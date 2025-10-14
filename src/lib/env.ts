export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL!,
  TILOPAY_API_KEY: process.env.TILOPAY_API_KEY || "",
  TILOPAY_WEBHOOK_SECRET: process.env.TILOPAY_WEBHOOK_SECRET || "",
  ROOT_DOMAIN: process.env.ROOT_DOMAIN || "localhost",
};
