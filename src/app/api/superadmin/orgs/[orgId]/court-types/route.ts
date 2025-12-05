// src/app/api/superadmin/orgs/[orgId]/court-types/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

export const runtime = "nodejs";

async function ensureSuperAdmin(req: Request) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return (token as any)?.role === "SUPER_ADMIN";
}

const SORT_WHITELIST = {
  created_at: "created_at",
  code: "code",
  name: "name",
} as const;

const createSchema = z.object({
  code: z.string().min(2, "Código muy corto").max(60),
  name: z.string().min(2, "Nombre muy corto").max(120),
});

export async function GET(req: Request, ctx: { params: { orgId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = ctx.params;
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const per = Math.min(50, Math.max(5, Number(searchParams.get("per") ?? 10) || 10));
    const sortParam = (searchParams.get("sort") ?? "created_at") as keyof typeof SORT_WHITELIST;
    const sortField = SORT_WHITELIST[sortParam] ?? "created_at";
    const dir = (searchParams.get("dir") ?? "desc") as "asc" | "desc";
    const includeDeleted = searchParams.get("include_deleted") === "1";

    const baseWhere: any = { org_id: orgId, ...(includeDeleted ? {} : { is_deleted: false }) };
    const where = q
      ? {
          ...baseWhere,
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : baseWhere;

    const [total, items] = await Promise.all([
      prisma.court_type.count({ where }),
      prisma.court_type.findMany({
        where,
        orderBy: { [sortField]: dir },
        take: per,
        skip: (page - 1) * per,
        select: {
          id: true,
          org_id: true,
          code: true,
          name: true,
          created_at: true,
          is_deleted: true,
          deleted_at: true,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / per)),
      per,
      sort: sortParam,
      dir,
      include_deleted: includeDeleted ? 1 : 0,
    });
  } catch (err: any) {
    console.error("court-types.GET", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: { orgId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { orgId } = ctx.params;
    const body = await req.json().catch(() => ({}));
    const data = createSchema.parse(body);

    const created = await prisma.court_type.create({
      data: {
        org_id: orgId,
        code: data.code.trim(),
        name: data.name.trim(),
      },
      select: { id: true, org_id: true, code: true, name: true, created_at: true, is_deleted: true },
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ ok: false, error: err.flatten() }, { status: 400 });
    }
    // conflicto por unique(code) si lo tienes por org_id
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      return NextResponse.json({ ok: false, error: "El código ya existe" }, { status: 409 });
    }
    console.error("court-types.POST", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
