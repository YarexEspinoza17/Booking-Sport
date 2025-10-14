import { headers } from "next/headers";

// En producción reemplaza este método para traducir subdominio -> organizationId desde la DB.
export async function getOrganizationFromRequest(): Promise<{ organizationId: string | null, orgSlug: string | null }> {
  const h = headers();
  const orgSlug = h.get("x-org");
  if (!orgSlug) return { organizationId: null, orgSlug: null };
  // TODO: lookup real a la DB para obtener organizationId
  // For demo, devolvemos el slug como "organizationId".
  return { organizationId: orgSlug, orgSlug };
}
