import { getToken } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

// Reutiliza el Prisma Client en dev (hot-reload safe)
declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma = globalThis.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") (globalThis as any).__prisma = prisma;

export type AuthToken = {
  sub?: string;           // user id
  email?: string;
  role?: string;          // 'SUPER_ADMIN' | 'ADMIN_ORG' | 'OPERADOR_SEDE' | etc.
  org_id?: string | null; // opcional según tus callbacks
  site_ids?: string[];    // opcional según tus callbacks
  // ...otros claims que metas en callbacks.jwt
};

/**
 * Lee el token JWT de NextAuth (cookies/headers) y retorna el objeto token o null.
 */
export async function getAuthToken(req: Request): Promise<AuthToken | null> {
  try {
    const token = (await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === "production",
    })) as AuthToken | null;
    return token ?? null;
  } catch {
    return null;
  }
}

/**
 * Verifica si la request pertenece a un SUPER ADMIN.
 * Criterios:
 *  - token.role === 'SUPER_ADMIN'
 *  - o email presente en tabla app_super_admin
 *  - o (DEV) header 'x-super-admin: 1'
 */
export async function ensureSuperAdmin(req: Request): Promise<boolean> {
  // Bypass de desarrollo (útil para probar APIs desde Postman)
  if (process.env.NODE_ENV !== "production") {
    const devBypass = req.headers.get("x-super-admin");
    if (devBypass === "1") return true;
  }

  const token = await getAuthToken(req);
  if (!token) return false;

  // Rol explícito
  if (token.role === "SUPER_ADMIN") return true;

  // Fallback por email en la tabla app_super_admin
  if (token.email) {
    const exists = await prisma.app_super_admin.findUnique({
      where: { email: token.email },
      select: { email: true },
    });
    if (exists) return true;
  }

  return false;
}

/**
 * Variante que lanza en vez de devolver boolean. Útil si prefieres early return en handlers.
 */
export async function requireSuperAdmin(req: Request): Promise<AuthToken> {
  const ok = await ensureSuperAdmin(req);
  if (!ok) {
    const e: any = new Error("Unauthorized");
    e.status = 401;
    throw e;
  }
  const token = await getAuthToken(req);
  if (!token) {
    const e: any = new Error("Unauthorized");
    e.status = 401;
    throw e;
  }
  return token;
}
