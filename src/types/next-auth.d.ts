import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  // Lo que guardas en session.user
  interface Session {
    user: {
      id: string;
      role?: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CUSTOMER";
    } & DefaultSession["user"];
  }

  // Lo que `authorize()` retorna como `user`
  interface User {
    id: string;
    role?: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CUSTOMER";
  }
}

declare module "next-auth/jwt" {
  // Lo que guardas en el JWT
  interface JWT {
    role?: "SUPER_ADMIN" | "ADMIN" | "STAFF" | "CUSTOMER";
  }
}
