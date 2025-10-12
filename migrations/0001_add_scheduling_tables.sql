-- Migration: Add scheduling support (season_period, shift_instance, work_session_day)
BEGIN;

-- 1) Add enum values/types safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_scheduletype_enum') THEN
    CREATE TYPE shift_scheduletype_enum AS ENUM ('fixed','flexible','live_in');
  ELSE
    -- try to add value live_in if not present
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'live_in' AND enumtypid = 'shift_scheduletype_enum'::regtype) THEN
      ALTER TYPE shift_scheduletype_enum ADD VALUE 'live_in';
    END IF;
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- fallback: ignore
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_season_enum') THEN
    CREATE TYPE shift_season_enum AS ENUM ('summer','winter');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekday_enum') THEN
    CREATE TYPE weekday_enum AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');
  END IF;
END$$;

-- 2) Alter shift table: make totalHours nullable, season nullable, day -> weekday_enum
ALTER TABLE "shift" ALTER COLUMN "totalHours" DROP NOT NULL;
ALTER TABLE "shift" ALTER COLUMN season DROP NOT NULL;

-- Change day varchar to weekday_enum: add new column, copy, drop old
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='day_enum') THEN
    ALTER TABLE "shift" ADD COLUMN day_enum weekday_enum;
    UPDATE "shift" SET day_enum = lower(day)::weekday_enum WHERE day IS NOT NULL;
    ALTER TABLE "shift" DROP COLUMN day;
    ALTER TABLE "shift" RENAME COLUMN day_enum TO day;
  END IF;
END$$;

-- 3) Create season_period table
CREATE TABLE IF NOT EXISTS season_period (
  id serial PRIMARY KEY,
  job_id integer NOT NULL REFERENCES "job"(id) ON DELETE CASCADE,
  season shift_season_enum NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL
);

-- 4) Create shift_instance table
CREATE TABLE IF NOT EXISTS shift_instance (
  id serial PRIMARY KEY,
  job_id integer NOT NULL REFERENCES "job"(id) ON DELETE CASCADE,
  shift_id integer REFERENCES "shift"(id),
  date date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  total_hours integer,
  is_generated boolean DEFAULT true
);

-- 5) Create work_session_day table
CREATE TABLE IF NOT EXISTS work_session_day (
  id serial PRIMARY KEY,
  work_session_id integer NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
  job_id integer NOT NULL,
  worker_id integer NOT NULL,
  date date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  minutes integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6) Optional: unique active session per worker (DB-level guard)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_worker_active_session') THEN
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_worker_active_session ON work_sessions(worker_id) WHERE is_active;
  END IF;
END$$;

COMMIT;
