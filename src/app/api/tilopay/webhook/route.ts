import { NextRequest } from "next/server";
import { verifyTilopaySignature } from "@/lib/payments/tilopay";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-tilopay-signature");

  if (!verifyTilopaySignature(raw, sig)) {
    return new Response("invalid signature", { status: 401 });
  }
  const payload = JSON.parse(raw);
  const externalId = String(payload.transaction_id || payload.id || "");
  if (!externalId) return Response.json({ ok:false, msg:"missing external id" }, { status:400 });

  const statusRaw = String(payload.status || "").toUpperCase();
  const status = ["CAPTURED","AUTHORIZED","FAILED","REFUNDED","PARTIAL_REFUNDED"].includes(statusRaw) ? statusRaw : "AUTHORIZED";
  const reservationId = payload.metadata?.reservation_id ?? null;
  const orgId = payload.metadata?.org_id ?? null;
  const currency = payload.currency || "CRC";
  const amountInt = Math.round(Number(payload.amount || 0) * 100);

  await query(
    `insert into payment (org_id, reservation_id, provider, external_id, status, currency, amount_int)
     values ($1,$2,'tilopay',$3,$4,$5,$6)
     on conflict (external_id) do update set status = excluded.status`,
    orgId, reservationId, externalId, status, currency, amountInt
  );

  if (status === "CAPTURED" && reservationId) {
    await query(`update reservation set status='CONFIRMED' where id = $1::uuid`, reservationId);
  }

  return Response.json({ ok:true });
}
