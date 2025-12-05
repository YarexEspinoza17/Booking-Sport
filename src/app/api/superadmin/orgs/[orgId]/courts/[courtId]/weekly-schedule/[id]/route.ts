// app/api/superadmin/orgs/[orgId]/courts/[courtId]/weekly-schedule/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, bad } from "@/lib/api";
import { WeeklyUpdateSchema } from "@/lib/validators";

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  // Fecha fija 1970-01-01 en UTC
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
}

/**
 * Comprueba si la franja propuesta se solapa con otra franja
 * del mismo court + dow, excluyendo la franja actual.
 */
async function hasOverlapOnUpdate(
  orgId: string,
  courtId: string,
  dow: number,
  start: Date,
  end: Date,
  excludeId: string
): Promise<boolean> {
  const overlapping = await prisma.court_weekly_schedule.findFirst({
    where: {
      org_id: orgId,
      court_id: courtId,
      dow,
      OR: [{ is_deleted: false }, { is_deleted: null }],
      id: { not: excludeId },
      // solapamiento: start < end_existente && start_existente < end
      start_local: { lt: end },
      end_local: { gt: start },
    },
  });

  return !!overlapping;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgId: string; courtId: string; id: string } }
) {
  try {
    const body = await req.json();
    const dto = WeeklyUpdateSchema.parse(body);

    // 1) Cargar la fila actual para conocer valores existentes
    const current = await prisma.court_weekly_schedule.findFirst({
      where: {
        id: params.id,
        org_id: params.orgId,
        court_id: params.courtId,
        OR: [{ is_deleted: false }, { is_deleted: null }],
      },
    });

    if (!current) {
      return bad("Franja no encontrada", 404);
    }

    // 2) Calcular los valores resultantes (lo que quedará después del PATCH)
    const newDow =
      typeof dto.dow === "number" ? dto.dow : current.dow;

    const newStart =
      dto.start_local ? hhmmToDate(dto.start_local) : current.start_local;

    const newEnd =
      dto.end_local ? hhmmToDate(dto.end_local) : current.end_local;

    // 3) Validar orden de horas
    if (!(newStart < newEnd)) {
      return bad("start_local debe ser menor a end_local", 422);
    }

    // 4) Validar solapamiento con otras filas del mismo día/cancha
    const overlaps = await hasOverlapOnUpdate(
      params.orgId,
      params.courtId,
      newDow,
      newStart,
      newEnd,
      params.id
    );

    if (overlaps) {
      return bad(
        "La franja se solapa con otra franja del mismo día para esta cancha.",
        409
      );
    }

    // 5) Construir el objeto data a actualizar
    const data: any = {};
    if (typeof dto.dow === "number") data.dow = dto.dow;
    if (dto.start_local) data.start_local = newStart as any;
    if (dto.end_local) data.end_local = newEnd as any;

    const row = await prisma.court_weekly_schedule.update({
      where: { id: params.id },
      data,
    });

    return ok(row);
  } catch (err: any) {
    // Si además tienes una EXCLUDE en BD, esto sigue siendo útil como fallback
    if (err?.message?.toLowerCase?.().includes("exclusion")) {
      return bad(
        "Solapamiento de franja en el mismo día para esta cancha.",
        409
      );
    }
    return bad(err?.message ?? "Error", 400);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { orgId: string; courtId: string; id: string } }
) {
  const row = await prisma.court_weekly_schedule.update({
    where: { id: params.id },
    data: { is_deleted: true, deleted_at: new Date() },
  });
  return ok(row);
}
