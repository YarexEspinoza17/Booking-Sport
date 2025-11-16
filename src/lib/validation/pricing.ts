// src/lib/validation/pricing.ts
import { z } from "zod";

export const BasePriceUpsertZ = z.object({
  currency: z.string().length(3).toUpperCase(),  // debe coincidir con su enum ccy (CRC/USD)
  amount_int: z.number().int().nonnegative()
});

export const PriceRuleCreateZ = z.object({
  dow: z.number().int().min(0).max(6).nullable().optional(), // null/omitir = no filtra por día
  start_local: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  end_local: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  multiplier: z.union([z.number(), z.string()]).optional()
    .transform(v => v === undefined ? undefined : Number(v)),
  add_int: z.number().int().optional(),
}).superRefine((d, ctx) => {
  const s = d.start_local;
  const e = d.end_local;
  if ((s && !e) || (!s && e)) {
    ctx.addIssue({ code: "custom", message: "Inicio y Fin deben venir juntos o ambos vacíos" });
  }
  if (s && e && e <= s) {
    ctx.addIssue({ code: "custom", message: "Fin debe ser mayor que Inicio" });
  }
  if (d.multiplier !== undefined && d.multiplier <= 0) {
    ctx.addIssue({ code: "custom", message: "Multiplier debe ser > 0" });
  }
});
