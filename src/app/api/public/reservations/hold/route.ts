// src/app/api/public/reservations/hold/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAvailable } from "@/lib/availability";
import { getOrgFromRequest } from "@/lib/org-from-request";

const BodySchema = z.object({
  siteId: z.string().uuid(),
  courtId: z.string().uuid(),
  startsAt: z.string().datetime(), // ISO
  endsAt: z.string().datetime(),   // ISO
  // Si luego quieres ligar un cliente al hold puedes agregar customerId aquí
});

export async function POST(req: NextRequest) {
  try {
    const org = await getOrgFromRequest();
    if (!org) {
      return NextResponse.json(
        { ok: false, error: "Organización no encontrada" },
        { status: 400 },
      );
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Parámetros inválidos", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { siteId, courtId, startsAt, endsAt } = parsed.data;

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (!(startDate < endDate)) {
      return NextResponse.json(
        { ok: false, error: "Rango de fechas inválido" },
        { status: 400 },
      );
    }

    // 1) Validar disponibilidad (usa tu motor central)
    const available = await isAvailable(courtId, startsAt, endsAt);
    if (!available) {
      return NextResponse.json(
        { ok: false, error: "El horario ya no está disponible" },
        { status: 409 },
      );
    }

    // 2) Crear el HOLD en reservation_hold (sin precio ni moneda)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    const hold = await prisma.reservation_hold.create({
      data: {
        org_id: org.id,
        site_id: siteId,
        court_id: courtId,
        // customer_id: null, // opcional por ahora
        starts_at: startDate,
        ends_at: endDate,
        expires_at: expiresAt,
        status: "ACTIVE", // enum hold_status
      },
    });

    return NextResponse.json(
      {
        ok: true,
        hold: {
          id: hold.id,
          org_id: hold.org_id,
          site_id: hold.site_id,
          court_id: hold.court_id,
          starts_at: hold.starts_at,
          ends_at: hold.ends_at,
          expires_at: hold.expires_at,
          status: hold.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/public/reservations/hold error", error);
    return NextResponse.json(
      { ok: false, error: "Error interno al crear el hold" },
      { status: 500 },
    );
  }
}
