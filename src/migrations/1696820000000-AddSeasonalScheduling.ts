import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeasonalScheduling1696820000000 implements MigrationInterface {
  name = 'AddSeasonalScheduling1696820000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums if not exist
    await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'season_enum') THEN
    CREATE TYPE season_enum AS ENUM ('normal','summer');
  END IF;
END$$;`);

    await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekday_enum') THEN
    CREATE TYPE weekday_enum AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');
  END IF;
END$$;`);

    await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_type_enum') THEN
    CREATE TYPE schedule_type_enum AS ENUM ('fixed','free','seasonal');
  ELSE
    -- ensure values exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'seasonal' AND enumtypid = 'schedule_type_enum'::regtype) THEN
      ALTER TYPE schedule_type_enum ADD VALUE 'seasonal';
    END IF;
  END IF;
END$$;`);

    // Add scheduleType column to job
    await queryRunner.query(`ALTER TABLE "job" ADD COLUMN IF NOT EXISTS scheduleType schedule_type_enum DEFAULT 'free';`);

    // Create seasonal_schedule table
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS seasonal_schedule (
      id serial PRIMARY KEY,
      job_id integer NOT NULL REFERENCES "job"(id) ON DELETE CASCADE,
      season season_enum NOT NULL,
      start_date date,
      end_date date
    );`);

    // Alter shift table: add seasonal_schedule_id and rename fields to match new model (if necessary)
    await queryRunner.query(`ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS seasonal_schedule_id integer;`);
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name='shift' AND column_name='totalHours'
  ) THEN
    EXECUTE 'ALTER TABLE "shift" RENAME COLUMN "totalHours" TO total_hours';
  END IF;
END$$;`);
    await queryRunner.query(`ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS start_weekday weekday_enum;`);
    await queryRunner.query(`ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS end_weekday weekday_enum;`);
    await queryRunner.query(`ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS base_start_time time;`);
    await queryRunner.query(`ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS base_end_time time;`);
    await queryRunner.query(`ALTER TABLE "shift" ADD COLUMN IF NOT EXISTS is_continuous boolean DEFAULT false;`);

    // Create foreign key if not exists
    await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_name='shift' AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='seasonal_schedule_id') THEN
    ALTER TABLE "shift" ADD CONSTRAINT fk_shift_seasonal_schedule FOREIGN KEY (seasonal_schedule_id) REFERENCES seasonal_schedule(id) ON DELETE CASCADE;
  END IF;
END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shift" DROP CONSTRAINT IF EXISTS fk_shift_seasonal_schedule;`);
    await queryRunner.query(`ALTER TABLE "shift" DROP COLUMN IF EXISTS seasonal_schedule_id;`);
    await queryRunner.query(`ALTER TABLE "shift" DROP COLUMN IF EXISTS start_weekday;`);
    await queryRunner.query(`ALTER TABLE "shift" DROP COLUMN IF EXISTS end_weekday;`);
    await queryRunner.query(`ALTER TABLE "shift" DROP COLUMN IF EXISTS base_start_time;`);
    await queryRunner.query(`ALTER TABLE "shift" DROP COLUMN IF EXISTS base_end_time;`);
    await queryRunner.query(`ALTER TABLE "shift" DROP COLUMN IF EXISTS is_continuous;`);
    await queryRunner.query(`DROP TABLE IF EXISTS seasonal_schedule;`);
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN IF EXISTS scheduleType;`);
    // Note: enum drop omitted to avoid data loss
  }
}
