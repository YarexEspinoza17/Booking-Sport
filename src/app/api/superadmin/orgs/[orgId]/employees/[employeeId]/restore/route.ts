import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { restoreEmployee } from "@/server/employees.service";

export async function POST(req: Request, { params }: { params: { orgId: string; employeeId: string } }) {
  try {
    const auth = await requireAuth();
    // ← Solo Super Admin puede RESTAURAR
    if (!auth.isSuperAdmin) return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });

    await restoreEmployee({ orgId: params.orgId, employeeId: params.employeeId });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    const msg = e?.message || "Internal error";
    const st = msg==="NotFound" ? 404 : msg==="Unauthorized" ? 401 : msg==="Forbidden" ? 403 : 500;
    return NextResponse.json({ ok:false, error: msg }, { status: st });
  }
}
