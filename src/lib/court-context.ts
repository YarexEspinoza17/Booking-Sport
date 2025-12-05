// src/lib/court-context.ts
import { prisma } from "@/lib/prisma";

export async function requireCourtFromOrgAndSite(
  orgId: string,
  siteId: string,
  courtId: string,
) {
  const court = await prisma.court.findFirst({
    where: {
      id: courtId,
      org_id: orgId,
      site_id: siteId,
      is_deleted: false,
    },
  });

  if (!court) {
    throw new Error(
      "La cancha no existe o no pertenece al sitio / organización actual.",
    );
  }

  return court;
}
