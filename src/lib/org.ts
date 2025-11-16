import { prisma } from "./prisma";


export async function getOrgOr404(orgId: string) {
const org = await prisma.org.findUnique({ where: { id: orgId } });
if (!org) throw new Response("Org not found", { status: 404 });
return org;
}