import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/guards";
import { OrgUpdateSchema } from "@/lib/validators";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireSuperAdmin(_req);
  const { id } = params;

  const org = await prisma.org.findUnique({
    where: { id },
    select: {
      id: true, name: true, slug: true, created_at: true,
      org_domain: { select: { domain: true } },
      sites: { select: { id: true, name: true, timezone: true, created_at: true } }
    }
  });
  if (!org) return Response.json({ ok:false, msg:"Not found" }, { status: 404 });

  return Response.json({
    ok:true,
    ...org,
    domains: org.org_domain.map(d => d.domain)
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  await requireSuperAdmin(req);
  const { id } = params;
  const json = await req.json();
  const parsed = OrgUpdateSchema.safeParse(json);
  if (!parsed.success) return Response.json({ ok:false, msg: parsed.error.flatten() }, { status: 400 });

  const { name, slug, domains } = parsed.data;

  try {
    const res = await prisma.$transaction(async (tx) => {
      const updated = await tx.org.update({
        where: { id },
        data: { name: name ?? undefined, slug: slug ?? undefined },
        select: { id: true }
      });

      if (domains) {
        // estrategia simple: borrar y recrear (o haz diff si prefieres)
        await tx.org_domain.deleteMany({ where: { org_id: id } });
        if (domains.length) {
          await tx.org_domain.createMany({
            data: domains.map(d => ({ org_id: id, domain: d })), skipDuplicates: true
          });
        }
      }
      return updated;
    });

    return Response.json({ ok:true, id: res.id });
  } catch (e: any) {
    return Response.json({ ok:false, msg: e.message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireSuperAdmin(_req);
  const { id } = params;
  try {
    await prisma.org.delete({ where: { id } });
    return Response.json({ ok:true });
  } catch (e: any) {
    return Response.json({ ok:false, msg: e.message }, { status: 400 });
  }
}
