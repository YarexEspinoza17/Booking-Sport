// lib/pricing/resolve.ts
import { prisma } from "@/lib/prisma";

/** Convierte "HH:mm" a minutos desde 00:00 */
function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Obtiene HH:mm local a partir de Date y zona */
function getLocalHHMM(dt: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(dt);
  const h = parts.find((p) => p.type === "hour")!.value;
  const m = parts.find((p) => p.type === "minute")!.value;
  return `${h}:${m}`;
}

/**
 * Resuelve el precio de una reserva simple:
 * - Toma la hora de inicio (startsAtISO),
 * - La convierte a hora local de la organización,
 * - Busca en court_price_range el rango cuyo DOW y ventana [start_local, end_local)
 *   contenga esa hora,
 * - Devuelve el precio fijo y la moneda de ese rango.
 */
export async function resolveCourtPriceSimple(args: {
  orgId: string;
  courtId: string;
  startsAtISO: string; // ISO con offset
  orgTimeZone?: string; // por defecto America/Costa_Rica
}) {
  const tz = args.orgTimeZone ?? "America/Costa_Rica";
  const start = new Date(args.startsAtISO);
  if (isNaN(start.getTime())) throw new Error("startsAt inválido");

  // --- Fecha y hora local ---
  // Día de la semana local (0 = dom .. 6 = sáb)
  const localStr = start.toLocaleString("en-US", { timeZone: tz });
  const localDate = new Date(localStr);
  const localDow = localDate.getDay(); // 0..6

  // Hora local HH:mm y a minutos
  const hhmm = getLocalHHMM(start, tz);
  const startMin = hhmmToMinutes(hhmm);

  // --- Buscar rangos para esa cancha ---
  const ranges = await prisma.court_price_range.findMany({
    where: {
      org_id: args.orgId,
      court_id: args.courtId,
    },
    orderBy: [{ dow: "asc" }, { start_local: "asc" }, { id: "asc" }],
  });

  // Encontrar el rango cuyo DOW coincida y cuyo span contenga la hora de inicio
  const match = ranges.find((r) => {
    if (r.dow !== localDow) return false;

    // start_local / end_local son @db.Time => Prisma los expone como Date (1970-01-01T..Z)
    const sMinutes =
      r.start_local.getUTCHours() * 60 + r.start_local.getUTCMinutes();
    const eMinutes =
      r.end_local.getUTCHours() * 60 + r.end_local.getUTCMinutes();

    return sMinutes <= startMin && startMin < eMinutes;
  });

  if (!match) {
    throw new Error(
      "No hay rango de precio configurado para la fecha y hora seleccionadas"
    );
  }

  // En el nuevo esquema el precio final ES el del rango
  const finalInt = match.amount_int;

  return {
    currency: match.currency,
    // Estos nombres se mantienen por compatibilidad con código existente
    base_amount_int: match.amount_int,
    rule_applied: {
      id: match.id,
      dow: match.dow,
      start_local: match.start_local,
      end_local: match.end_local,
      amount_int: match.amount_int,
      currency: match.currency,
    },
    final_amount_int: Math.max(0, finalInt),
  };
}
