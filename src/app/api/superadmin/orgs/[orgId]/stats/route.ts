import { NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/guards"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await requireSuperAdmin(req)
  const orgId = params.id

  const [sites, courts, reservations, confirmedPayments] = await Promise.all([
    prisma.site.count({ where: { org_id: orgId } }),
    prisma.court.count({ where: { org_id: orgId } }),
    prisma.reservation.count({ where: { org_id: orgId } }),
    prisma.payment.aggregate({
      where: { org_id: orgId, status: { in: ["CAPTURED", "AUTHORIZED"] } },
      _sum: { amount_int: true }
    })
  ])

  return Response.json({
    ok: true,
    stats: {
      sites,
      courts,
      reservations,
      revenue_int: confirmedPayments._sum.amount_int ?? 0
    }
  })
}
