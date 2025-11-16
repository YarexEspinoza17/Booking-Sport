import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { updateEmployee, softDeleteEmployee } from "@/server/employees.service";

const UpdateSchema = z.object({
  full_name: z.string().max(120).nullable().optional(),
  role: z.enum(["OWNER","SITE_ADMIN","STAFF"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { orgId: string; employeeId: string } }) {
  try {
    const auth = await requireAuth();
    // ← Solo Super Admin puede EDITAR
    if (!auth.isSuperAdmin) return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok:false, error:"Invalid body" }, { status: 400 });

    await updateEmployee({ orgId: params.orgId, employeeId: params.employeeId, ...parsed.data });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    const msg = e?.message || "Internal error";
    const st = msg==="NotFound" ? 404 : msg==="Unauthorized" ? 401 : msg==="Forbidden" ? 403 : 500;
    return NextResponse.json({ ok:false, error: msg }, { status: st });
  }
}

export async function DELETE(req: Request, { params }: { params: { orgId: string; employeeId: string } }) {
  try {
    const auth = await requireAuth();
    // ← Solo Super Admin puede ELIMINAR
    if (!auth.isSuperAdmin) return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });

    await softDeleteEmployee({ orgId: params.orgId, employeeId: params.employeeId });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    const msg = e?.message || "Internal error";
    const st = msg==="NotFound" ? 404 : msg==="Unauthorized" ? 401 : msg==="Forbidden" ? 403 : 500;
    return NextResponse.json({ ok:false, error: msg }, { status: st });
  }
}
