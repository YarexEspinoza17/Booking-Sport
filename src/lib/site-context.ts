// src/lib/site-context.ts
import { prisma } from "@/lib/prisma";

export async function requireSiteFromOrg(orgId: string, siteId: string) {
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      org_id: orgId,
      is_deleted: false,
    },
  });

  if (!site) {
    throw new Error("El sitio no existe o no pertenece a esta organización.");
  }

  return site;
}
