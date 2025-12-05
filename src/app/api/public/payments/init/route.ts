// src/app/api/public/payments/init/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTilopayOrder } from "@/lib/tilopay";
import { computePriceInt } from "@/lib/price-engine";
import { findOrCreateCustomer } from "@/lib/customers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      console.error("Body inválido en /payments/init:", body);
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const hold_id: string | undefined =
      (body as any).hold_id ?? (body as any).holdId;

    const customerName: string | undefined =
      (body as any).customerName ?? (body as any).customer_name;

    const customerEmail: string | undefined =
      (body as any).customerEmail ?? (body as any).customer_email;

    const customerPhone: string | undefined =
      (body as any).customerPhone ?? (body as any).customer_phone;

    if (!hold_id || typeof hold_id !== "string") {
      console.error("Falta hold_id en /payments/init. Body:", body);
      return NextResponse.json(
        { ok: false, error: "hold_id is required" },
        { status: 400 },
      );
    }

    // 1. Buscar el hold
    const hold = await prisma.reservation_hold.findUnique({
      where: { id: hold_id },
    });

    if (!hold) {
      return NextResponse.json(
        { ok: false, error: "Hold not found" },
        { status: 404 },
      );
    }

    if (hold.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: "Hold must be ACTIVE to start payment" },
        { status: 400 },
      );
    }

    if (hold.expires_at <= new Date()) {
      return NextResponse.json(
        { ok: false, error: "Hold has expired" },
        { status: 400 },
      );
    }

    // 2. Asegurar que el hold tenga customer_id si tenemos datos del cliente
    let billingFullName: string | null = null;
    let billingEmail: string | null = null;
    let billingPhone: string | null = null;

    if (hold.customer_id) {
      // Ya hay cliente ligado al hold → lo usamos
      const cust = await prisma.customer.findUnique({
        where: { id: hold.customer_id },
      });

      if (cust) {
        billingFullName = cust.full_name ?? null;
        billingEmail = cust.email ?? null;
        billingPhone = cust.phone ?? null;
      }
    } else if (customerName || customerEmail) {
      // No hay customer_id en el hold, pero recibimos datos del formulario
      const fullName = customerName?.trim() || "Cliente";
      const customer = await findOrCreateCustomer({
        orgId: hold.org_id,
        fullName,
        email: customerEmail,
        phone: customerPhone,
      });

      // Actualizamos el hold para dejar ligado el customer
      await prisma.reservation_hold.update({
        where: { id: hold.id },
        data: { customer_id: customer.id },
      });

      billingFullName = customer.full_name ?? fullName;
      billingEmail = customer.email ?? customerEmail ?? null;
      billingPhone = customer.phone ?? customerPhone ?? null;
    }

    // 3. Calcular precio
    const { priceInt, currency } = await computePriceInt(
      hold.org_id,
      hold.court_id,
      hold.starts_at,
      hold.ends_at,
    );

    // Normalizar moneda a ISO (Tilopay exige "CRC" o "USD")
    const currencyIso =
      currency === "CRC" || currency === "USD"
        ? currency
        : currency === "₡"
          ? "CRC"
          : "USD";

    const amount_int = priceInt;
    if (!amount_int || amount_int <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid amount calculated from hold" },
        { status: 400 },
      );
    }

    // 4. Crear Payment
    const payment = await prisma.payment.create({
      data: {
        org_id: hold.org_id,
        hold_id: hold.id,
        amount_int,
        currency: currencyIso as any,
        status: "INITIATED",
        provider: "tilopay",
      },
    });

    // 5. Construir baseUrl (subdominio correcto)
    const host = req.headers.get("host") ?? "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // URL donde Tilopay hará el redirect al final (mismo subdominio)
    const redirectUrl = `${baseUrl}/checkout/result`;

    // returnData: enviamos el paymentId en base64
    const returnData = Buffer.from(
      JSON.stringify({ paymentId: payment.id }),
      "utf8",
    ).toString("base64");

    // 6. Armar billing para Tilopay usando datos reales si los tenemos
    const fullNameForBilling =
      billingFullName || customerName || "Cliente AUReady";
    const [firstNameRaw, ...restNameRaw] = fullNameForBilling.split(" ");
    const firstName = firstNameRaw || "Cliente";
    const lastName = restNameRaw.join(" ") || "Reserva";

    const emailForBilling =
      billingEmail || customerEmail || "no-reply@example.com";
    const phoneForBilling =
      billingPhone || customerPhone || "00000000";

    const billing = {
      firstName,
      lastName,
      address: "San José",     // luego lo puede parametrizar
      address2: "Costa Rica",
      city: "San José",
      state: "CR-SJ",
      zipCode: "10101",
      country: "CR",
      telephone: phoneForBilling,
      email: emailForBilling,
    };

    // 7. Crear orden en Tilopay
    const tilopayOrder = await createTilopayOrder({
      amount: amount_int,
      currency: currencyIso,
      internalPaymentId: payment.id,
      redirectUrl,
      returnData,
      billing,
    });

    // 8. Devolver URL de Tilopay al frontend
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
