// app/api/superadmin/orgs/[orgId]/courts/[courtId]/weekly-schedule/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, bad } from "@/lib/api";
import { WeeklyCreateSchema } from "@/lib/validators";

function toHHmm(value: any): string {
  // Prisma @db.Time(6) suele serializar a "1970-01-01THH:mm:SS.sssZ" o "HH:mm:ss"
  // Soportamos ambos formatos y normalizamos a "HH:mm"
  if (!value) return "";
  const s = String(value);

  // Caso ISO con fecha ficticia
  const isoMatch = s.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;

  // Caso "HH:mm:ss" o "HH:mm"
  const hmMatch = s.match(/^(\d{2}):(\d{2})/);
  if (hmMatch) return `${hmMatch[1]}:${hmMatch[2]}`;

  return s; // fallback
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { orgId: string; courtId: string } }
) {
  try {
    const { orgId, courtId } = params;

    const rows = await prisma.court_weekly_schedule.findMany({
      where: { org_id: orgId, court_id: courtId, is_deleted: false },
      orderBy: [{ dow: "asc" }, { start_local: "asc" }],
    });

    // Normaliza a DTO "HH:mm"
    const data = rows.map((x) => ({
      id: x.id,
      dow: x.dow,
      start_local: toHHmm(x.start_local as any),
      end_local: toHHmm(x.end_local as any),
      // si necesitas otros campos, añádelos aquí
    }));

    return ok(data);
  } catch (err: any) {
    console.error("GET /weekly-schedule error:", err);
    return bad(err?.message ?? "Internal error", 500);
  }
}

function hhmmToDate(hhmm: string): Date {
  // convierte "HH:mm" a Date 1970-01-01 HH:mm (solo se usa por Prisma/pg)
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
  return d;
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string; courtId: string } }) {
  try {
    const body = await req.json();
    const dto = WeeklyCreateSchema.parse(body);

    const start = hhmmToDate(dto.start_local);
    const end = hhmmToDate(dto.end_local);
    if (!(start < end)) return bad("start_local debe ser menor a end_local", 422);

    const row = await prisma.court_weekly_schedule.create({
      data: {
        org_id: params.orgId,
        court_id: params.courtId,
        dow: dto.dow,
        start_local: start as any, // Prisma @db.Time(6)
        end_local: end as any,
      },
    });

    return ok(row);
  } catch (err: any) {
    // Exclusion violation => 409
    if (err?.message?.toLowerCase?.().includes("exclusion")) {
      return bad("Solapamiento de franja en el mismo día para esta cancha.", 409);
    }
    return bad(err?.message ?? "Error", 400);
  }
}
