import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getToken } from "next-auth/jwt";

async function ensureSuperAdmin(req: Request) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return (token as any)?.role === "SUPER_ADMIN";
}

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  timezone: z.string().min(2).max(60),
  address: z.string().max(200).optional().nullable(),
});

export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.orgId;
    if (!orgId || !isUuid(orgId)) {
      return NextResponse.json({ ok: false, error: "orgId inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const q    = (searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const per  = Math.min(50, Math.max(5, Number(searchParams.get("per") ?? 10) || 10));
    const sort = (searchParams.get("sort") ?? "created_at") as "created_at" | "name";
    const dir  = (searchParams.get("dir") ?? "desc") as "asc" | "desc";

    const where: any = {
      org_id: orgId,              // 👈 siempre por org_id
      is_deleted: false,
      ...(q
        ? {
            OR: [
              { name:     { contains: q, mode: "insensitive" as const } },
              { timezone: { contains: q, mode: "insensitive" as const } },
              { address:  { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.site.count({ where }),
      prisma.site.findMany({
        where,
        orderBy: { [sort]: dir },
        take: per,
        skip: (page - 1) * per,
        select: { id:true, org_id:true, name:true, timezone:true, address:true, created_at:true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / per)),
      per,
      sort,
      dir,
    });
  } catch (err: any) {
    console.error("sites.GET", err);
    return NextResponse.json({ ok: false, error: err?.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  try {
    if (!(await ensureSuperAdmin(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.orgId;
    if (!orgId || !isUuid(orgId)) {
      return NextResponse.json({ ok: false, error: "orgId inválido" }, { status: 400 });
    }

    const ct = req.headers.get("content-type") || "";
    let payload: any;
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      payload = Object.fromEntries(fd.entries());
    } else {
      payload = await req.json().catch(() => ({}));
    }

    const data = createSchema.parse(payload);

    const created = await prisma.site.create({
      data: {
        org_id: orgId, // 👈 no del body, del path
        name: data.name.trim(),
        timezone: data.timezone.trim(),
        address: data.address?.trim() || null,
      },
      select: { id:true, org_id:true, name:true, timezone:true, address:true, created_at:true },
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ ok: false, error: err.flatten() }, { status: 400 });
    }
    console.error("sites.POST", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
