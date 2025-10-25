import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/guards";
import { SiteUpdateSchema } from "@/lib/validators";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireSuperAdmin(_req);
  const site = await prisma.site.findUnique({
    where: { id: params.id },
    select: {
      id: true, org_id: true, name: true, timezone: true, created_at: true,
      // admins asignados (employee_site)
      employee_site: { select: { employee_id: true } }
    }
  });
  if (!site) return Response.json({ ok:false, msg:"Not found" }, { status: 404 });
  return Response.json({ ok:true, ...site });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  await requireSuperAdmin(req);
  const parsed = SiteUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ ok:false, msg: parsed.error.flatten() }, { status: 400 });

  const { name, timezone } = parsed.data;

  try {
    const s = await prisma.site.update({
      where: { id: params.id },
      data: { name: name ?? undefined, timezone: timezone ?? undefined },
      select: { id: true }
    });
    return Response.json({ ok:true, id: s.id });
  } catch (e: any) {
    return Response.json({ ok:false, msg: e.message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireSuperAdmin(_req);
  try {
    await prisma.site.delete({ where: { id: params.id } });
    return Response.json({ ok:true });
  } catch (e: any) {
    return Response.json({ ok:false, msg: e.message }, { status: 400 });
  }
}
