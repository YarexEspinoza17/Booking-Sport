// Fuerza runtime Node (Prisma no funciona en edge)
export const runtime = "nodejs";

import { prisma, ensureDb } from "@/lib/prisma";

export async function GET() {
  try {
    await ensureDb(); // opcional, conecta si hace falta
    const rows = await prisma.$queryRaw<{ one: number }[]>`select 1 as one`;
    return Response.json({ ok: true, rows });
  } catch (e: any) {
    console.error("DB PING ERROR:", e);
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
