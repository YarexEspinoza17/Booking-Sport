// app/api/superadmin/orgs/[orgId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

export const runtime = "nodejs"; // Prisma necesita Node

// validar UUID v4
const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

// auth mínima
async function ensureSuperAdmin(req: Request) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return (token as any)?.role === "SUPER_ADMIN";
}

const baseSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(120),
  slug: z
    .string()
    .min(2, "Slug muy corto")
    .max(60, "Slug muy largo")
    .regex(/^[a-z0-9-]+$/, "Use minúsculas, números y guiones"),
});

// Para PUT/PATCH permitimos uno o ambos campos:
const partialSchema = baseSchema.partial().refine(
  (v) => typeof v.name === "string" || typeof v.slug === "string",
  { message: "Debe enviar name o slug" }
);

function prismaToHttp(e: any) {
  if (e?.code === "P2002") {
    return NextResponse.json({ ok: false, error: "Slug ya está en uso" }, { status: 409 });
  }
  if (e?.code === "P2025") {
    return NextResponse.json({ ok: false, error: "Organización no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
}

// ===== PUT (update completo/parcial) =====
export async function PUT(req: Request, { params }: { params: { orgId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.orgId;
    if (!orgId || !isUuid(orgId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const data = partialSchema.parse(await req.json());

    const updated = await prisma.org.update({
      where: { id: orgId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
      },
      select: { id: true, name: true, slug: true, created_at: true, is_deleted: true },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: e.errors?.[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }
    console.error("orgs.[orgId].PUT", e);
    return prismaToHttp(e);
  }
}

// ===== PATCH (parcial) =====
export async function PATCH(req: Request, { params }: { params: { orgId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.orgId;
    if (!orgId || !isUuid(orgId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const data = partialSchema.parse(await req.json());

    const updated = await prisma.org.update({
      where: { id: orgId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
      },
      select: { id: true, name: true, slug: true, created_at: true, is_deleted: true },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: e.errors?.[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }
    console.error("orgs.[orgId].PATCH", e);
    return prismaToHttp(e);
  }
}

// ===== DELETE (soft delete) =====
export async function DELETE(req: Request, { params }: { params: { orgId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.orgId;
    if (!orgId || !isUuid(orgId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const current = await prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true, is_deleted: true },
    });

    if (!current) {
      return NextResponse.json({ ok: false, error: "Organización no encontrada" }, { status: 404 });
    }
    if (current.is_deleted) {
      return NextResponse.json({ ok: false, error: "La organización ya estaba eliminada" }, { status: 409 });
    }

    const deleted = await prisma.org.update({
      where: { id: orgId },
      data: { is_deleted: true, deleted_at: new Date() },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, data: deleted });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Organización no encontrada" }, { status: 404 });
    }
    console.error("orgs.[orgId].DELETE", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
