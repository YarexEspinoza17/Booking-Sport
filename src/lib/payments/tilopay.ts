// lib/payments/tilopay.ts
import crypto from "crypto";
import { env } from "../env";

export function verifyTilopaySignature(rawBody: string, headerSig: string | null): boolean {
  if (!env.TILOPAY_WEBHOOK_SECRET) return false;
  if (!headerSig) return false;
  const mac = crypto.createHmac("sha256", env.TILOPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(headerSig));
  } catch {
    return false;
  }
}
