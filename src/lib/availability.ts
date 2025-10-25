// lib/availability.ts
import { query } from "./db";

/** Llama fn_is_available (true/false) */
export async function isAvailable(courtId: string, starts: string, ends: string): Promise<boolean> {
  const rows = await query<{ fn_is_available: boolean }>(
    `select fn_is_available($1::uuid, $2::timestamptz, $3::timestamptz)`,
    courtId, starts, ends
  );
  return !!rows[0]?.fn_is_available;
}

/** Llama fn_available_windows para listar ventanas continuas */
export async function availableWindows(
  courtId: string,
  dateISO: string,          // YYYY-MM-DD
  durationMin: number,      // ej. 120
  stepMin = 30
) {
  return query<{ start_at: string; end_at: string }>(
    `select * from fn_available_windows($1::uuid, $2::date, $3::int, $4::int) order by start_at`,
    courtId, dateISO, durationMin, stepMin
  );
}
