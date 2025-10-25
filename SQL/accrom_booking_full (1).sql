-- =========================================================
-- ACCROM Booking – Esquema completo para Supabase/Postgres
-- Multi-tenant (subdominios), reservas con buffers & holds,
-- precios por franja, pagos Tilopay con idempotencia,
-- RLS basada en org_id del JWT.
-- =========================================================

-- 0) Extensiones necesarias
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists btree_gist;    -- índices/EXCLUDE con rangos/equals

-- 1) Tipos ENUM
do $$
begin
  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type reservation_status as enum ('HELD','PENDING_PAYMENT','CONFIRMED','CANCELLED','REFUNDED','NO_SHOW');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('INITIATED','AUTHORIZED','CAPTURED','FAILED','REFUNDED','PARTIAL_REFUNDED');
  end if;

  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('ADMIN','STAFF','CUSTOMER');
  end if;

  if not exists (select 1 from pg_type where typname = 'ccy') then
    create type ccy as enum ('CRC','USD');
  end if;
end$$;

-- 2) Helpers
-- Acceso a claims del JWT (Supabase):
-- Recomendado: agregar 'org_id' dentro de app_metadata en el JWT.
create or replace function fn_current_org_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'org_id','')::uuid;
$$;

-- 3) Tablas núcleo de multi-tenant
create table if not exists org (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,          -- subdominio/segmento URL
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists org_domain (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  domain     text not null unique,          -- p.ej. palm-sports.accrom.app o dominio propio
  created_at timestamptz not null default now()
);

-- Sedes (venues/sites)
create table if not exists site (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  name       text not null,
  timezone   text not null default 'America/Costa_Rica',
  created_at timestamptz not null default now(),
  constraint uq_site_org_name unique (org_id, name)
);
create index if not exists idx_site_org on site(org_id);

-- Empleados (usuarios operativos del panel)
create table if not exists employee (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  email      text not null unique,
  full_name  text,
  role       user_role not null default 'STAFF',
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_org on employee(org_id);

-- Asignación de empleado a sede (opcional múltiples sedes)
create table if not exists employee_site (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employee(id) on delete cascade,
  site_id     uuid not null references site(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint uq_employee_site unique (employee_id, site_id)
);
create index if not exists idx_employee_site_site on employee_site(site_id);

-- 4) Catálogo de canchas
create table if not exists court_type (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  code       text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint uq_court_type unique (org_id, code)
);
create index if not exists idx_court_type_org on court_type(org_id);

create table if not exists court (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references org(id) on delete cascade,
  site_id       uuid not null references site(id) on delete cascade,
  court_type_id uuid not null references court_type(id) on delete restrict,
  name          text not null,
  buffer_before_minutes int not null default 0, -- buffer previo por reserva
  buffer_after_minutes  int not null default 0, -- buffer posterior
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint uq_court_name unique (org_id, site_id, name)
);
create index if not exists idx_court_org_site on court(org_id, site_id);
create index if not exists idx_court_type on court(court_type_id);

-- Disponibilidad semanal (horarios tipo)
create table if not exists court_weekly_schedule (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references org(id) on delete cascade,
  court_id    uuid not null references court(id) on delete cascade,
  dow         int  not null check (dow between 0 and 6), -- 0=Domingo
  start_local time not null,
  end_local   time not null,
  created_at  timestamptz not null default now(),
  constraint chk_cws_range check (end_local > start_local)
);
create index if not exists idx_cws_court_dow on court_weekly_schedule(court_id, dow, start_local, end_local);

-- Bloqueos por mantenimiento/eventos
create table if not exists court_blackout (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  court_id   uuid not null references court(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint chk_blackout check (ends_at > starts_at)
);
create index if not exists idx_blackout_range
  on court_blackout using gist (court_id, tstzrange(starts_at, ends_at, '[)'));

-- 5) Precios
create table if not exists court_base_price (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  court_id   uuid not null references court(id) on delete cascade,
  currency   ccy  not null default 'CRC',
  amount_int int  not null, -- precio por hora en unidades menores (centimos)
  created_at timestamptz not null default now(),
  constraint uq_court_base_price unique (court_id)
);
create index if not exists idx_cbp_org on court_base_price(org_id);

-- Reglas de precio por franja (opcional)
create table if not exists price_rule (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  court_id   uuid not null references court(id) on delete cascade,
  dow        int  null check (dow between 0 and 6), -- null = aplica todos
  start_local time null,
  end_local   time null,
  multiplier  numeric(6,3) null,  -- p.ej. 1.25 = +25%
  add_int     int null,           -- ajuste fijo (+/- en céntimos)
  created_at  timestamptz not null default now()
);
create index if not exists idx_price_rule_court on price_rule(court_id, dow, start_local, end_local);

-- 6) Clientes
create table if not exists customer (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  email      text,
  phone      text,
  full_name  text,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_org on customer(org_id);
create index if not exists idx_customer_phone on customer(org_id, phone);

-- 7) Reservas y holds
create table if not exists reservation (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references org(id) on delete cascade,
  site_id         uuid not null references site(id) on delete cascade,
  court_id        uuid not null references court(id) on delete cascade,
  customer_id     uuid references customer(id) on delete set null,
  created_by      uuid references employee(id) on delete set null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  effective_range tstzrange  not null,  -- con buffers aplicados
  currency        ccy not null default 'CRC',
  price_int       int not null,
  status          reservation_status not null default 'HELD',
  hold_expires_at timestamptz,
  payment_id      uuid,
  notes           text,
  created_at      timestamptz not null default now(),
  constraint chk_reservation_range check (end_time > start_time)
);
create index if not exists idx_reservation_org_site_court
  on reservation(org_id, site_id, court_id, start_time, end_time);
create index if not exists idx_reservation_status on reservation(status);
create index if not exists idx_reservation_effective
  on reservation using gist (court_id, effective_range);

-- Evita solapes usando el rango efectivo (bloquea HELD/PENDING_PAYMENT/CONFIRMED)
-- (1) Asegura que no exista previamente
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'ex_reservation_overlap'
      and conrelid = 'reservation'::regclass
  ) then
    alter table reservation drop constraint ex_reservation_overlap;
  end if;
