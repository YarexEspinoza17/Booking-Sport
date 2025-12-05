// src/lib/org-context.ts
import {prisma} from "@/lib/prisma";
import { getSubdomainFromHost } from "@/lib/subdomain";

export async function findOrgBySubdomain(subdomain: string | null) {
  if (!subdomain) return null;

  const org = await prisma.org.findUnique({
    where: { slug: subdomain },
  });

  return org;
}

/**
 * Recibe un Request o NextRequest.
 * 1) Intenta leer "x-subdomain" (puesto por middleware si aplica).
 * 2) Si no existe, calcula el subdominio desde Host.
 */
export async function requireOrgFromRequest(req: Request) {
  let subdomain = req.headers.get("x-subdomain");

  if (!subdomain) {
    const host = req.headers.get("host");
    subdomain = getSubdomainFromHost(host);
  }

  if (!subdomain) {
    return {
      org: null,
      error: "Organización no detectada (subdominio ausente).",
    };
  }

  const org = await findOrgBySubdomain(subdomain);

  if (!org || org.is_deleted) {
    return {
      org: null,
      error: `No existe organización activa con slug '${subdomain}'.`,
    };
  }

  return { org, error: null };
}
