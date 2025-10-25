import { NextRequest } from "next/server";
import { getOrgIdFromRequest } from "@/lib/tenancy";
import { availableWindows } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const courtId = url.searchParams.get("courtId");
  const date = url.searchParams.get("date");      // YYYY-MM-DD
  const duration = Number(url.searchParams.get("duration") ?? "120");
  const step = Number(url.searchParams.get("step") ?? "30");

  if (!courtId || !date) {
    return Response.json({ ok: false, msg: "Missing courtId/date" }, { status: 400 });
  }

  const orgId = await getOrgIdFromRequest(req); // (si ya no lo usas, quita esta línea)
  // podrías validar que courtId pertenezca a orgId si quieres

  const slots = await availableWindows(courtId, date, duration, step);
  return Response.json({ ok: true, slots });
}
