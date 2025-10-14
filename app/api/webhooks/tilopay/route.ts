import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/client";
import { env } from "@/src/lib/env";

// TODO: reemplazar con verificación real de firma de Tilopay.
// Debes leer el header que envíe Tilopay (p.ej. x-tilopay-signature) y validar HMAC con TILOPAY_WEBHOOK_SECRET.
function verifyTilopaySignature(req: NextRequest, rawBody: string): boolean {
  // Placeholder: siempre true en este starter.
  return !!env.TILOPAY_WEBHOOK_SECRET;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureValid = verifyTilopaySignature(req, rawBody);
  if (!signatureValid) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const externalId = event?.id || event?.data?.id || null;
  const status = event?.data?.status || event?.status;
  const reservationId = event?.data?.metadata?.reservationId || null;
  const amountCrc = event?.data?.amount || 0;

  if (!externalId || !reservationId || !status) {
    return NextResponse.json({ error: "Campos insuficientes" }, { status: 400 });
  }

  // Idempotencia
  const existing = await prisma.webhookEvent.findUnique({ where: { externalId } });
  if (existing) return NextResponse.json({ ok: true, idempotent: true });

  // Guarda el evento
  await prisma.webhookEvent.create({
    data: {
      provider: "tilopay",
      eventType: status,
      externalId,
      payload: event as any,
    },
  });

  // Upsert Payment + update Reservation
  const payment = await prisma.payment.upsert({
    where: { externalId },
    create: {
      organizationId: "unknown", // opcional: vincula por reservation.organizationId
      reservationId,
      provider: "tilopay",
      externalId,
      status: "INITIATED",
      amountCrc: amountCrc || 0,
    },
    update: {},
  });

  let newStatus: "CONFIRMED" | "CANCELLED" | null = null;
  if (status === "CAPTURED" || status === "AUTHORIZED") {
    newStatus = "CONFIRMED";
    await prisma.payment.update({ where: { externalId }, data: { status: "CAPTURED" } });
  } else if (status === "FAILED" || status === "REFUNDED") {
    newStatus = "CANCELLED";
    await prisma.payment.update({ where: { externalId }, data: { status: status === "REFUNDED" ? "REFUNDED" : "FAILED" } });
  }

  if (newStatus) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { status: newStatus },
    });
  }

  return NextResponse.json({ ok: true });
}
