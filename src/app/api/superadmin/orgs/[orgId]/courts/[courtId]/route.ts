import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getOrgOr404 } from "@/lib/org";


const uuid = z.string().uuid();


const updateBodySchema = z.object({
name: z.string().min(1).max(120).optional(),
site_id: uuid.optional(),
court_type_id: uuid.optional(),
buffer_before_minutes: z.number().int().min(0).max(600).optional(),
buffer_after_minutes: z.number().int().min(0).max(600).optional(),
active: z.boolean().optional(),
});


export async function PATCH(req: NextRequest, { params }: { params: { orgId: string; courtId: string } }) {
const { orgId, courtId } = params;
await getOrgOr404(orgId);


const body = await req.json();
const parse = updateBodySchema.safeParse(body);
if (!parse.success) return NextResponse.json({ ok: false, error: parse.error.flatten() }, { status: 400 });


// Ensure the court belongs to the org and is not hard-deleted
const exists = await prisma.court.findFirst({ where: { id: courtId, org_id: orgId } });
if (!exists) return NextResponse.json({ ok: false, error: "Court no encontrado" }, { status: 404 });


const { site_id, court_type_id } = parse.data;
if (site_id) {
const site = await prisma.site.findFirst({ where: { id: site_id, org_id: orgId, is_deleted: false } });
if (!site) return NextResponse.json({ ok: false, error: "Site no existe o no pertenece al org" }, { status: 400 });
}
if (court_type_id) {
const ctype = await prisma.court_type.findFirst({ where: { id: court_type_id, org_id: orgId, is_deleted: false } });
if (!ctype) return NextResponse.json({ ok: false, error: "Court type no existe o no pertenece al org" }, { status: 400 });
}


const updated = await prisma.court.update({ where: { id: courtId }, data: parse.data });
return NextResponse.json({ ok: true, data: updated });
}


export async function DELETE(_req: NextRequest, { params }: { params: { orgId: string; courtId: string } }) {
const { orgId, courtId } = params;
await getOrgOr404(orgId);


const exists = await prisma.court.findFirst({ where: { id: courtId, org_id: orgId } });
if (!exists) return NextResponse.json({ ok: false, error: "Court no encontrado" }, { status: 404 });


const deleted = await prisma.court.update({
where: { id: courtId },
data: { is_deleted: true, deleted_at: new Date(), active: false },
});
return NextResponse.json({ ok: true, data: deleted });
}