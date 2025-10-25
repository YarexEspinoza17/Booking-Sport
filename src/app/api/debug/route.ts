// src/app/api/debug/route.ts
export const runtime = "nodejs";

export async function GET() {
  return Response.json({ ok: true, route: "/api/debug" });
}
