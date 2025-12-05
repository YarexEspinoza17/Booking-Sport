// lib/tenancy.ts
import { prisma } from "./prisma";
import { env } from "./env";

/** Extrae el subdominio del host: ej. clubx.tu-dominio.com → "clubx" */
export function getSubdomain(host: string): string | null {
  if (!host) return null;
  const h = host.toLowerCase().split(":")[0]; // quita puerto
  // si estás en local sin wildcard, usa ?orgId= o un host tipo <sub>.localtest.me
  if (env.ROOT_DOMAIN === "localhost") return null;

  const parts = h.split(".");
  // ejemplo: sub.domain.com (sub = parts[0])
  return parts.length > 2 ? parts[0] : null;
}

/** Resuelve org_id desde host por tabla org_domain o slug */
export async function resolveOrgIdFromHost(host: string): Promise<string | null> {
  const sub = getSubdomain(host);
  if (!sub) return null;

  // 1) Coincidencia por dominio completo en org_domain
  const byDomain = await prisma.$queryRawUnsafe<
    { org_id: string }[]
  >(`select org_id from org_domain where domain = $1 limit 1`, host.toLowerCase());
  if (byDomain[0]?.org_id) return byDomain[0].org_id;

  // 2) Coincidencia por slug (subdominio == org.slug)
  const bySlug = await prisma.$queryRawUnsafe<
    { id: string }[]
  >(`select id from org where slug = $1 limit 1`, sub);
  return bySlug[0]?.id ?? null;
}

/** Obtiene org_id desde request (host o query param fallback en local) */
export async function getOrgIdFromRequest(req: Request): Promise<string | null> {
  const host = req.headers.get("host") || "";
  const fromHost = await resolveOrgIdFromHost(host);
  if (fromHost) return fromHost;

  // Fallback en local: permitir ?orgId=... mientras no tienes subdominios
  const url = new URL(req.url);
  return url.searchParams.get("orgId");
}
