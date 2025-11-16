// src/app/api/public/holds/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  court_id: z.string().uuid(),
  start: z.string().datetime(), // ISO con Z
  end: z.string().datetime(),
  customer_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = BodySchema.parse(json);

    const start = new Date(parsed.start);
    const end = new Date(parsed.end);

    if (!(start < end)) {
      return NextResponse.json(
        { ok: false, error: "Rango inválido: start debe ser < end" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx: { $queryRaw: any; reservation_hold: { create: (arg0: { data: { org_id: any; site_id: any; court_id: string; customer_id: string | null; starts_at: Date; ends_at: Date; }; select: { id: boolean; org_id: boolean; site_id: boolean; court_id: boolean; customer_id: boolean; starts_at: boolean; ends_at: boolean; expires_at: boolean; status: boolean; created_at: boolean; }; }) => any; }; }) => {
      // 1) Bloquear la cancha (SELECT ... FOR UPDATE)
      const courts = await tx.$queryRaw<
        {
          id: string;
          org_id: string;
          site_id: string;
          buffer_before_minutes: number;
          buffer_after_minutes: number;
        }[]
      >`
        SELECT c.id, c.org_id, c.site_id, c.buffer_before_minutes, c.buffer_after_minutes
        FROM public.court c
        WHERE c.id = ${parsed.court_id}::uuid
        FOR UPDATE
      `;

      const court = courts[0];

      if (!court) {
        throw new Error("COURT_NOT_FOUND");
      }

      // 2) Aplicar buffers a la ventana efectiva
      const effectiveStart = new Date(
        start.getTime() - court.buffer_before_minutes * 60_000,
      );
      const effectiveEnd = new Date(
        end.getTime() + court.buffer_after_minutes * 60_000,
      );

      // 3) Validar contra BLACKOUTS (tabla real: court_blackout, columna period tstzrange)
      const blackoutCheck = await tx.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM public.court_blackout b
          WHERE b.court_id = ${parsed.court_id}::uuid
            AND b.period && tstzrange(
              ${effectiveStart}::timestamptz,
              ${effectiveEnd}::timestamptz,
              '[)'
            )
          FOR SHARE
        ) AS exists
      `;

      if (blackoutCheck[0]?.exists) {
        throw new Error("NOT_AVAILABLE");
      }

      // 4) Validar contra RESERVAS CONFIRMADAS
      const reservationCheck = await tx.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM public.reservation r
          WHERE r.court_id = ${parsed.court_id}::uuid
            AND r.status = 'CONFIRMED'
            AND tstzrange(r.start_time, r.end_time, '[)') && tstzrange(
              ${effectiveStart}::timestamptz,
              ${effectiveEnd}::timestamptz,
              '[)'
            )
          FOR SHARE
        ) AS exists
      `;

      if (reservationCheck[0]?.exists) {
        throw new Error("NOT_AVAILABLE");
      }

      // 5) Validar contra HOLDS ACTIVOS / NO EXPIRADOS (reservation_hold)
      const holdCheck = await tx.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM public.reservation_hold h
          WHERE h.court_id = ${parsed.court_id}::uuid
            AND h.status = 'ACTIVE'
            AND h.expires_at > now()
            AND tstzrange(h.starts_at, h.ends_at, '[)') && tstzrange(
              ${effectiveStart}::timestamptz,
              ${effectiveEnd}::timestamptz,
              '[)'
            )
          FOR SHARE
        ) AS exists
      `;

      if (holdCheck[0]?.exists) {
        throw new Error("NOT_AVAILABLE");
      }

      // 6) Crear el HOLD (usa defaults de expires_at y status en la BD)
      const hold = await tx.reservation_hold.create({
        data: {
          org_id: court.org_id,
          site_id: court.site_id,
          court_id: parsed.court_id,
          customer_id: parsed.customer_id ?? null,
          starts_at: start,
          ends_at: end,
        },
        select: {
          id: true,
          org_id: true,
          site_id: true,
          court_id: true,
          customer_id: true,
          starts_at: true,
          ends_at: true,
          expires_at: true,
          status: true,
          created_at: true,
        },
      });

      return hold;
    });

    return NextResponse.json(
      {
        ok: true,
        hold: result,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error(err);

    if (err.message === "COURT_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Cancha no encontrada" },
        { status: 404 },
      );
    }

    if (err.message === "NOT_AVAILABLE") {
      return NextResponse.json(
        { ok: false, error: "El rango seleccionado no está disponible" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: err.message ?? "Error" },
      { status: 400 },
    );
  }
}
