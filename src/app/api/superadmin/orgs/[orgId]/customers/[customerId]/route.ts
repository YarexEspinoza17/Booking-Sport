// /src/app/api/superadmin/orgs/[orgId]/customers/[customerId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function ensureBelongs(orgId: string, customerId: string) {
  return prisma.customer.findFirst({ where: { id: customerId, org_id: orgId } });
}

export async function PATCH(req: Request, { params }: { params: { orgId: string; customerId: string } }) {
  const exists = await ensureBelongs(params.orgId, params.customerId);
  if (!exists) return NextResponse.json({ ok: false, error: "Cliente no encontrado." }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  if (body.full_name !== undefined) data.full_name = body.full_name;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.email !== undefined) data.email = body.email?.toLowerCase?.();

  try {
    const updated = await prisma.customer.update({
      where: { id: params.customerId },
      data,
      select: { id: true, email: true, full_name: true, phone: true, created_at: true, is_deleted: true, deleted_at: true },
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Email ya existe en esta organización." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: "Error al actualizar cliente." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { orgId: string; customerId: string } }) {
  const exists = await ensureBelongs(params.orgId, params.customerId);
  if (!exists || exists.is_deleted) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado." }, { status: 404 });
  }

  const deleted = await prisma.customer.update({
    where: { id: params.customerId },
    data: { is_deleted: true, deleted_at: new Date() },
    select: { id: true, is_deleted: true, deleted_at: true },
  });

  return NextResponse.json({ ok: true, data: deleted });
}
