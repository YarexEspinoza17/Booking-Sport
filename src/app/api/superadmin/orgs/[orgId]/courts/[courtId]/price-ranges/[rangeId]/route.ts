import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CourtPriceRangeCreateZ } from "@/lib/validation/pricing";

type Params = { params: { orgId: string; courtId: string; rangeId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { orgId, courtId, rangeId } = params;

  const row = await prisma.court_price_range.findFirst({
    where: { id: rangeId, org_id: orgId, court_id: courtId },
  });

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Rango no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, data: row });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { orgId, courtId, rangeId } = params;

  const body = await req.json();
  const parsed = CourtPriceRangeCreateZ.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  const startAsDate = new Date(`1970-01-01T${d.start_local}:00.000Z`);
  const endAsDate = new Date(`1970-01-01T${d.end_local}:00.000Z`);

  try {
    const updated = await prisma.court_price_range.update({
      where: { id: rangeId },
      data: {
        org_id: orgId,
        court_id: courtId,
        dow: d.dow,
        start_local: startAsDate as any,
        end_local: endAsDate as any,
        amount_int: d.amount_int,
        currency: d.currency,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("Error actualizando court_price_range", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo actualizar el rango de precio" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { orgId, courtId, rangeId } = params;

  const existing = await prisma.court_price_range.findFirst({
    where: { id: rangeId, org_id: orgId, court_id: courtId },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Rango no encontrado" },
      { status: 404 }
    );
  }

  await prisma.court_price_range.delete({
    where: { id: existing.id },
  });

  return NextResponse.json({ ok: true });
}
