--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: alert_alerttype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.alert_alerttype_enum AS ENUM (
    'sign_in',
    'delay',
    'sign_out',
    'duration'
);


ALTER TYPE public.alert_alerttype_enum OWNER TO postgres;

--
-- Name: cjobs_alertas_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_alertas_status_enum AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.cjobs_alertas_status_enum OWNER TO postgres;

--
-- Name: cjobs_alertas_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_alertas_type_enum AS ENUM (
    'entrance',
    'exit'
);


ALTER TYPE public.cjobs_alertas_type_enum OWNER TO postgres;

--
-- Name: cjobs_encuestasJobs_periodicity_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."cjobs_encuestasJobs_periodicity_enum" AS ENUM (
    'daily',
    'weekly',
    'monthly'
);


ALTER TYPE public."cjobs_encuestasJobs_periodicity_enum" OWNER TO postgres;

--
-- Name: cjobs_encuestasJobs_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."cjobs_encuestasJobs_type_enum" AS ENUM (
    'customer',
    'worker'
);


ALTER TYPE public."cjobs_encuestasJobs_type_enum" OWNER TO postgres;

--
-- Name: cjobs_fichajes_action_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_fichajes_action_enum AS ENUM (
    'clock_in',
    'clock_out',
    'break_start',
    'break_end',
    'lunch_start',
    'lunch_end'
);


ALTER TYPE public.cjobs_fichajes_action_enum OWNER TO postgres;

--
-- Name: cjobs_horarios_semanales_dayofweek_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_horarios_semanales_dayofweek_enum AS ENUM (
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
);


ALTER TYPE public.cjobs_horarios_semanales_dayofweek_enum OWNER TO postgres;

--
-- Name: cjobs_jobsCentros_locationtype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."cjobs_jobsCentros_locationtype_enum" AS ENUM (
    'primary',
    'secondary',
    'backup'
);


ALTER TYPE public."cjobs_jobsCentros_locationtype_enum" OWNER TO postgres;

--
-- Name: cjobs_jobsTrabajadores_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."cjobs_jobsTrabajadores_status_enum" AS ENUM (
    'assigned',
    'active',
    'completed',
    'cancelled',
    'replaced'
);


ALTER TYPE public."cjobs_jobsTrabajadores_status_enum" OWNER TO postgres;

--
-- Name: cjobs_jobs_schedule_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_jobs_schedule_type_enum AS ENUM (
    'free',
    'programming'
);


ALTER TYPE public.cjobs_jobs_schedule_type_enum OWNER TO postgres;

--
-- Name: cjobs_jobs_season_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_jobs_season_type_enum AS ENUM (
    'winter',
    'summer'
);


ALTER TYPE public.cjobs_jobs_season_type_enum OWNER TO postgres;

--
-- Name: cjobs_jobs_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_jobs_status_enum AS ENUM (
    'active',
    'inactive',
    'completed',
    'cancelled'
);


ALTER TYPE public.cjobs_jobs_status_enum OWNER TO postgres;

--
-- Name: cjobs_tareasTrabajadores_action_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."cjobs_tareasTrabajadores_action_enum" AS ENUM (
    'started',
    'completed',
    'paused',
    'resumed'
);


ALTER TYPE public."cjobs_tareasTrabajadores_action_enum" OWNER TO postgres;

--
-- Name: cjobs_tareas_periodicity_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_tareas_periodicity_enum AS ENUM (
    'once',
    'personalize',
    'daily',
    'weekly',
    'monthly'
);


ALTER TYPE public.cjobs_tareas_periodicity_enum OWNER TO postgres;

--
-- Name: cjobs_tareas_priority_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_tareas_priority_enum AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE public.cjobs_tareas_priority_enum OWNER TO postgres;

--
-- Name: cjobs_tareas_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_tareas_status_enum AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.cjobs_tareas_status_enum OWNER TO postgres;

--
-- Name: cjobs_tareas_to_be_carried_out_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_tareas_to_be_carried_out_enum AS ENUM (
    'before',
    'during',
    'after'
);


ALTER TYPE public.cjobs_tareas_to_be_carried_out_enum OWNER TO postgres;

--
-- Name: cjobs_turnos_shift_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_turnos_shift_type_enum AS ENUM (
    'morning',
    'late',
    'evening'
);


ALTER TYPE public.cjobs_turnos_shift_type_enum OWNER TO postgres;

--
-- Name: cjobs_turnos_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cjobs_turnos_status_enum AS ENUM (
    'free',
    'booked',
    'completed',
    'cancelled'
);


ALTER TYPE public.cjobs_turnos_status_enum OWNER TO postgres;

--
-- Name: employerSubTypes_name_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."employerSubTypes_name_enum" AS ENUM (
    'Individual',
    'Self-Employed',
    'Company'
);


ALTER TYPE public."employerSubTypes_name_enum" OWNER TO postgres;

--
-- Name: employerTypes_name_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."employerTypes_name_enum" AS ENUM (
    'Home',
    'Static',
    'Remote'
);


ALTER TYPE public."employerTypes_name_enum" OWNER TO postgres;

--
-- Name: job_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.job_status_enum AS ENUM (
    'scheduled',
    'pending',
    'in_progress',
    'completed',
    'cancelled',
    'on_hold'
);


ALTER TYPE public.job_status_enum OWNER TO postgres;

--
-- Name: qr_codes_ownertype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.qr_codes_ownertype_enum AS ENUM (
    'CLIENT',
    'EMPLOYER'
);


ALTER TYPE public.qr_codes_ownertype_enum OWNER TO postgres;

--
-- Name: qr_codes_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.qr_codes_type_enum AS ENUM (
    'STATIC',
    'DYNAMIC'
);


ALTER TYPE public.qr_codes_type_enum OWNER TO postgres;

--
-- Name: schedule_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.schedule_type_enum AS ENUM (
    'fixed',
    'free',
    'seasonal'
);


ALTER TYPE public.schedule_type_enum OWNER TO postgres;

--
-- Name: season_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.season_enum AS ENUM (
    'normal',
    'summer'
);


ALTER TYPE public.season_enum OWNER TO postgres;

--
-- Name: shift_scheduletype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shift_scheduletype_enum AS ENUM (
    'fixed',
    'flexible',
    'live_in'
);


ALTER TYPE public.shift_scheduletype_enum OWNER TO postgres;

--
-- Name: shift_season_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shift_season_enum AS ENUM (
    'summer',
    'winter'
);


ALTER TYPE public.shift_season_enum OWNER TO postgres;

--
-- Name: shift_shifttype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shift_shifttype_enum AS ENUM (
    'morning',
    'noon',
    'evening'
);


ALTER TYPE public.shift_shifttype_enum OWNER TO postgres;

--
-- Name: signing_method_methodtype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.signing_method_methodtype_enum AS ENUM (
    'mobile',
    'pc',
    'call'
);


ALTER TYPE public.signing_method_methodtype_enum OWNER TO postgres;

--
-- Name: survey_question_questiontype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.survey_question_questiontype_enum AS ENUM (
    'text',
    'radio',
    'checkbox',
    'rating'
);


ALTER TYPE public.survey_question_questiontype_enum OWNER TO postgres;

--
-- Name: task_periodicity_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_periodicity_enum AS ENUM (
    'once',
    'daily',
    'weekly',
    'monthly',
    'yearly'
);


ALTER TYPE public.task_periodicity_enum OWNER TO postgres;

--
-- Name: task_shift_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_shift_enum AS ENUM (
    'morning',
    'noon',
    'evening'
);


ALTER TYPE public.task_shift_enum OWNER TO postgres;

--
-- Name: task_timing_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_timing_enum AS ENUM (
    'before',
    'during',
    'after'
);


ALTER TYPE public.task_timing_enum OWNER TO postgres;

--
-- Name: weekday_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.weekday_enum AS ENUM (
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
);


