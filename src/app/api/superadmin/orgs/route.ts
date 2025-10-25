export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const orgs = await prisma.org.findMany({
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json(orgs);
}

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null) as { name?: string; slug?: string };
  const name = (body?.name ?? "").trim();
  const slug = (body?.slug ?? "").trim().toLowerCase();

  if (!name || !slug) {
    return NextResponse.json({ error: "name y slug son requeridos" }, { status: 400 });
  }

  try {
    const created = await prisma.org.create({
      data: { name, slug },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error creando org" }, { status: 500 });
  }
}
