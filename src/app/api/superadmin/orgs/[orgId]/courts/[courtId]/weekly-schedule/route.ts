import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpsertSchema = z.object({
  dow: z.number().int().min(0).max(6),
  start_local: z.string().regex(/^\d{2}:\d{2}$/), // "HH:mm"
  end_local: z.string().regex(/^\d{2}:\d{2}$/),   // "HH:mm"
});

function timeToDate(hhmm: string): Date {
  // 1970-01-01 + HH:mm, usando Z para que sea estable
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

// Date 1970-01-01T08:00:00.000Z -> "08:00"
function dateToHHMM(value: Date | null): string {
  if (!value) return "";
  return value.toISOString().substring(11, 16);
}

/**
 * Comprueba si la nueva franja se solapa con alguna existente
 * en el mismo court + dow.
 */
async function hasOverlap(
  orgId: string,
  courtId: string,
  dow: number,
  start: Date,
  end: Date
): Promise<boolean> {
  const overlapping = await prisma.court_weekly_schedule.findFirst({
    where: {
      org_id: orgId,
      court_id: courtId,
      dow,
      OR: [{ is_deleted: false }, { is_deleted: null }],
      // solapamiento: start < end_existente && start_existente < end
      start_local: { lt: end },
      end_local: { gt: start },
    },
  });

  return !!overlapping;
}

/**
 * GET: lista el horario semanal de esa cancha, devolviendo HH:mm
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
) {
  try {
    const rows = await prisma.court_weekly_schedule.findMany({
      where: {
        org_id: params.orgId,
        court_id: params.courtId,
        OR: [{ is_deleted: false }, { is_deleted: null }],
      },
      orderBy: [
        { dow: "asc" },
        { start_local: "asc" }, // para que las franjas del mismo día salgan ordenadas
      ],
    });

    const data = rows.map((r) => ({
      id: r.id,
      dow: r.dow,
      start_local: dateToHHMM(r.start_local),
      end_local: dateToHHMM(r.end_local),
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error("GET weekly-schedule error", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Error" },
      { status: 500 }
    );
  }
}

/**
 * POST: crea una NUEVA franja (ya no se hace upsert por dow).
 * Permite varias franjas por día mientras las horas no se solapen.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
) {
  try {
    const json = await req.json();
    const parsed = UpsertSchema.parse(json);

    const startDate = timeToDate(parsed.start_local);
    const endDate = timeToDate(parsed.end_local);

    // Validación básica: hora de inicio < hora de fin
    if (startDate >= endDate) {
      return NextResponse.json(
        { ok: false, error: "La hora de apertura debe ser menor que la de cierre." },
        { status: 400 }
      );
    }

    // Validar solapamiento con otras franjas del mismo día
    const overlaps = await hasOverlap(
      params.orgId,
      params.courtId,
      parsed.dow,
      startDate,
      endDate
    );

    if (overlaps) {
      return NextResponse.json(
        {
          ok: false,
          error: "La franja se solapa con otra franja del mismo día para esta cancha.",
        },
        { status: 409 }
      );
    }

    // Crear SIEMPRE una nueva fila (ya no se busca/actualiza por dow)
    const row = await prisma.court_weekly_schedule.create({
      data: {
        org_id: params.orgId,
        court_id: params.courtId,
        dow: parsed.dow,
        start_local: startDate as any,
        end_local: endDate as any,
      },
    });

    const data = {
      id: row.id,
      dow: row.dow,
      start_local: dateToHHMM(row.start_local),
      end_local: dateToHHMM(row.end_local),
    };

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e: any) {
    console.error("POST weekly-schedule error", e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Error" },
      { status: 400 }
    );
  }
}
