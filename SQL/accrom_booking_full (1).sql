-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_super_admin (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text,
  password_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_super_admin_pkey PRIMARY KEY (id)
);
CREATE TABLE public.court (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid NOT NULL,
  court_type_id uuid NOT NULL,
  name text NOT NULL,
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT court_pkey PRIMARY KEY (id),
  CONSTRAINT court_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id),
  CONSTRAINT court_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.site(id),
  CONSTRAINT court_court_type_id_fkey FOREIGN KEY (court_type_id) REFERENCES public.court_type(id)
);
CREATE TABLE public.court_base_price (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  court_id uuid NOT NULL UNIQUE,
  currency USER-DEFINED NOT NULL DEFAULT 'CRC'::ccy,
  amount_int integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT court_base_price_pkey PRIMARY KEY (id),
  CONSTRAINT court_base_price_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id),
  CONSTRAINT court_base_price_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id)
);
CREATE TABLE public.court_blackout (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  court_id uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT court_blackout_pkey PRIMARY KEY (id),
  CONSTRAINT court_blackout_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id),
  CONSTRAINT court_blackout_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id)
);
CREATE TABLE public.court_type (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT court_type_pkey PRIMARY KEY (id),
  CONSTRAINT court_type_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id)
);
CREATE TABLE public.court_weekly_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  court_id uuid NOT NULL,
  dow integer NOT NULL CHECK (dow >= 0 AND dow <= 6),
  start_local time without time zone NOT NULL,
  end_local time without time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT court_weekly_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT court_weekly_schedule_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id),
  CONSTRAINT court_weekly_schedule_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id)
);
CREATE TABLE public.customer (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  email text,
  phone text,
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_pkey PRIMARY KEY (id),
  CONSTRAINT customer_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id)
);
CREATE TABLE public.employee (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  role USER-DEFINED NOT NULL DEFAULT 'STAFF'::user_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employee_pkey PRIMARY KEY (id),
  CONSTRAINT employee_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id)
);
CREATE TABLE public.employee_site (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  site_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employee_site_pkey PRIMARY KEY (id),
  CONSTRAINT employee_site_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee(id),
  CONSTRAINT employee_site_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.site(id)
);
CREATE TABLE public.org (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_deleted boolean DEFAULT false,
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT org_pkey PRIMARY KEY (id)
);
CREATE TABLE public.org_domain (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  domain text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT org_domain_pkey PRIMARY KEY (id),
  CONSTRAINT org_domain_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id)
);
CREATE TABLE public.payment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'tilopay'::text,
  external_id text NOT NULL UNIQUE,
  status USER-DEFINED NOT NULL DEFAULT 'INITIATED'::payment_status,
  currency USER-DEFINED NOT NULL DEFAULT 'CRC'::ccy,
  amount_int integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_pkey PRIMARY KEY (id),
  CONSTRAINT payment_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id),
  CONSTRAINT payment_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id)
);
CREATE TABLE public.price_rule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  court_id uuid NOT NULL,
  dow integer CHECK (dow >= 0 AND dow <= 6),
  start_local time without time zone,
  end_local time without time zone,
  multiplier numeric,
  add_int integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT price_rule_pkey PRIMARY KEY (id),
  CONSTRAINT price_rule_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id),
  CONSTRAINT price_rule_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id)
);
CREATE TABLE public.reservation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid NOT NULL,
  court_id uuid NOT NULL,
  customer_id uuid,
  created_by uuid,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  effective_range tstzrange NOT NULL,
  currency USER-DEFINED NOT NULL DEFAULT 'CRC'::ccy,
  price_int integer NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'HELD'::reservation_status,
  hold_expires_at timestamp with time zone,
  payment_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservation_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id),
  CONSTRAINT reservation_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.site(id),
  CONSTRAINT reservation_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id),
  CONSTRAINT reservation_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id),
  CONSTRAINT reservation_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employee(id)
);
CREATE TABLE public.reservation_hold (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid NOT NULL,
  court_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservation_hold_pkey PRIMARY KEY (id),
  CONSTRAINT reservation_hold_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.site(id),
  CONSTRAINT reservation_hold_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id),
  CONSTRAINT reservation_hold_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id)
);
CREATE TABLE public.site (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Costa_Rica'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  address character varying,
  is_deleted boolean DEFAULT false,
  CONSTRAINT site_pkey PRIMARY KEY (id),
  CONSTRAINT site_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id)
);
CREATE TABLE public.webhook_event (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT webhook_event_pkey PRIMARY KEY (id)
);