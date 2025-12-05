--
-- PostgreSQL database dump
--

\restrict lQzRGST5VPhLvRvDLga3FniDUdcyzGbIEmVEKvForUjNWuJk76wWreQUBc2O1Dc

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2025-12-05 10:36:13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5425 (class 1262 OID 32772)
-- Name: booking_sport; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE booking_sport WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_United States.1252';


ALTER DATABASE booking_sport OWNER TO postgres;

\unrestrict lQzRGST5VPhLvRvDLga3FniDUdcyzGbIEmVEKvForUjNWuJk76wWreQUBc2O1Dc
\connect booking_sport
\restrict lQzRGST5VPhLvRvDLga3FniDUdcyzGbIEmVEKvForUjNWuJk76wWreQUBc2O1Dc

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 3 (class 3079 OID 32810)
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- TOC entry 5426 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- TOC entry 2 (class 3079 OID 32773)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5427 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 1102 (class 1247 OID 33461)
-- Name: ccy; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ccy AS ENUM (
    'CRC',
    'USD'
);


ALTER TYPE public.ccy OWNER TO postgres;

--
-- TOC entry 1156 (class 1247 OID 65541)
-- Name: hold_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.hold_status AS ENUM (
    'ACTIVE',
    'RELEASED',
    'EXPIRED',
    'USED'
);


ALTER TYPE public.hold_status OWNER TO postgres;

--
-- TOC entry 1111 (class 1247 OID 33484)
-- Name: payment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_status AS ENUM (
    'INITIATED',
    'PENDING',
    'AUTHORIZED',
    'PAID',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);


ALTER TYPE public.payment_status OWNER TO postgres;

--
-- TOC entry 1108 (class 1247 OID 33474)
-- Name: reservation_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reservation_status AS ENUM (
    'HELD',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED',
    'CHECKED_IN',
    'NO_SHOW'
);


ALTER TYPE public.reservation_status OWNER TO postgres;

--
-- TOC entry 1105 (class 1247 OID 33466)
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'OWNER',
    'ADMIN',
    'STAFF'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- TOC entry 347 (class 1255 OID 90124)
-- Name: fn_available_windows(uuid, date, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_available_windows(p_court_id uuid, p_date date, p_duration_min integer, p_step_min integer) RETURNS TABLE(start_at timestamp with time zone, end_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
  day_start  timestamptz := p_date::timestamptz;  -- inicio del día (00:00) en tz del servidor
  slot_start timestamptz;
  slot_end   timestamptz;
  i          int;
BEGIN
  -- Recorre el día en pasos de p_step_min
  FOR i IN 0 .. ((24 * 60 - p_duration_min) / p_step_min) LOOP
    slot_start := day_start + make_interval(mins => i * p_step_min);
    slot_end   := slot_start + make_interval(mins => p_duration_min);

    IF fn_is_available(p_court_id, slot_start, slot_end) THEN
      start_at := slot_start;
      end_at   := slot_end;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.fn_available_windows(p_court_id uuid, p_date date, p_duration_min integer, p_step_min integer) OWNER TO postgres;

--
-- TOC entry 329 (class 1255 OID 90126)
-- Name: fn_is_available(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_is_available(p_court_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_range tstzrange := tstzrange(p_start_at, p_end_at, '[)');
BEGIN
  -- 1) Reservas que bloquean
  IF EXISTS (
    SELECT 1
    FROM reservation r
    WHERE r.court_id = p_court_id
      AND r.status IN ('HELD', 'CONFIRMED')  -- 👈 tus enums reales
      AND tstzrange(r.start_time, r.end_time, '[)') && v_range
  ) THEN
    RETURN false;
  END IF;

  -- 2) Holds activos que bloquean
  IF EXISTS (
    SELECT 1
    FROM reservation_hold h
    WHERE h.court_id = p_court_id
      AND h.status = 'ACTIVE'               -- asumiendo enum hold_status con ACTIVE
      AND h.expires_at > now()
      AND tstzrange(h.starts_at, h.ends_at, '[)') && v_range
  ) THEN
    RETURN false;
  END IF;

  -- 3) Bloqueos de cancha
  IF EXISTS (
    SELECT 1
    FROM court_blackout b
    WHERE b.court_id = p_court_id
      AND tstzrange(b.starts_at, b.ends_at, '[)') && v_range
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION public.fn_is_available(p_court_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone) OWNER TO postgres;

--
-- TOC entry 459 (class 1255 OID 90127)
-- Name: fn_price_preview(uuid, uuid, uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_price_preview(p_org_id uuid, p_site_id uuid, p_court_id uuid, p_start timestamp with time zone, p_end timestamp with time zone) RETURNS integer
    LANGUAGE sql
    AS $$
  SELECT COALESCE(SUM(r.price_int), 0)
  FROM reservation r
  WHERE r.org_id  = p_org_id
    AND r.site_id = p_site_id
    AND r.court_id = p_court_id
    AND tstzrange(r.start_time, r.end_time, '[)')
        && tstzrange(p_start, p_end, '[)');
$$;


ALTER FUNCTION public.fn_price_preview(p_org_id uuid, p_site_id uuid, p_court_id uuid, p_start timestamp with time zone, p_end timestamp with time zone) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 33499)
-- Name: app_super_admin; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_super_admin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_super_admin OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 33645)
-- Name: court; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.court (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    site_id uuid NOT NULL,
    court_type_id uuid NOT NULL,
    name text NOT NULL,
    buffer_before_minutes integer DEFAULT 0 NOT NULL,
    buffer_after_minutes integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.court OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 33692)
-- Name: court_blackout; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.court_blackout (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    court_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp(6) with time zone,
    period tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)'::text)) STORED,
    CONSTRAINT court_blackout_valid_range_chk CHECK ((starts_at < ends_at))
);


