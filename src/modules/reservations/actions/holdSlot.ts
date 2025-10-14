"use server";

import { prisma } from "@/src/db/client";
import { redis } from "@/src/lib/redis";
import { getOrganizationFromRequest } from "@/src/lib/tenancy";
import { z } from "zod";

const HoldSchema = z.object({
  venueId: z.string().uuid(),
  courtId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  priceCrc: z.number().int().positive(),
});

export async function holdSlot(input: z.infer<typeof HoldSchema>) {
  const { organizationId } = await getOrganizationFromRequest();
  if (!organizationId) throw new Error("Organización no resuelta");

  const data = HoldSchema.parse(input);
  const lockKey = `lock:${data.courtId}:${data.startTime}-${data.endTime}`;

  // TTL 10 minutos
  const lock = await redis.set(lockKey, "1", "NX", "EX", 60 * 10);
  if (!lock) throw new Error("El espacio ya está siendo tomado.");

  try {
    // Conflictos:
    const overlap = await prisma.reservation.findFirst({
      where: {
        courtId: data.courtId,
        status: { in: ["HELD", "PENDING_PAYMENT", "CONFIRMED"] },
        startTime: { lt: new Date(data.endTime) },
        endTime:   { gt: new Date(data.startTime) },
      },
    });
    if (overlap) throw new Error("Existe una reserva en conflicto.");

    const resv = await prisma.reservation.create({
      data: {
        organizationId,
        venueId: data.venueId,
        courtId: data.courtId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        priceCrc: data.priceCrc,
        status: "HELD",
      },
      select: { id: true }
    });

    await prisma.reservationHold.create({
      data: {
        organizationId,
        venueId: data.venueId,
        courtId: data.courtId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return { reservationId: resv.id };
  } catch (err) {
    await redis.del(lockKey);
    throw err;
  }
}
