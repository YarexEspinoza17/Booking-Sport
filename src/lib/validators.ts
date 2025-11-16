// lib/validators.ts
import { z } from "zod";

export const OrgCreateSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  domains: z.array(z.string().min(1)).optional(),
  // opcional: crear 1 sede y su admin
  site: z.object({
    name: z.string().min(2),
    timezone: z.string().optional()
  }).optional(),
  admin: z.object({
    email: z.string().email(),
    full_name: z.string().optional(),
    password: z.string().min(8)
  }).optional()
});

export const OrgUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  domains: z.array(z.string().min(1)).optional()
});

export const SiteCreateSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(2),
  timezone: z.string().optional(),
  admin: z.object({
    email: z.string().email(),
    full_name: z.string().optional(),
    password: z.string().min(8)
  }).optional()
});

export const SiteUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  timezone: z.string().optional()
});


export const WeeklyCreateSchema = z.object({
  dow: z.number().int().min(0).max(6),
  start_local: z.string().regex(/^\d{2}:\d{2}$/), // "HH:mm"
  end_local: z.string().regex(/^\d{2}:\d{2}$/),
});

export const WeeklyUpdateSchema = WeeklyCreateSchema.partial();

export const BlackoutCreateSchema = z.object({
  // acepta "2025-11-10T09:00", "2025-11-10T09:00:00Z", etc.
  starts_at: z.coerce.date(),
  ends_at:   z.coerce.date(),
  reason:    z.string().max(250).optional().nullable(),
});

export const BlackoutUpdateSchema = BlackoutCreateSchema.partial();



