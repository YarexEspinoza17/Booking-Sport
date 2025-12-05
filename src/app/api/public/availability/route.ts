// src/app/api/public/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Granularidad de los slots
const STEP_MIN = 5;

const QuerySchema = z.object({
  site_id: z.string().uuid(),
  court_type_id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  duration_min: z.coerce.number().int().positive().max(24 * 60),
  tz: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      site_id: url.searchParams.get("site_id"),
      court_type_id: url.searchParams.get("court_type_id") || undefined,
      date: url.searchParams.get("date"),
      duration_min: url.searchParams.get("duration_min"),
      tz: url.searchParams.get("tz") || undefined,
    });

    // 1) Obtener timezone del sitio si no viene en el query
    const site = await prisma.site.findUnique({
      where: { id: parsed.site_id },
      select: { id: true, timezone: true },
    });
    if (!site) {
      return NextResponse.json(
        { ok: false, error: "Site no encontrado" },
        { status: 404 },
      );
    }
    const tz = parsed.tz ?? site.timezone;

    // 2) Query RAW: genera slots desde court_weekly_schedule
    const rows = await prisma.$queryRaw<
      {
        court_id: string;
        court_name: string;
        court_type_id: string | null;
        slot_start: Date;
        slot_end: Date;
      }[]
    >`
WITH params AS (
  SELECT
    ${parsed.date}::date AS d,
    ${parsed.duration_min}::int AS duration_min,
    ${STEP_MIN}::int AS step_min,
    ${tz}::text AS tz
),
courts AS (
  SELECT
    c.id,
    c.name,
    c.court_type_id,
    c.buffer_before_minutes,
    c.buffer_after_minutes
  FROM public.court c
  WHERE c.site_id = ${parsed.site_id}::uuid
    AND c.active = true
    AND (${parsed.court_type_id}::uuid IS NULL OR c.court_type_id = ${parsed.court_type_id}::uuid)
),

-- HORARIO SEMANAL: court_weekly_schedule con start_local / end_local
ws AS (
  SELECT
    c.*,
    w.start_local,
    w.end_local
  FROM courts c
  JOIN public.court_weekly_schedule w ON w.court_id = c.id
  JOIN params p ON TRUE
  WHERE w.dow = EXTRACT(DOW FROM p.d)::int
    AND (w.is_deleted IS NULL OR w.is_deleted = false)
),

-- Rangos de apertura en UTC para el día pedido
open_ranges AS (
  SELECT
    w.id AS court_id,
    w.name AS court_name,
    w.court_type_id,
    -- construimos el timestamp local concatenando fecha + hora
    ((p.d::text || ' ' || w.start_local::text)::timestamp AT TIME ZONE p.tz) AS opens_utc,
    ((p.d::text || ' ' || w.end_local::text)::timestamp   AT TIME ZONE p.tz) AS closes_utc,
    w.buffer_before_minutes,
    w.buffer_after_minutes
  FROM ws w
  CROSS JOIN params p
),

-- Solo soportamos horarios que NO cruzan medianoche (closes_utc > opens_utc)
split_ranges AS (
  SELECT
    o.court_id,
    o.court_name,
    o.court_type_id,
    tstzrange(o.opens_utc, o.closes_utc, '[)') AS open_range,
    o.buffer_before_minutes,
    o.buffer_after_minutes
  FROM open_ranges o
  WHERE o.closes_utc > o.opens_utc
),

-- Slots candidatos
candidate_slots AS (
  SELECT
    s.court_id,
    s.court_name,
    s.court_type_id,
    s.buffer_before_minutes,
    s.buffer_after_minutes,
    gs AS slot_start,
    gs + make_interval(mins := p.duration_min) AS slot_end
  FROM split_ranges s
  CROSS JOIN params p
  CROSS JOIN LATERAL generate_series(
    lower(s.open_range),
    upper(s.open_range) - make_interval(mins := p.duration_min),
    make_interval(mins := p.step_min)
  ) AS gs
),

slot_ranges AS (
  SELECT
    c.*,
    tstzrange(c.slot_start, c.slot_end, '[)') AS slot_range
  FROM candidate_slots c
),

-- Blackouts: court_blackout.period (tstzrange)
bl AS (
  SELECT
    b.court_id,
    b.period AS blocked
  FROM public.court_blackout b
  JOIN params p ON TRUE
  WHERE b.period && tstzrange(
    (p.d::timestamp AT TIME ZONE 'UTC'),
    ((p.d + INTERVAL '1 day')::timestamp AT TIME ZONE 'UTC'),
    '[)'
  )
),

-- Reservas confirmadas (start_time / end_time) + buffers
res AS (
  SELECT
    r.court_id,
    tstzrange(
      (r.start_time - make_interval(mins := c.buffer_before_minutes)),
      (r.end_time   + make_interval(mins := c.buffer_after_minutes)),
      '[)'
    ) AS blocked
  FROM public.reservation r
  JOIN params p ON TRUE
  JOIN courts c ON c.id = r.court_id
  WHERE r.status = 'CONFIRMED'
    AND r.end_time   > (p.d::timestamp AT TIME ZONE 'UTC')
    AND r.start_time < ((p.d + INTERVAL '1 day')::timestamp AT TIME ZONE 'UTC')
),

-- Holds activos/no expirados: reservation_hold + buffers
h AS (
  SELECT
    h.court_id,
    tstzrange(
      (h.starts_at - make_interval(mins := c.buffer_before_minutes)),
      (h.ends_at   + make_interval(mins := c.buffer_after_minutes)),
      '[)'
    ) AS blocked
  FROM public.reservation_hold h
  JOIN params p ON TRUE
  JOIN courts c ON c.id = h.court_id
  WHERE h.status = 'ACTIVE'
    AND h.expires_at > now()
    AND h.ends_at   > (p.d::timestamp AT TIME ZONE 'UTC')
    AND h.starts_at < ((p.d + INTERVAL '1 day')::timestamp AT TIME ZONE 'UTC')
),

blocked AS (
  SELECT * FROM bl
  UNION ALL
  SELECT * FROM res
  UNION ALL
  SELECT * FROM h
)

SELECT
  s.court_id,
  s.court_name,
  s.court_type_id,
  s.slot_start,
  s.slot_end
FROM slot_ranges s
LEFT JOIN blocked b
  ON b.court_id = s.court_id AND b.blocked && s.slot_range
WHERE b.court_id IS NULL
ORDER BY s.court_name, s.slot_start;
    `;

    // 3) Agrupar por cancha para la respuesta
    const grouped = rows.reduce((acc: Record<string, {
      court_id: string;
      court_name: string;
      court_type_id: string | null;
      slots: { start: string; end: string }[];
    }>, r: { court_id: string; court_name: string; court_type_id: string | null; slot_start: Date; slot_end: Date }) => {
      const key = r.court_id;
      if (!acc[key]) {
        acc[key] = {
          court_id: r.court_id,
          court_name: r.court_name,
          court_type_id: r.court_type_id,
          slots: [] as Array<{ start: string; end: string }>,
        };
      }
      acc[key].slots.push({
        start: r.slot_start.toISOString(),
        end: r.slot_end.toISOString(),
      });
      return acc;
    }, {} as Record<
      string,
      {
        court_id: string;
        court_name: string;
        court_type_id: string | null;
        slots: { start: string; end: string }[];
      }
    >);

    return NextResponse.json({
      ok: true,
      site_id: parsed.site_id,
      date: parsed.date,
      duration_min: parsed.duration_min,
      tz,
      courts: Object.values(grouped),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Error" },
      { status: 400 },
    );
  }
}
