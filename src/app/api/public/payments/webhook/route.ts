// src/app/api/public/payments/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTilopaySignature } from "@/lib/tilopay";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") ?? "";

    // 1. Verificar firma de Tilopay
    const valid = verifyTilopaySignature(rawBody, signature);
    if (!valid) {
      console.error("Firma Tilopay inválida");
      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 400 },
      );
    }

    const body = JSON.parse(rawBody);

    // Ajusta estos campos a lo que Tilopay envía realmente
    const orderId = body.order_id as string;               // Lo guardaste en payment.external_id
    const eventId = (body.event_id ?? orderId) as string;  // Si no hay event_id, uso orderId
    const eventType = (body.event_type ?? "unknown") as string;
    const tilopayStatus = (body.status ?? "") as string;   // "PAID", "FAILED", "CANCELLED", etc.

    // 2. Buscar Payment por external_id
    const payment = await prisma.payment.findUnique({
      where: { external_id: orderId },
    });

    if (!payment) {
      // No conocemos este pago → respondemos 200 para no generar reintentos infinitos
      return NextResponse.json({ ok: true });
    }

    // 3. Guardar webhook_event (idempotente con @@unique(provider, external_id))
    try {
      await prisma.webhook_event.create({
        data: {
          provider: "tilopay",
          event_type: eventType,
          external_id: eventId,
          payment_id: payment.id,
          payload: body,
          // created_at usa el default del modelo
        },
      });
    } catch {
      // Si ya existe el evento, no reprocesamos (idempotencia)
      return NextResponse.json({ ok: true });
    }

    // 4. Mapear estado externo (Tilopay) a tu enum de payment_status (a nivel de código usamos strings)
    let internalStatus:
      | "INITIATED"
      | "PENDING"
      | "AUTHORIZED"
      | "PAID"
      | "FAILED"
      | "REFUNDED"
      | "CANCELLED"
      | null = null;

    if (tilopayStatus === "PAID" || tilopayStatus === "CAPTURED") {
      internalStatus = "PAID";
    } else if (tilopayStatus === "FAILED") {
      internalStatus = "FAILED";
    } else if (
      tilopayStatus === "CANCELLED" ||
      tilopayStatus === "CANCELED"
    ) {
      internalStatus = "CANCELLED";
    }

    // 5. Lógica principal: pago exitoso → crear reserva; fallo/cancelación → actualizar estado
    if (internalStatus === "PAID") {
      // Pago exitoso → confirmar reserva desde el hold
      await prisma.$transaction(async (tx: { payment: { findUnique: (arg0: { where: { id: any; }; select: { id: boolean; status: boolean; hold_id: boolean; org_id: boolean; amount_int: boolean; currency: boolean; }; }) => any; update: (arg0: { where: { id: any; } | { id: any; }; data: { status: string; } | { reservation_id: any; }; }) => any; }; reservation_hold: { update: (arg0: { where: { id: any; status: string; }; data: { status: string; }; }) => any; }; reservation: { create: (arg0: { data: { org_id: any; site_id: any; court_id: any; customer_id: any; start_time: any; end_time: any; currency: any; price_int: any; status: string; }; }) => any; }; }) => {
        const freshPayment = await tx.payment.findUnique({
          where: { id: payment.id },
          select: {
            id: true,
            status: true,
            hold_id: true,
            org_id: true,
            amount_int: true,
            currency: true,
          },
        });

        if (!freshPayment) return;

        // Si ya estaba PAID, no hacemos nada (idempotencia)
        if (freshPayment.status === "PAID") return;

        // a) Actualizar Payment a PAID
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "PAID" },
        });

        // b) Marcar el hold como USED (enum hold_status)
        const hold = await tx.reservation_hold.update({
          where: {
            id: freshPayment.hold_id,
            status: "ACTIVE",
          },
          data: {
            status: "USED",
          },
        });

        // c) Crear Reservation final desde el hold
        const reservation = await tx.reservation.create({
          data: {
            org_id: hold.org_id,
            site_id: hold.site_id,
            court_id: hold.court_id,
            customer_id: hold.customer_id,
            start_time: hold.starts_at,
            end_time: hold.ends_at,
            currency: freshPayment.currency,
            price_int: freshPayment.amount_int,
            status: "CONFIRMED", // enum reservation_status
            // effective_range lo rellena el default en la DB
          },
        });

        // d) Vincular Payment → Reservation
        await tx.payment.update({
          where: { id: payment.id },
          data: { reservation_id: reservation.id },
        });
      });
    } else if (internalStatus === "FAILED" || internalStatus === "CANCELLED") {
      // Pago fallido o cancelado → solo actualizar Payment
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: internalStatus },
      });
    } else {
      // Otros estados opcionales: PENDING, AUTHORIZED, etc.
      if (tilopayStatus === "PENDING") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "PENDING" },
        });
      } else if (tilopayStatus === "AUTHORIZED") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "AUTHORIZED" },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en webhook Tilopay:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
