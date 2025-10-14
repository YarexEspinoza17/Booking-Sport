# ACCROM Booking Starter (Next.js + Prisma + Supabase)

Arquitectura base para un sistema de reservas multi-tenant (subdominios por organización),
con bloqueo temporal de horarios (holds con Redis) e integración de pagos (Tilopay) vía webhook
con idempotencia.

## Stack
- Next.js (App Router, Server Actions)
- Prisma ORM + PostgreSQL (Supabase compatible)
- Redis (ioredis) para locks/holds
- NextAuth (placeholder) para autenticación
- Webhook Tilopay con verificación (placeholder) e idempotencia

## Cómo empezar
```bash
# 1) Instala deps
npm i

# 2) Copia variables
cp .env.local.example .env.local

# 3) Ajusta DATABASE_URL a tu instancia de Supabase/Postgres

# 4) Genera la DB
npm run migrate

# 5) (Opcional) abre Prisma Studio
npm run studio

# 6) Ejecuta el proyecto
npm run dev
```

## Multitenant por subdominio
- El `middleware.ts` extrae el subdominio y lo coloca en una cabecera `x-org` (puedes reemplazarlo con un lookup real en DB).
- Usa `getOrganizationFromRequest()` para resolver el tenant en Server Actions, Route Handlers y páginas.

## Holds y Concurrencia
- `holdSlot` crea un lock con TTL en Redis, valida solapamientos, crea una Reservation en estado HELD y
  un registro en `ReservationHold`. Si algo falla, libera el lock.
- Un job (no incluido) puede limpiar holds expirados y cancelar reservas HELD vencidas (Vercel Cron / worker).

## Webhook Tilopay
- Route Handler en `app/api/webhooks/tilopay/route.ts` con verificación de firma (stub) e idempotencia via `WebhookEvent.externalId`.
- Actualiza `Payment` y `Reservation` según el estado reportado (CAPTURED/FAILED).