ALTER TABLE public.court_blackout OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 98308)
-- Name: court_price_range; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.court_price_range (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    court_id uuid NOT NULL,
    dow integer NOT NULL,
    start_local time(6) without time zone NOT NULL,
    end_local time(6) without time zone NOT NULL,
    amount_int integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    currency public.ccy DEFAULT 'CRC'::public.ccy NOT NULL,
    CONSTRAINT court_price_range_amount_int_check CHECK ((amount_int >= 0)),
    CONSTRAINT court_price_range_dow_check CHECK (((dow >= 0) AND (dow <= 6)))
);


ALTER TABLE public.court_price_range OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 33618)
-- Name: court_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.court_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.court_type OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 33711)
-- Name: court_weekly_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.court_weekly_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    court_id uuid NOT NULL,
    dow integer NOT NULL,
    start_local time without time zone NOT NULL,
    end_local time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp(6) with time zone,
    local_span int4range GENERATED ALWAYS AS (int4range(((EXTRACT(epoch FROM start_local))::integer / 60), ((EXTRACT(epoch FROM end_local))::integer / 60), '[)'::text)) STORED,
    CONSTRAINT court_weekly_schedule_dow_check CHECK (((dow >= 0) AND (dow <= 6))),
    CONSTRAINT court_weekly_schedule_valid_span_chk CHECK ((start_local < end_local))
);


ALTER TABLE public.court_weekly_schedule OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 33729)
-- Name: customer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    email text,
    phone text,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.customer OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 33743)
-- Name: employee; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role public.user_role DEFAULT 'STAFF'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.employee OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 33760)
-- Name: employee_site; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_site (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    site_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp(6) with time zone
);


ALTER TABLE public.employee_site OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 33526)
-- Name: org; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


ALTER TABLE public.org OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 33538)
-- Name: org_domain; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_domain (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.org_domain OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 33875)
-- Name: payment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    reservation_id uuid,
    provider text DEFAULT 'tilopay'::text NOT NULL,
    external_id text,
    status public.payment_status DEFAULT 'INITIATED'::public.payment_status NOT NULL,
    currency public.ccy DEFAULT 'CRC'::public.ccy NOT NULL,
    amount_int integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hold_id uuid NOT NULL
);


