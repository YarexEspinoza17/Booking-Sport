// src/app/api/public/payments/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Genera un código de reserva tipo ABC12345
function generateReservationCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { paymentId, code, order, tilopayTransaction, description } =
      await req.json();

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "paymentId is required" },
        { status: 400 },
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        reservation: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { ok: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    // Idempotencia fuera de la transacción:
    // si ya está pagado y tiene reserva, devolvemos el código existente
    if (payment.status === "PAID" && payment.reservation) {
      return NextResponse.json({
        ok: true,
        reservationCode: payment.reservation.code,
      });
    }

    // code = "1" => aprobado según Tilopay
    const isApproved = code === "1";

    // Si Tilopay reporta rechazo, marcamos FAILED y salimos
    if (!isApproved) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Payment not approved",
          tilopayCode: code,
          description,
        },
        { status: 400 },
      );
    }

    // Pago aprobado -> confirmar reserva desde el hold
    const reservationInfo = await prisma.$transaction(async (tx) => {
      const freshPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        select: {
          id: true,
          status: true,
          hold_id: true,
          org_id: true,
          amount_int: true,
          currency: true,
          reservation_id: true,
        },
      });

      if (!freshPayment) {
        throw new Error("Payment not found inside transaction");
      }

      // Idempotencia dentro de la transacción:
      // si ya está PAID y tiene reservation_id, devolvemos la reserva existente
      if (freshPayment.status === "PAID" && freshPayment.reservation_id) {
        const existing = await tx.reservation.findUnique({
          where: { id: freshPayment.reservation_id },
          select: { id: true, code: true },
        });
        if (existing) {
          return { id: existing.id, code: existing.code };
        }
      }

      if (!freshPayment.hold_id) {
        throw new Error("Payment has no hold_id");
      }

      // Actualizar Payment a PAID (si todavía no lo está)
      if (freshPayment.status !== "PAID") {
        await tx.payment.update({
          where: { id: freshPayment.id },
          data: { status: "PAID" },
        });
      }

      // Marcar el hold como USED mientras esté ACTIVE
      // Usamos updateMany para evitar P2025 en reintentos
      const updated = await tx.reservation_hold.updateMany({
        where: {
          id: freshPayment.hold_id,
          status: "ACTIVE",
        },
        data: {
          status: "USED",
        },
      });

      if (updated.count === 0) {
        // No rompemos la transacción, solo dejamos registro.
        console.warn(
          `[payments/confirm] Hold ${freshPayment.hold_id} no estaba ACTIVE (posible reintento)`,
        );
      }

      // Obtenemos el hold para leer org/site/court/fechas
      const hold = await tx.reservation_hold.findUnique({
        where: { id: freshPayment.hold_id },
      });

      if (!hold) {
        throw new Error("Reservation hold not found inside transaction");
      }

      const reservationCode = generateReservationCode();

      // Insert crudo en reservation para respetar el esquema real
      const rows = await tx.$queryRaw<
        { id: string; code: string }[]
      >`INSERT INTO "public"."reservation"
        ("org_id", "site_id", "court_id", "customer_id",
         "start_time", "end_time", "effective_range",
         "currency", "price_int", "status",
         "hold_expires_at",
         "code")
        VALUES (
          ${hold.org_id}::uuid,
          ${hold.site_id}::uuid,
          ${hold.court_id}::uuid,
          ${hold.customer_id}::uuid,
          ${hold.starts_at}::timestamptz,
          ${hold.ends_at}::timestamptz,
          tstzrange(
            ${hold.starts_at}::timestamptz,
            ${hold.ends_at}::timestamptz,
            '[)'
          ),
          ${freshPayment.currency}::ccy,
          ${freshPayment.amount_int}::integer,
          'CONFIRMED',
          ${hold.expires_at}::timestamptz,
          ${reservationCode}
        )
        RETURNING "id", "code"
      `;

      if (!rows || rows.length === 0) {
        throw new Error("RAW INSERT into reservation did not return any row");
      }

      const created = rows[0];

      // Vincular Payment -> Reservation
      await tx.payment.update({
        where: { id: freshPayment.id },
        data: { reservation_id: created.id },
      });

      return { id: created.id, code: created.code };
    });

    if (!reservationInfo) {
      return NextResponse.json(
        { ok: false, error: "Unable to confirm reservation" },
        { status: 500 },
      );
    }

    // Devolvemos el código de la reserva para que el frontend haga /reservations/[code]
    return NextResponse.json({
      ok: true,
      reservationCode: reservationInfo.code,
    });
  } catch (error) {
    console.error("Error en /payments/confirm:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
