// src/lib/tilopay.ts
import crypto from "crypto";

const TILOPAY_BASE_URL = process.env.TILOPAY_BASE_URL!;      // ej. "https://app.tilopay.com/api/v1"
const TILOPAY_API_KEY = process.env.TILOPAY_TERMINAL_ID!;    // "key" / terminal_id
const TILOPAY_SECRET = process.env.TILOPAY_SECRET!;

// Credenciales de login
const APIUSER = process.env.TILOPAY_APIUSER!;
const PASSWORD = process.env.TILOPAY_PASSWORD!;

// Moneda que realmente acepta Tilopay para tu caso
type TilopayCurrency = "CRC" | "USD";

type CreateTilopayOrderParams = {
  // ⬇ entero en centavos (ej: ₡10.000,00 => 1000000)
  amount: number;
  // ⬇ SIEMPRE código ISO, nunca "₡"
  currency: TilopayCurrency;    // "CRC" o "USD"
  internalPaymentId: string;    // id de tu Payment (orderNumber en Tilopay)
  redirectUrl: string;          // URL donde Tilopay va a redirigir al final
  returnData: string;           // string en base64 (Tilopay lo devuelve intacto)
  billing: {
    firstName: string;
    lastName: string;
    address: string;
    address2: string;
    city: string;
    state: string;      // CR-SJ, US-CA, etc.
    zipCode: string;
    country: string;    // CR, US, GT...
    telephone: string;
    email: string;
  };
};

type TilopayTokenCache = {
  token: string;
  expiresAt: number; // timestamp en ms
};

let tokenCache: TilopayTokenCache | null = null;

// ================== LOGIN Y TOKEN ==================

async function loginTilopay(): Promise<TilopayTokenCache> {
  const res = await fetch(`${TILOPAY_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiuser: APIUSER,
      password: PASSWORD,
    }),
  });

  if (!res.ok) {
    console.error("Error al hacer login con Tilopay:", res.status, await res.text());
    throw new Error("No se pudo obtener token de Tilopay");
  }

  // 🔹 Tilopay responde algo como:
  // { access_token: '...', token_type: 'bearer', expires_in: 86400 }
  const data: { access_token: string; expires_in: number } = await res.json();

  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;

  tokenCache = {
    token: data.access_token,
    expiresAt,
  };

  return tokenCache;
}

/** Devuelve un token válido; si no hay o expiró, hace login */
export async function getTilopayBearerToken(): Promise<string> {
  if (!tokenCache || Date.now() >= tokenCache.expiresAt) {
    await loginTilopay();
  }
  return tokenCache!.token;
}

// ================== CREAR ORDEN ==================

export async function createTilopayOrder(params: CreateTilopayOrderParams) {
  // Tilopay espera el amount en decimal (string), no en centavos
  const amountDecimal = (params.amount / 100).toFixed(2);

  const body = {
    redirect: params.redirectUrl,
    key: TILOPAY_API_KEY,
    amount: amountDecimal,
    currency: params.currency,          // 👈 aquí ya va "CRC" o "USD", nunca "₡"
    orderNumber: params.internalPaymentId,
    capture: "1",
    suscription: "0",
    plataforma: "ACCROM_BOOKING",

    // Billing
    billToFirstName: params.billing.firstName,
    billToLastName: params.billing.lastName,
    billToAddress: params.billing.address,
    billToAddress2: params.billing.address2,
    billToCity: params.billing.city,
    billToState: params.billing.state,
    billToZipCode: params.billing.zipCode,
    billToCountry: params.billing.country,
    billToTelephone: params.billing.telephone,
    billToEmail: params.billing.email,

    // Shipping (mismos datos)
    shipToFirstName: params.billing.firstName,
    shipToLastName: params.billing.lastName,
    shipToAddress: params.billing.address,
    shipToAddress2: params.billing.address2,
    shipToCity: params.billing.city,
    shipToState: params.billing.state,
    shipToZipCode: params.billing.zipCode,
    shipToCountry: params.billing.country,
    shipToTelephone: params.billing.telephone,

    returnData: params.returnData,
  };

  const bearer = await getTilopayBearerToken();

  const res = await fetch(`${TILOPAY_BASE_URL}/processPayment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // 👇 JWT puro, formateado correcto
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  if (!res.ok) {
    console.error("Error creando orden Tilopay:", res.status, data);
    throw new Error("Error creating Tilopay order");
  }

  return {
    // Tilopay puede usar distintos campos: url, redirect, paymentUrl...
    redirectUrl: data.url ?? data.redirect ?? data.paymentUrl,
  };
}

// Por si luego se usa verificación de firma
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

  return computed === signatureHeader;
}
