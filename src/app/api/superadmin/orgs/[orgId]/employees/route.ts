import { NextResponse } from "next/server";
import { requireAuth, canManageOrg, canManageSite } from "@/lib/auth";
import { z } from "zod";
import { listEmployees, createEmployee } from "@/server/employees.service";
import { user_role } from "@prisma/client";

export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  try {
    const auth = await requireAuth();
    if (!canManageOrg(auth, params.orgId)) {
      return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const siteId = url.searchParams.get("site_id") || undefined;
    const page = Number(url.searchParams.get("page") ?? 1);
    const per  = Number(url.searchParams.get("per") ?? 10);
    const sort = (url.searchParams.get("sort") ?? "created_at") as "created_at"|"email"|"full_name";
    const dir  = (url.searchParams.get("dir") ?? "desc") as "asc"|"desc";

    const { total, data } = await listEmployees({ orgId: params.orgId, q, siteId, page, per, sort, dir });
    return NextResponse.json({ ok:true, data, meta:{ page, per, total } });
  } catch (e:any) {
    const msg = e?.message || "Internal error";
    const st = msg==="Unauthorized" ? 401 : msg==="Forbidden" ? 403 : 500;
    return NextResponse.json({ ok:false, error: msg }, { status: st });
  }
}

const CreateSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(120).optional(),
  role: z.nativeEnum(user_role).default(user_role.STAFF),
  site_ids: z.array(z.string().uuid()).optional(),
});

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  try {
    const auth = await requireAuth();
    // ← Solo Super Admin puede CREAR
    if (!auth.isSuperAdmin) return NextResponse.json({ ok:false, error:"Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok:false, error:"Invalid body" }, { status: 400 });

    // validación de sedes si no fuera superadmin (no aplica aquí, pero lo dejamos robusto)
    const site_ids = parsed.data.site_ids ?? [];
    if (!auth.isSuperAdmin && site_ids.length) {
      for (const sId of site_ids) {
        if (!canManageSite(auth, params.orgId, sId)) {
          return NextResponse.json({ ok:false, error:"Forbidden to assign one or more sites" }, { status: 403 });
        }
      }
    }

    const id = await createEmployee({ orgId: params.orgId, ...parsed.data });
    return NextResponse.json({ ok:true, data:{ id } }, { status: 201 });
  } catch (e:any) {
    if (e?.code === "P2002") return NextResponse.json({ ok:false, error:"Email ya está en uso" }, { status: 409 });
    const msg = e?.message || "Internal error";
    const st = msg==="Unauthorized" ? 401 : msg==="Forbidden" ? 403 : 500;
    return NextResponse.json({ ok:false, error: msg }, { status: st });
  }
}
