-- Extensiones necesarias
create extension if not exists btree_gist; -- permite EXCLUDE con uuid/int + ranges

-- 1) Franja válida
alter table public.court_weekly_schedule
  add constraint court_weekly_schedule_valid_span_chk
  check (start_local < end_local);

-- 2) Rango [start, end) en minutos SIN columnas intermedias
--    (extract(epoch from time)/60)::int => minutos desde medianoche
alter table public.court_weekly_schedule
  add column local_span int4range
  generated always as (
    int4range(
      (extract(epoch from start_local)::int / 60),
      (extract(epoch from end_local)::int   / 60),
      '[)'
    )
  ) stored;

-- 3) Índices de apoyo
create index if not exists idx_court_weekly_schedule_court_dow
  on public.court_weekly_schedule(court_id, dow);

create index if not exists idx_court_weekly_schedule_span_gist
  on public.court_weekly_schedule using gist (local_span);

-- 4) No solapamientos por cancha y día (ignorando soft-delete)
alter table public.court_weekly_schedule
  add constraint court_weekly_schedule_no_overlap
  exclude using gist (
    court_id  with =,
    dow       with =,
    local_span with &&
  ) where (is_deleted = false);
