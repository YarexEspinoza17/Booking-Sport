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
