// app/api/public/payments/init/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTilopayOrder } from "@/lib/tilopay";

export async function POST(req: NextRequest) {
  try {
    const { hold_id } = await req.json();

    if (!hold_id) {
      return NextResponse.json(
        { ok: false, error: "hold_id is required" },
        { status: 400 },
      );
    }

    // 1. Buscar el hold real en reservation_hold
    const hold = await prisma.reservation_hold.findUnique({
      where: { id: hold_id },
    });

    if (!hold) {
      return NextResponse.json(
        { ok: false, error: "Hold not found" },
        { status: 404 },
      );
    }

    if (hold.status !== "ACTIVE") { // ajusta al valor de tu enum hold_status
      return NextResponse.json(
        { ok: false, error: "Hold must be ACTIVE to start payment" },
        { status: 400 },
      );
    }

    // 2. Calcular monto (debería venir de tu motor de precios)
    // Por ahora un ejemplo fijo:
    const amount_int = 5000;
    const currency = "CRC"; // coincide con tu enum ccy

    // 3. Crear Payment ligado al hold
    const payment = await prisma.payment.create({
      data: {
        org_id: hold.org_id,
        hold_id: hold.id,
        amount_int,
        currency: currency as any,     // si ccy es enum; ajusta según lo tengas
        status: "INITIATED",           // valor de tu payment_status
        provider: "tilopay",
      },
    });

    // 4. URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const returnUrl = `${baseUrl}/public/checkout/result?paymentId=${payment.id}`;
    const webhookUrl = `${baseUrl}/api/public/payments/webhook`;

    // 5. Crear orden en Tilopay
    const tilopayOrder = await createTilopayOrder({
      amount: amount_int,
      currency,
      internalPaymentId: payment.id,
      returnUrl,
      webhookUrl,
    });

    // 6. Guardar external_id (order_id)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { external_id: tilopayOrder.orderId },
    });

    // 7. Responder al frontend
    return NextResponse.json({
      ok: true,
      redirect_url: tilopayOrder.redirectUrl,
    });
  } catch (error) {
    console.error("Error en /payments/init:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
