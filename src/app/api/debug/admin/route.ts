// src/app/api/debug/admin/route.ts
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get("email") || "").trim();
    if (!email) {
      return Response.json({ ok: false, error: "email requerido" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<
      { id: string; email: string; full_name: string | null; password_hash: string | null }[]
    >`
      select id, email, full_name, password_hash
      from app_super_admin
      where lower(email) = lower(${email})
      limit 1
    `;

    const u = rows[0];
    return Response.json({
      ok: true,
      exists: !!u,
      id: u?.id ?? null,
      email: u?.email ?? null,
      hasHash: !!u?.password_hash,
    });
  } catch (e: any) {
    console.error("DEBUG ADMIN ERROR:", e);
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