ALTER TABLE public.payment OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 33816)
-- Name: reservation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reservation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    site_id uuid NOT NULL,
    court_id uuid NOT NULL,
    customer_id uuid,
    created_by uuid,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    effective_range tstzrange NOT NULL,
    currency public.ccy DEFAULT 'CRC'::public.ccy NOT NULL,
    price_int integer NOT NULL,
    status public.reservation_status DEFAULT 'HELD'::public.reservation_status NOT NULL,
    hold_expires_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text NOT NULL,
    cancelled_at timestamp with time zone,
    cancel_reason text
);


ALTER TABLE public.reservation OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 65547)
-- Name: reservation_hold; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reservation_hold (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    site_id uuid NOT NULL,
    court_id uuid NOT NULL,
    customer_id uuid,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    status public.hold_status DEFAULT 'ACTIVE'::public.hold_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hold_range tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)'::text)) STORED,
    CONSTRAINT reservation_hold_starts_before_ends CHECK ((starts_at < ends_at))
);


ALTER TABLE public.reservation_hold OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 33571)
-- Name: site; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'America/Costa_Rica'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    address character varying,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.site OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 33587)
-- Name: webhook_event; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_event (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    event_type text NOT NULL,
    external_id text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_id uuid
);


ALTER TABLE public.webhook_event OWNER TO postgres;

--
-- TOC entry 5185 (class 2606 OID 33509)
-- Name: app_super_admin app_super_admin_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_super_admin
    ADD CONSTRAINT app_super_admin_email_key UNIQUE (email);


--
-- TOC entry 5187 (class 2606 OID 33507)
-- Name: app_super_admin app_super_admin_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_super_admin
    ADD CONSTRAINT app_super_admin_pkey PRIMARY KEY (id);


--
-- TOC entry 5207 (class 2606 OID 57359)
-- Name: court_blackout court_blackout_no_overlap; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_blackout
    ADD CONSTRAINT court_blackout_no_overlap EXCLUDE USING gist (court_id WITH =, period WITH &&) WHERE ((is_deleted = false));


--
-- TOC entry 5209 (class 2606 OID 33700)
-- Name: court_blackout court_blackout_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_blackout
    ADD CONSTRAINT court_blackout_pkey PRIMARY KEY (id);


--
-- TOC entry 5204 (class 2606 OID 33656)
-- Name: court court_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court
    ADD CONSTRAINT court_pkey PRIMARY KEY (id);


--
-- TOC entry 5242 (class 2606 OID 98316)
-- Name: court_price_range court_price_range_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_price_range
    ADD CONSTRAINT court_price_range_pkey PRIMARY KEY (id);


--
-- TOC entry 5244 (class 2606 OID 98329)
-- Name: court_price_range court_price_range_unique_range; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_price_range
    ADD CONSTRAINT court_price_range_unique_range UNIQUE (court_id, dow, start_local, end_local);


--
-- TOC entry 5202 (class 2606 OID 33626)
-- Name: court_type court_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_type
    ADD CONSTRAINT court_type_pkey PRIMARY KEY (id);


--
-- TOC entry 5213 (class 2606 OID 57406)
-- Name: court_weekly_schedule court_weekly_schedule_no_overlap; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_weekly_schedule
    ADD CONSTRAINT court_weekly_schedule_no_overlap EXCLUDE USING gist (court_id WITH =, dow WITH =, local_span WITH &&) WHERE ((is_deleted = false));


--
-- TOC entry 5215 (class 2606 OID 33718)
-- Name: court_weekly_schedule court_weekly_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_weekly_schedule
    ADD CONSTRAINT court_weekly_schedule_pkey PRIMARY KEY (id);


--
-- TOC entry 5219 (class 2606 OID 33737)
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- TOC entry 5221 (class 2606 OID 33754)
-- Name: employee employee_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_email_key UNIQUE (email);


--
-- TOC entry 5223 (class 2606 OID 33752)
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (id);


--
-- TOC entry 5225 (class 2606 OID 33766)
-- Name: employee_site employee_site_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_site
    ADD CONSTRAINT employee_site_pkey PRIMARY KEY (id);


--
-- TOC entry 5193 (class 2606 OID 33548)
-- Name: org_domain org_domain_domain_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_domain
    ADD CONSTRAINT org_domain_domain_key UNIQUE (domain);


