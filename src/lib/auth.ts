// src/lib/auth.ts
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/* ===== Tipos de app ===== */
export type AppRole = "SUPER_ADMIN" | "OWNER" | "SITE_ADMIN" | "STAFF";

export type AuthPrincipal = {
  role?: AppRole;
  isSuperAdmin: boolean;
  orgId?: string;             // (para tenant más adelante)
  siteIdsAllowed: string[];   // (para tenant más adelante)
};

/* ===== Provider: Super Admin con credenciales ===== */
const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 60,   // 30 min
    updateAge: 5 * 60, // refresco a los 5 min de actividad
  },
  providers: [
    Credentials({
      name: "SuperAdmin",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const rows = await prisma.$queryRaw<
          { id: string; email: string; full_name: string | null; password_hash: string | null }[]
        >`
          select id, email, full_name, password_hash
          from app_super_admin
          where lower(email) = lower(${email})
          limit 1
        `;

        const user = rows[0];
        if (!user?.password_hash) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.full_name ?? "Super Admin",
          role: "SUPER_ADMIN" as const,
          // En el futuro podrías adjuntar orgId / siteIdsAllowed si aplicara
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).role = (user as any).role ?? (token as any).role;
        // (futuro tenant)
        // (token as any).orgId = (user as any).orgId ?? (token as any).orgId;
        // (token as any).siteIdsAllowed = (user as any).siteIdsAllowed ?? (token as any).siteIdsAllowed;
      }
      if (!("siteIdsAllowed" in (token as any))) {
        (token as any).siteIdsAllowed = [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = (token as any).role;
        (session.user as any).orgId = (token as any).orgId;
        (session.user as any).siteIdsAllowed = (token as any).siteIdsAllowed ?? [];
      }
      return session;
    },
  },
  pages: { signIn: "/superadmin/login" },
};

/* ===== Instancia NextAuth v5 =====
   Exporta helpers para usar en rutas y server components.
*/
export const { auth, signIn, signOut, handlers } = NextAuth(authOptions);

/* ===== requireAuth para endpoints (App Router) ===== */
export async function requireAuth(): Promise<AuthPrincipal> {
  const session = await auth(); // <- v5: NO getServerSession
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  const role = (session.user as any).role as AppRole | undefined;

  return {
    role,
    isSuperAdmin: role === "SUPER_ADMIN",
    orgId: (session.user as any).orgId,
    siteIdsAllowed: (session.user as any).siteIdsAllowed ?? [],
  };
}

/* ===== Helpers de autorización ===== */
export function canManageOrg(authz: AuthPrincipal, targetOrgId: string) {
  if (authz.isSuperAdmin) return true;
  return !!authz.orgId && authz.orgId === targetOrgId && (authz.role === "OWNER" || authz.role === "SITE_ADMIN");
}

export function canManageSite(authz: AuthPrincipal, targetOrgId: string, siteId: string) {
  if (authz.isSuperAdmin) return true;
  if (!authz.orgId || authz.orgId !== targetOrgId) return false;
  if (authz.role === "OWNER") return true;
  if (authz.role === "SITE_ADMIN") return authz.siteIdsAllowed.includes(siteId);
  return false;
}

/* ===== Versión assert* si prefieres lanzar errores directos ===== */
export function assertOrgOwnerOrSiteAdmin(authz: { role?: string; orgId?: string }, orgId: string) {
  if (authz.orgId !== orgId) throw new Error("Forbidden");
  if (!["OWNER", "SITE_ADMIN"].includes(String(authz.role))) throw new Error("Forbidden");
}

export function assertOwnerOrSiteAdminForSite(
  authz: { role?: string; orgId?: string; siteIdsAllowed?: string[] },
  orgId: string,
  siteId: string
) {
  if (authz.orgId !== orgId) throw new Error("Forbidden");
  if (authz.role === "OWNER") return;
  if (authz.role === "SITE_ADMIN" && (authz.siteIdsAllowed ?? []).includes(siteId)) return;
  throw new Error("Forbidden");
}
