// src/app/api/superadmin/orgs/[orgId]/court-types/[typeId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

export const runtime = "nodejs";

async function ensureSuperAdmin(req: Request) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return (token as any)?.role === "SUPER_ADMIN";
}

const patchSchema = z.object({
  code: z.string().min(2).max(60).optional(),
  name: z.string().min(2).max(120).optional(),
});

export async function PATCH(req: Request, ctx: { params: { orgId: string; typeId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { orgId, typeId } = ctx.params;
    const data = patchSchema.parse(await req.json().catch(() => ({})));

    const updated = await prisma.court_type.update({
      where: { id: typeId },
      data: { ...(data.code ? { code: data.code.trim() } : {}), ...(data.name ? { name: data.name.trim() } : {}) },
      select: { id: true, org_id: true, code: true, name: true, created_at: true, is_deleted: true },
    });
    if (updated.org_id !== orgId) return NextResponse.json({ ok: false, error: "No pertenece a la organización" }, { status: 403 });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err: any) {
    if (err?.name === "ZodError") return NextResponse.json({ ok: false, error: err.flatten() }, { status: 400 });
    if (err?.code === "P2025") return NextResponse.json({ ok: false, error: "Tipo no encontrado" }, { status: 404 });
    if (String(err?.message || "").toLowerCase().includes("unique"))
      return NextResponse.json({ ok: false, error: "El código ya existe" }, { status: 409 });
    console.error("court-types.[id].PATCH", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: { orgId: string; typeId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { orgId, typeId } = ctx.params;

    const current = await prisma.court_type.findUnique({
      where: { id: typeId },
      select: { id: true, org_id: true, is_deleted: true },
    });
    if (!current) return NextResponse.json({ ok: false, error: "Tipo no encontrado" }, { status: 404 });
    if (current.org_id !== orgId) return NextResponse.json({ ok: false, error: "No pertenece a la organización" }, { status: 403 });
    if (current.is_deleted) return NextResponse.json({ ok: false, error: "Ya estaba eliminado" }, { status: 409 });

    await prisma.court_type.update({ where: { id: typeId }, data: { is_deleted: true, deleted_at: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("court-types.[id].DELETE", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
