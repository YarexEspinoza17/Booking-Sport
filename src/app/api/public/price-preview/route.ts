// src/app/api/public/price-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computePriceInt } from "@/lib/price-engine";
import { isAvailable } from "@/lib/availability";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const { siteId, courtId, startsAt, endsAt } = body as {
      siteId?: string;
      courtId?: string;
      startsAt?: string;
      endsAt?: string;
    };

    if (!siteId || !courtId || !startsAt || !endsAt) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const starts = new Date(startsAt);
    const ends = new Date(endsAt);

    if (
      !(starts instanceof Date) ||
      !(ends instanceof Date) ||
      isNaN(starts.getTime()) ||
      isNaN(ends.getTime()) ||
      ends <= starts
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid date range" },
        { status: 400 },
      );
    }

    // Encontrar org a partir de site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { org_id: true },
    });

    if (!site) {
      return NextResponse.json(
        { ok: false, error: "Site not found" },
        { status: 404 },
      );
    }

    // Calcular precio (usa el motor de precios)
    const { priceInt, currency } = await computePriceInt(
      site.org_id,
      courtId,
      starts,
      ends,
    );

    // Ver disponibilidad
    const available = await isAvailable(
      courtId,
      starts.toISOString(),
      ends.toISOString(),
    );

    return NextResponse.json({
      ok: true,
      priceInt,
      currency, // "CRC" | "USD"
      available,
    });
  } catch (error) {
    console.error("Error en /price-preview:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
