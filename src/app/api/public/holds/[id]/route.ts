// app/api/public/holds/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Body = z.object({ customer_id: z.string().uuid() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { customer_id } = Body.parse(await req.json());
    const hold = await prisma.reservation_hold.findUnique({ where: { id: params.id } });
    if (!hold) return NextResponse.json({ ok: false, error: "Hold no encontrado" }, { status: 404 });
    if (hold.status !== "ACTIVE" || hold.expires_at <= new Date())
      return NextResponse.json({ ok: false, error: "Hold no activo o expirado" }, { status: 409 });

    await prisma.reservation_hold.update({
      where: { id: hold.id },
      data: { customer_id },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Error" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const hold = await prisma.reservation_hold.findUnique({ where: { id: params.id } });
    if (!hold) return NextResponse.json({ ok: false, error: "Hold no encontrado" }, { status: 404 });

    if (hold.status === "ACTIVE") {
      const updated = await prisma.reservation_hold.update({
        where: { id: params.id },
        data: { status: "RELEASED" },
        select: { id: true, status: true }
      });
      return NextResponse.json({ ok: true, hold: updated });
    }
    return NextResponse.json({ ok: true, hold: { id: hold.id, status: hold.status } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Error" }, { status: 400 });
  }
}
