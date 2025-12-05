// src/lib/validation/pricing.ts
import { z } from "zod";

export const CourtPriceRangeCreateZ = z
  .object({
    // 0 = lunes ... 6 = domingo
    dow: z
      .number({ required_error: "El día de la semana es obligatorio" })
      .int()
      .min(0, "dow debe ser entre 0 y 6")
      .max(6, "dow debe ser entre 0 y 6"),

    // Formato HH:mm
    start_local: z
      .string({ required_error: "La hora de inicio es obligatoria" })
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora de inicio inválida, use HH:mm"),

    end_local: z
      .string({ required_error: "La hora de fin es obligatoria" })
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora de fin inválida, use HH:mm"),

    amount_int: z
      .number({ required_error: "El precio es obligatorio" })
      .int("El precio debe ser entero")
      .nonnegative("El precio debe ser mayor o igual a cero"),

    currency: z.enum(["CRC", "USD"]).default("CRC"),
  })
  .refine((d) => d.start_local < d.end_local, {
    path: ["end_local"],
    message: "La hora de fin debe ser mayor que la hora de inicio",
  });
