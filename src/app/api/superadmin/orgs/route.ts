// src/app/api/superadmin/orgs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

async function ensureSuperAdmin(req: Request) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return (token as any)?.role === "SUPER_ADMIN";
}

/** Esquemas */
const createSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use minúsculas, números y guiones"),
});
// Whitelist de campos ordenables (en snake_case, como tu modelo)
const SORT_WHITELIST = {
  created_at: "created_at",
  name: "name",
  slug: "slug",
} as const;



export async function GET(req: Request) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const per  = Math.min(50, Math.max(5, Number(searchParams.get("per") ?? 10) || 10));

    const sortParam = (searchParams.get("sort") ?? "created_at") as "created_at" | "name" | "slug";
    const dir = (searchParams.get("dir") ?? "desc") as "asc" | "desc";
    const includeDeleted = searchParams.get("include_deleted") === "1";

    const sortField = SORT_WHITELIST[sortParam] ?? "created_at";

    // where SOLO con filtros (sin skip/take/orderBy)
    const baseWhere: any = includeDeleted ? {} : { is_deleted: false };
    const where =
      q
        ? {
            ...baseWhere,
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { slug: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : baseWhere;

    // 1) total: NO reuses ningún objeto con skip/take/orderBy
    const total = await prisma.org.count({ where });

    // 2) items: paginado normal
    const items = await prisma.org.findMany({
      where,
      orderBy: { [sortField]: dir },
      take: per,
      skip: (page - 1) * per,
      select: {
        id: true,
        name: true,
        slug: true,
        created_at: true,
        is_deleted: true,
      },
    });

    const pages = Math.max(1, Math.ceil(total / per));

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      pages,
      per,
      sort: sortParam,
      dir,
      include_deleted: includeDeleted ? 1 : 0,
    });
  } catch (err: any) {
    console.error("orgs.GET", err);
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // aceptamos JSON y (opcional) form-data
    let payload: any;
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      payload = Object.fromEntries(fd.entries());
    } else {
      payload = await req.json().catch(() => ({}));
    }

    const data = createSchema.parse(payload);

    const created = await prisma.org.create({
      data: { name: data.name, slug: data.slug },
      select: { id: true, name: true, slug: true, created_at: true },
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ ok: false, error: err.flatten() }, { status: 400 });
    }
    // conflicto de slug único, etc.
    if (String(err?.message || "").includes("Unique") || String(err).includes("unique")) {
      return NextResponse.json({ ok: false, error: "Slug ya existe" }, { status: 409 });
    }
    console.error("orgs.POST", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
