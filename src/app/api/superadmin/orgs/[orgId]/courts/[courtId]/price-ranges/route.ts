import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CourtPriceRangeCreateZ } from "@/lib/validation/pricing";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
) {
  const { orgId, courtId } = params;

  const rows = await prisma.court_price_range.findMany({
    where: { org_id: orgId, court_id: courtId },
    orderBy: [{ dow: "asc" }, { start_local: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
) {
  const { orgId, courtId } = params;

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
    const created = await prisma.court_price_range.create({
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

    return NextResponse.json({ ok: true, data: created });
  } catch (err) {
    console.error("Error creando court_price_range", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo crear el rango de precio" },
      { status: 500 }
    );
  }
}