--
-- TOC entry 5195 (class 2606 OID 33546)
-- Name: org_domain org_domain_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_domain
    ADD CONSTRAINT org_domain_pkey PRIMARY KEY (id);


--
-- TOC entry 5189 (class 2606 OID 33535)
-- Name: org org_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org
    ADD CONSTRAINT org_pkey PRIMARY KEY (id);


--
-- TOC entry 5191 (class 2606 OID 33537)
-- Name: org org_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org
    ADD CONSTRAINT org_slug_key UNIQUE (slug);


--
-- TOC entry 5234 (class 2606 OID 33888)
-- Name: payment payment_external_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_external_id_key UNIQUE (external_id);


--
-- TOC entry 5236 (class 2606 OID 33886)
-- Name: payment payment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (id);


--
-- TOC entry 5227 (class 2606 OID 81925)
-- Name: reservation reservation_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_code_key UNIQUE (code);


--
-- TOC entry 5240 (class 2606 OID 65559)
-- Name: reservation_hold reservation_hold_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation_hold
    ADD CONSTRAINT reservation_hold_pkey PRIMARY KEY (id);


--
-- TOC entry 5232 (class 2606 OID 33826)
-- Name: reservation reservation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_pkey PRIMARY KEY (id);


--
-- TOC entry 5197 (class 2606 OID 33581)
-- Name: site site_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site
    ADD CONSTRAINT site_pkey PRIMARY KEY (id);


--
-- TOC entry 5199 (class 2606 OID 33595)
-- Name: webhook_event webhook_event_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_event
    ADD CONSTRAINT webhook_event_pkey PRIMARY KEY (id);


--
-- TOC entry 5205 (class 1259 OID 33904)
-- Name: court_site_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX court_site_id_idx ON public.court USING btree (site_id);


--
-- TOC entry 5210 (class 1259 OID 57356)
-- Name: idx_court_blackout_court_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_court_blackout_court_id ON public.court_blackout USING btree (court_id);


--
-- TOC entry 5211 (class 1259 OID 57357)
-- Name: idx_court_blackout_period_gist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_court_blackout_period_gist ON public.court_blackout USING gist (period);


--
-- TOC entry 5245 (class 1259 OID 98327)
-- Name: idx_court_price_range_court_dow_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_court_price_range_court_dow_start ON public.court_price_range USING btree (court_id, dow, start_local);


--
-- TOC entry 5216 (class 1259 OID 57392)
-- Name: idx_court_weekly_schedule_court_dow; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_court_weekly_schedule_court_dow ON public.court_weekly_schedule USING btree (court_id, dow);


--
-- TOC entry 5217 (class 1259 OID 57404)
-- Name: idx_court_weekly_schedule_span_gist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_court_weekly_schedule_span_gist ON public.court_weekly_schedule USING gist (local_span);


--
-- TOC entry 5237 (class 1259 OID 65581)
-- Name: idx_reservation_hold_court_range_gist; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservation_hold_court_range_gist ON public.reservation_hold USING gist (court_id, hold_range);


--
-- TOC entry 5238 (class 1259 OID 65580)
-- Name: idx_reservation_hold_status_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reservation_hold_status_expires ON public.reservation_hold USING btree (status, expires_at);


--
-- TOC entry 5228 (class 1259 OID 33900)
-- Name: reservation_court_id_start_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reservation_court_id_start_time_idx ON public.reservation USING btree (court_id, start_time);


--
-- TOC entry 5229 (class 1259 OID 33901)
-- Name: reservation_effective_range_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reservation_effective_range_idx ON public.reservation USING gist (effective_range);


--
-- TOC entry 5230 (class 1259 OID 33899)
-- Name: reservation_org_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX reservation_org_id_idx ON public.reservation USING btree (org_id);


--
-- TOC entry 5200 (class 1259 OID 73745)
-- Name: webhook_event_provider_external_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX webhook_event_provider_external_id_key ON public.webhook_event USING btree (provider, external_id);


--
-- TOC entry 5253 (class 2606 OID 33706)
-- Name: court_blackout court_blackout_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_blackout
    ADD CONSTRAINT court_blackout_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id);