end$$;

-- (2) Crea la EXCLUDE SIN NOT VALID (no se permite NOT VALID en EXCLUDE)
alter table reservation
  add constraint ex_reservation_overlap
  exclude using gist (
    court_id        with =,
    effective_range with &&
  )
  where (status in ('HELD','PENDING_PAYMENT','CONFIRMED'));

-- Holds en tabla separada (para auditoría/limpieza)
create table if not exists reservation_hold (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references org(id) on delete cascade,
  site_id    uuid not null references site(id) on delete cascade,
  court_id   uuid not null references court(id) on delete cascade,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_reservation_hold_main
  on reservation_hold(org_id, site_id, court_id, expires_at);

-- 8) Pagos (Tilopay)
create table if not exists payment (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references org(id) on delete cascade,
  reservation_id uuid not null references reservation(id) on delete cascade,
  provider       text not null default 'tilopay',
  external_id    text not null unique,  -- idempotencia por evento/transacción del proveedor
  status         payment_status not null default 'INITIATED',
  currency       ccy not null default 'CRC',
  amount_int     int not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_payment_org on payment(org_id);

-- Webhook log con idempotencia
create table if not exists webhook_event (
  id         uuid primary key default gen_random_uuid(),
  provider   text not null,
  event_type text not null,
  external_id text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  constraint uq_webhook_event unique (provider, external_id)
);

-- 9) Funciones/Triggers: buffers y expiración de holds

-- Calcula el rango efectivo aplicando buffers definidos en la cancha
create or replace function fn_reservation_apply_buffers()
returns trigger
language plpgsql
as $$
declare
  before_min int;
  after_min  int;
  s timestamptz;
  e timestamptz;
begin
  select buffer_before_minutes, buffer_after_minutes
    into before_min, after_min
    from court
   where id = new.court_id;

  s := new.start_time - make_interval(mins => coalesce(before_min,0));
  e := new.end_time   + make_interval(mins => coalesce(after_min,0));

  new.effective_range := tstzrange(s, e, '[)');
  return new;
end;
$$;

drop trigger if exists trg_reservation_buffers_ins on reservation;
create trigger trg_reservation_buffers_ins
before insert on reservation
for each row
execute function fn_reservation_apply_buffers();

drop trigger if exists trg_reservation_buffers_upd on reservation;
create trigger trg_reservation_buffers_upd
before update of start_time, end_time, court_id on reservation
for each row
execute function fn_reservation_apply_buffers();

