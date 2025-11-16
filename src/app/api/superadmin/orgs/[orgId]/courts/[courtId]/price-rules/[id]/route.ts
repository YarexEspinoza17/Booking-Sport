import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PriceRuleCreateZ } from "@/lib/validation/pricing";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const parsed = PriceRuleCreateZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const startAsDate = d.start_local ? new Date(`1970-01-01T${d.start_local}:00.000Z`) : null;
  const endAsDate   = d.end_local   ? new Date(`1970-01-01T${d.end_local}:00.000Z`)   : null;

  const updated = await prisma.price_rule.update({
    where: { id: params.id },
    data: {
      dow: d.dow ?? null,
      start_local: startAsDate as any,
      end_local: endAsDate as any,
      multiplier: d.multiplier === undefined ? null : d.multiplier,
      add_int: d.add_int ?? null,
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.price_rule.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
