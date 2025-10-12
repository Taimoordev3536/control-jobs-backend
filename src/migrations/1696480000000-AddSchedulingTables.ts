import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchedulingTables1696480000000 implements MigrationInterface {
  name = 'AddSchedulingTables1696480000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums if not exist (Postgres specific)
    await queryRunner.query(`DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_scheduletype_enum') THEN\n    CREATE TYPE shift_scheduletype_enum AS ENUM ('fixed','flexible','live_in');\n  ELSE\n    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'live_in' AND enumtypid = 'shift_scheduletype_enum'::regtype) THEN\n      ALTER TYPE shift_scheduletype_enum ADD VALUE 'live_in';\n    END IF;\n  END IF;\nEND$$;`);

    await queryRunner.query(`DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_season_enum') THEN\n    CREATE TYPE shift_season_enum AS ENUM ('summer','winter');\n  END IF;\nEND$$;`);

    await queryRunner.query(`DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekday_enum') THEN\n    CREATE TYPE weekday_enum AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');\n  END IF;\nEND$$;`);

    // Make totalHours and season nullable on shift
    await queryRunner.query(`ALTER TABLE "shift" ALTER COLUMN "totalHours" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "shift" ALTER COLUMN season DROP NOT NULL;`);

    // Add day_enum column, copy values from day, and swap
  await queryRunner.query(`ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS day_enum weekday_enum;`);
  // Cast day to text first so lower() works whether day is stored as text or as an enum
  await queryRunner.query(`UPDATE "shift" SET day_enum = lower(day::text)::weekday_enum WHERE day IS NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "shift" DROP COLUMN IF EXISTS day;`);
    await queryRunner.query(`ALTER TABLE "shift" RENAME COLUMN day_enum TO day;`);

    // Create season_period table
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS season_period (id serial PRIMARY KEY, job_id integer NOT NULL REFERENCES "job"(id) ON DELETE CASCADE, season shift_season_enum NOT NULL, start_date date NOT NULL, end_date date NOT NULL);`);

    // Create shift_instance
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS shift_instance (id serial PRIMARY KEY, job_id integer NOT NULL REFERENCES "job"(id) ON DELETE CASCADE, shift_id integer REFERENCES "shift"(id), date date NOT NULL, start_time timestamptz NOT NULL, end_time timestamptz NOT NULL, total_hours integer, is_generated boolean DEFAULT true);`);

    // Create work_session_day
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS work_session_day (id serial PRIMARY KEY, work_session_id integer NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE, job_id integer NOT NULL, worker_id integer NOT NULL, date date NOT NULL, start_time timestamptz NOT NULL, end_time timestamptz NOT NULL, minutes integer NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());`);

    // Create partial unique index for active sessions (if not exists)
    await queryRunner.query(`DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_worker_active_session') THEN\n    CREATE UNIQUE INDEX IF NOT EXISTS ux_worker_active_session ON work_sessions(worker_id) WHERE is_active;\n  END IF;\nEND$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse changes conservatively
    await queryRunner.query(`DROP TABLE IF EXISTS work_session_day;`);
    await queryRunner.query(`DROP TABLE IF EXISTS shift_instance;`);
    await queryRunner.query(`DROP TABLE IF EXISTS season_period;`);
    await queryRunner.query(`ALTER TABLE "shift" RENAME COLUMN IF EXISTS day TO day_enum_old;`);
    // Note: enum drop operations are intentionally omitted to avoid data loss
  }
}
