import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeSeasonalScheduleDatesToDayMonth20251110 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert start_date and end_date from DATE to VARCHAR(5) storing DD-MM (day-month)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'seasonal_schedule' AND column_name = 'start_date' AND data_type = 'date'
        ) THEN
          ALTER TABLE "seasonal_schedule" 
            ALTER COLUMN "start_date" TYPE varchar(5) USING to_char("start_date", 'DD-MM');
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'seasonal_schedule' AND column_name = 'end_date' AND data_type = 'date'
        ) THEN
          ALTER TABLE "seasonal_schedule" 
            ALTER COLUMN "end_date" TYPE varchar(5) USING to_char("end_date", 'DD-MM');
        END IF;
      END$$;
    `);

    // Add helpful comments
    await queryRunner.query(`
      COMMENT ON COLUMN public.seasonal_schedule."start_date" IS 'Day-Month (DD-MM), no year';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN public.seasonal_schedule."end_date" IS 'Day-Month (DD-MM), no year';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort: convert DD-MM back to DATE using year 2000
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'seasonal_schedule' AND column_name = 'start_date' AND data_type <> 'date'
        ) THEN
          ALTER TABLE "seasonal_schedule" 
            ALTER COLUMN "start_date" TYPE date USING to_date('2000-' || substring("start_date" from 4 for 2) || '-' || substring("start_date" from 1 for 2), 'YYYY-MM-DD');
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'seasonal_schedule' AND column_name = 'end_date' AND data_type <> 'date'
        ) THEN
          ALTER TABLE "seasonal_schedule" 
            ALTER COLUMN "end_date" TYPE date USING to_date('2000-' || substring("end_date" from 4 for 2) || '-' || substring("end_date" from 1 for 2), 'YYYY-MM-DD');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN public.seasonal_schedule."start_date" IS NULL;
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN public.seasonal_schedule."end_date" IS NULL;
    `);
  }
}
