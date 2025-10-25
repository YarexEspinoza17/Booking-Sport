import { prisma } from "@/lib/prisma";

export async function GET() {
  // cuenta canchas (o cualquier tabla que tengas)
  const [row] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    "select count(*)::int as n from court"
  );
  return Response.json({ ok: true, courts: row?.n ?? 0 });
}
