

import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function authorizeFromDb(email: string, password: string) {
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
  };
}

const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "SuperAdmin",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        return authorizeFromDb(String(creds.email), String(creds.password));
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }): Promise<JWT> {
      if (user) {
        token.role = (user as any).role ?? token.role;
        token.name = user.name ?? token.name;
        token.email = user.email ?? token.email;
        token.sub = (user as any).id ?? token.sub;
      }
      return token;
    },
    async session({ session, token }): Promise<Session> {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = (token.sub as string) ?? (session.user as any).id;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
      }
      return session;
    },
  },
  pages: { signIn: "/superadmin/login" },
};

const { handlers, auth } = NextAuth(authConfig); // ⬅️ antes tenías solo { handlers }
export const GET = handlers.GET;
export const POST = handlers.POST;
export { auth }; // ⬅️ nueva exportación
