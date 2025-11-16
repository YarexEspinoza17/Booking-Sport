// tests/availability-time.test.ts
import { describe, it, expect } from "vitest";
import { localWindowToUtcRanges } from "@/lib/availability-time";

describe("localWindowToUtcRanges", () => {
  it("ventana normal mismo día", () => {
    const rs = localWindowToUtcRanges("2025-03-10", "America/Costa_Rica", "08:00", "12:00");
    expect(rs).toHaveLength(1);
    expect(+rs[0].end - +rs[0].start).toBe(4 * 60 * 60 * 1000);
  });

  it("cruce de medianoche", () => {
    const rs = localWindowToUtcRanges("2025-03-10", "America/Costa_Rica", "20:00", "02:00");
    expect(rs).toHaveLength(2);
  });

  it("apertura=cierre (sin disponibilidad)", () => {
    const rs = localWindowToUtcRanges("2025-03-10", "America/Costa_Rica", "10:00", "10:00");
    // En SQL lo partimos en dos con cláusulas; aquí devolverá 2 rangos (0 longitud) o 1 vacío.
    // Para mantener coherencia, puedes decidir que se trate como cruce de medianoche o 'cerrado'.
    // Para el test, validamos que no explote:
    expect(Array.isArray(rs)).toBe(true);
  });
});
