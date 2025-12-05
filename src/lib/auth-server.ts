// src/lib/auth-server.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth"; // tu config (providers, callbacks, etc.)

export const { auth } = NextAuth(authOptions);
