// src/lib/auth.ts
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: NextAuthConfig = {
  session: {
    strategy: "jwt",
    // caduca a los 30 min
    maxAge: 30 * 60,
    // renueva cada 5 min si hay actividad (requests)
    updateAge: 5 * 60,
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
        // consulta directa sin depender del nombre del modelo (INTERPOLACIÓN SEGURA)

        const rows = await prisma.$queryRaw<
          {
            id: string;
            email: string;
            full_name: string | null;
            password_hash: string | null;
          }[]
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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role ?? token.role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    },
  },
  pages: { signIn: "/superadmin/login" },
};
