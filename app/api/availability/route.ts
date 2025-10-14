import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/client";
import { getOrganizationFromRequest } from "@/src/lib/tenancy";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const courtId = searchParams.get("courtId");
  const date = searchParams.get("date"); // YYYY-MM-DD

  const { organizationId } = await getOrganizationFromRequest();
  if (!organizationId) return NextResponse.json({ error: "Org no resuelta" }, { status: 400 });
  if (!courtId || !date) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });

  // TODO: implementar lógica real de slots (franjas, buffers).
  // Por ahora devolvemos reservas existentes para ese día.
  const dayStart = new Date(date + "T00:00:00.000Z");
  const dayEnd = new Date(date + "T23:59:59.999Z");

  const reservations = await prisma.reservation.findMany({
    where: {
      organizationId,
      courtId,
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
      status: { in: ["HELD", "PENDING_PAYMENT", "CONFIRMED"] }
    },
    select: { id: true, startTime: true, endTime: true, status: true }
  });

  return NextResponse.json({ reservations });
}
