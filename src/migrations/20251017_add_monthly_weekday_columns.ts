import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMonthlyWeekdayColumns20251017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "monthlyStartWeekday" integer;`);
    await queryRunner.query(`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "monthlyEndWeekday" integer;`);
    await queryRunner.query(`COMMENT ON COLUMN public.task."monthlyStartWeekday" IS '0=Sunday .. 6=Saturday - first occurrence of this weekday in the month';`);
    await queryRunner.query(`COMMENT ON COLUMN public.task."monthlyEndWeekday" IS '0=Sunday .. 6=Saturday - last occurrence of this weekday in the month';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN IF EXISTS "monthlyStartWeekday";`);
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN IF EXISTS "monthlyEndWeekday";`);
  }
}
