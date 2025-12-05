// app/api/superadmin/orgs/[orgId]/courts/[courtId]/blackouts/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, bad, toInt } from "@/lib/api";
import { BlackoutCreateSchema } from "@/lib/validators";

export async function GET(req: NextRequest, { params }: { params: { orgId: string; courtId: string } }) {
  try {
    const url = new URL(req.url);

    // Normaliza page/per
    const rawPage = toInt(url.searchParams.get("page"), 1);
    const rawPer  = toInt(url.searchParams.get("per"), 20);

    const page = Math.max(1, rawPage);          // nunca < 1
    const per  = Math.min(100, Math.max(1, rawPer)); // 1..100
    const skip = (page - 1) * per;              // nunca negativo

    const where = { org_id: params.orgId, court_id: params.courtId, is_deleted: false };

    const [rows, total] = await Promise.all([
      prisma.court_blackout.findMany({
        where,
        orderBy: { starts_at: "desc" },
        skip,
        take: per,
      }),
      prisma.court_blackout.count({ where }),
    ]);

    return ok({ rows, page, per, total });
  } catch (err: any) {
    console.error("GET /blackouts error:", err);
    return bad(err?.message ?? "Internal error", 500);
  }
}


export async function POST(req: NextRequest, { params }: { params: { orgId: string; courtId: string } }) {
  try {
    const raw = await req.json();
    const dto = BlackoutCreateSchema.parse(raw); // dto.starts_at y dto.ends_at son Date

    if (!(dto.starts_at < dto.ends_at)) {
      return bad("starts_at debe ser menor a ends_at", 422);
    }

    const row = await prisma.court_blackout.create({
      data: {
        org_id:   params.orgId,
        court_id: params.courtId,
        starts_at: dto.starts_at,
        ends_at:   dto.ends_at,
        reason:    dto.reason ?? null,
      },
    });

    return ok(row);
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.toLowerCase().includes("exclusion")) {
      return bad("Solapamiento de blackouts para esta cancha.", 409);
    }
    return bad(err?.message ?? "Error", 400);
  }
}

