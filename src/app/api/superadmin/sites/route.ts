import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/guards";
import { SiteCreateSchema } from "@/lib/validators";
import { hashPassword } from "@/lib/hash";

export async function GET(req: NextRequest) {
  await requireSuperAdmin(req);
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId") || undefined;
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const where: any = {};
  if (orgId) where.org_id = orgId;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const [items, total] = await Promise.all([
    prisma.site.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
      select: { id: true, org_id: true, name: true, timezone: true, created_at: true }
    }),
    prisma.site.count({ where })
  ]);

  return Response.json({ ok:true, total, limit, offset, items });
}

export async function POST(req: NextRequest) {
  await requireSuperAdmin(req);
  const json = await req.json();
  const parsed = SiteCreateSchema.safeParse(json);
  if (!parsed.success) return Response.json({ ok:false, msg: parsed.error.flatten() }, { status: 400 });
  const { orgId, name, timezone, admin } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const s = await tx.site.create({
        data: { org_id: orgId, name, timezone: timezone || "America/Costa_Rica" },
        select: { id: true }
      });

      let adminId: string | null = null;
      if (admin?.email && admin?.password) {
        const password_hash = await hashPassword(admin.password);
        const e = await tx.employee.create({
          data: {
            org_id: orgId,
            email: admin.email.toLowerCase(),
            full_name: admin.full_name || null,
            role: "ADMIN",
            password_hash
          },
          select: { id: true }
        });
        adminId = e.id;

        await tx.employee_site.create({
          data: { employee_id: e.id, site_id: s.id }
        });
      }

      return { siteId: s.id, adminId };
    });

    return Response.json({ ok:true, ...result }, { status: 201 });
  } catch (e: any) {
    return Response.json({ ok:false, msg: e.message }, { status: 400 });
  }
}
