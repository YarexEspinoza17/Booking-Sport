import { NextResponse } from "next/server";
import { requireAuth, canManageSite } from "@/lib/auth";
import { assignEmployeeToSite, revokeEmployeeFromSite } from "@/server/employees.service";

export async function POST(req: Request, { params }: { params: { orgId: string; siteId: string; employeeId: string } }) {
  try {
    const auth = await requireAuth();
    if (!canManageSite(auth, params.orgId, params.siteId)) {
      return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });
    }
    const id = await assignEmployeeToSite({ orgId: params.orgId, siteId: params.siteId, employeeId: params.employeeId });
    return NextResponse.json({ ok:true, data:{ employee_site_id: id } });
  } catch (e:any) {
    const msg = e?.message || "Internal error";
    const st = msg==="NotFound" ? 404 : msg==="Unauthorized" ? 401 : msg==="Forbidden" ? 403 : 500;
    return NextResponse.json({ ok:false, error: msg }, { status: st });
  }
}

export async function DELETE(req: Request, { params }: { params: { orgId: string; siteId: string; employeeId: string } }) {
  try {
    const auth = await requireAuth();
    if (!canManageSite(auth, params.orgId, params.siteId)) {
      return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });
    }
    await revokeEmployeeFromSite({ orgId: params.orgId, siteId: params.siteId, employeeId: params.employeeId });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    const msg = e?.message || "Internal error";
    const st = msg==="NotFound" ? 404 : msg==="Unauthorized" ? 401 : msg==="Forbidden" ? 403 : 500;
    return NextResponse.json({ ok:false, error: msg }, { status: st });
  }
}
