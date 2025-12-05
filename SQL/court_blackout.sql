-- Asegurar que starts_at < ends_at
alter table public.court_blackout
  add constraint court_blackout_valid_range_chk
  check (starts_at < ends_at);

-- Columna generada con el rango de tiempo
alter table public.court_blackout
  add column period tstzrange
  generated always as (tstzrange(starts_at, ends_at, '[)')) stored;

-- Índices de apoyo
create index if not exists idx_court_blackout_court_id on public.court_blackout(court_id);
create index if not exists idx_court_blackout_period_gist on public.court_blackout using gist (period);

-- No permitir solapamientos por cancha (ignorando soft-delete)
alter table public.court_blackout
  add constraint court_blackout_no_overlap
  exclude using gist (
    court_id with =,
    period  with &&
  ) where (is_deleted = false);
