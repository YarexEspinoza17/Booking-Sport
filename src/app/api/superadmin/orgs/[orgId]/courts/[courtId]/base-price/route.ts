import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BasePriceUpsertZ } from "@/lib/validation/pricing";
import { ccy } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
) {
  const row = await prisma.court_base_price.findUnique({
    where: { court_id: params.courtId }
  });
  return NextResponse.json({ ok: true, data: row ?? null });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
) {
  const body = await req.json();
  const parsed = BasePriceUpsertZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { currency, amount_int } = parsed.data;

  const data = await prisma.court_base_price.upsert({
    where: { court_id: params.courtId },
    update: { currency: currency as ccy, amount_int },
    create: {
      org_id: params.orgId,
      court_id: params.courtId,
      currency: currency as ccy,
      amount_int,
    },
  });

  return NextResponse.json({ ok: true, data });
}