--
-- TOC entry 5254 (class 2606 OID 33701)
-- Name: court_blackout court_blackout_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_blackout
    ADD CONSTRAINT court_blackout_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5250 (class 2606 OID 33667)
-- Name: court court_court_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court
    ADD CONSTRAINT court_court_type_id_fkey FOREIGN KEY (court_type_id) REFERENCES public.court_type(id);


--
-- TOC entry 5251 (class 2606 OID 33657)
-- Name: court court_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court
    ADD CONSTRAINT court_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5273 (class 2606 OID 98322)
-- Name: court_price_range court_price_range_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_price_range
    ADD CONSTRAINT court_price_range_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id);


--
-- TOC entry 5274 (class 2606 OID 98317)
-- Name: court_price_range court_price_range_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_price_range
    ADD CONSTRAINT court_price_range_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5252 (class 2606 OID 33662)
-- Name: court court_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court
    ADD CONSTRAINT court_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.site(id);


--
-- TOC entry 5249 (class 2606 OID 33627)
-- Name: court_type court_type_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_type
    ADD CONSTRAINT court_type_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5255 (class 2606 OID 33724)
-- Name: court_weekly_schedule court_weekly_schedule_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_weekly_schedule
    ADD CONSTRAINT court_weekly_schedule_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id);


--
-- TOC entry 5256 (class 2606 OID 33719)
-- Name: court_weekly_schedule court_weekly_schedule_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.court_weekly_schedule
    ADD CONSTRAINT court_weekly_schedule_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5257 (class 2606 OID 33738)
-- Name: customer customer_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5258 (class 2606 OID 33755)
-- Name: employee employee_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5259 (class 2606 OID 33767)
-- Name: employee_site employee_site_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_site
    ADD CONSTRAINT employee_site_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employee(id);


--
-- TOC entry 5260 (class 2606 OID 33772)
-- Name: employee_site employee_site_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_site
    ADD CONSTRAINT employee_site_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.site(id);


--
-- TOC entry 5246 (class 2606 OID 33549)
-- Name: org_domain org_domain_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_domain
    ADD CONSTRAINT org_domain_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5266 (class 2606 OID 73735)
-- Name: payment payment_hold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_hold_id_fkey FOREIGN KEY (hold_id) REFERENCES public.reservation_hold(id);


--
-- TOC entry 5267 (class 2606 OID 33889)
-- Name: payment payment_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5268 (class 2606 OID 33894)
-- Name: payment payment_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- TOC entry 5261 (class 2606 OID 33837)
-- Name: reservation reservation_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id);


--
-- TOC entry 5262 (class 2606 OID 33847)
-- Name: reservation reservation_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employee(id);


--
-- TOC entry 5263 (class 2606 OID 33842)
-- Name: reservation reservation_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- TOC entry 5269 (class 2606 OID 65570)
-- Name: reservation_hold reservation_hold_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation_hold
    ADD CONSTRAINT reservation_hold_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.court(id);


--
-- TOC entry 5270 (class 2606 OID 65575)
-- Name: reservation_hold reservation_hold_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation_hold
    ADD CONSTRAINT reservation_hold_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- TOC entry 5271 (class 2606 OID 65560)
-- Name: reservation_hold reservation_hold_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation_hold
    ADD CONSTRAINT reservation_hold_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5272 (class 2606 OID 65565)
-- Name: reservation_hold reservation_hold_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation_hold
    ADD CONSTRAINT reservation_hold_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.site(id);


--
-- TOC entry 5264 (class 2606 OID 33827)
-- Name: reservation reservation_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5265 (class 2606 OID 33832)
-- Name: reservation reservation_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.site(id);


--
-- TOC entry 5247 (class 2606 OID 33582)
-- Name: site site_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site
    ADD CONSTRAINT site_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id);


--
-- TOC entry 5248 (class 2606 OID 73740)
-- Name: webhook_event webhook_event_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_event
    ADD CONSTRAINT webhook_event_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payment(id);


-- Completed on 2025-12-05 10:36:14

--
-- PostgreSQL database dump complete
--

\unrestrict lQzRGST5VPhLvRvDLga3FniDUdcyzGbIEmVEKvForUjNWuJk76wWreQUBc2O1Dc

