// app/api/public/sites/route.ts
import { NextRequest, NextResponse } from "next/server";
import {prisma} from "@/lib/prisma";
import { requireOrgFromRequest } from "@/lib/org-context";

export async function GET(req: NextRequest) {
  const { org, error } = await requireOrgFromRequest(req);

  if (!org) {
    return NextResponse.json(
      { ok: false, error },
      { status: 400 },
    );
  }

  const sites = await prisma.site.findMany({
    where: {
      org_id: org.id,
      is_deleted: false,
    },
    orderBy: { created_at: "asc" },
  });

  return NextResponse.json({ ok: true, data: sites });
}
