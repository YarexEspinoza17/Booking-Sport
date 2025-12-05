// lib/org-from-request.ts
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function getOrgFromRequest(req: unknown) {
  const host = headers().get('host') ?? ''; // p.ej. club-palma.booking-sport.com
  if (!host) {
    throw new Error('Host no disponible');
  }

  // 1) Intentar match exacto con org_domain.domain
  const orgDomain = await prisma.org_domain.findUnique({
    where: {
      domain: host,
    },
    include: { org: true },
  });

  if (orgDomain) {
    return orgDomain.org;
  }

  // 2) Fallback simple: tomar primer segmento como slug (club-palma.dominio.com)
  const [subdomain] = host.split('.');
  if (subdomain && subdomain !== 'localhost') {
    const orgBySlug = await prisma.org.findUnique({
      where: { slug: subdomain },
    });
    if (orgBySlug) return orgBySlug;
  }

  throw new Error('No se encontró organización para este dominio/subdominio');
}
