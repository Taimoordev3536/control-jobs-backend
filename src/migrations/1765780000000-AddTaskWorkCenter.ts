import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskWorkCenter1765780000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task"
      ADD COLUMN IF NOT EXISTS "workCenterId" integer NULL;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_task_work_center') THEN
          ALTER TABLE "task"
          ADD CONSTRAINT fk_task_work_center FOREIGN KEY ("workCenterId") REFERENCES public.work_center(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_task_work_center_id ON "task" ("workCenterId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task" DROP CONSTRAINT IF EXISTS fk_task_work_center;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_task_work_center_id;
    `);

    await queryRunner.query(`
      ALTER TABLE "task" DROP COLUMN IF EXISTS "workCenterId";
    `);
  }
}
