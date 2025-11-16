// app/api/superadmin/orgs/[orgId]/courts/[courtId]/blackouts/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, bad } from "@/lib/api";
import { BlackoutUpdateSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const dto = BlackoutUpdateSchema.parse(body);

    const data: any = {};
    if (dto.starts_at) data.starts_at = new Date(dto.starts_at);
    if (dto.ends_at)   data.ends_at = new Date(dto.ends_at);
    if ("reason" in dto) data.reason = dto.reason ?? null;

    if (data.starts_at && data.ends_at && !(data.starts_at < data.ends_at)) {
      return bad("starts_at debe ser menor a ends_at", 422);
    }

    const row = await prisma.court_blackout.update({ where: { id: params.id }, data });
    return ok(row);
  } catch (err: any) {
    if (err?.message?.toLowerCase?.().includes("exclusion")) {
      return bad("Solapamiento de blackouts para esta cancha.", 409);
    }
    return bad(err?.message ?? "Error", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const row = await prisma.court_blackout.update({
    where: { id: params.id },
    data: { is_deleted: true, deleted_at: new Date() },
  });
  return ok(row);
}
