import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrgOr404 } from "@/lib/org";
import { Prisma } from "@prisma/client";

// Schemas
const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(["created_at", "name", "active"]).default("created_at"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  site_id: z.string().uuid().optional(),
  court_type_id: z.string().uuid().optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

const uuid = z.string().uuid();

const createBodySchema = z.object({
  site_id: uuid,
  court_type_id: uuid,
  name: z.string().min(1).max(120),
  buffer_before_minutes: z.number().int().min(0).max(600).default(0),
  buffer_after_minutes: z.number().int().min(0).max(600).default(0),
  active: z.boolean().optional().default(true),
});

// GET /api/superadmin/orgs/[orgId]/courts
export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  await getOrgOr404(orgId);

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }
  const { q, page, per, sort, dir, site_id, court_type_id, includeDeleted } = parsed.data;

  // where tipado fuerte para evitar error 2322
  const where: Prisma.CourtWhereInput = {
    org_id: orgId,
    ...(includeDeleted ? {} : { is_deleted: false }),
    ...(q
      ? {
          name: {
            contains: q,
            mode: Prisma.QueryMode.insensitive, // <- ENUM, compatible en todas las versiones
          },
        }
      : {}),
    ...(site_id ? { site_id } : {}),
    ...(court_type_id ? { court_type_id } : {}),
  };

  // orderBy tipado seguro
  let orderBy: Prisma.CourtOrderByWithRelationInput;
  switch (sort) {
    case "name":
      orderBy = { name: dir };
      break;
    case "active":
      orderBy = { active: dir };
      break;
    default:
      orderBy = { created_at: dir };
  }

  const [items, total] = await Promise.all([
    prisma.court.findMany({
      where,
      orderBy,
      skip: (page - 1) * per,
      take: per,
      include: {
        court_type: true,
        site: true,
      },
    }),
    prisma.court.count({ where }),
  ]);

  return NextResponse.json({ ok: true, data: items, meta: { page, per, total } });
}

// POST /api/superadmin/orgs/[orgId]/courts
export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  await getOrgOr404(orgId);

  const body = await req.json();
  const parse = createBodySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ ok: false, error: parse.error.flatten() }, { status: 400 });
  }

  const { name, site_id, court_type_id, buffer_before_minutes, buffer_after_minutes, active } = parse.data;

  // Validaciones de pertenencia al org
  const [site, ctype] = await Promise.all([
    prisma.site.findFirst({ where: { id: site_id, org_id: orgId, is_deleted: false } }),
    prisma.court_type.findFirst({ where: { id: court_type_id, org_id: orgId, is_deleted: false } }),
  ]);
  if (!site) return NextResponse.json({ ok: false, error: "Site no existe o no pertenece al org" }, { status: 400 });
  if (!ctype) return NextResponse.json({ ok: false, error: "Court type no existe o no pertenece al org" }, { status: 400 });

  const created = await prisma.court.create({
    data: {
      org_id: orgId,
      site_id,
      court_type_id,
      name,
      buffer_before_minutes,
      buffer_after_minutes,
      active,
    },
  });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}
