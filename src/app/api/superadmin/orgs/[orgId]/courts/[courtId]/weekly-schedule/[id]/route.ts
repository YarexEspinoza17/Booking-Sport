// app/api/superadmin/orgs/[orgId]/courts/[courtId]/weekly-schedule/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, bad } from "@/lib/api";
import { WeeklyUpdateSchema } from "@/lib/validators";

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
  return d;
}

export async function PATCH(req: NextRequest, { params }: { params: { orgId: string; courtId: string; id: string } }) {
  try {
    const body = await req.json();
    const dto = WeeklyUpdateSchema.parse(body);

    const data: any = {};
    if (typeof dto.dow === "number") data.dow = dto.dow;
    if (dto.start_local) data.start_local = hhmmToDate(dto.start_local) as any;
    if (dto.end_local) data.end_local = hhmmToDate(dto.end_local) as any;

    if (data.start_local && data.end_local && !(data.start_local < data.end_local)) {
      return bad("start_local debe ser menor a end_local", 422);
    }

    const row = await prisma.court_weekly_schedule.update({
      where: { id: params.id },
      data,
    });

    return ok(row);
  } catch (err: any) {
    if (err?.message?.toLowerCase?.().includes("exclusion")) {
      return bad("Solapamiento de franja en el mismo día para esta cancha.", 409);
    }
    return bad(err?.message ?? "Error", 400);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const row = await prisma.court_weekly_schedule.update({
    where: { id: params.id },
    data: { is_deleted: true, deleted_at: new Date() },
  });
  return ok(row);
}
