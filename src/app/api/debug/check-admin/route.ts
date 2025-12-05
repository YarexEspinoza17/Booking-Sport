export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json().catch(() => ({}));
    if (!email || !password) {
      return Response.json({ ok: false, error: "email y password requeridos" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<
      { id: string; email: string; full_name: string | null; password_hash: string | null }[]
    >`
      select id, email, full_name, password_hash
      from app_super_admin
      where lower(email) = lower(${String(email).trim()})
      limit 1
    `;

    const u = rows[0];
    if (!u?.password_hash) return Response.json({ ok: false, reason: "USER_NOT_FOUND" });

    const ok = await bcrypt.compare(String(password), u.password_hash);
    return Response.json({ ok, userId: ok ? u.id : null });
  } catch (e: any) {
    console.error("CHECK-ADMIN ERROR:", e);
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
