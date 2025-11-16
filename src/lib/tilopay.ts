// lib/tilopay.ts
import crypto from "crypto";

const TILOPAY_BASE_URL = process.env.TILOPAY_BASE_URL!;
const TILOPAY_TERMINAL_ID = process.env.TILOPAY_TERMINAL_ID!;
const TILOPAY_API_KEY = process.env.TILOPAY_API_KEY!;
const TILOPAY_SECRET = process.env.TILOPAY_SECRET!;

type CreateTilopayOrderParams = {
  amount: number; // en centavos o en la unidad que Tilopay requiera
  currency: string;
  internalPaymentId: string; // id de tu tabla Payment
  returnUrl: string;         // URL donde vuelve el cliente después de pagar
  webhookUrl: string;        // URL del webhook
};

export async function createTilopayOrder(params: CreateTilopayOrderParams) {
  // Ajustar body según docs de Tilopay
  const body = {
    terminal_id: TILOPAY_TERMINAL_ID,
    amount: params.amount,
    currency: params.currency,
    order_id: params.internalPaymentId, // para luego mapear en el webhook
    return_url: params.returnUrl,
    webhook_url: params.webhookUrl,
  };

  const res = await fetch(`${TILOPAY_BASE_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": TILOPAY_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Error creando orden Tilopay:", errorBody);
    throw new Error("Error creating Tilopay order");
  }

  const data = await res.json();

  // Ajustar nombres según Tilopay: aquí supongo que devuelve order_id y redirect_url
  return {
    orderId: data.order_id,
    redirectUrl: data.redirect_url,
  };
}

// Verificación de firma HMAC (ejemplo genérico: HMAC-SHA256)
export function verifyTilopaySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string = TILOPAY_SECRET,
): boolean {
  if (!signatureHeader) return false;

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Ajustar comparación según Tilopay (puede ser prefijo, etc.)
  return computed === signatureHeader;
}
