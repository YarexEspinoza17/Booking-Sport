import { NextRequest } from "next/server";
import { isAvailable } from "@/lib/availability";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { orgId, siteId, courtId, startsAt, endsAt, priceInt, currency = "CRC" } = await req.json();
  if (!orgId || !siteId || !courtId || !startsAt || !endsAt || !priceInt)
    return Response.json({ ok:false, msg:"Missing fields" }, { status:400 });

  const ok = await isAvailable(courtId, startsAt, endsAt);
  if (!ok) return Response.json({ ok:false, msg:"Slot not available" }, { status:409 });

  const holdExpires = new Date(Date.now() + 15*60*1000).toISOString();
  const rows = await query<{ id: string; hold_expires_at: string }>(
    `insert into reservation (org_id, site_id, court_id, start_time, end_time, currency, price_int, status, hold_expires_at)
     values ($1,$2,$3,$4,$5,$6,$7,'HELD',$8)
     returning id, hold_expires_at`,
    orgId, siteId, courtId, startsAt, endsAt, currency, priceInt, holdExpires
  );

  return Response.json({ ok:true, reservationId: rows[0].id, holdExpiresAt: rows[0].hold_expires_at });
}
