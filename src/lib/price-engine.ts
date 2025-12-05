// src/lib/price-engine.ts
import { resolveCourtPriceSimple } from "@/lib/pricing/resolve";

/**
 * Calcula el precio entero y la moneda para una reserva.
 * Mantiene la firma anterior (start/end) para compatibilidad,
 * pero actualmente solo usa start para buscar el rango horario.
 */
export async function computePriceInt(
  orgId: string,
  courtId: string,
  start: Date,
  end: Date
): Promise<{ priceInt: number; currency: string }> {
  if (
    !(start instanceof Date) ||
    !(end instanceof Date) ||
    isNaN(start.getTime()) ||
    isNaN(end.getTime()) ||
    end <= start
  ) {
    throw new Error("INVALID_RANGE");
  }

  // Usa el nuevo motor basado en court_price_range
  const res = await resolveCourtPriceSimple({
    orgId,
    courtId,
    startsAtISO: start.toISOString(),
  });

  // Normalizar la moneda: internamente siempre usamos ISO ("CRC" | "USD")
  const rawCurrency = (res.currency || "").toString().trim();

  const currencyNormalized =
    rawCurrency === "CRC" || rawCurrency === "USD"
      ? rawCurrency
      : rawCurrency === "₡"
        ? "CRC"
        : "USD"; // fallback defensivo

  return {
    priceInt: res.final_amount_int,
    currency: currencyNormalized,
  };
}