ALTER TYPE public.weekday_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_config (
    id integer NOT NULL,
    "companyName" character varying NOT NULL,
    address character varying NOT NULL,
    "vatRate" numeric(5,2) NOT NULL,
    "invoiceSeries" character varying NOT NULL,
    "paymentDetails" character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_config OWNER TO postgres;

--
-- Name: admin_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_config_id_seq OWNER TO postgres;

--
-- Name: admin_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_config_id_seq OWNED BY public.admin_config.id;


--
-- Name: alert; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert (
    id integer NOT NULL,
    "alertType" public.alert_alerttype_enum NOT NULL,
    "triggerTime" character varying(50),
    "minDuration" integer,
    "jobId" integer NOT NULL
);


ALTER TABLE public.alert OWNER TO postgres;

--
-- Name: alert_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alert_id_seq OWNER TO postgres;

--
-- Name: alert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alert_id_seq OWNED BY public.alert.id;


--
-- Name: cjobs_IVASTAI; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."cjobs_IVASTAI" (
    id integer NOT NULL,
    rate numeric(5,2) NOT NULL,
    name character varying NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."cjobs_IVASTAI" OWNER TO postgres;

--
-- Name: cjobs_IVASTAI_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_IVASTAI_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_IVASTAI_id_seq" OWNER TO postgres;

--
-- Name: cjobs_IVASTAI_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_IVASTAI_id_seq" OWNED BY public."cjobs_IVASTAI".id;


--
-- Name: cjobs_alertas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_alertas (
    id integer NOT NULL,
    job_id integer NOT NULL,
    type public.cjobs_alertas_type_enum DEFAULT 'entrance'::public.cjobs_alertas_type_enum NOT NULL,
    when_signing_in boolean DEFAULT false NOT NULL,
    delay_enabled boolean DEFAULT false NOT NULL,
    delay_value integer DEFAULT 10 NOT NULL,
    duration_enabled boolean DEFAULT false NOT NULL,
    duration_value integer DEFAULT 30 NOT NULL,
    status public.cjobs_alertas_status_enum DEFAULT 'active'::public.cjobs_alertas_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_alertas OWNER TO postgres;

--
-- Name: cjobs_alertas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_alertas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_alertas_id_seq OWNER TO postgres;

--
-- Name: cjobs_alertas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_alertas_id_seq OWNED BY public.cjobs_alertas.id;


--
-- Name: work_center; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_center (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    address character varying(255) NOT NULL,
    "contactName" character varying(100),
    "contactPhone" character varying(20),
    "contactEmail" character varying(100),
    client_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    landline character varying(20),
    postal_code character varying(20),
    employer_id integer
);


ALTER TABLE public.work_center OWNER TO postgres;

--
-- Name: cjobs_centrosTrabajo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_centrosTrabajo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_centrosTrabajo_id_seq" OWNER TO postgres;

--
-- Name: cjobs_centrosTrabajo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_centrosTrabajo_id_seq" OWNED BY public.work_center.id;


--
-- Name: cjobs_empleadores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_empleadores (
    id integer NOT NULL,
    "partnerId" integer NOT NULL,
    name character varying NOT NULL,
    "taxId" character varying NOT NULL,
    address character varying NOT NULL,
    phone character varying,
    mobile character varying,
    landline character varying,
    "typeId" integer NOT NULL,
    "subTypeId" integer NOT NULL,
    fee numeric(5,2) NOT NULL,
    discount numeric(5,2),
    "paymentMethodId" integer NOT NULL,
    "accountIban" character varying,
    "bicSwift" character varying,
    "probationPeriod" character varying,
    responsible character varying,
    "accessAccountStatus" character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_empleadores OWNER TO postgres;

--
-- Name: cjobs_empleadores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_empleadores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_empleadores_id_seq OWNER TO postgres;

--
-- Name: cjobs_empleadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_empleadores_id_seq OWNED BY public.cjobs_empleadores.id;


--
-- Name: cjobs_encuestas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_encuestas (
    id integer NOT NULL,
    survey_id integer NOT NULL,
    user_id integer NOT NULL,
    rating integer NOT NULL,
    comments text,
    response_date timestamp without time zone NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    ip_address character varying(45),
    device_info text,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    is_verified boolean DEFAULT false NOT NULL,
    verified_by integer,
    verification_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_encuestas OWNER TO postgres;

--
-- Name: cjobs_encuestasJobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."cjobs_encuestasJobs" (
    id integer NOT NULL,
    job_id integer NOT NULL,
    type public."cjobs_encuestasJobs_type_enum" DEFAULT 'customer'::public."cjobs_encuestasJobs_type_enum" NOT NULL,
    "questionText" text NOT NULL,
    monitoring_value integer DEFAULT 5 NOT NULL,
    text_alert_tracking text,
    farewell_text text,
    periodicity public."cjobs_encuestasJobs_periodicity_enum" DEFAULT 'daily'::public."cjobs_encuestasJobs_periodicity_enum" NOT NULL,
    periodicity_value integer DEFAULT 1 NOT NULL,
    hour time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    allow_comments boolean DEFAULT true NOT NULL,
    send_reminder boolean DEFAULT false NOT NULL,
    reminder_days integer DEFAULT 3 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."cjobs_encuestasJobs" OWNER TO postgres;

--
-- Name: cjobs_encuestasJobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_encuestasJobs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_encuestasJobs_id_seq" OWNER TO postgres;

--
-- Name: cjobs_encuestasJobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_encuestasJobs_id_seq" OWNED BY public."cjobs_encuestasJobs".id;


--
-- Name: cjobs_encuestas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_encuestas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_encuestas_id_seq OWNER TO postgres;

--
-- Name: cjobs_encuestas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_encuestas_id_seq OWNED BY public.cjobs_encuestas.id;


--
-- Name: cjobs_fichajes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_fichajes (
    id integer NOT NULL,
    job_id integer NOT NULL,
    shift_id integer,
    worker_id integer NOT NULL,
    action public.cjobs_fichajes_action_enum DEFAULT 'clock_in'::public.cjobs_fichajes_action_enum NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    location_lat numeric(10,8),
    location_lng numeric(11,8),
    device_info text,
    ip_address character varying(45),
    notes text,
    is_manual boolean DEFAULT false NOT NULL,
    approved_by integer,
    approval_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_fichajes OWNER TO postgres;

--
-- Name: cjobs_fichajes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_fichajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_fichajes_id_seq OWNER TO postgres;

--
-- Name: cjobs_fichajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_fichajes_id_seq OWNED BY public.cjobs_fichajes.id;


--
-- Name: cjobs_horarios_semanales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_horarios_semanales (
    id integer NOT NULL,
    job_id integer NOT NULL,
    "dayOfWeek" public.cjobs_horarios_semanales_dayofweek_enum DEFAULT 'monday'::public.cjobs_horarios_semanales_dayofweek_enum NOT NULL,
    tomorrow_start time without time zone,
    tomorrow_end time without time zone,
    late_start time without time zone,
    late_end time without time zone,
    evening_start time without time zone,
    evening_end time without time zone,
    day_total character varying(10) DEFAULT '00:00'::character varying NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_horarios_semanales OWNER TO postgres;

--
-- Name: cjobs_horarios_semanales_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_horarios_semanales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_horarios_semanales_id_seq OWNER TO postgres;

--
-- Name: cjobs_horarios_semanales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_horarios_semanales_id_seq OWNED BY public.cjobs_horarios_semanales.id;


--
-- Name: cjobs_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_jobs (
    id integer NOT NULL,
    employer_id integer NOT NULL,
    client_id integer NOT NULL,
    denomination character varying(255) NOT NULL,
    "startDate" date NOT NULL,
    "endDate" date NOT NULL,
    observations text,
    schedule_type public.cjobs_jobs_schedule_type_enum DEFAULT 'free'::public.cjobs_jobs_schedule_type_enum NOT NULL,
    season_type public.cjobs_jobs_season_type_enum DEFAULT 'winter'::public.cjobs_jobs_season_type_enum NOT NULL,
    total_weekly_hours character varying(10) DEFAULT '00:00'::character varying NOT NULL,
    mobile_qr_code boolean DEFAULT false NOT NULL,
    mobile_wifi boolean DEFAULT false NOT NULL,
    mobile_gps boolean DEFAULT false NOT NULL,
    laptop_ip boolean DEFAULT false NOT NULL,
    laptop_wifi boolean DEFAULT false NOT NULL,
    phone_caller_id boolean DEFAULT false NOT NULL,
    verify_identity boolean DEFAULT false NOT NULL,
    status public.cjobs_jobs_status_enum DEFAULT 'active'::public.cjobs_jobs_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_jobs OWNER TO postgres;

--
-- Name: cjobs_jobsCentros; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."cjobs_jobsCentros" (
    id integer NOT NULL,
    job_id integer NOT NULL,
    work_center_id integer NOT NULL,
    "locationType" public."cjobs_jobsCentros_locationtype_enum" DEFAULT 'primary'::public."cjobs_jobsCentros_locationtype_enum" NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    start_date date,
    end_date date,
    notes text,
    max_workers integer,
    required_equipment text,
    safety_requirements text,
    access_instructions text,
    contact_person character varying(255),
    contact_phone character varying(20),
    contact_email character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."cjobs_jobsCentros" OWNER TO postgres;

--
-- Name: cjobs_jobsCentros_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_jobsCentros_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_jobsCentros_id_seq" OWNER TO postgres;

--
-- Name: cjobs_jobsCentros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_jobsCentros_id_seq" OWNED BY public."cjobs_jobsCentros".id;


--
-- Name: cjobs_jobsTrabajadores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."cjobs_jobsTrabajadores" (
    id integer NOT NULL,
    job_id integer NOT NULL,
    worker_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status public."cjobs_jobsTrabajadores_status_enum" DEFAULT 'assigned'::public."cjobs_jobsTrabajadores_status_enum" NOT NULL,
    hourly_rate numeric(10,2),
    total_hours numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total_cost numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    assigned_by integer NOT NULL,
    assignment_date timestamp without time zone NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    can_clock_in boolean DEFAULT true NOT NULL,
    can_manage_tasks boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."cjobs_jobsTrabajadores" OWNER TO postgres;

--
-- Name: cjobs_jobsTrabajadores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_jobsTrabajadores_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_jobsTrabajadores_id_seq" OWNER TO postgres;

--
-- Name: cjobs_jobsTrabajadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_jobsTrabajadores_id_seq" OWNED BY public."cjobs_jobsTrabajadores".id;


--
-- Name: cjobs_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_jobs_id_seq OWNER TO postgres;

--
-- Name: cjobs_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_jobs_id_seq OWNED BY public.cjobs_jobs.id;


--
-- Name: cjobs_notificaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_notificaciones (
    id integer NOT NULL,
    role character varying NOT NULL,
    recipient_id integer NOT NULL,
    title character varying NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_notificaciones OWNER TO postgres;

--
-- Name: cjobs_notificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_notificaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_notificaciones_id_seq OWNER TO postgres;

--
-- Name: cjobs_notificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_notificaciones_id_seq OWNED BY public.cjobs_notificaciones.id;


--
-- Name: cjobs_partners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_partners (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    address character varying(255) NOT NULL,
    landline character varying(20),
    mobile character varying(20),
    email character varying(100),
    nif character varying(20) NOT NULL,
    commission numeric(5,2) NOT NULL,
    retention numeric(5,2) NOT NULL,
    account_iban character varying(50),
    bic_swift character varying(20),
    "logoUrl" character varying,
    responsible character varying(100),
    access_account_status character varying DEFAULT 'postpone'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    type_of_partner character varying(50),
    payment_method character varying(50),
    partner_tier_id integer,
    default_payment_method_id integer
);


ALTER TABLE public.cjobs_partners OWNER TO postgres;

--
-- Name: cjobs_partnersUsuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."cjobs_partnersUsuarios" (
    id integer NOT NULL,
    partner_id integer NOT NULL,
    user_id integer NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."cjobs_partnersUsuarios" OWNER TO postgres;

--
-- Name: cjobs_partnersUsuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_partnersUsuarios_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_partnersUsuarios_id_seq" OWNER TO postgres;

--
-- Name: cjobs_partnersUsuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_partnersUsuarios_id_seq" OWNED BY public."cjobs_partnersUsuarios".id;


--
-- Name: cjobs_partners_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_partners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_partners_id_seq OWNER TO postgres;

--
-- Name: cjobs_partners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_partners_id_seq OWNED BY public.cjobs_partners.id;


--
-- Name: cjobs_paymentMethods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."cjobs_paymentMethods" (
    id integer NOT NULL,
    name character varying NOT NULL,
    description character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."cjobs_paymentMethods" OWNER TO postgres;

--
-- Name: cjobs_paymentMethods_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_paymentMethods_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_paymentMethods_id_seq" OWNER TO postgres;

--
-- Name: cjobs_paymentMethods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_paymentMethods_id_seq" OWNED BY public."cjobs_paymentMethods".id;


--
-- Name: cjobs_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_roles (
    id integer NOT NULL,
    name character varying NOT NULL,
    value integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_roles OWNER TO postgres;

--
-- Name: cjobs_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_roles_id_seq OWNER TO postgres;

--
-- Name: cjobs_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_roles_id_seq OWNED BY public.cjobs_roles.id;


--
-- Name: cjobs_tareas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_tareas (
    id integer NOT NULL,
    job_id integer NOT NULL,
    name character varying(255) NOT NULL,
    observations text,
    duration character varying(10),
    shift_tomorrow boolean DEFAULT false NOT NULL,
    shift_late boolean DEFAULT false NOT NULL,
    shift_evening boolean DEFAULT false NOT NULL,
    to_be_carried_out public.cjobs_tareas_to_be_carried_out_enum DEFAULT 'during'::public.cjobs_tareas_to_be_carried_out_enum NOT NULL,
    periodicity public.cjobs_tareas_periodicity_enum DEFAULT 'once'::public.cjobs_tareas_periodicity_enum NOT NULL,
    periodicity_date date,
    alert_task_completed boolean DEFAULT false NOT NULL,
    pending_task_alert boolean DEFAULT false NOT NULL,
    status public.cjobs_tareas_status_enum DEFAULT 'pending'::public.cjobs_tareas_status_enum NOT NULL,
    completion_stage integer DEFAULT 0 NOT NULL,
    priority public.cjobs_tareas_priority_enum DEFAULT 'medium'::public.cjobs_tareas_priority_enum NOT NULL,
    estimated_cost numeric(10,2),
    actual_cost numeric(10,2),
    start_time time without time zone,
    end_time time without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_tareas OWNER TO postgres;

--
-- Name: cjobs_tareasTrabajadores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."cjobs_tareasTrabajadores" (
    id integer NOT NULL,
    task_id integer NOT NULL,
    worker_id integer NOT NULL,
    shift_id integer NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    action public."cjobs_tareasTrabajadores_action_enum" DEFAULT 'started'::public."cjobs_tareasTrabajadores_action_enum" NOT NULL,
    notes text,
    completion_percentage integer DEFAULT 0 NOT NULL,
    time_spent integer,
    quality_rating integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."cjobs_tareasTrabajadores" OWNER TO postgres;

--
-- Name: cjobs_tareasTrabajadores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_tareasTrabajadores_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_tareasTrabajadores_id_seq" OWNER TO postgres;

--
-- Name: cjobs_tareasTrabajadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_tareasTrabajadores_id_seq" OWNED BY public."cjobs_tareasTrabajadores".id;


--
-- Name: cjobs_tareas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_tareas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_tareas_id_seq OWNER TO postgres;

--
-- Name: cjobs_tareas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_tareas_id_seq OWNED BY public.cjobs_tareas.id;


--
-- Name: cjobs_turnos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_turnos (
    id integer NOT NULL,
    job_id integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status public.cjobs_turnos_status_enum DEFAULT 'free'::public.cjobs_turnos_status_enum NOT NULL,
    notes text,
    break_duration integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    worker_id integer,
    date date NOT NULL,
    shift_type public.cjobs_turnos_shift_type_enum DEFAULT 'morning'::public.cjobs_turnos_shift_type_enum NOT NULL,
    actual_start_time time without time zone,
    actual_end_time time without time zone,
    total_hours numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    hourly_rate numeric(10,2),
    total_cost numeric(10,2) DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE public.cjobs_turnos OWNER TO postgres;

--
-- Name: cjobs_turnos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_turnos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_turnos_id_seq OWNER TO postgres;

--
-- Name: cjobs_turnos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_turnos_id_seq OWNED BY public.cjobs_turnos.id;


--
-- Name: cjobs_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cjobs_user (
    id integer NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    first_name character varying,
    last_name character varying,
    role_id integer NOT NULL,
    partner_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cjobs_user OWNER TO postgres;

--
-- Name: cjobs_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cjobs_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cjobs_user_id_seq OWNER TO postgres;

--
-- Name: cjobs_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cjobs_user_id_seq OWNED BY public.cjobs_user.id;


--
-- Name: cjobs_usuariosFcm; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."cjobs_usuariosFcm" (
    id integer NOT NULL,
    user_id integer NOT NULL,
    firebase_token character varying NOT NULL,
    device_type character varying,
    last_used timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."cjobs_usuariosFcm" OWNER TO postgres;

--
-- Name: cjobs_usuariosFcm_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."cjobs_usuariosFcm_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."cjobs_usuariosFcm_id_seq" OWNER TO postgres;

--
-- Name: cjobs_usuariosFcm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."cjobs_usuariosFcm_id_seq" OWNED BY public."cjobs_usuariosFcm".id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    type character varying NOT NULL,
    status character varying NOT NULL,
    code character varying NOT NULL,
    "taxId" character varying NOT NULL,
    address character varying NOT NULL,
    landline character varying,
    mobile character varying,
    observation character varying,
    responsible character varying,
    winter_schedule character varying,
    summer_schedule character varying,
    access_account_status character varying DEFAULT 'postpone'::character varying NOT NULL,
    "userId" integer,
    name character varying
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO postgres;

--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: clients_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients_users (
    id integer NOT NULL,
    "clientId" integer NOT NULL,
    "userId" integer NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.clients_users OWNER TO postgres;

--
-- Name: clients_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_users_id_seq OWNER TO postgres;

--
-- Name: clients_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_users_id_seq OWNED BY public.clients_users.id;


--
-- Name: employerClients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."employerClients" (
    id integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    "employerId" integer,
    "clientId" integer
);


ALTER TABLE public."employerClients" OWNER TO postgres;

--
-- Name: employerClients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."employerClients_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."employerClients_id_seq" OWNER TO postgres;

--
-- Name: employerClients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."employerClients_id_seq" OWNED BY public."employerClients".id;


--
-- Name: employerSubTypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."employerSubTypes" (
    id integer NOT NULL,
    name public."employerSubTypes_name_enum" NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    "invoicingRules" text
);


ALTER TABLE public."employerSubTypes" OWNER TO postgres;

--
-- Name: employerSubTypes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."employerSubTypes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."employerSubTypes_id_seq" OWNER TO postgres;

--
-- Name: employerSubTypes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."employerSubTypes_id_seq" OWNED BY public."employerSubTypes".id;


--
-- Name: employerTypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."employerTypes" (
    id integer NOT NULL,
    name public."employerTypes_name_enum" NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    "defaultRate" numeric
);


ALTER TABLE public."employerTypes" OWNER TO postgres;

--
-- Name: employerTypes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."employerTypes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."employerTypes_id_seq" OWNER TO postgres;

--
-- Name: employerTypes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."employerTypes_id_seq" OWNED BY public."employerTypes".id;


--
-- Name: employerUsers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."employerUsers" (
    id integer NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    "employerId" integer,
    "userId" integer
);


ALTER TABLE public."employerUsers" OWNER TO postgres;

--
-- Name: employerUsers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."employerUsers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."employerUsers_id_seq" OWNER TO postgres;

--
-- Name: employerUsers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."employerUsers_id_seq" OWNED BY public."employerUsers".id;


--
-- Name: employerWorkCenters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."employerWorkCenters" (
    id integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    "employerId" integer,
    "workCenterId" integer
);


ALTER TABLE public."employerWorkCenters" OWNER TO postgres;

--
-- Name: employerWorkCenters_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."employerWorkCenters_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."employerWorkCenters_id_seq" OWNER TO postgres;

--
-- Name: employerWorkCenters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."employerWorkCenters_id_seq" OWNED BY public."employerWorkCenters".id;


--
-- Name: employerWorkers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."employerWorkers" (
    id integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    "employerId" integer,
    "workerId" integer
);


ALTER TABLE public."employerWorkers" OWNER TO postgres;

--
-- Name: employerWorkers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."employerWorkers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."employerWorkers_id_seq" OWNER TO postgres;

--
-- Name: employerWorkers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."employerWorkers_id_seq" OWNED BY public."employerWorkers".id;


--
-- Name: employers_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employers_users (
    id integer NOT NULL,
    employer_id integer NOT NULL,
    user_id integer NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employers_users OWNER TO postgres;

--
-- Name: employers_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employers_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employers_users_id_seq OWNER TO postgres;

--
-- Name: employers_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employers_users_id_seq OWNED BY public.employers_users.id;


--
-- Name: gender; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gender (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.gender OWNER TO postgres;

--
-- Name: gender_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gender_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gender_id_seq OWNER TO postgres;

--
-- Name: gender_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gender_id_seq OWNED BY public.gender.id;


--
-- Name: job; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job (
    id integer NOT NULL,
    "jobName" character varying(255) NOT NULL,
    "startDate" date NOT NULL,
    "endDate" date NOT NULL,
    note text,
    "employerId" integer NOT NULL,
    "clientId" integer,
    user_id integer,
    status public.job_status_enum DEFAULT 'scheduled'::public.job_status_enum NOT NULL,
    "workCenterId" integer,
    timezone character varying(64),
    "scheduleType" public.schedule_type_enum DEFAULT 'free'::public.schedule_type_enum
);


ALTER TABLE public.job OWNER TO postgres;

--
-- Name: job_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.job_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_id_seq OWNER TO postgres;

--
-- Name: job_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.job_id_seq OWNED BY public.job.id;


--
-- Name: job_work_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_work_centers (
    job_id integer NOT NULL,
    work_center_id integer NOT NULL
);


ALTER TABLE public.job_work_centers OWNER TO postgres;

--
-- Name: job_workers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_workers (
    "jobId" integer NOT NULL,
    "workersId" integer NOT NULL
);


ALTER TABLE public.job_workers OWNER TO postgres;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    role character varying(50) NOT NULL,
    recipient_id integer NOT NULL,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    meta jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: otp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    otp character varying NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    intent character varying NOT NULL,
    "createdAt" timestamp without time zone NOT NULL
);


ALTER TABLE public.otp OWNER TO postgres;

--
-- Name: otp_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.otp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otp_id_seq OWNER TO postgres;

--
-- Name: otp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.otp_id_seq OWNED BY public.otp.id;


--
-- Name: partner_tier; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partner_tier (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    value integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.partner_tier OWNER TO postgres;

--
-- Name: partner_tier_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partner_tier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partner_tier_id_seq OWNER TO postgres;

--
-- Name: partner_tier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partner_tier_id_seq OWNED BY public.partner_tier.id;


--
-- Name: qr_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qr_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    token character varying(44) NOT NULL,
    type public.qr_codes_type_enum NOT NULL,
    "ownerType" public.qr_codes_ownertype_enum NOT NULL,
    "ownerId" bigint NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "expiresAt" timestamp without time zone,
    "lastRefreshedAt" timestamp without time zone,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.qr_codes OWNER TO postgres;

--
-- Name: receipt; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.receipt (
    id integer NOT NULL,
    "imageUrl" character varying NOT NULL,
    amount numeric NOT NULL,
    "pfrReceiptNumber" character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    city character varying,
    "retailStore" character varying,
    "userId" integer NOT NULL,
    "pointsAwarded" integer DEFAULT 0 NOT NULL,
    "approvedOrRejectedBy" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "rejectionReason" character varying
);


ALTER TABLE public.receipt OWNER TO postgres;

--
-- Name: receipt_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.receipt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.receipt_id_seq OWNER TO postgres;

--
-- Name: receipt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.receipt_id_seq OWNED BY public.receipt.id;


--
-- Name: scan_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scan_logs (
    id integer NOT NULL,
    job_id integer NOT NULL,
    worker_id integer NOT NULL,
    "scanType" character varying(50) DEFAULT 'check-in'::character varying NOT NULL,
    location text,
    notes text,
    scan_time timestamp with time zone DEFAULT now() NOT NULL,
    user_timezone text
);


ALTER TABLE public.scan_logs OWNER TO postgres;

--
-- Name: scan_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scan_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scan_logs_id_seq OWNER TO postgres;

--
-- Name: scan_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scan_logs_id_seq OWNED BY public.scan_logs.id;


--
-- Name: season_period; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.season_period (
    id integer NOT NULL,
    job_id integer NOT NULL,
    season public.shift_season_enum NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL
);


ALTER TABLE public.season_period OWNER TO postgres;

--
-- Name: season_period_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.season_period_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.season_period_id_seq OWNER TO postgres;

--
-- Name: season_period_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.season_period_id_seq OWNED BY public.season_period.id;


--
-- Name: seasonal_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seasonal_schedule (
    id integer NOT NULL,
    job_id integer NOT NULL,
    season public.season_enum NOT NULL,
    start_date character varying(5),
    end_date character varying(5),
    total_week_hours integer DEFAULT 0
);


ALTER TABLE public.seasonal_schedule OWNER TO postgres;

--
-- Name: COLUMN seasonal_schedule.start_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.seasonal_schedule.start_date IS 'Day-Month (DD-MM), no year';


--
-- Name: COLUMN seasonal_schedule.end_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.seasonal_schedule.end_date IS 'Day-Month (DD-MM), no year';


--
-- Name: COLUMN seasonal_schedule.total_week_hours; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.seasonal_schedule.total_week_hours IS 'Total weekly hours expressed in whole hours';


--
-- Name: seasonal_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seasonal_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.seasonal_schedule_id_seq OWNER TO postgres;

--
-- Name: seasonal_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.seasonal_schedule_id_seq OWNED BY public.seasonal_schedule.id;


--
-- Name: shift; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shift (
    id integer NOT NULL,
    "shiftType" public.shift_shifttype_enum,
    "startTime" time without time zone,
    "endTime" time without time zone,
    total_hours integer,
    season public.shift_season_enum,
    day public.weekday_enum,
    day_enum public.weekday_enum,
    seasonal_schedule_id integer,
    start_weekday public.weekday_enum,
    end_weekday public.weekday_enum,
    base_start_time time without time zone,
    base_end_time time without time zone,
    is_continuous boolean DEFAULT false
);


ALTER TABLE public.shift OWNER TO postgres;

--
-- Name: shift_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shift_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_id_seq OWNER TO postgres;

--
-- Name: shift_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shift_id_seq OWNED BY public.shift.id;


--
-- Name: shift_instance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shift_instance (
    id integer NOT NULL,
    job_id integer NOT NULL,
    shift_id integer,
    date date NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    total_hours integer,
    is_generated boolean DEFAULT true
);


ALTER TABLE public.shift_instance OWNER TO postgres;

--
-- Name: shift_instance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shift_instance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_instance_id_seq OWNER TO postgres;

--
-- Name: shift_instance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shift_instance_id_seq OWNED BY public.shift_instance.id;


--
-- Name: signing_method; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.signing_method (
    id integer NOT NULL,
    "methodType" public.signing_method_methodtype_enum NOT NULL,
    "methodDetails" text NOT NULL,
    "verifyIdentity" boolean DEFAULT false NOT NULL,
    "jobId" integer NOT NULL
);


ALTER TABLE public.signing_method OWNER TO postgres;

--
-- Name: signing_method_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.signing_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.signing_method_id_seq OWNER TO postgres;

--
-- Name: signing_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.signing_method_id_seq OWNED BY public.signing_method.id;


--
-- Name: survey; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey (
    id integer NOT NULL,
    "jobId" integer,
    "employerId" integer NOT NULL,
    "clientId" integer,
    "workerId" integer,
    "questionText" character varying(500),
    "rateDigit" integer,
    "textAlertTracking" text,
    "greetingText" text,
    periodicity character varying(20),
    "startDate" date,
    "endDate" date,
    "interval" integer,
    "monthlyDays" text,
    "monthlyWeekdays" text,
    "monthlyStartWeekday" integer,
    "monthlyEndWeekday" integer,
    "sendTime" time without time zone,
    "createdAt" timestamp with time zone DEFAULT now()
);


ALTER TABLE public.survey OWNER TO postgres;

--
-- Name: survey_answer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_answer (
    id integer NOT NULL,
    "answerText" text,
    "responseId" integer NOT NULL,
    "questionId" integer NOT NULL
);


ALTER TABLE public.survey_answer OWNER TO postgres;

--
-- Name: survey_answer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.survey_answer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_answer_id_seq OWNER TO postgres;

--
-- Name: survey_answer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.survey_answer_id_seq OWNED BY public.survey_answer.id;


--
-- Name: survey_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.survey_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_id_seq OWNER TO postgres;

--
-- Name: survey_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.survey_id_seq OWNED BY public.survey.id;


--
-- Name: survey_question; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_question (
    id integer NOT NULL,
    "questionText" character varying(500) NOT NULL,
    "questionType" public.survey_question_questiontype_enum NOT NULL,
    options text,
    "isRequired" boolean DEFAULT false NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "surveyId" integer NOT NULL
);


ALTER TABLE public.survey_question OWNER TO postgres;

--
-- Name: survey_question_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.survey_question_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_question_id_seq OWNER TO postgres;

--
-- Name: survey_question_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.survey_question_id_seq OWNED BY public.survey_question.id;


--
-- Name: survey_response; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.survey_response (
    id integer NOT NULL,
    "submittedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "surveyId" integer NOT NULL,
    "jobId" integer NOT NULL,
    "workerId" integer,
    "clientId" integer
);


ALTER TABLE public.survey_response OWNER TO postgres;

--
-- Name: survey_response_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.survey_response_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_response_id_seq OWNER TO postgres;

--
-- Name: survey_response_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.survey_response_id_seq OWNED BY public.survey_response.id;


--
-- Name: task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    note text,
    "expectedDuration" integer,
    shift public.task_shift_enum,
    timing public.task_timing_enum NOT NULL,
    periodicity public.task_periodicity_enum NOT NULL,
    "alertTask" boolean DEFAULT false NOT NULL,
    "pendingTask" boolean DEFAULT false NOT NULL,
    "jobId" integer NOT NULL,
    "isCompleted" boolean DEFAULT false NOT NULL,
    "completedAt" timestamp without time zone,
    "completedByWorkerId" integer,
    "weeklyDays" text,
    "startDate" date,
    "endDate" date,
    "interval" integer DEFAULT 1 NOT NULL,
    "onceDate" date,
    "monthlyDays" text,
    "monthlyWeekdays" text,
    "yearlyMonths" text,
    "yearlyDays" text,
    "workCenterId" integer,
    "monthlyStartWeekday" integer,
    "monthlyEndWeekday" integer
);


ALTER TABLE public.task OWNER TO postgres;

--
-- Name: COLUMN task."monthlyStartWeekday"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.task."monthlyStartWeekday" IS '0=Sunday .. 6=Saturday - first occurrence of this weekday in the month';


--
-- Name: COLUMN task."monthlyEndWeekday"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.task."monthlyEndWeekday" IS '0=Sunday .. 6=Saturday - last occurrence of this weekday in the month';


--
-- Name: task_completion_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_completion_history (
    id integer NOT NULL,
    task_id integer NOT NULL,
    "completionDate" date NOT NULL,
    "completedByWorkerId" integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    "completedAt" timestamp without time zone NOT NULL
);


ALTER TABLE public.task_completion_history OWNER TO postgres;

--
-- Name: task_completion_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_completion_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_completion_history_id_seq OWNER TO postgres;

--
-- Name: task_completion_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_completion_history_id_seq OWNED BY public.task_completion_history.id;


--
-- Name: task_completions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_completions (
    id integer NOT NULL,
    task_id integer NOT NULL,
    worker_id integer NOT NULL,
    job_id integer NOT NULL,
    "completionDate" date NOT NULL,
    "completedAt" timestamp without time zone NOT NULL,
    notes text,
    "timeSpentMinutes" integer,
    "completionMethod" character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_completions OWNER TO postgres;

--
-- Name: task_completions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_completions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_completions_id_seq OWNER TO postgres;

--
-- Name: task_completions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_completions_id_seq OWNED BY public.task_completions.id;


--
-- Name: task_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_history (
    id integer NOT NULL,
    "taskId" integer NOT NULL,
    "jobId" integer NOT NULL,
    date date NOT NULL,
    "isCompleted" boolean DEFAULT false NOT NULL,
    "completedAt" timestamp without time zone,
    "completedByWorkerId" integer,
    "completedById" integer
);


ALTER TABLE public.task_history OWNER TO postgres;

--
-- Name: task_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_history_id_seq OWNER TO postgres;

--
-- Name: task_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_history_id_seq OWNED BY public.task_history.id;


--
-- Name: task_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_id_seq OWNER TO postgres;

--
-- Name: task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_id_seq OWNED BY public.task.id;


--
-- Name: work_center_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_center_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_center_id_seq OWNER TO postgres;

--
-- Name: work_center_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_center_id_seq OWNED BY public.work_center.id;


--
-- Name: work_session_day; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_session_day (
    id integer NOT NULL,
    work_session_id integer NOT NULL,
    job_id integer NOT NULL,
    worker_id integer NOT NULL,
    date date NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    minutes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.work_session_day OWNER TO postgres;

--
-- Name: work_session_day_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_session_day_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_session_day_id_seq OWNER TO postgres;

--
-- Name: work_session_day_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_session_day_id_seq OWNED BY public.work_session_day.id;


--
-- Name: work_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_sessions (
    id integer NOT NULL,
    job_id integer NOT NULL,
    worker_id integer NOT NULL,
    total_work_minutes integer DEFAULT 0 NOT NULL,
    total_break_minutes integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    is_on_break boolean DEFAULT false NOT NULL,
    notes text,
    check_in_time timestamp with time zone NOT NULL,
    check_out_time timestamp with time zone,
    current_break_start timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.work_sessions OWNER TO postgres;

--
-- Name: work_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_sessions_id_seq OWNER TO postgres;

--
-- Name: work_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_sessions_id_seq OWNED BY public.work_sessions.id;


--
-- Name: workers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workers (
    id integer NOT NULL,
    code character varying NOT NULL,
    access_account_status character varying DEFAULT 'postpone'::character varying NOT NULL,
    landline character varying(20),
    mobile character varying(20),
    nif character varying(20),
    naf character varying(20),
    occupation character varying(100),
    birthday date,
    active boolean DEFAULT true NOT NULL,
    observation text,
    asset character varying(50),
    gender_id integer,
    address character varying(255),
    user_id integer
);


ALTER TABLE public.workers OWNER TO postgres;

--
-- Name: workers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workers_id_seq OWNER TO postgres;

--
-- Name: workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workers_id_seq OWNED BY public.workers.id;


--
-- Name: workers_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workers_users (
    id integer NOT NULL,
    "workerId" integer NOT NULL,
    "userId" integer NOT NULL
);


ALTER TABLE public.workers_users OWNER TO postgres;

--
-- Name: workers_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workers_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workers_users_id_seq OWNER TO postgres;

--
-- Name: workers_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workers_users_id_seq OWNED BY public.workers_users.id;


--
-- Name: admin_config id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_config ALTER COLUMN id SET DEFAULT nextval('public.admin_config_id_seq'::regclass);


--
-- Name: alert id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert ALTER COLUMN id SET DEFAULT nextval('public.alert_id_seq'::regclass);


--
-- Name: cjobs_IVASTAI id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_IVASTAI" ALTER COLUMN id SET DEFAULT nextval('public."cjobs_IVASTAI_id_seq"'::regclass);


--
-- Name: cjobs_alertas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_alertas ALTER COLUMN id SET DEFAULT nextval('public.cjobs_alertas_id_seq'::regclass);


--
-- Name: cjobs_empleadores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_empleadores ALTER COLUMN id SET DEFAULT nextval('public.cjobs_empleadores_id_seq'::regclass);


--
-- Name: cjobs_encuestas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_encuestas ALTER COLUMN id SET DEFAULT nextval('public.cjobs_encuestas_id_seq'::regclass);


--
-- Name: cjobs_encuestasJobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_encuestasJobs" ALTER COLUMN id SET DEFAULT nextval('public."cjobs_encuestasJobs_id_seq"'::regclass);


--
-- Name: cjobs_fichajes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_fichajes ALTER COLUMN id SET DEFAULT nextval('public.cjobs_fichajes_id_seq'::regclass);


--
-- Name: cjobs_horarios_semanales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_horarios_semanales ALTER COLUMN id SET DEFAULT nextval('public.cjobs_horarios_semanales_id_seq'::regclass);


--
-- Name: cjobs_jobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_jobs ALTER COLUMN id SET DEFAULT nextval('public.cjobs_jobs_id_seq'::regclass);


--
-- Name: cjobs_jobsCentros id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_jobsCentros" ALTER COLUMN id SET DEFAULT nextval('public."cjobs_jobsCentros_id_seq"'::regclass);


--
-- Name: cjobs_jobsTrabajadores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_jobsTrabajadores" ALTER COLUMN id SET DEFAULT nextval('public."cjobs_jobsTrabajadores_id_seq"'::regclass);


--
-- Name: cjobs_notificaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_notificaciones ALTER COLUMN id SET DEFAULT nextval('public.cjobs_notificaciones_id_seq'::regclass);


--
-- Name: cjobs_partners id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_partners ALTER COLUMN id SET DEFAULT nextval('public.cjobs_partners_id_seq'::regclass);


--
-- Name: cjobs_partnersUsuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_partnersUsuarios" ALTER COLUMN id SET DEFAULT nextval('public."cjobs_partnersUsuarios_id_seq"'::regclass);


--
-- Name: cjobs_paymentMethods id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_paymentMethods" ALTER COLUMN id SET DEFAULT nextval('public."cjobs_paymentMethods_id_seq"'::regclass);


--
-- Name: cjobs_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_roles ALTER COLUMN id SET DEFAULT nextval('public.cjobs_roles_id_seq'::regclass);


--
-- Name: cjobs_tareas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_tareas ALTER COLUMN id SET DEFAULT nextval('public.cjobs_tareas_id_seq'::regclass);


--
-- Name: cjobs_tareasTrabajadores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_tareasTrabajadores" ALTER COLUMN id SET DEFAULT nextval('public."cjobs_tareasTrabajadores_id_seq"'::regclass);


--
-- Name: cjobs_turnos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_turnos ALTER COLUMN id SET DEFAULT nextval('public.cjobs_turnos_id_seq'::regclass);


--
-- Name: cjobs_user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_user ALTER COLUMN id SET DEFAULT nextval('public.cjobs_user_id_seq'::regclass);


--
-- Name: cjobs_usuariosFcm id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_usuariosFcm" ALTER COLUMN id SET DEFAULT nextval('public."cjobs_usuariosFcm_id_seq"'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: clients_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients_users ALTER COLUMN id SET DEFAULT nextval('public.clients_users_id_seq'::regclass);


--
-- Name: employerClients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerClients" ALTER COLUMN id SET DEFAULT nextval('public."employerClients_id_seq"'::regclass);


--
-- Name: employerSubTypes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerSubTypes" ALTER COLUMN id SET DEFAULT nextval('public."employerSubTypes_id_seq"'::regclass);


--
-- Name: employerTypes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerTypes" ALTER COLUMN id SET DEFAULT nextval('public."employerTypes_id_seq"'::regclass);


--
-- Name: employerUsers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerUsers" ALTER COLUMN id SET DEFAULT nextval('public."employerUsers_id_seq"'::regclass);


--
-- Name: employerWorkCenters id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerWorkCenters" ALTER COLUMN id SET DEFAULT nextval('public."employerWorkCenters_id_seq"'::regclass);


--
-- Name: employerWorkers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerWorkers" ALTER COLUMN id SET DEFAULT nextval('public."employerWorkers_id_seq"'::regclass);


--
-- Name: employers_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employers_users ALTER COLUMN id SET DEFAULT nextval('public.employers_users_id_seq'::regclass);


--
-- Name: gender id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gender ALTER COLUMN id SET DEFAULT nextval('public.gender_id_seq'::regclass);


--
-- Name: job id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job ALTER COLUMN id SET DEFAULT nextval('public.job_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: otp id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp ALTER COLUMN id SET DEFAULT nextval('public.otp_id_seq'::regclass);


--
-- Name: partner_tier id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partner_tier ALTER COLUMN id SET DEFAULT nextval('public.partner_tier_id_seq'::regclass);


--
-- Name: receipt id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt ALTER COLUMN id SET DEFAULT nextval('public.receipt_id_seq'::regclass);


--
-- Name: scan_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_logs ALTER COLUMN id SET DEFAULT nextval('public.scan_logs_id_seq'::regclass);


--
-- Name: season_period id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.season_period ALTER COLUMN id SET DEFAULT nextval('public.season_period_id_seq'::regclass);


--
-- Name: seasonal_schedule id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seasonal_schedule ALTER COLUMN id SET DEFAULT nextval('public.seasonal_schedule_id_seq'::regclass);


--
-- Name: shift id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift ALTER COLUMN id SET DEFAULT nextval('public.shift_id_seq'::regclass);


--
-- Name: shift_instance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_instance ALTER COLUMN id SET DEFAULT nextval('public.shift_instance_id_seq'::regclass);


--
-- Name: signing_method id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_method ALTER COLUMN id SET DEFAULT nextval('public.signing_method_id_seq'::regclass);


--
-- Name: survey id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey ALTER COLUMN id SET DEFAULT nextval('public.survey_id_seq'::regclass);


--
-- Name: survey_answer id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answer ALTER COLUMN id SET DEFAULT nextval('public.survey_answer_id_seq'::regclass);


--
-- Name: survey_question id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_question ALTER COLUMN id SET DEFAULT nextval('public.survey_question_id_seq'::regclass);


--
-- Name: survey_response id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_response ALTER COLUMN id SET DEFAULT nextval('public.survey_response_id_seq'::regclass);


--
-- Name: task id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task ALTER COLUMN id SET DEFAULT nextval('public.task_id_seq'::regclass);


--
-- Name: task_completion_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_completion_history ALTER COLUMN id SET DEFAULT nextval('public.task_completion_history_id_seq'::regclass);


--
-- Name: task_completions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_completions ALTER COLUMN id SET DEFAULT nextval('public.task_completions_id_seq'::regclass);


--
-- Name: task_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_history ALTER COLUMN id SET DEFAULT nextval('public.task_history_id_seq'::regclass);


--
-- Name: work_center id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_center ALTER COLUMN id SET DEFAULT nextval('public.work_center_id_seq'::regclass);


--
-- Name: work_session_day id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_session_day ALTER COLUMN id SET DEFAULT nextval('public.work_session_day_id_seq'::regclass);


--
-- Name: work_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_sessions ALTER COLUMN id SET DEFAULT nextval('public.work_sessions_id_seq'::regclass);


--
-- Name: workers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers ALTER COLUMN id SET DEFAULT nextval('public.workers_id_seq'::regclass);


--
-- Name: workers_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers_users ALTER COLUMN id SET DEFAULT nextval('public.workers_users_id_seq'::regclass);


--
-- Data for Name: admin_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_config (id, "companyName", address, "vatRate", "invoiceSeries", "paymentDetails", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: alert; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alert (id, "alertType", "triggerTime", "minDuration", "jobId") FROM stdin;
\.


--
-- Data for Name: cjobs_IVASTAI; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."cjobs_IVASTAI" (id, rate, name, "isActive") FROM stdin;
\.


--
-- Data for Name: cjobs_alertas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_alertas (id, job_id, type, when_signing_in, delay_enabled, delay_value, duration_enabled, duration_value, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_empleadores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_empleadores (id, "partnerId", name, "taxId", address, phone, mobile, landline, "typeId", "subTypeId", fee, discount, "paymentMethodId", "accountIban", "bicSwift", "probationPeriod", responsible, "accessAccountStatus", created_at, updated_at) FROM stdin;
1	1	ali	54321	main street	66666666666	\N	44444444444	2	1	2.00	22.00	4				Ana	request	2025-09-13 05:16:49.86463	2025-09-13 05:16:49.86463
2	1	employer 2	54321	main market,street 1	23232323233	\N		2	1	2.00	0.00	5					request	2025-09-16 00:24:12.231918	2025-09-16 00:24:12.231918
3	2	Employer 3	54321	main market,street 1	232323223	\N		2	3	2.00	0.00	5					request	2025-09-16 00:42:28.015076	2025-09-16 00:42:28.015076
\.


--
-- Data for Name: cjobs_encuestas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_encuestas (id, survey_id, user_id, rating, comments, response_date, is_anonymous, ip_address, device_info, location_lat, location_lng, is_verified, verified_by, verification_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_encuestasJobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."cjobs_encuestasJobs" (id, job_id, type, "questionText", monitoring_value, text_alert_tracking, farewell_text, periodicity, periodicity_value, hour, is_active, is_required, allow_comments, send_reminder, reminder_days, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_fichajes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_fichajes (id, job_id, shift_id, worker_id, action, "timestamp", location_lat, location_lng, device_info, ip_address, notes, is_manual, approved_by, approval_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_horarios_semanales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_horarios_semanales (id, job_id, "dayOfWeek", tomorrow_start, tomorrow_end, late_start, late_end, evening_start, evening_end, day_total, "isActive", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_jobs (id, employer_id, client_id, denomination, "startDate", "endDate", observations, schedule_type, season_type, total_weekly_hours, mobile_qr_code, mobile_wifi, mobile_gps, laptop_ip, laptop_wifi, phone_caller_id, verify_identity, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_jobsCentros; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."cjobs_jobsCentros" (id, job_id, work_center_id, "locationType", is_active, start_date, end_date, notes, max_workers, required_equipment, safety_requirements, access_instructions, contact_person, contact_phone, contact_email, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_jobsTrabajadores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."cjobs_jobsTrabajadores" (id, job_id, worker_id, start_date, end_date, status, hourly_rate, total_hours, total_cost, notes, assigned_by, assignment_date, is_primary, can_clock_in, can_manage_tasks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_notificaciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_notificaciones (id, role, recipient_id, title, message, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: cjobs_partners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_partners (id, name, address, landline, mobile, email, nif, commission, retention, account_iban, bic_swift, "logoUrl", responsible, access_account_status, created_at, updated_at, type_of_partner, payment_method, partner_tier_id, default_payment_method_id) FROM stdin;
1	partner 1	mian street	12345678	12345678	partners11@gmail.com	54321	6.00	10.00	555	TEST123456	\N	Ana	request	2025-09-13 03:35:09.742623	2025-09-13 03:35:09.742623	Silver	Direct Debit	2	\N
2	partner 2	main market,street 1		22222222222	partner2@gmail.com	54321	6.00	15.00			\N		request	2025-09-16 00:02:35.272554	2025-09-16 00:02:35.272554	Bronze	Transfer	3	\N
\.


--
-- Data for Name: cjobs_partnersUsuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."cjobs_partnersUsuarios" (id, partner_id, user_id, is_default, created_at, updated_at) FROM stdin;
1	1	4	t	2025-09-13 03:35:09.755802	2025-09-13 03:35:09.755802
2	2	11	t	2025-09-16 00:02:35.284714	2025-09-16 00:02:35.284714
\.


--
-- Data for Name: cjobs_paymentMethods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."cjobs_paymentMethods" (id, name, description, "isActive", created_at, updated_at) FROM stdin;
1	Transfer	Bank transfer payment method	t	2025-08-30 02:35:02.462076	2025-08-30 02:35:02.462076
2	Direct Debit	Direct Debit payment method	t	2025-08-30 02:35:02.462076	2025-08-30 02:35:02.462076
3	Card	Card payment method	t	2025-08-30 02:35:02.462076	2025-08-30 02:35:02.462076
4	PayPal	PayPal payment method	t	2025-08-30 02:35:02.462076	2025-08-30 02:35:02.462076
5	Others	Other payment methods	t	2025-08-30 02:35:02.462076	2025-08-30 02:35:02.462076
\.


--
-- Data for Name: cjobs_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_roles (id, name, value, created_at, updated_at) FROM stdin;
1	Admin	1	2025-06-16 21:55:39.141914	2025-06-16 21:55:39.141914
2	Partner	2	2025-06-16 21:55:39.141914	2025-06-16 21:55:39.141914
3	Employer	3	2025-06-16 21:55:39.141914	2025-06-16 21:55:39.141914
4	Client	4	2025-06-16 21:55:39.141914	2025-06-16 21:55:39.141914
5	Worker	5	2025-06-16 21:55:39.141914	2025-06-16 21:55:39.141914
\.


--
-- Data for Name: cjobs_tareas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_tareas (id, job_id, name, observations, duration, shift_tomorrow, shift_late, shift_evening, to_be_carried_out, periodicity, periodicity_date, alert_task_completed, pending_task_alert, status, completion_stage, priority, estimated_cost, actual_cost, start_time, end_time, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_tareasTrabajadores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."cjobs_tareasTrabajadores" (id, task_id, worker_id, shift_id, "timestamp", action, notes, completion_percentage, time_spent, quality_rating, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cjobs_turnos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_turnos (id, job_id, start_time, end_time, status, notes, break_duration, created_at, updated_at, worker_id, date, shift_type, actual_start_time, actual_end_time, total_hours, hourly_rate, total_cost) FROM stdin;
\.


--
-- Data for Name: cjobs_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cjobs_user (id, name, email, password, first_name, last_name, role_id, partner_id, created_at, updated_at) FROM stdin;
1	admin	admin4@example.com	$2b$10$fb5iMQuvGL.KSeaE3QbcMOc8/k5MzpNvkQZnWcTRgk0XouNnwDB3q	\N	\N	1	\N	2025-09-13 03:18:01.734259	2025-09-13 03:18:01.734259
2	partner 1	partner1@gmail.com	$2b$10$Y6iaLSyfSqIz0V4kLNzuxeKX5XHIvcHrbxmh3Nb5Nnqfy4c7RSTWi	\N	\N	2	\N	2025-09-13 03:25:28.89818	2025-09-13 03:25:28.89818
3	partner 1	partner11@gmail.com	$2b$10$ebb4CWRPg6jn/KP3EZwTnuxV/6RdeaiTL2whmfQCtvIP2YDrKzO1q	\N	\N	2	\N	2025-09-13 03:32:01.92625	2025-09-13 03:32:01.92625
4	partner 1	partners11@gmail.com	$2b$10$YDzt5Kbip22h2./6mzAgNe94dIYxuU80HkKEsHoFiZYYoDgO.bmbq	\N	\N	2	\N	2025-09-13 03:35:09.731194	2025-09-13 03:35:09.731194
5	ali	employer1@example.com	$2b$10$AQTZiInD4Mnr8ImchZw.See.tIEV9Sb.Body4SQ7kwefo37shfxpe	\N	\N	3	\N	2025-09-13 05:16:49.86463	2025-09-13 05:16:49.86463
6	client1	client1@example.com	$2b$10$ED1BJjjnRS.1sehRMadOKOmp2bu.qHXsxggEllTqP9n0Dn5WP3y1S	\N	\N	4	\N	2025-09-13 05:19:35.153604	2025-09-13 05:19:35.153604
7	worker 1	worker1@example.com	$2b$10$9C13YqYo82.rLcD/kkr/VewErQc6bUhD3c8Q6wWNRhvtVdKtwSKJa	\N	\N	5	\N	2025-09-13 05:21:20.999066	2025-09-13 05:21:20.999066
8	ali	client2@example.com	$2b$10$Q4QRdPIA6YSFjit6H2KwH.GgLR1Dl.lkBcu2iNBF1LWR0fg7Yws82	\N	\N	4	\N	2025-09-15 23:50:53.273643	2025-09-15 23:50:53.273643
10	worker 2	worker2@example.com	$2b$10$Z8c2Zam5QEom8c5cH9ZRneM.DJ.hKELInjI5TEMZRDbuaVVVBIY/e	\N	\N	5	\N	2025-09-15 23:55:30.808812	2025-09-15 23:55:30.808812
11	partner 2	partner2@gmail.com	$2b$10$uLzBDNkMPRa.PeCqZGruaO8wzRWwEzn92gMb5zOuDkznXwYbAYLla	\N	\N	2	\N	2025-09-16 00:02:35.262917	2025-09-16 00:02:35.262917
12	employer 2	employer2@example.com	$2b$10$fX7YzqC1Yfo3J9/9fo95au/kHw/rZF5HgF7DwKD57siQNR2L0ZBhm	\N	\N	3	\N	2025-09-16 00:24:12.231918	2025-09-16 00:24:12.231918
13	Employer 3	employer3@example.com	$2b$10$5lKbD4NqPSzzha2nM9FPV.oZyiWEjLCK7cwmLhpaZROhVOAhcnevm	\N	\N	3	\N	2025-09-16 00:42:28.015076	2025-09-16 00:42:28.015076
14	Calvin Hodge	saler@mailinator.com	$2b$10$k9LRwZXVDNKVGmiR6MlKdOkyno94KyGWD6HTVMKxD.EEK7QBv.rjO	\N	\N	4	\N	2025-10-29 05:13:15.60659	2025-10-29 05:13:15.60659
15	Melinda Hahn	qifinar@mailinator.com	$2b$10$2BvrkVpk1Tw6Ke7zcxZlAuirtFZ2nOznTIIRdfhg4S4tFk1zQXrEG	\N	\N	4	\N	2025-10-29 05:15:16.358528	2025-10-29 05:15:16.358528
16	Lyle Noble	fuwyvupego@mailinator.com	$2b$10$3tBy1ySLlGLVMhUsHguj3.a0v9223.rQPkHcQKjRhF.eSkvEvV7Ei	\N	\N	4	\N	2025-10-29 05:18:29.7563	2025-10-29 05:18:29.7563
17	Sean Miranda	jylykeva@mailinator.com	$2b$10$H4nHCBU60/2SeoZtTN7mKem9Bp6e1/W8tcgsMfzjQo0.EGxdS01FC	\N	\N	4	\N	2025-10-29 05:24:23.286699	2025-10-29 05:24:23.286699
18	Jarrod Ramos	refaw@mailinator.com	$2b$10$ww.eTXEi1NsqIpHQrDxrfeb6Rlq8c4Hrx/67/o/AgYKvw63dB.wIi	\N	\N	4	\N	2025-10-29 05:27:31.980347	2025-10-29 05:27:31.980347
19	Ian Hayes	mujijynozi@mailinator.com	$2b$10$SlZlzX3fk1Q92ZR50CQMauXD1mcr6TQmJptQurKUC4VhWm9Q4As0G	\N	\N	5	\N	2025-10-29 05:31:28.673271	2025-10-29 05:31:28.673271
20	Olivia Weiss	zunanoqeg@mailinator.com	$2b$10$b/jTqJaFl8X0TOv3tvWjBOZVkcHO6aTv0eBMYAeC8M3hRgWPmM6Ny	\N	\N	5	\N	2025-10-29 05:43:09.195432	2025-10-29 05:43:09.195432
21	Pamela Henry	kynixola@mailinator.com	$2b$10$s8ZZtvVHLOUq9HwC6Sgeu.nrvx8pmS7OK97gqCorpcopLrfKAgQz6	\N	\N	5	\N	2025-10-29 07:01:04.488132	2025-10-29 07:01:04.488132
22	Hayes Lucas	sigacimed@mailinator.com	$2b$10$RDKhx1G8c/eXUu0mLAL66Ob0SpH6Qv60oFez.Hx10LdBDqFPQfWCq	\N	\N	5	\N	2025-10-29 07:01:58.691534	2025-10-29 07:01:58.691534
\.


--
-- Data for Name: cjobs_usuariosFcm; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."cjobs_usuariosFcm" (id, user_id, firebase_token, device_type, last_used) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, type, status, code, "taxId", address, landline, mobile, observation, responsible, winter_schedule, summer_schedule, access_account_status, "userId", name) FROM stdin;
1	company	Active	10120	232323	worker center 1	12345666	3456789	vip	Ana	\N	\N	request	6	client1
2	particular	Active			main street		33333333333			\N	\N	request	8	ali
3	particular	Active	10120	3434	Dignissimos sed accu	322222222	233333333333	3fdfdf	Ana	\N	\N	request	14	Calvin Hodge
4	company	Active	10120	2323	Odit nisi non sed do	234567ui	2345678	sfsfd	Ana	\N	\N	request	15	Melinda Hahn
5	company	Active	10120	343433	Accusamus explicabo	242422	4242422	xcxcxcxc	Fernando Gil	\N	\N	request	16	Lyle Noble
6	company	Active	10120	2322	Asperiores eu quaera	24444444444444	322222222222	dfdff	Alain	\N	\N	request	17	Sean Miranda
7	particular	Active	10120	34344343	Ea rerum quis quo cu	444444444434	344444444444	dsfgdsa	Fernando Gil	\N	\N	request	18	Jarrod Ramos
\.


--
-- Data for Name: clients_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients_users (id, "clientId", "userId", "isDefault") FROM stdin;
1	1	6	t
2	2	8	t
3	3	14	t
4	4	15	t
5	5	16	t
6	6	17	t
7	7	18	t
\.


--
-- Data for Name: employerClients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."employerClients" (id, "isActive", created_at, updated_at, "employerId", "clientId") FROM stdin;
1	t	2025-09-13 05:19:35.153604	2025-09-13 05:19:35.153604	1	1
2	t	2025-09-15 23:50:53.273643	2025-09-15 23:50:53.273643	1	2
3	t	2025-10-29 05:13:15.60659	2025-10-29 05:13:15.60659	1	3
4	t	2025-10-29 05:15:16.358528	2025-10-29 05:15:16.358528	1	4
5	t	2025-10-29 05:18:29.7563	2025-10-29 05:18:29.7563	1	5
6	t	2025-10-29 05:24:23.286699	2025-10-29 05:24:23.286699	1	6
7	t	2025-10-29 05:27:31.980347	2025-10-29 05:27:31.980347	1	7
\.


--
-- Data for Name: employerSubTypes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."employerSubTypes" (id, name, created_at, updated_at, "invoicingRules") FROM stdin;
1	Individual	2025-08-30 02:57:52.110949	2025-08-30 02:57:52.110949	\N
2	Self-Employed	2025-08-30 02:57:52.110949	2025-08-30 02:57:52.110949	\N
3	Company	2025-08-30 02:57:52.110949	2025-08-30 02:57:52.110949	\N
\.


--
-- Data for Name: employerTypes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."employerTypes" (id, name, created_at, updated_at, "defaultRate") FROM stdin;
1	Home	2025-08-30 03:12:16.803493	2025-08-30 03:12:16.803493	\N
2	Static	2025-08-30 03:12:16.803493	2025-08-30 03:12:16.803493	\N
3	Remote	2025-08-30 03:12:16.803493	2025-08-30 03:12:16.803493	\N
\.


--
-- Data for Name: employerUsers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."employerUsers" (id, "isDefault", created_at, updated_at, "employerId", "userId") FROM stdin;
1	t	2025-09-13 05:16:49.86463	2025-09-13 05:16:49.86463	1	5
2	t	2025-09-16 00:24:12.231918	2025-09-16 00:24:12.231918	2	12
3	t	2025-09-16 00:42:28.015076	2025-09-16 00:42:28.015076	3	13
\.


--
-- Data for Name: employerWorkCenters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."employerWorkCenters" (id, is_active, created_at, updated_at, "employerId", "workCenterId") FROM stdin;
\.


--
-- Data for Name: employerWorkers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."employerWorkers" (id, "isActive", created_at, updated_at, "employerId", "workerId") FROM stdin;
1	t	2025-09-13 05:21:20.999066	2025-09-13 05:21:20.999066	1	1
2	t	2025-09-15 23:55:30.808812	2025-09-15 23:55:30.808812	1	2
3	t	2025-10-29 05:31:28.673271	2025-10-29 05:31:28.673271	1	3
4	t	2025-10-29 05:43:09.195432	2025-10-29 05:43:09.195432	1	4
5	t	2025-10-29 07:01:04.488132	2025-10-29 07:01:04.488132	1	5
6	t	2025-10-29 07:01:58.691534	2025-10-29 07:01:58.691534	1	6
\.


--
-- Data for Name: employers_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employers_users (id, employer_id, user_id, is_default, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: gender; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gender (id, name) FROM stdin;
1	Male
2	Female
3	Other
\.


--
-- Data for Name: job; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job (id, "jobName", "startDate", "endDate", note, "employerId", "clientId", user_id, status, "workCenterId", timezone, "scheduleType") FROM stdin;
1	ELECTRICISTA	2025-11-14	2126-08-01	ggg	1	1	\N	scheduled	1	\N	seasonal
2	Cleaner	2025-11-15	2126-08-01		1	1	\N	scheduled	1	\N	seasonal
3	cleener	2025-11-13	2126-08-01		1	1	\N	scheduled	1	\N	free
4	cleener	2025-11-28	2126-08-01		1	1	\N	scheduled	1	\N	seasonal
5	electrician	2025-12-18	2126-08-01	fgfg	1	1	\N	scheduled	1	\N	free
6	asad	2025-12-10	2126-08-01	gffg	1	\N	\N	scheduled	6	\N	free
7	cleener	2025-12-12	2126-08-01	dgdf	1	1	\N	scheduled	1	\N	seasonal
\.


--
-- Data for Name: job_work_centers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_work_centers (job_id, work_center_id) FROM stdin;
1	1
1	2
1	5
1	7
2	1
3	1
3	2
4	1
4	2
5	1
5	2
5	5
5	7
6	6
6	8
6	9
6	10
7	1
7	2
7	5
\.


--
-- Data for Name: job_workers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_workers ("jobId", "workersId") FROM stdin;
1	1
1	2
2	1
2	2
3	1
4	1
5	1
5	2
5	3
5	4
5	5
5	6
6	1
6	2
6	3
6	4
6	5
6	6
7	1
7	2
7	4
7	5
7	6
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, role, recipient_id, type, message, meta, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: otp; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.otp (id, "userId", otp, "expiresAt", intent, "createdAt") FROM stdin;
\.


--
-- Data for Name: partner_tier; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.partner_tier (id, name, value, created_at, updated_at) FROM stdin;
1	Gold	1	2025-09-13 03:24:34.053026	2025-09-13 03:24:34.053026
2	Silver	2	2025-09-13 03:24:34.053026	2025-09-13 03:24:34.053026
3	Bronze	3	2025-09-13 03:24:34.053026	2025-09-13 03:24:34.053026
4	Affiliate	4	2025-09-13 03:24:34.053026	2025-09-13 03:24:34.053026
\.


--
-- Data for Name: qr_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.qr_codes (id, token, type, "ownerType", "ownerId", "createdAt", "updatedAt", "expiresAt", "lastRefreshedAt", "isActive") FROM stdin;
a721c4c7-b786-4e2f-82d2-839f4d67d183	02385238-d137-46ba-aae1-4fceff7fb4e6	STATIC	CLIENT	1	2025-11-19 03:38:17.539591	2025-11-19 03:38:17.539591	\N	\N	t
192216b4-a40d-4cec-afc2-668f18d0f207	872dcfce-9bd8-4206-8c27-a486cdcaf551	STATIC	CLIENT	2	2025-11-19 03:38:17.588572	2025-11-19 03:38:17.588572	\N	\N	t
65fc5fdf-f13c-4c90-b9d0-1d91db4b29a1	000cc9c9-9309-40c1-a93f-380bf74d7c59	STATIC	CLIENT	3	2025-11-19 03:38:17.595167	2025-11-19 03:38:17.595167	\N	\N	t
cbccf7a2-2798-4d97-b0f2-2020a8b2dcc2	bc3b8c85-d8fe-4d6a-a40a-f82217da16b0	STATIC	CLIENT	4	2025-11-19 03:38:17.600749	2025-11-19 03:38:17.600749	\N	\N	t
b3c635c9-3cb8-417b-8749-9a997002f92d	3b7238b5-d01f-415c-9de5-92ac7ed015fe	STATIC	CLIENT	5	2025-11-19 03:38:17.607202	2025-11-19 03:38:17.607202	\N	\N	t
d08b6774-ab9a-4388-8eb7-3f90db8206ca	7dd24836-4c14-44a6-b7e1-6fb85ff89d5e	STATIC	CLIENT	6	2025-11-19 03:38:17.611954	2025-11-19 03:38:17.611954	\N	\N	t
19999edb-e231-4398-bdc7-95406a325626	2af614fb-67c8-4387-ab86-8e5f89877439	STATIC	CLIENT	7	2025-11-19 03:38:17.615339	2025-11-19 03:38:17.615339	\N	\N	t
13547b80-2e8b-4061-9005-6ad05eafa374	e51de3a0-8b6c-40b8-8c73-5a5201c68a14	STATIC	EMPLOYER	1	2025-11-19 03:38:17.625947	2025-11-19 03:38:17.625947	\N	\N	t
ea2c3260-246a-403b-82cb-6a01c4418f36	a5548535-09ad-4cff-91d7-33ef40bdf8bd	STATIC	EMPLOYER	2	2025-11-19 03:38:17.629682	2025-11-19 03:38:17.629682	\N	\N	t
dcc9592b-20a2-4072-b01c-5e2aadde9d48	c735e97f-e7c9-4bfc-b4b2-9a743f431e57	STATIC	EMPLOYER	3	2025-11-19 03:38:17.63312	2025-11-19 03:38:17.63312	\N	\N	t
40ba8276-a155-4dde-bc04-7e080afad927	4TX2EfcCpyISGmsT64UPg1M3XfBRvszKJ4U1grKJNNQ	DYNAMIC	CLIENT	1	2025-11-19 03:38:17.584704	2025-12-03 07:50:00.257409	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
bd2ff462-3d25-4217-b57d-e94023fe9401	jGjqwoJNvgNYYWKxBt55-Q5gEnybWRqaH_Td7sMxrxw	DYNAMIC	CLIENT	2	2025-11-19 03:38:17.592316	2025-12-03 07:50:00.297002	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
5f26911e-bf4e-4503-85aa-018d3634b227	_rgXMh7Ossf95AYwNV4AKdbp426Hvr07Eg6cuiaY3Y8	DYNAMIC	CLIENT	3	2025-11-19 03:38:17.597985	2025-12-03 07:50:00.306473	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
309ce489-189b-48db-bd89-dff2f77cb993	T4NKB2lLiMdThtJyk4HqzyvC5SKbNfS189iRWHma0YA	DYNAMIC	CLIENT	4	2025-11-19 03:38:17.603296	2025-12-03 07:50:00.317312	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
9175d2de-ab37-4b11-b17e-b9605fc320ff	fE_Tqv1LRtF_szsOHykEJtjeM-R8f9buC4jXElSJcQw	DYNAMIC	CLIENT	5	2025-11-19 03:38:17.61017	2025-12-03 07:50:00.324992	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
f4babea3-37f3-4569-b64a-81801fc37d3d	AhYbrGCaPVuwyln59xzlErqlEBO6ln2Mp9oXyvQwquI	DYNAMIC	CLIENT	6	2025-11-19 03:38:17.613737	2025-12-03 07:50:00.334139	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
12cd2a08-83b9-4946-8504-79e24f2926ef	L5ue-JK_a4my_fvHtPFLt4n1QO_FHjqSQ8mhhK60BDY	DYNAMIC	CLIENT	7	2025-11-19 03:38:17.617441	2025-12-03 07:50:00.34254	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
9b4507c0-d5ef-4a2d-a5cb-adc13e175a13	8G7ULkwaNZd4mN-4Ghgr-2ltl8R6-JRY4k655MYvKUM	DYNAMIC	EMPLOYER	1	2025-11-19 03:38:17.628043	2025-12-03 07:50:00.355485	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
c270688c-34ea-4fd6-878f-864b6b3388d5	4Zx6D3bNNDFV2xZOIUdXosGnY9K-HaBQN76Hr30nHBk	DYNAMIC	EMPLOYER	2	2025-11-19 03:38:17.631393	2025-12-03 07:50:00.366287	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
34570389-a7ae-4103-8b4c-36aa0ae56ba3	X1rTQ5XlJlEch_BgkmR_8XNwxGGS8sOz9gG8acRTIN4	DYNAMIC	EMPLOYER	3	2025-11-19 03:38:17.634799	2025-12-03 07:50:00.374716	2025-12-03 20:55:00.029	2025-12-03 20:50:00.029	t
\.


--
-- Data for Name: receipt; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.receipt (id, "imageUrl", amount, "pfrReceiptNumber", status, city, "retailStore", "userId", "pointsAwarded", "approvedOrRejectedBy", "createdAt", "rejectionReason") FROM stdin;
\.


--
-- Data for Name: scan_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.scan_logs (id, job_id, worker_id, "scanType", location, notes, scan_time, user_timezone) FROM stdin;
1	1	1	check-out	{"address":"Abassia Town, Rahim Yar Khan, Rahim Yar Khan Tehsil, Rahim Yar Khan District, Bahawalpur Division, Punjab, 64200, Pakistan","ip":"39.46.116.45","latitude":28.423119,"longitude":70.3025777,"qrData":null}	Work session completed	2025-11-26 21:48:10.528052-08	Asia/Karachi
2	3	1	check-out	{"address":"Abassia Town, Rahim Yar Khan, Rahim Yar Khan Tehsil, Rahim Yar Khan District, Bahawalpur Division, Punjab, 64200, Pakistan","ip":"39.46.116.45","latitude":28.423119,"longitude":70.3025777,"qrData":null}	Work session completed	2025-11-26 21:52:00.685101-08	Asia/Karachi
3	1	1	check-out	{"address":"Rahim Yar Khan, Rahim Yar Khan Tehsil, Rahim Yar Khan District, Bahawalpur Division, Punjab, 64200, Pakistan","ip":"39.46.116.45","latitude":28.4266952,"longitude":70.3219218,"qrData":null}	Sesi├│n de trabajo completada	2025-11-28 02:43:49.050244-08	Asia/Karachi
4	2	1	check-out	{"address":"Rahim Yar Khan, Rahim Yar Khan Tehsil, Rahim Yar Khan District, Bahawalpur Division, Punjab, 64200, Pakistan","ip":"39.46.116.45","latitude":28.4266847,"longitude":70.3263857,"qrData":null}	Sesi├│n de trabajo completada	2025-12-01 02:19:46.54885-08	Asia/Karachi
5	4	1	check-out	{"address":"Rahim Yar Khan, Rahim Yar Khan Tehsil, Rahim Yar Khan District, Bahawalpur Division, Punjab, 64200, Pakistan","ip":"39.46.116.45","latitude":28.4266847,"longitude":70.3263857,"qrData":null}	Sesi├│n de trabajo completada	2025-12-01 02:20:52.969782-08	Asia/Karachi
6	1	1	check-out	{"address":"Abassia Town, Rahim Yar Khan, Rahim Yar Khan Tehsil, Rahim Yar Khan District, Bahawalpur Division, Punjab, 64200, Pakistan","ip":"39.46.116.45","latitude":28.4231129,"longitude":70.3003456,"qrData":null}	Sesi├│n de trabajo completada	2025-12-03 03:46:04.76309-08	Asia/Karachi
\.


--
-- Data for Name: season_period; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.season_period (id, job_id, season, start_date, end_date) FROM stdin;
1	1	summer	2025-05-12	2025-12-12
2	4	summer	2025-05-12	2025-07-12
3	7	summer	2025-04-12	2025-07-12
\.


--
-- Data for Name: seasonal_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.seasonal_schedule (id, job_id, season, start_date, end_date, total_week_hours) FROM stdin;
1	1	normal	\N	\N	95
2	1	summer	12-05	12-12	72
3	2	normal	\N	\N	96
4	2	summer	\N	\N	0
5	4	normal	\N	\N	112
6	4	summer	12-05	12-07	89
7	7	normal	\N	\N	97
8	7	summer	12-04	12-07	107
\.


--
-- Data for Name: shift; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shift (id, "shiftType", "startTime", "endTime", total_hours, season, day, day_enum, seasonal_schedule_id, start_weekday, end_weekday, base_start_time, base_end_time, is_continuous) FROM stdin;
1	\N	\N	\N	95	\N	\N	\N	1	monday	friday	02:00:00	01:00:00	t
2	\N	\N	\N	72	\N	\N	\N	2	tuesday	friday	02:00:00	02:00:00	t
3	\N	\N	\N	96	\N	\N	\N	3	tuesday	saturday	03:00:00	03:00:00	t
4	\N	\N	\N	4	\N	\N	\N	5	wednesday	wednesday	03:00:00	07:00:00	f
5	\N	\N	\N	36	\N	\N	\N	5	thursday	friday	02:00:00	14:00:00	t
6	\N	\N	\N	72	\N	\N	\N	5	saturday	tuesday	03:00:00	03:00:00	t
7	\N	\N	\N	53	\N	\N	\N	6	monday	wednesday	03:00:00	08:00:00	t
8	\N	\N	\N	20	\N	\N	\N	6	friday	friday	01:00:00	21:00:00	f
9	\N	\N	\N	16	\N	\N	\N	6	saturday	saturday	03:00:00	19:00:00	f
10	\N	\N	\N	24	\N	\N	\N	7	tuesday	wednesday	01:00:00	01:00:00	t
11	\N	\N	\N	1	\N	\N	\N	7	thursday	thursday	02:00:00	03:00:00	f
12	\N	\N	\N	72	\N	\N	\N	7	friday	monday	03:00:00	03:00:00	t
13	\N	\N	\N	9	\N	\N	\N	8	tuesday	tuesday	02:00:00	11:00:00	f
14	\N	\N	\N	98	\N	\N	\N	8	wednesday	sunday	01:00:00	03:00:00	t
\.


--
-- Data for Name: shift_instance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shift_instance (id, job_id, shift_id, date, start_time, end_time, total_hours, is_generated) FROM stdin;
\.


--
-- Data for Name: signing_method; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.signing_method (id, "methodType", "methodDetails", "verifyIdentity", "jobId") FROM stdin;
1	mobile	ip,gps	f	1
2	pc	web	f	1
3	mobile	web	f	2
4	pc	ip	f	2
5	mobile	qrcode,ip,gps	f	3
6	pc	web	f	3
7	mobile	web	f	4
8	pc	web	f	4
9	mobile	web	f	5
10	pc	web	f	5
11	mobile	web	f	6
12	pc	web	f	6
13	mobile	web	f	7
14	pc	web	f	7
\.


--
-- Data for Name: survey; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey (id, "jobId", "employerId", "clientId", "workerId", "questionText", "rateDigit", "textAlertTracking", "greetingText", periodicity, "startDate", "endDate", "interval", "monthlyDays", "monthlyWeekdays", "monthlyStartWeekday", "monthlyEndWeekday", "sendTime", "createdAt") FROM stdin;
1	27	1	\N	\N	\N	\N	wwwwwwwwww	\N	weekly	2025-10-24	2025-10-24	1	[]	[3]	\N	\N	\N	2025-10-22 23:38:48.523256-07
2	27	1	\N	\N	\N	\N	cccccccccc	\N	monthly	2025-10-24	2025-10-31	1	[10,27]	[]	\N	\N	\N	2025-10-22 23:38:48.523256-07
3	28	1	\N	\N	zzzzzzzzzz	6	zzzzzzzzzzzzzzzzz	zzzzzzzzzzzzzzzzzzzz	daily	2025-10-23	2025-10-24	2	[]	[]	\N	\N	09:00:00	2025-10-22 23:51:36.325843-07
4	28	1	\N	\N	xxxxxxxxxx	1	xxxxxxxxxxxxxx	xxxxxxxxxxxxx	weekly	2025-10-24	2025-10-31	1	[]	[3]	\N	\N	21:00:00	2025-10-22 23:51:36.325843-07
5	35	1	1	\N	vvvvvvvv	4	vvvvvvv	vvvvvvvvv	daily	2025-10-23	2025-10-31	1	[]	[]	\N	\N	08:00:00	2025-10-23 04:52:24.455118-07
6	35	1	\N	\N	bbbbbbbbbbbbbbbb	5	bbbbbbbbbbbbbbbbbbbb	bbbbbbbbbbbbbbbbbbb	daily	2025-10-24	2025-10-24	1	[]	[]	\N	\N	08:00:00	2025-10-23 04:52:24.455118-07
7	36	1	1	\N	vvvvvvvv	4	vvvvvvv	vvvvvvvvv	daily	2025-10-23	2025-10-31	1	[]	[]	\N	\N	08:00:00	2025-10-23 04:54:45.078858-07
8	36	1	\N	\N	bbbbbbbbbbbbbbbb	5	bbbbbbbbbbbbbbbbbbbb	bbbbbbbbbbbbbbbbbbb	daily	2025-10-24	2025-10-24	1	[]	[]	\N	\N	08:00:00	2025-10-23 04:54:45.078858-07
9	37	1	\N	\N	aaaaaaaaa	5	aaaaaaaaaaa	aaaaaaaa	weekly	2025-10-24	2025-10-31	1	[]	[0]	\N	\N	08:00:00	2025-10-23 04:57:02.075327-07
10	37	1	\N	\N	llllllllllll	5	lllllllllllllllllllll	lllllllllllllll	monthly	2025-10-24	2025-10-31	1	[1,13,31]	[]	\N	\N	08:00:00	2025-10-23 04:57:02.075327-07
11	38	1	\N	\N	sdsdsdsdd	5	dwdwewewew	Please fill after job completion.	monthly	2025-10-24	2025-10-31	1	[]	[]	\N	\N	08:00:00	2025-10-23 05:03:53.895504-07
12	38	1	\N	\N	tyytytytyy	5	tytytytytytyt	tytytytyty	monthly	2025-10-23	2025-10-24	1	[]	[]	\N	\N	08:00:00	2025-10-23 05:03:53.895504-07
13	39	1	\N	\N	asasasas	5	asasasa	asasasasa	monthly	\N	\N	1	[]	[]	4	\N	08:00:00	2025-10-23 05:15:09.080548-07
14	39	1	\N	\N	dfdfdfdfd	5	dfdfdfdf	dfdfdfdfd	monthly	\N	\N	1	[]	[]	\N	0	08:00:00	2025-10-23 05:15:09.080548-07
15	40	1	\N	\N	ssssssssssssss	10	sssssssssssss	sssssssssssss	weekly	2025-10-23	2025-10-31	1	[]	[0]	\N	\N	08:00:00	2025-10-23 05:21:28.901892-07
16	40	1	\N	\N	aaaaaaaaaaaaa	6	aaaaaaaaaaaa	aaaaaaaaaaaaaaaaaaa	monthly	\N	\N	1	[]	[4,6]	\N	\N	08:00:00	2025-10-23 05:21:28.901892-07
17	42	1	\N	\N	adadadadad	5	adadaddadadad	adadadadad	weekly	\N	\N	4	[]	[1,4]	\N	\N	08:00:00	2025-10-27 00:33:45.11316-07
18	42	1	\N	\N	bbbbbbbbbbbbbbb	5	bbbbbbbbbbbbbbbb	bbbbbbbbbbbbbbbbbbbbb	monthly	\N	\N	8	[]	[]	5	\N	18:00:00	2025-10-27 00:33:45.11316-07
19	52	1	\N	\N	dfdfdf	3	dfdfdf	fdfdfdf	daily	\N	\N	2	[]	[]	\N	\N	08:00:00	2025-11-03 21:24:58.700721-08
20	53	1	1	\N	dfdfdf	7	sdsdsd	sdsdsds	daily	\N	\N	1	[]	[]	\N	\N	08:00:00	2025-11-03 23:52:58.735104-08
21	54	1	1	\N	dfdfdf	3	sdsd	sdsdsd	daily	\N	\N	1	[]	[]	\N	\N	08:00:00	2025-11-03 23:57:32.310284-08
22	70	1	1	\N	dfdfdd	6	cggf	dgdgdg	daily	\N	\N	1	[]	[]	\N	\N	08:00:00	2025-11-12 03:41:27.986141-08
23	1	1	1	\N	dfdfdf	5	gfhgf	fghhg	daily	\N	\N	1	[]	[]	\N	\N	08:00:00	2025-11-12 22:07:03.515151-08
24	7	1	1	\N	dfdfdf	5	sesesese	sesesese	daily	\N	\N	2	[]	[]	\N	\N	08:00:00	2025-12-03 01:53:38.635693-08
\.


--
-- Data for Name: survey_answer; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_answer (id, "answerText", "responseId", "questionId") FROM stdin;
\.


--
-- Data for Name: survey_question; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_question (id, "questionText", "questionType", options, "isRequired", "order", "surveyId") FROM stdin;
1	How satisfied are you with the job?	rating	1,2,3,4,5	t	1	1
2	Any comments?	text	\N	f	2	1
3	sfdf	rating	1,2,3,4,5,6,7,8,9,10	t	1	2
4	dfdfdfd	text	\N	f	2	2
5	Queastion for worker	rating	1,2,3,4,5,6,7,8,9,10	t	1	3
6	alert worker	text	\N	f	2	3
7	dddddddddd	rating	1,2,3,4,5,6,7,8,9,10	t	1	4
8	dddddddddd	text	\N	f	2	4
9	cccccc	rating	1,2,3,4,5,6,7,8,9,10	t	1	5
10	cccccccccc	text	\N	f	2	5
11	wwwww	rating	1,2,3,4,5,6,7,8,9,10	t	1	6
12	wwwwwwwwwwwwww	text	\N	f	2	6
13	wwwwww	rating	1,2,3,4,5,6,7,8,9,10	t	1	1
14	wwwwwwwwww	text	\N	f	2	1
15	ccccccccccccc	rating	1,2,3,4,5,6,7,8,9,10	t	1	2
16	cccccccccc	text	\N	f	2	2
17	zzzzzzzzzz	rating	1,2,3,4,5,6,7,8,9,10	t	1	3
18	zzzzzzzzzzzzzzzzz	text	\N	f	2	3
19	xxxxxxxxxx	rating	1,2,3,4,5,6,7,8,9,10	t	1	4
20	xxxxxxxxxxxxxx	text	\N	f	2	4
\.


--
-- Data for Name: survey_response; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.survey_response (id, "submittedAt", "surveyId", "jobId", "workerId", "clientId") FROM stdin;
\.


--
-- Data for Name: task; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task (id, name, note, "expectedDuration", shift, timing, periodicity, "alertTask", "pendingTask", "jobId", "isCompleted", "completedAt", "completedByWorkerId", "weeklyDays", "startDate", "endDate", "interval", "onceDate", "monthlyDays", "monthlyWeekdays", "yearlyMonths", "yearlyDays", "workCenterId", "monthlyStartWeekday", "monthlyEndWeekday") FROM stdin;
1	task 1	rtjhgf	4	morning	during	once	t	f	1	f	\N	\N	\N	\N	\N	1	2025-11-20	\N	\N	\N	\N	1	\N	\N
2	paint desk	dgdf	3	morning	during	weekly	f	t	7	f	\N	\N	4,1,0	2025-12-23	2025-12-24	1	\N	\N	\N	\N	\N	2	\N	\N
3	paint desk	dfgdf	8	morning	during	monthly	t	f	7	f	\N	\N	\N	\N	\N	1	\N	\N	\N	\N	\N	-2	5	\N
\.


--
-- Data for Name: task_completion_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_completion_history (id, task_id, "completionDate", "completedByWorkerId", created_at, "completedAt") FROM stdin;
\.


--
-- Data for Name: task_completions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_completions (id, task_id, worker_id, job_id, "completionDate", "completedAt", notes, "timeSpentMinutes", "completionMethod", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: task_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_history (id, "taskId", "jobId", date, "isCompleted", "completedAt", "completedByWorkerId", "completedById") FROM stdin;
1	1	1	2025-11-27	t	2025-11-27 10:53:07.827	1	\N
2	1	1	2025-11-28	t	2025-11-28 15:43:43.543	1	\N
\.


--
-- Data for Name: work_center; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_center (id, name, address, "contactName", "contactPhone", "contactEmail", client_id, created_at, updated_at, landline, postal_code, employer_id) FROM stdin;
1	WorkCenter 1	Auto-created work center	\N	\N	\N	1	2025-09-13 05:54:37.310899	2025-09-13 05:54:37.310899	\N	\N	\N
2	Central Work Center	123 Main Street, Suite 400	Ali Khan	+92-300-1234567	ali.khan@example.com	1	2025-09-25 23:50:28.295672	2025-09-25 23:50:28.295672	\N	\N	\N
5	center	Mainpuri, Uttar Pradesh 205001, India	ana	45678909876543	main@example.com	1	2025-09-26 04:21:42.306692	2025-09-26 04:21:42.306692	\N	\N	\N
6	Employer Work Center	123 Main Street, Suite 400	Ali Khan	+92-300-1234567	employer1@example.com	\N	2025-09-29 03:24:33.262559	2025-09-29 03:24:33.262559	+92-42-1234567	54000	1
7	Client Work Center	123 Main Street, Suite 400	Client center	+92-300-1234567	client1@example.com	1	2025-09-29 06:35:37.227809	2025-09-29 06:35:37.227809	+92-42-1234567	54000	\N
8	Client Work Center	123 Main Street, Suite 400	Client center	+92-300-1234567	client1@example.com	\N	2025-09-29 06:35:59.388792	2025-09-29 06:35:59.388792	+92-42-1234567	54000	1
9	workcenter	Mainpat, Chhattisgarh 497111, India	ana	2345678765432	workmain@example.com	\N	2025-09-30 06:34:20.867844	2025-09-30 06:34:20.867844	\N	\N	1
10	workcenter	Model Colony Malir Cantonment, Karachi, Pakistan	ana	23456789	main3243@example.com	\N	2025-09-30 06:46:48.559515	2025-09-30 06:46:48.559515	345678876	54567	1
-1	In itinere - In	before check in	\N	\N	\N	\N	2025-10-20 23:58:39.505596	2025-10-20 23:58:39.505596	\N	\N	\N
-2	In itinere - Out	after check out	\N	\N	\N	\N	2025-10-20 23:58:39.505596	2025-10-20 23:58:39.505596	\N	\N	\N
\.


--
-- Data for Name: work_session_day; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_session_day (id, work_session_id, job_id, worker_id, date, start_time, end_time, minutes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: work_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_sessions (id, job_id, worker_id, total_work_minutes, total_break_minutes, is_active, is_on_break, notes, check_in_time, check_out_time, current_break_start, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workers (id, code, access_account_status, landline, mobile, nif, naf, occupation, birthday, active, observation, asset, gender_id, address, user_id) FROM stdin;
1	10120	request	2635263823	2382582743	54321	23504510	ELECTRICISTA	2005-02-13	t	\N	\N	1	main street	\N
2	10120	request		03087983318			Limpiadora	2024-05-15	t	\N	\N	2	main market,street 1	\N
3	10120	request	2444444444	233333333	54321	23504510	Limpiadora	2025-10-29	t	\N	\N	2	Exercitation a lorem	\N
4	10120	request	1324335	24444444444	54321	23504510	Limpiadora	2025-10-30	t	\N	\N	1	Explicabo Excepteur	\N
5	10120	request	345678	23456788765	54321	23504510	Limpiadora	2025-09-30	t	\N	\N	1	Vel in facere pariat	\N
6	10120	request	45678754345	23457898765432	54321	23504510	Limpiadora	2025-10-30	t	\N	\N	1	Magni quia dolor ame	\N
\.


--
-- Data for Name: workers_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workers_users (id, "workerId", "userId") FROM stdin;
1	1	7
2	2	10
3	3	19
4	4	20
5	5	21
6	6	22
\.


--
-- Name: admin_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_config_id_seq', 1, false);


--
-- Name: alert_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alert_id_seq', 1, false);


--
-- Name: cjobs_IVASTAI_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_IVASTAI_id_seq"', 1, false);


--
-- Name: cjobs_alertas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_alertas_id_seq', 1, false);


--
-- Name: cjobs_centrosTrabajo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_centrosTrabajo_id_seq"', 1, false);


--
-- Name: cjobs_empleadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_empleadores_id_seq', 3, true);


--
-- Name: cjobs_encuestasJobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_encuestasJobs_id_seq"', 1, false);


--
-- Name: cjobs_encuestas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_encuestas_id_seq', 1, false);


--
-- Name: cjobs_fichajes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_fichajes_id_seq', 1, false);


--
-- Name: cjobs_horarios_semanales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_horarios_semanales_id_seq', 1, false);


--
-- Name: cjobs_jobsCentros_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_jobsCentros_id_seq"', 1, false);


--
-- Name: cjobs_jobsTrabajadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_jobsTrabajadores_id_seq"', 1, false);


--
-- Name: cjobs_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_jobs_id_seq', 1, false);


--
-- Name: cjobs_notificaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_notificaciones_id_seq', 1, false);


--
-- Name: cjobs_partnersUsuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_partnersUsuarios_id_seq"', 2, true);


--
-- Name: cjobs_partners_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_partners_id_seq', 2, true);


--
-- Name: cjobs_paymentMethods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_paymentMethods_id_seq"', 5, true);


--
-- Name: cjobs_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_roles_id_seq', 5, true);


--
-- Name: cjobs_tareasTrabajadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_tareasTrabajadores_id_seq"', 1, false);


--
-- Name: cjobs_tareas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_tareas_id_seq', 1, false);


--
-- Name: cjobs_turnos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_turnos_id_seq', 1, false);


--
-- Name: cjobs_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cjobs_user_id_seq', 22, true);


--
-- Name: cjobs_usuariosFcm_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."cjobs_usuariosFcm_id_seq"', 1, false);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clients_id_seq', 7, true);


--
-- Name: clients_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clients_users_id_seq', 7, true);


--
-- Name: employerClients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."employerClients_id_seq"', 7, true);


--
-- Name: employerSubTypes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."employerSubTypes_id_seq"', 3, true);


--
-- Name: employerTypes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."employerTypes_id_seq"', 3, true);


--
-- Name: employerUsers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."employerUsers_id_seq"', 3, true);


--
-- Name: employerWorkCenters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."employerWorkCenters_id_seq"', 1, false);


--
-- Name: employerWorkers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."employerWorkers_id_seq"', 6, true);


--
-- Name: employers_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employers_users_id_seq', 1, false);


--
-- Name: gender_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gender_id_seq', 3, true);


--
-- Name: job_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.job_id_seq', 7, true);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.migrations_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 4, true);


--
-- Name: otp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.otp_id_seq', 1, false);


--
-- Name: partner_tier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.partner_tier_id_seq', 4, true);


--
-- Name: receipt_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.receipt_id_seq', 1, false);


--
-- Name: scan_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.scan_logs_id_seq', 6, true);


--
-- Name: season_period_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.season_period_id_seq', 3, true);


--
-- Name: seasonal_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.seasonal_schedule_id_seq', 8, true);


--
-- Name: shift_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shift_id_seq', 14, true);


--
-- Name: shift_instance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shift_instance_id_seq', 1, false);


--
-- Name: signing_method_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.signing_method_id_seq', 14, true);


--
-- Name: survey_answer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.survey_answer_id_seq', 1, false);


--
-- Name: survey_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.survey_id_seq', 24, true);


--
-- Name: survey_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.survey_question_id_seq', 20, true);


--
-- Name: survey_response_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.survey_response_id_seq', 1, false);


--
-- Name: task_completion_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.task_completion_history_id_seq', 1, false);


--
-- Name: task_completions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.task_completions_id_seq', 1, false);


--
-- Name: task_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.task_history_id_seq', 2, true);


--
-- Name: task_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.task_id_seq', 3, true);


--
-- Name: work_center_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_center_id_seq', 10, true);


--
-- Name: work_session_day_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_session_day_id_seq', 1, false);


--
-- Name: work_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_sessions_id_seq', 1, false);


--
-- Name: workers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.workers_id_seq', 6, true);


--
-- Name: workers_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.workers_users_id_seq', 6, true);


--
-- Name: cjobs_usuariosFcm PK_0c27092e17699e66a3129e18c22; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_usuariosFcm"
    ADD CONSTRAINT "PK_0c27092e17699e66a3129e18c22" PRIMARY KEY (id);


--
-- Name: cjobs_encuestas PK_1247a4eccff7dc66b0e55e5d702; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_encuestas
    ADD CONSTRAINT "PK_1247a4eccff7dc66b0e55e5d702" PRIMARY KEY (id);


--
-- Name: employerWorkCenters PK_12bd3b78ab8a9864f04160a8359; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerWorkCenters"
    ADD CONSTRAINT "PK_12bd3b78ab8a9864f04160a8359" PRIMARY KEY (id);


--
-- Name: cjobs_jobsTrabajadores PK_1a5c0a4e6aca24fb87718c15771; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_jobsTrabajadores"
    ADD CONSTRAINT "PK_1a5c0a4e6aca24fb87718c15771" PRIMARY KEY (id);


--
-- Name: cjobs_encuestasJobs PK_1e33f169ebf65c411ffb6b2a19f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_encuestasJobs"
    ADD CONSTRAINT "PK_1e33f169ebf65c411ffb6b2a19f" PRIMARY KEY (id);


--
-- Name: work_sessions PK_2b15ef494243f1cc2bf0f731e76; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_sessions
    ADD CONSTRAINT "PK_2b15ef494243f1cc2bf0f731e76" PRIMARY KEY (id);


--
-- Name: otp PK_32556d9d7b22031d7d0e1fd6723; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp
    ADD CONSTRAINT "PK_32556d9d7b22031d7d0e1fd6723" PRIMARY KEY (id);


--
-- Name: shift PK_53071a6485a1e9dc75ec3db54b9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift
    ADD CONSTRAINT "PK_53071a6485a1e9dc75ec3db54b9" PRIMARY KEY (id);


--
-- Name: cjobs_IVASTAI PK_557708c7b7179fd38d48f89ea0e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_IVASTAI"
    ADD CONSTRAINT "PK_557708c7b7179fd38d48f89ea0e" PRIMARY KEY (id);


--
-- Name: cjobs_jobs PK_58f95e5a1b7fbd5006366edc9b9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_jobs
    ADD CONSTRAINT "PK_58f95e5a1b7fbd5006366edc9b9" PRIMARY KEY (id);


--
-- Name: cjobs_partnersUsuarios PK_5978813dbd6099419ece9917eca; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_partnersUsuarios"
    ADD CONSTRAINT "PK_5978813dbd6099419ece9917eca" PRIMARY KEY (id);


--
-- Name: survey_answer PK_5a2a931b95ad2a866f8bc039db9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answer
    ADD CONSTRAINT "PK_5a2a931b95ad2a866f8bc039db9" PRIMARY KEY (id);


--
-- Name: cjobs_turnos PK_5a6f5733ead4b28e18b6f760c89; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_turnos
    ADD CONSTRAINT "PK_5a6f5733ead4b28e18b6f760c89" PRIMARY KEY (id);


--
-- Name: job_workers PK_61b550db831022ddd70dec621df; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_workers
    ADD CONSTRAINT "PK_61b550db831022ddd70dec621df" PRIMARY KEY ("jobId", "workersId");


--
-- Name: notifications PK_6a72c3c0f683f6462415e653c3a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);


--
-- Name: cjobs_notificaciones PK_6eaa641ddd7d94c56ef206c484c; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_notificaciones
    ADD CONSTRAINT "PK_6eaa641ddd7d94c56ef206c484c" PRIMARY KEY (id);


--
-- Name: task_history PK_716670443aea4a2f4a599bb7c53; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_history
    ADD CONSTRAINT "PK_716670443aea4a2f4a599bb7c53" PRIMARY KEY (id);


--
-- Name: cjobs_empleadores PK_7a1af9fb27d44ad1aca758f6190; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_empleadores
    ADD CONSTRAINT "PK_7a1af9fb27d44ad1aca758f6190" PRIMARY KEY (id);


--
-- Name: cjobs_tareas PK_7dd0917a7dbaf2ebbdb383aa6ae; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_tareas
    ADD CONSTRAINT "PK_7dd0917a7dbaf2ebbdb383aa6ae" PRIMARY KEY (id);


--
-- Name: scan_logs PK_898b053110431519810c8f72d37; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_logs
    ADD CONSTRAINT "PK_898b053110431519810c8f72d37" PRIMARY KEY (id);


--
-- Name: clients_users PK_8c28c704c99b5cbb8fd42f38a14; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients_users
    ADD CONSTRAINT "PK_8c28c704c99b5cbb8fd42f38a14" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: cjobs_user PK_8dd56cc8ab051fe5a5975d9a381; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_user
    ADD CONSTRAINT "PK_8dd56cc8ab051fe5a5975d9a381" PRIMARY KEY (id);


--
-- Name: work_center PK_90e52adf69fa914619c764abb4b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_center
    ADD CONSTRAINT "PK_90e52adf69fa914619c764abb4b" PRIMARY KEY (id);


--
-- Name: job PK_98ab1c14ff8d1cf80d18703b92f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job
    ADD CONSTRAINT "PK_98ab1c14ff8d1cf80d18703b92f" PRIMARY KEY (id);


--
-- Name: cjobs_alertas PK_a09af48eb8826a413b2954bd8ca; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_alertas
    ADD CONSTRAINT "PK_a09af48eb8826a413b2954bd8ca" PRIMARY KEY (id);


--
-- Name: cjobs_partners PK_ab125780fb4ceea405829180ba0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_partners
    ADD CONSTRAINT "PK_ab125780fb4ceea405829180ba0" PRIMARY KEY (id);


--
-- Name: employerWorkers PK_acb1837b77888cdd501a810d6f0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerWorkers"
    ADD CONSTRAINT "PK_acb1837b77888cdd501a810d6f0" PRIMARY KEY (id);


--
-- Name: alert PK_ad91cad659a3536465d564a4b2f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert
    ADD CONSTRAINT "PK_ad91cad659a3536465d564a4b2f" PRIMARY KEY (id);


--
-- Name: cjobs_roles PK_b14989ced750482775838061cb0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_roles
    ADD CONSTRAINT "PK_b14989ced750482775838061cb0" PRIMARY KEY (id);


--
-- Name: cjobs_fichajes PK_b2d12432cfa486aeee068736331; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_fichajes
    ADD CONSTRAINT "PK_b2d12432cfa486aeee068736331" PRIMARY KEY (id);


--
-- Name: receipt PK_b4b9ec7d164235fbba023da9832; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt
    ADD CONSTRAINT "PK_b4b9ec7d164235fbba023da9832" PRIMARY KEY (id);


--
-- Name: employerClients PK_b650dfe6e570953b138e1cf984f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerClients"
    ADD CONSTRAINT "PK_b650dfe6e570953b138e1cf984f" PRIMARY KEY (id);


--
-- Name: admin_config PK_c486270cca36cc6c0ee6cf65f74; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_config
    ADD CONSTRAINT "PK_c486270cca36cc6c0ee6cf65f74" PRIMARY KEY (id);


--
-- Name: task_completion_history PK_c49d9c575ccbd6666ef7649c614; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_completion_history
    ADD CONSTRAINT "PK_c49d9c575ccbd6666ef7649c614" PRIMARY KEY (id);


--
-- Name: cjobs_tareasTrabajadores PK_c5f7035c4665656c61faf236954; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_tareasTrabajadores"
    ADD CONSTRAINT "PK_c5f7035c4665656c61faf236954" PRIMARY KEY (id);


--
-- Name: task_completions PK_c9c25215a82514668ab1d72a04d; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_completions
    ADD CONSTRAINT "PK_c9c25215a82514668ab1d72a04d" PRIMARY KEY (id);


--
-- Name: employerUsers PK_ca3bfdcf58241b92119680aead0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerUsers"
    ADD CONSTRAINT "PK_ca3bfdcf58241b92119680aead0" PRIMARY KEY (id);


--
-- Name: employers_users PK_d4a85a497c5d99807b8c0a00322; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employers_users
    ADD CONSTRAINT "PK_d4a85a497c5d99807b8c0a00322" PRIMARY KEY (id);


--
-- Name: workers_users PK_d4dc916b281901f8b64bc1d2c26; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers_users
    ADD CONSTRAINT "PK_d4dc916b281901f8b64bc1d2c26" PRIMARY KEY (id);


--
-- Name: signing_method PK_d617147cedbb3075ec98d9a20b3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_method
    ADD CONSTRAINT "PK_d617147cedbb3075ec98d9a20b3" PRIMARY KEY (id);


--
-- Name: cjobs_horarios_semanales PK_d842396476956b73e527cca8122; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_horarios_semanales
    ADD CONSTRAINT "PK_d842396476956b73e527cca8122" PRIMARY KEY (id);


--
-- Name: survey_response PK_d9326eb52bf8b23d56a39ce419a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_response
    ADD CONSTRAINT "PK_d9326eb52bf8b23d56a39ce419a" PRIMARY KEY (id);


--
-- Name: cjobs_jobsCentros PK_e02b2dd9798ccd03b226a5f6795; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_jobsCentros"
    ADD CONSTRAINT "PK_e02b2dd9798ccd03b226a5f6795" PRIMARY KEY (id);


--
-- Name: workers PK_e950c9aba3bd84a4f193058d838; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT "PK_e950c9aba3bd84a4f193058d838" PRIMARY KEY (id);


--
-- Name: survey_question PK_ec6d65e83fd7217202178b79907; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_question
    ADD CONSTRAINT "PK_ec6d65e83fd7217202178b79907" PRIMARY KEY (id);


--
-- Name: clients PK_f1ab7cf3a5714dbc6bb4e1c28a4; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY (id);


--
-- Name: task PK_fb213f79ee45060ba925ecd576e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT "PK_fb213f79ee45060ba925ecd576e" PRIMARY KEY (id);


--
-- Name: cjobs_paymentMethods PK_ff61f30047c0c4d77c0552453c2; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_paymentMethods"
    ADD CONSTRAINT "PK_ff61f30047c0c4d77c0552453c2" PRIMARY KEY (id);


--
-- Name: qr_codes PK_qr_codes_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT "PK_qr_codes_id" PRIMARY KEY (id);


--
-- Name: cjobs_user UQ_f096d66d650ebbcfd386d63abc9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_user
    ADD CONSTRAINT "UQ_f096d66d650ebbcfd386d63abc9" UNIQUE (email);


--
-- Name: qr_codes UQ_qr_codes_ownerType_ownerId_type; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT "UQ_qr_codes_ownerType_ownerId_type" UNIQUE ("ownerType", "ownerId", type);


--
-- Name: employerSubTypes employerSubTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerSubTypes"
    ADD CONSTRAINT "employerSubTypes_pkey" PRIMARY KEY (id);


--
-- Name: employerTypes employerTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerTypes"
    ADD CONSTRAINT "employerTypes_pkey" PRIMARY KEY (id);


--
-- Name: gender gender_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gender
    ADD CONSTRAINT gender_pkey PRIMARY KEY (id);


--
-- Name: partner_tier partner_tier_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partner_tier
    ADD CONSTRAINT partner_tier_pkey PRIMARY KEY (id);


--
-- Name: job_work_centers pk_job_work_centers; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_work_centers
    ADD CONSTRAINT pk_job_work_centers PRIMARY KEY (job_id, work_center_id);


--
-- Name: season_period season_period_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.season_period
    ADD CONSTRAINT season_period_pkey PRIMARY KEY (id);


--
-- Name: seasonal_schedule seasonal_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seasonal_schedule
    ADD CONSTRAINT seasonal_schedule_pkey PRIMARY KEY (id);


--
-- Name: shift_instance shift_instance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_instance
    ADD CONSTRAINT shift_instance_pkey PRIMARY KEY (id);


--
-- Name: survey survey_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey
    ADD CONSTRAINT survey_pkey PRIMARY KEY (id);


--
-- Name: work_session_day work_session_day_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_session_day
    ADD CONSTRAINT work_session_day_pkey PRIMARY KEY (id);


--
-- Name: IDX_0ad19b85da652a0c4314276a26; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_0ad19b85da652a0c4314276a26" ON public.job_workers USING btree ("workersId");


--
-- Name: IDX_5332a4daa46fd3f4e6625dd275; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_5332a4daa46fd3f4e6625dd275" ON public.notifications USING btree (recipient_id);


--
-- Name: IDX_543c63713d0b2c44dc4b86052b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_543c63713d0b2c44dc4b86052b" ON public.job_workers USING btree ("jobId");


--
-- Name: IDX_621012bb1a6d163e763444c3c1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_621012bb1a6d163e763444c3c1" ON public.notifications USING btree (role);


--
-- Name: IDX_77ee7b06d6f802000c0846f3a5; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_77ee7b06d6f802000c0846f3a5" ON public.notifications USING btree (created_at);


--
-- Name: IDX_qr_codes_expiresAt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_qr_codes_expiresAt" ON public.qr_codes USING btree ("expiresAt");


--
-- Name: idx_task_work_center_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_work_center_id ON public.task USING btree ("workCenterId");


--
-- Name: ux_worker_active_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_worker_active_session ON public.work_sessions USING btree (worker_id) WHERE is_active;


--
-- Name: employerClients FK_009d6c858f74752891ac4304923; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerClients"
    ADD CONSTRAINT "FK_009d6c858f74752891ac4304923" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: employerWorkers FK_042d67b583e1a04d19a7238df52; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerWorkers"
    ADD CONSTRAINT "FK_042d67b583e1a04d19a7238df52" FOREIGN KEY ("workerId") REFERENCES public.workers(id) ON DELETE CASCADE;


--
-- Name: survey_answer FK_05fc898083001ed1cda7526f71f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answer
    ADD CONSTRAINT "FK_05fc898083001ed1cda7526f71f" FOREIGN KEY ("questionId") REFERENCES public.survey_question(id);


--
-- Name: work_center FK_07b3bc772c6c09df0495e8a33c0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_center
    ADD CONSTRAINT "FK_07b3bc772c6c09df0495e8a33c0" FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: scan_logs FK_08d42b7e7e7831f52b0555a1639; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_logs
    ADD CONSTRAINT "FK_08d42b7e7e7831f52b0555a1639" FOREIGN KEY (worker_id) REFERENCES public.workers(id);


--
-- Name: cjobs_horarios_semanales FK_09358faef12736201962ec893f1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_horarios_semanales
    ADD CONSTRAINT "FK_09358faef12736201962ec893f1" FOREIGN KEY (job_id) REFERENCES public.cjobs_jobs(id);


--
-- Name: job_workers FK_0ad19b85da652a0c4314276a265; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_workers
    ADD CONSTRAINT "FK_0ad19b85da652a0c4314276a265" FOREIGN KEY ("workersId") REFERENCES public.workers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cjobs_empleadores FK_124a73a719a400df8c7574939e0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_empleadores
    ADD CONSTRAINT "FK_124a73a719a400df8c7574939e0" FOREIGN KEY ("typeId") REFERENCES public."employerTypes"(id);


--
-- Name: survey_response FK_125b44973ca0241ae85fb3c06da; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_response
    ADD CONSTRAINT "FK_125b44973ca0241ae85fb3c06da" FOREIGN KEY ("workerId") REFERENCES public.workers(id);


--
-- Name: task_completions FK_13482f65992b1a4d06ae7c30fb4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_completions
    ADD CONSTRAINT "FK_13482f65992b1a4d06ae7c30fb4" FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;


--
-- Name: job FK_13dd4ad96c9a725eadf48db7558; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job
    ADD CONSTRAINT "FK_13dd4ad96c9a725eadf48db7558" FOREIGN KEY (user_id) REFERENCES public.cjobs_user(id);


--
-- Name: task_history FK_158887786322644785a61e6980e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_history
    ADD CONSTRAINT "FK_158887786322644785a61e6980e" FOREIGN KEY ("taskId") REFERENCES public.task(id);


--
-- Name: employerWorkers FK_1aa551ac0c8ab94a4c2166561a6; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerWorkers"
    ADD CONSTRAINT "FK_1aa551ac0c8ab94a4c2166561a6" FOREIGN KEY ("employerId") REFERENCES public.cjobs_empleadores(id) ON DELETE CASCADE;


--
-- Name: cjobs_partnersUsuarios FK_27ad30852e9f3815adf7e042876; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_partnersUsuarios"
    ADD CONSTRAINT "FK_27ad30852e9f3815adf7e042876" FOREIGN KEY (partner_id) REFERENCES public.cjobs_partners(id) ON DELETE CASCADE;


--
-- Name: employerClients FK_2b9e1a9df4f18f2e6ad3d8653f0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerClients"
    ADD CONSTRAINT "FK_2b9e1a9df4f18f2e6ad3d8653f0" FOREIGN KEY ("employerId") REFERENCES public.cjobs_empleadores(id) ON DELETE CASCADE;


--
-- Name: cjobs_fichajes FK_2f7a0cb70c9cead58ec4157affc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_fichajes
    ADD CONSTRAINT "FK_2f7a0cb70c9cead58ec4157affc" FOREIGN KEY (worker_id) REFERENCES public.workers(id);


--
-- Name: task_completions FK_3967800678c1fa2c32358f76580; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_completions
    ADD CONSTRAINT "FK_3967800678c1fa2c32358f76580" FOREIGN KEY (task_id) REFERENCES public.task(id) ON DELETE CASCADE;


--
-- Name: cjobs_alertas FK_39c0bdaf346c08d2d504a00357b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_alertas
    ADD CONSTRAINT "FK_39c0bdaf346c08d2d504a00357b" FOREIGN KEY (job_id) REFERENCES public.cjobs_jobs(id);


--
-- Name: task_completion_history FK_3a7b083c9976168623ebc81e177; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_completion_history
    ADD CONSTRAINT "FK_3a7b083c9976168623ebc81e177" FOREIGN KEY (task_id) REFERENCES public.task(id);


--
-- Name: survey_response FK_3cd93b4986cfa8d798424356737; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_response
    ADD CONSTRAINT "FK_3cd93b4986cfa8d798424356737" FOREIGN KEY ("jobId") REFERENCES public.job(id);


--
-- Name: cjobs_empleadores FK_53dc8a3599de3886cbe28d0f43e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_empleadores
    ADD CONSTRAINT "FK_53dc8a3599de3886cbe28d0f43e" FOREIGN KEY ("subTypeId") REFERENCES public."employerSubTypes"(id);


--
-- Name: task FK_53ed44c9efb278a60ae56a8bf77; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT "FK_53ed44c9efb278a60ae56a8bf77" FOREIGN KEY ("jobId") REFERENCES public.job(id);


--
-- Name: job_workers FK_543c63713d0b2c44dc4b86052ba; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_workers
    ADD CONSTRAINT "FK_543c63713d0b2c44dc4b86052ba" FOREIGN KEY ("jobId") REFERENCES public.job(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cjobs_tareasTrabajadores FK_594311d3795590acdf38c8d7f04; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_tareasTrabajadores"
    ADD CONSTRAINT "FK_594311d3795590acdf38c8d7f04" FOREIGN KEY (task_id) REFERENCES public.cjobs_tareas(id);


--
-- Name: workers_users FK_5c2be161ea2120f60206e694a8e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers_users
    ADD CONSTRAINT "FK_5c2be161ea2120f60206e694a8e" FOREIGN KEY ("workerId") REFERENCES public.workers(id);


--
-- Name: cjobs_empleadores FK_5dedb7aa12520f4c30fb07f9589; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_empleadores
    ADD CONSTRAINT "FK_5dedb7aa12520f4c30fb07f9589" FOREIGN KEY ("partnerId") REFERENCES public.cjobs_partners(id);


--
-- Name: cjobs_jobs FK_6134b968c3e47b44eb43005113a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_jobs
    ADD CONSTRAINT "FK_6134b968c3e47b44eb43005113a" FOREIGN KEY (employer_id) REFERENCES public.cjobs_empleadores(id);


--
-- Name: employerWorkCenters FK_6aa5f36cf3e65178aaa4628579f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerWorkCenters"
    ADD CONSTRAINT "FK_6aa5f36cf3e65178aaa4628579f" FOREIGN KEY ("employerId") REFERENCES public.cjobs_empleadores(id) ON DELETE CASCADE;


--
-- Name: cjobs_fichajes FK_6cf8099dbc59d514c45d0853f29; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_fichajes
    ADD CONSTRAINT "FK_6cf8099dbc59d514c45d0853f29" FOREIGN KEY (job_id) REFERENCES public.cjobs_jobs(id);


--
-- Name: cjobs_jobsTrabajadores FK_6ebdf61d3e0487714b5c8a11489; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_jobsTrabajadores"
    ADD CONSTRAINT "FK_6ebdf61d3e0487714b5c8a11489" FOREIGN KEY (worker_id) REFERENCES public.workers(id);


--
-- Name: cjobs_turnos FK_71634015eaedd25b2168d98c35a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_turnos
    ADD CONSTRAINT "FK_71634015eaedd25b2168d98c35a" FOREIGN KEY (job_id) REFERENCES public.cjobs_jobs(id);


--
-- Name: cjobs_turnos FK_72a8905e3f4f2ced8c06e718ef0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_turnos
    ADD CONSTRAINT "FK_72a8905e3f4f2ced8c06e718ef0" FOREIGN KEY (worker_id) REFERENCES public.workers(id);


--
-- Name: job FK_75cd3d59d25ae00702a18f8d7b3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job
    ADD CONSTRAINT "FK_75cd3d59d25ae00702a18f8d7b3" FOREIGN KEY ("workCenterId") REFERENCES public.work_center(id);


--
-- Name: cjobs_encuestas FK_77b3985bf447429b21b0deddccd; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_encuestas
    ADD CONSTRAINT "FK_77b3985bf447429b21b0deddccd" FOREIGN KEY (survey_id) REFERENCES public."cjobs_encuestasJobs"(id);


--
-- Name: work_sessions FK_7cc3c7fb9399957a892ca49378f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_sessions
    ADD CONSTRAINT "FK_7cc3c7fb9399957a892ca49378f" FOREIGN KEY (job_id) REFERENCES public.job(id);


--
-- Name: job FK_7cd310fbca5788bc794308210ab; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job
    ADD CONSTRAINT "FK_7cd310fbca5788bc794308210ab" FOREIGN KEY ("employerId") REFERENCES public.cjobs_empleadores(id);


--
-- Name: signing_method FK_7d4fee7a80823aae4be10214d4a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_method
    ADD CONSTRAINT "FK_7d4fee7a80823aae4be10214d4a" FOREIGN KEY ("jobId") REFERENCES public.job(id);


--
-- Name: survey_answer FK_8db2dac3eb39f0d1a7f3e5e1348; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_answer
    ADD CONSTRAINT "FK_8db2dac3eb39f0d1a7f3e5e1348" FOREIGN KEY ("responseId") REFERENCES public.survey_response(id);


--
-- Name: employerUsers FK_90055f4cb650e8ff148a9978a99; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerUsers"
    ADD CONSTRAINT "FK_90055f4cb650e8ff148a9978a99" FOREIGN KEY ("employerId") REFERENCES public.cjobs_empleadores(id) ON DELETE CASCADE;


--
-- Name: employerWorkCenters FK_9b6d0c178a856ddd971f530ef61; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerWorkCenters"
    ADD CONSTRAINT "FK_9b6d0c178a856ddd971f530ef61" FOREIGN KEY ("workCenterId") REFERENCES public.work_center(id) ON DELETE CASCADE;


--
-- Name: cjobs_tareas FK_a0548da7b07804a24c92faa73e3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_tareas
    ADD CONSTRAINT "FK_a0548da7b07804a24c92faa73e3" FOREIGN KEY (job_id) REFERENCES public.cjobs_jobs(id);


--
-- Name: cjobs_encuestasJobs FK_a359b84a1d6ccc406e1cf079459; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_encuestasJobs"
    ADD CONSTRAINT "FK_a359b84a1d6ccc406e1cf079459" FOREIGN KEY (job_id) REFERENCES public.cjobs_jobs(id);


--
-- Name: cjobs_tareasTrabajadores FK_ab8094d04d6b59cb3713c3e8275; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_tareasTrabajadores"
    ADD CONSTRAINT "FK_ab8094d04d6b59cb3713c3e8275" FOREIGN KEY (worker_id) REFERENCES public.workers(id);


--
-- Name: task_history FK_aca90e722e0edfa5930617b1437; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_history
    ADD CONSTRAINT "FK_aca90e722e0edfa5930617b1437" FOREIGN KEY ("completedById") REFERENCES public.workers(id);


--
-- Name: work_sessions FK_ad263aa9c3fe3c9fa40c1a121d5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_sessions
    ADD CONSTRAINT "FK_ad263aa9c3fe3c9fa40c1a121d5" FOREIGN KEY (worker_id) REFERENCES public.workers(id);


--
-- Name: scan_logs FK_b064b30c559fe80bc7f0f8dea18; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_logs
    ADD CONSTRAINT "FK_b064b30c559fe80bc7f0f8dea18" FOREIGN KEY (job_id) REFERENCES public.job(id);


--
-- Name: workers_users FK_b3f5cbaa6282dd9ad48ab222601; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers_users
    ADD CONSTRAINT "FK_b3f5cbaa6282dd9ad48ab222601" FOREIGN KEY ("userId") REFERENCES public.cjobs_user(id);


--
-- Name: employers_users FK_b785bd736d25acded7c76e6deef; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employers_users
    ADD CONSTRAINT "FK_b785bd736d25acded7c76e6deef" FOREIGN KEY (employer_id) REFERENCES public.cjobs_empleadores(id) ON DELETE CASCADE;


--
-- Name: cjobs_fichajes FK_b8ac5e839ea274cf4fcda5fb19c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_fichajes
    ADD CONSTRAINT "FK_b8ac5e839ea274cf4fcda5fb19c" FOREIGN KEY (shift_id) REFERENCES public.cjobs_turnos(id);


--
-- Name: alert FK_c0801d8c55f7aa7677a2de188e0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert
    ADD CONSTRAINT "FK_c0801d8c55f7aa7677a2de188e0" FOREIGN KEY ("jobId") REFERENCES public.job(id);


--
-- Name: employers_users FK_c0f7987a0b1866d5f647869d697; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employers_users
    ADD CONSTRAINT "FK_c0f7987a0b1866d5f647869d697" FOREIGN KEY (user_id) REFERENCES public.cjobs_user(id) ON DELETE CASCADE;


--
-- Name: cjobs_partnersUsuarios FK_c24ed1db6524fe9f110c4cebe4c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_partnersUsuarios"
    ADD CONSTRAINT "FK_c24ed1db6524fe9f110c4cebe4c" FOREIGN KEY (user_id) REFERENCES public.cjobs_user(id) ON DELETE CASCADE;


--
-- Name: clients_users FK_c78d243bd4deb707c0dfcabf667; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients_users
    ADD CONSTRAINT "FK_c78d243bd4deb707c0dfcabf667" FOREIGN KEY ("userId") REFERENCES public.cjobs_user(id);


--
-- Name: clients_users FK_c7e4bd77662be7cb5b55bca5fea; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients_users
    ADD CONSTRAINT "FK_c7e4bd77662be7cb5b55bca5fea" FOREIGN KEY ("clientId") REFERENCES public.clients(id);


--
-- Name: cjobs_jobs FK_cc232b319edfe165dbdba60057f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_jobs
    ADD CONSTRAINT "FK_cc232b319edfe165dbdba60057f" FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: cjobs_jobsTrabajadores FK_cf66078767e253834fb68de9dca; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_jobsTrabajadores"
    ADD CONSTRAINT "FK_cf66078767e253834fb68de9dca" FOREIGN KEY (job_id) REFERENCES public.cjobs_jobs(id);


--
-- Name: survey_response FK_d4d43b1708d17b4c66149d0bf43; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.survey_response
    ADD CONSTRAINT "FK_d4d43b1708d17b4c66149d0bf43" FOREIGN KEY ("clientId") REFERENCES public.clients(id);


--
-- Name: task_history FK_d52e4be7835977d6012b3a2e1d2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_history
    ADD CONSTRAINT "FK_d52e4be7835977d6012b3a2e1d2" FOREIGN KEY ("jobId") REFERENCES public.job(id);


--
-- Name: employerUsers FK_d665c750d84f8e03fea5abc4784; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."employerUsers"
    ADD CONSTRAINT "FK_d665c750d84f8e03fea5abc4784" FOREIGN KEY ("userId") REFERENCES public.cjobs_user(id) ON DELETE CASCADE;


--
-- Name: workers FK_d6d926fb1bfe051a6e07dedcafc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT "FK_d6d926fb1bfe051a6e07dedcafc" FOREIGN KEY (gender_id) REFERENCES public.gender(id);


--
-- Name: otp FK_db724db1bc3d94ad5ba38518433; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp
    ADD CONSTRAINT "FK_db724db1bc3d94ad5ba38518433" FOREIGN KEY ("userId") REFERENCES public.cjobs_user(id);


--
-- Name: job FK_e00beba94f55e2e444ccd678c6a; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job
    ADD CONSTRAINT "FK_e00beba94f55e2e444ccd678c6a" FOREIGN KEY ("clientId") REFERENCES public.clients(id);


--
-- Name: receipt FK_e011d4704c491f4d821d7ebb6ca; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt
    ADD CONSTRAINT "FK_e011d4704c491f4d821d7ebb6ca" FOREIGN KEY ("userId") REFERENCES public.cjobs_user(id);


--
-- Name: cjobs_user FK_e2d419b21f2e7fb65c353c49b4e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_user
    ADD CONSTRAINT "FK_e2d419b21f2e7fb65c353c49b4e" FOREIGN KEY (role_id) REFERENCES public.cjobs_roles(id);


--
-- Name: workers FK_e47e873d6f19443891cca73bd8c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT "FK_e47e873d6f19443891cca73bd8c" FOREIGN KEY (user_id) REFERENCES public.cjobs_user(id);


--
-- Name: task_completions FK_e5c09127bee3c725aede5016e67; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_completions
    ADD CONSTRAINT "FK_e5c09127bee3c725aede5016e67" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE;


--
-- Name: cjobs_jobsCentros FK_e784b467f5c51b9eb18572ca27b; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."cjobs_jobsCentros"
    ADD CONSTRAINT "FK_e784b467f5c51b9eb18572ca27b" FOREIGN KEY (job_id) REFERENCES public.cjobs_jobs(id);


--
-- Name: cjobs_empleadores FK_f21659c2d755f61ae8855e39c25; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_empleadores
    ADD CONSTRAINT "FK_f21659c2d755f61ae8855e39c25" FOREIGN KEY ("paymentMethodId") REFERENCES public."cjobs_paymentMethods"(id);


--
-- Name: cjobs_encuestas FK_f329d26d1724a0582a17e3f6700; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_encuestas
    ADD CONSTRAINT "FK_f329d26d1724a0582a17e3f6700" FOREIGN KEY (user_id) REFERENCES public.cjobs_user(id);


--
-- Name: cjobs_partners fk_default_payment_method; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_partners
    ADD CONSTRAINT fk_default_payment_method FOREIGN KEY (default_payment_method_id) REFERENCES public."cjobs_paymentMethods"(id) ON DELETE SET NULL;


--
-- Name: job_work_centers fk_jwc_job; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_work_centers
    ADD CONSTRAINT fk_jwc_job FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE;


--
-- Name: job_work_centers fk_jwc_work_center; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_work_centers
    ADD CONSTRAINT fk_jwc_work_center FOREIGN KEY (work_center_id) REFERENCES public.work_center(id) ON DELETE CASCADE;


--
-- Name: cjobs_partners fk_partner_tier; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cjobs_partners
    ADD CONSTRAINT fk_partner_tier FOREIGN KEY (partner_tier_id) REFERENCES public.partner_tier(id) ON DELETE SET NULL;


--
-- Name: shift fk_shift_seasonal_schedule; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift
    ADD CONSTRAINT fk_shift_seasonal_schedule FOREIGN KEY (seasonal_schedule_id) REFERENCES public.seasonal_schedule(id) ON DELETE CASCADE;


--
-- Name: task fk_task_work_center; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT fk_task_work_center FOREIGN KEY ("workCenterId") REFERENCES public.work_center(id) ON DELETE SET NULL;


--
-- Name: work_center fk_work_center_client; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_center
    ADD CONSTRAINT fk_work_center_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: work_center fk_work_center_employer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_center
    ADD CONSTRAINT fk_work_center_employer FOREIGN KEY (employer_id) REFERENCES public.cjobs_empleadores(id) ON DELETE SET NULL;


--
-- Name: season_period season_period_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.season_period
    ADD CONSTRAINT season_period_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE;


--
-- Name: seasonal_schedule seasonal_schedule_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seasonal_schedule
    ADD CONSTRAINT seasonal_schedule_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE;


--
-- Name: shift_instance shift_instance_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_instance
    ADD CONSTRAINT shift_instance_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE;


--
-- Name: shift_instance shift_instance_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_instance
    ADD CONSTRAINT shift_instance_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shift(id);


--
-- Name: work_session_day work_session_day_work_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_session_day
    ADD CONSTRAINT work_session_day_work_session_id_fkey FOREIGN KEY (work_session_id) REFERENCES public.work_sessions(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

