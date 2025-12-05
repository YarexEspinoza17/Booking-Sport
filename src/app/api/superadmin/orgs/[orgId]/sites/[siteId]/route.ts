import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

async function ensureSuperAdmin(req: Request) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return (token as any)?.role === "SUPER_ADMIN";
}

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  timezone: z.string().min(2).max(60).optional(),
  address: z.string().max(200).nullable().optional(),
}).refine(
  (v) => v.name !== undefined || v.timezone !== undefined || v.address !== undefined,
  { message: "Debe enviar al menos un campo: name, timezone o address" }
);

// PATCH /api/superadmin/orgs/[orgId]/sites/[siteId]
export async function PATCH(req: Request, { params }: { params: { orgId: string, siteId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { orgId, siteId } = params;
    if (!isUuid(orgId) || !isUuid(siteId)) {
      return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
    }

    const body = await req.json();
    const data = patchSchema.parse(body);

    // opcional: verificar que la sede pertenece a esa org
    const exists = await prisma.site.findFirst({
      where: { id: siteId, org_id: orgId, is_deleted: false },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ ok: false, error: "Sede no encontrada" }, { status: 404 });
    }

    const updated = await prisma.site.update({
      where: { id: siteId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
      },
      select: { id: true, name: true, timezone: true, address: true, org_id: true, created_at: true },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ ok: false, error: e.errors?.[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }
    console.error("sites.[siteId].PATCH", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

// DELETE (soft) /api/superadmin/orgs/[orgId]/sites/[siteId]
export async function DELETE(req: Request, { params }: { params: { orgId: string, siteId: string } }) {

  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { orgId, siteId } = params;
    if (!isUuid(orgId) || !isUuid(siteId)) {
      return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
    }

    // verificar que exista y pertenece a la org
    const current = await prisma.site.findFirst({
      where: { id: siteId, org_id: orgId },
      select: { id: true, is_deleted: true },
    });
    if (!current) {
      return NextResponse.json({ ok: false, error: "Sede no encontrada" }, { status: 404 });
    }
    if (current.is_deleted) {
      return NextResponse.json({ ok: false, error: "La sede ya estaba eliminada" }, { status: 409 });
    }

    const deleted = await prisma.site.update({
      where: { id: siteId },
      data: { is_deleted: true, deleted_at: new Date() },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, item: deleted });
  } catch (e: any) {
    console.error("sites.[siteId].DELETE", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  } 

  
}
