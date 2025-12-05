// app/api/public/reservations/[code]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {prisma} from "@/lib/prisma";
import { requireOrgFromRequest } from "@/lib/org-context";

interface Params {
  params: { code: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { org, error } = await requireOrgFromRequest(req);

  if (!org) {
    return NextResponse.json(
      { ok: false, error },
      { status: 400 },
    );
  }

  const { code } = params;

  const reservation = await prisma.reservation.findFirst({
    where: {
      code,          // campo de tu modelo
      org_id: org.id // te aseguras que no se vea otra org
    },
    include: {
      site: true,
      court: true,
      customer: true,
    },
  });

  if (!reservation) {
    return NextResponse.json(
      { ok: false, error: "Reserva no encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, data: reservation });
}
