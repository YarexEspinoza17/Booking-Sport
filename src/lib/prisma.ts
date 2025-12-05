// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Extiende el objeto global para cachear una sola instancia en dev (hot-reload)
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Crea la instancia con logs útiles en dev
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

// En desarrollo, guarda la instancia en global para evitar múltiples clientes
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// (Opcional) helper para comprobar conexión en arranque de serverless/route handlers
export async function ensureDb() {
  try {
    // $connect es idempotente; en poolers (pgbouncer) no pasa nada si ya está
    await prisma.$connect();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("❌ Prisma connect error:", e);
    throw e;
  }
}
