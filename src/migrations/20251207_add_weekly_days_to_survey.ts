import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeeklyDaysToSurvey20251207 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "survey" ADD COLUMN IF NOT EXISTS "weeklyDays" text;`);
    await queryRunner.query(`COMMENT ON COLUMN public.survey."weeklyDays" IS 'JSON array of weekday numbers (0=Sunday, 1=Monday, etc.) for weekly survey schedule';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "survey" DROP COLUMN IF EXISTS "weeklyDays";`);
  }
}
