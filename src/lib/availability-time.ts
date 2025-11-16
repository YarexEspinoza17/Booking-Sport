// lib/availability-time.ts
export function localWindowToUtcRanges(
    dateISO: string,           // "2025-11-12"
    tz: string,                // "America/Costa_Rica"
    opensLocalHHMM: string,    // "06:00"
    closesLocalHHMM: string    // "22:00" (o "02:00" si cruza medianoche)
  ): Array<{ start: Date; end: Date }> {
    const d = new Date(`${dateISO}T00:00:00`);
    // Usar Intl.DateTimeFormat no convierte a UTC; para tests puros sin DB,
    // usa resoluciones relativas o una lib como luxon. Aquí es esquemático:
    // En producción, lo resolvemos en SQL con AT TIME ZONE (ya implementado).
    // Para test de lógica de “cruce de medianoche”, simulamos:
    const [oH, oM] = opensLocalHHMM.split(":").map(Number);
    const [cH, cM] = closesLocalHHMM.split(":").map(Number);
    const opens = new Date(d); opens.setHours(oH, oM, 0, 0);
    let closes = new Date(d); closes.setHours(cH, cM, 0, 0);
  
    if (closes <= opens) {
      // cruza medianoche
      const midnight = new Date(d); midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0,0,0,0);
      const nextClose = new Date(d); nextClose.setDate(nextClose.getDate() + 1);
      nextClose.setHours(cH, cM, 0, 0);
      return [{ start: opens, end: midnight }, { start: midnight, end: nextClose }];
    }
    return [{ start: opens, end: closes }];
  }
  