-- Expiración automática de reservas en HELD (si hold_expires_at pasó)
create or replace function fn_expire_holds(now_ts timestamptz default now())
returns int
language plpgsql
as $$
declare
  n int;
begin
  update reservation r
     set status = 'CANCELLED'
   where r.status = 'HELD'
     and r.hold_expires_at is not null
     and r.hold_expires_at < now_ts;
  get diagnostics n = row_count;

  -- Limpia holds expirados
  delete from reservation_hold where expires_at < now_ts;

  return n;
end;
$$;

-- 10) RLS (Row Level Security) — BLOQUE CORREGIDO (sin IF NOT EXISTS)

-- Habilitar RLS
alter table org                     enable row level security;
alter table org_domain              enable row level security;
alter table site                    enable row level security;
alter table employee                enable row level security;
alter table employee_site           enable row level security;
alter table court_type              enable row level security;
alter table court                   enable row level security;
alter table court_weekly_schedule   enable row level security;
alter table court_blackout          enable row level security;
alter table court_base_price        enable row level security;
alter table price_rule              enable row level security;
alter table customer                enable row level security;
alter table reservation             enable row level security;
alter table reservation_hold        enable row level security;
alter table payment                 enable row level security;
alter table webhook_event           enable row level security;

-- ORG (ajusta si quieres restringir a service role en prod)
drop policy if exists org_select on org;
create policy org_select on org
  for select using (true);

drop policy if exists org_insert on org;
create policy org_insert on org
  for insert with check (true);

drop policy if exists org_update on org;
create policy org_update on org
  for update using (true) with check (true);

-- ORG_DOMAIN
drop policy if exists org_domain_rw on org_domain;
create policy org_domain_rw on org_domain
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- SITE
drop policy if exists site_rw on site;
create policy site_rw on site
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- EMPLOYEE
drop policy if exists employee_rw on employee;
create policy employee_rw on employee
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- EMPLOYEE_SITE
drop policy if exists employee_site_rw on employee_site;
create policy employee_site_rw on employee_site
  for all
  using (
    exists (select 1 from employee e where e.id = employee_id and e.org_id = fn_current_org_id())
    and exists (select 1 from site s where s.id = site_id and s.org_id = fn_current_org_id())
  )
  with check (
    exists (select 1 from employee e where e.id = employee_id and e.org_id = fn_current_org_id())
    and exists (select 1 from site s where s.id = site_id and s.org_id = fn_current_org_id())
  );

-- COURT_TYPE
drop policy if exists court_type_rw on court_type;
create policy court_type_rw on court_type
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- COURT
drop policy if exists court_rw on court;
create policy court_rw on court
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- COURT_WEEKLY_SCHEDULE
drop policy if exists cws_rw on court_weekly_schedule;
create policy cws_rw on court_weekly_schedule
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- COURT_BLACKOUT
drop policy if exists cblk_rw on court_blackout;
create policy cblk_rw on court_blackout
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- COURT_BASE_PRICE
drop policy if exists cbp_rw on court_base_price;
create policy cbp_rw on court_base_price
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- PRICE_RULE
drop policy if exists pr_rw on price_rule;
create policy pr_rw on price_rule
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- CUSTOMER
drop policy if exists customer_rw on customer;
create policy customer_rw on customer
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- RESERVATION
drop policy if exists reservation_rw on reservation;
create policy reservation_rw on reservation
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- RESERVATION_HOLD
drop policy if exists rh_rw on reservation_hold;
create policy rh_rw on reservation_hold
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- PAYMENT
drop policy if exists payment_rw on payment;
create policy payment_rw on payment
  for all
  using (org_id = fn_current_org_id())
  with check (org_id = fn_current_org_id());

-- WEBHOOK_EVENT (lectura opcional; inserts desde backend con service role)
drop policy if exists wh_select on webhook_event;
create policy wh_select on webhook_event
  for select using (true);

drop policy if exists wh_insert on webhook_event;
create policy wh_insert on webhook_event
  for insert with check (true);


-- 11) Checks de coherencia opcionales
-- Exigir hold_expires_at cuando status = HELD
alter table reservation
  drop constraint if exists chk_res_hold_expire;
alter table reservation
  add constraint chk_res_hold_expire
  check (status <> 'HELD' or hold_expires_at is not null);

-- 12) Semillas mínimas (opcional)
-- insert into org (slug, name) values ('demo-org','Demo Org') on conflict do nothing;

-- FIN DEL ESQUEMA
