import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTotalWeekHoursToSeasonalSchedule20251106 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "seasonal_schedule" ADD COLUMN IF NOT EXISTS "total_week_hours" integer DEFAULT 0;`);
    await queryRunner.query(`COMMENT ON COLUMN public.seasonal_schedule."total_week_hours" IS 'Total weekly hours expressed in whole hours';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "seasonal_schedule" DROP COLUMN IF EXISTS "total_week_hours";`);
  }
}
