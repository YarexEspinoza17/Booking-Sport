// /src/app/api/superadmin/orgs/[orgId]/customers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
  const per = Math.min(Math.max(parseInt(searchParams.get("per") || "10"), 1), 100);
  const includeDeleted = (searchParams.get("include_deleted") || "false") === "true";

  const where: any = { org_id: params.orgId };
  if (!includeDeleted) where.is_deleted = false;
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { full_name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * per,
      take: per,
      select: {
        id: true, full_name: true, email: true, phone: true,
        created_at: true, is_deleted: true, deleted_at: true,
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({ ok: true, data: items, meta: { page, per, total } });
}

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  const body = await req.json();
  const email = body?.email?.toLowerCase?.() ?? null;

  if (!email) {
    return NextResponse.json({ ok: false, error: "email requerido" }, { status: 400 });
  }

  try {
    const created = await prisma.customer.create({
      data: {
        org_id: params.orgId,
        email,
        full_name: body?.full_name ?? null,
        phone: body?.phone ?? null,
      },
      select: { id: true, email: true, full_name: true, phone: true, created_at: true },
    });

    // IMPORTANTE: devuelve el ID para usarlo en la reserva
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Email ya existe en esta organización." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: "Error al crear cliente." }, { status: 500 });
  }
}
