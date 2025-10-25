import { NextRequest } from "next/server"
import { requireSuperAdmin } from "@/lib/guards"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await requireSuperAdmin(req)
  const { password } = await req.json() as { password?: string }
  if (!password || password.length < 8) {
    return Response.json({ ok:false, msg: "password >= 8 chars" }, { status: 400 })
  }
  const password_hash = await bcrypt.hash(password, 10)
  try {
    await prisma.employee.update({
      where: { id: params.id },
      data: { password_hash }
    })
    return Response.json({ ok:true })
  } catch (e: any) {
    return Response.json({ ok:false, msg: e.message }, { status: 400 })
  }
}
