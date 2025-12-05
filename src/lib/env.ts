// lib/env.ts
function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";

export const env = {
  DATABASE_URL: must("DATABASE_URL"),
  ROOT_DOMAIN: process.env.ROOT_DOMAIN ?? "localhost",

  // Opcionales (pueden estar vacías en dev)
  REDIS_URL: process.env.REDIS_URL ?? "",
  TILOPAY_API_KEY: process.env.TILOPAY_API_KEY ?? "",
  TILOPAY_WEBHOOK_SECRET: process.env.TILOPAY_WEBHOOK_SECRET ?? "",
};

if (isProd) {
  // endurece si en prod vas a usar pagos/redis
  if (!env.TILOPAY_WEBHOOK_SECRET) {
    throw new Error("TILOPAY_WEBHOOK_SECRET is required in production");
  }
}
