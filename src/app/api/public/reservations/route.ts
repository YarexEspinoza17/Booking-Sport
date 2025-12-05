// src/app/api/public/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgFromRequest } from "@/lib/org-from-request";
import { z } from "zod";
import { computePriceInt } from "@/lib/price-engine";

const BodySchema = z.object({
  siteId: z.string().uuid(),
  courtId: z.string().uuid(),
  startsAt: z.string().datetime(), // ISO
  endsAt: z.string().datetime(),   // ISO
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
});

function generateReservationCode(len = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    // 🔹 Importante: usar el helper con el request
    const org = await getOrgFromRequest(req);
    if (!org) {
      return NextResponse.json(
        { ok: false, error: "Organización no encontrada." },
        { status: 400 },
      );
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Parámetros incompletos.",
          details: parsed.error.format(),
        },
        { status: 400 },
      );
    }

    const {
      siteId,
      courtId,
      startsAt,
      endsAt,
      customerName,
      customerEmail,
    } = parsed.data;

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (!(start < end) || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Rango de fechas inválido." },
        { status: 400 },
      );
    }

    const code = generateReservationCode();

    const reservation = await prisma.$transaction(async (tx) => {
      // 1) Obtener cancha y buffers, validando organización
      const court = await tx.court.findUnique({
        where: { id: courtId },
        select: {
          id: true,
          org_id: true,
          site_id: true,
          buffer_before_minutes: true,
          buffer_after_minutes: true,
        },
      });

      if (!court || court.org_id !== org.id) {
        throw new Error("COURT_NOT_FOUND");
      }

      // (Opcional) validar que la cancha pertenezca a la sede recibida
      // if (court.site_id !== siteId) {
      //   throw new Error("COURT_SITE_MISMATCH");
      // }

      // 2) Crear / reutilizar Customer dentro de la misma transacción
      const trimmedName = customerName.trim();
      const trimmedEmail = customerEmail?.trim();

      let customerId: string | null = null;

      if (trimmedEmail) {
        // Buscar cliente por (org_id, email)
        const existing = await tx.customer.findFirst({
          where: {
            org_id: org.id,
            email: trimmedEmail,
          },
        });

        let customer;
        if (existing) {
          // Actualizar solo nombre
          customer = await tx.customer.update({
            where: { id: existing.id },
            data: {
              full_name: trimmedName,
            },
          });
        } else {
          // Crear nuevo cliente
          customer = await tx.customer.create({
            data: {
              org_id: org.id,
              full_name: trimmedName,
              email: trimmedEmail,
            },
          });
        }

        customerId = customer.id;
      } else {
        // Sin correo: siempre se crea un nuevo cliente con nombre
        const customer = await tx.customer.create({
          data: {
            org_id: org.id,
            full_name: trimmedName,
            // email queda null
          },
        });
        customerId = customer.id;
      }

      // 3) Aplicar buffers y validar disponibilidad (blackouts + reservas confirmadas)
      const effectiveStart = new Date(
        start.getTime() - court.buffer_before_minutes * 60_000,
      );
      const effectiveEnd = new Date(
        end.getTime() + court.buffer_after_minutes * 60_000,
      );

      const blackoutCheck = await tx.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM public.court_blackout b
          WHERE b.court_id = ${courtId}::uuid
            AND b.period && tstzrange(
              ${effectiveStart}::timestamptz,
              ${effectiveEnd}::timestamptz,
              '[)'
            )
        ) AS exists
      `;
      if (blackoutCheck[0]?.exists) {
        throw new Error("NOT_AVAILABLE");
      }

      const reservationCheck = await tx.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM public.reservation r
          WHERE r.court_id = ${courtId}::uuid
            AND r.status = 'CONFIRMED'
            AND tstzrange(r.start_time, r.end_time, '[)') && tstzrange(
              ${effectiveStart}::timestamptz,
              ${effectiveEnd}::timestamptz,
              '[)'
            )
        ) AS exists
      `;
      if (reservationCheck[0]?.exists) {
        throw new Error("NOT_AVAILABLE");
      }

      // 4) Calcular precio definitivo (usa el nuevo motor de rangos horarios)
      const { priceInt, currency } = await computePriceInt(
        org.id,
        courtId,
        start,
        end,
      );

      // 5) Crear reserva CONFIRMED
      const inserted = await tx.$queryRaw<
        {
          id: string;
          code: string;
          status: string;
          start_time: Date;
          end_time: Date;
          price_int: number;
          currency: string;
        }[]
      >`
        INSERT INTO public.reservation (
          org_id,
          site_id,
          court_id,
          customer_id,
          start_time,
          end_time,
          effective_range,
          currency,
          price_int,
          status,
          code
        )
        VALUES (
          ${org.id}::uuid,
          ${siteId}::uuid,
          ${courtId}::uuid,
          ${customerId}::uuid,
          ${start}::timestamptz,
          ${end}::timestamptz,
          tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)'),
          ${currency},
          ${priceInt}::int,
          'CONFIRMED',
          ${code}
        )
        RETURNING id, code, status, start_time, end_time, price_int, currency
      `;

      return inserted[0];
    });

    return NextResponse.json(
      { ok: true, reservation },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("POST /api/public/reservations error", err);

    if (err.message === "COURT_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Cancha no encontrada." },
        { status: 404 },
      );
    }

    if (err.message === "NOT_AVAILABLE") {
      return NextResponse.json(
        {
          ok: false,
          error: "El horario seleccionado ya no está disponible.",
        },
        { status: 409 },
      );
    }

    if (err.message === "NO_BASE_PRICE") {
      // compatibilidad por si algo viejo lanza esto todavía
      return NextResponse.json(
        {
          ok: false,
          error: "No hay precio base configurado para esta cancha.",
        },
        { status: 500 },
      );
    }

    if (err.message === "NO_PRICE_RANGE") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hay un rango de precio configurado para la fecha y hora seleccionadas.",
        },
        { status: 500 },
      );
    }

    if (err.message === "INVALID_RANGE") {
      return NextResponse.json(
        { ok: false, error: "Rango de fechas inválido." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Error interno al crear la reserva." },
      { status: 500 },
    );
  }
}
