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
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(dt);
  const h = parts.find(p => p.type === "hour")!.value;
  const m = parts.find(p => p.type === "minute")!.value;
  return `${h}:${m}`;
}

export async function resolveCourtPriceSimple(args: {
  orgId: string;
  courtId: string;
  startsAtISO: string;           // ISO con offset
  orgTimeZone?: string;          // por defecto America/Costa_Rica
}) {
  const tz = args.orgTimeZone ?? "America/Costa_Rica";
  const start = new Date(args.startsAtISO);
  if (isNaN(start.getTime())) throw new Error("startsAt inválido");

  // 1) Base
  const base = await prisma.court_base_price.findUnique({ where: { court_id: args.courtId } });
  if (!base) throw new Error("No hay base price configurado para la cancha");
  let finalInt = base.amount_int;

  // 2) Reglas coincidentes (última gana)
  const dow = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .formatToParts(start)
    .find(p => p.type === "weekday")!.value); // esto no da 0..6; mejor usa getDay con fecha local

  // Usamos getDay local:
  const localStr = start.toLocaleString("en-US", { timeZone: tz });
  const localDate = new Date(localStr);
  const localDow = localDate.getDay(); // 0..6
  const hhmm = getLocalHHMM(start, tz);
  const nowMin = hhmmToMinutes(hhmm);

  const rules = await prisma.price_rule.findMany({
    where: { org_id: args.orgId, court_id: args.courtId },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

  const matches = rules.filter(r => {
    // DOW: si r.dow es null, no filtra; si no, debe coincidir
    if (r.dow !== null && r.dow !== undefined && r.dow !== localDow) return false;
    // Horas: si ambas null => no filtra; si no, verificar ventana
    if (r.start_local && r.end_local) {
      const s = getLocalHHMM(r.start_local as unknown as Date, "UTC"); // guardamos como 1970-01-01T..Z
      const e = getLocalHHMM(r.end_local   as unknown as Date, "UTC");
      const sm = hhmmToMinutes(s);
      const em = hhmmToMinutes(e);
      if (!(sm <= nowMin && nowMin < em)) return false;
    }
    return true;
  });

  const last = matches.length ? matches[matches.length - 1] : null;

  if (last) {
    if (last.multiplier !== null && last.multiplier !== undefined) {
      finalInt = Math.round(finalInt * Number(last.multiplier));
    }
    if (last.add_int !== null && last.add_int !== undefined) {
      finalInt += last.add_int;
    }
  }

  return {
    currency: base.currency,
    base_amount_int: base.amount_int,
    rule_applied: last ? { id: last.id, dow: last.dow, multiplier: last.multiplier, add_int: last.add_int } : null,
    final_amount_int: Math.max(0, finalInt),
  };
}
