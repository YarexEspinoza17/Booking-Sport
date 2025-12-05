// app/api/public/orgs/[orgSlug]/courts/[courtId]/price/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveCourtPriceSimple } from "@/lib/pricing/resolve";
import { prisma } from "@/lib/prisma";

async function orgIdFromSlug(slug: string) {
  const org = await prisma.org.findUnique({ where: { slug } });
  if (!org) throw new Error("Organización no encontrada");
  return { id: org.id, tz: "America/Costa_Rica" }; // si tienes tz por sede/org, léela aquí
}

export async function GET(req: NextRequest, { params }: { params: { orgSlug: string, courtId: string } }) {
  const { searchParams } = new URL(req.url);
  const starts_at = searchParams.get("starts_at");
  if (!starts_at) {
    return NextResponse.json({ ok: false, error: "starts_at (ISO con zona) es requerido" }, { status: 400 });
  }
  try {
    const { id: orgId, tz } = await orgIdFromSlug(params.orgSlug);
    const data = await resolveCourtPriceSimple({
      orgId,
      courtId: params.courtId,
      startsAtISO: starts_at,
      orgTimeZone: tz,
    });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
