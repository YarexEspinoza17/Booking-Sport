import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PriceRuleCreateZ } from "@/lib/validation/pricing";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
) {
  const rows = await prisma.price_rule.findMany({
    where: { org_id: params.orgId, court_id: params.courtId },
    orderBy: [{ created_at: "asc" }, { id: "asc" }], // última creada "gana" en el resolver
  });
  return NextResponse.json({ ok: true, data: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
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

  // Guardamos HH:mm en columnas @db.Time(6). Prisma lo modela como Date, usamos época 1970-01-01.
  const startAsDate = d.start_local ? new Date(`1970-01-01T${d.start_local}:00.000Z`) : null;
  const endAsDate   = d.end_local   ? new Date(`1970-01-01T${d.end_local}:00.000Z`)   : null;

  const created = await prisma.price_rule.create({
    data: {
      org_id: params.orgId,
      court_id: params.courtId,
      dow: d.dow ?? null,
      start_local: startAsDate as any,
      end_local: endAsDate as any,
      multiplier: d.multiplier === undefined ? null : d.multiplier,
      add_int: d.add_int ?? null,
    },
  });

  return NextResponse.json({ ok: true, data: created });
}
