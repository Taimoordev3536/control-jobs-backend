import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropShiftJobIdColumn1696860000000 implements MigrationInterface {
  name = 'DropShiftJobIdColumn1696860000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy jobId column from shift table if present (handle both lowercase and camelCase variants)
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='jobid') THEN
    EXECUTE 'ALTER TABLE "shift" DROP COLUMN IF EXISTS jobid CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='jobId') THEN
    EXECUTE 'ALTER TABLE "shift" DROP COLUMN IF EXISTS "jobId" CASCADE';
  END IF;
END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate a nullable jobId column if needed (no FK to avoid accidental constraints)
    await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='jobid') THEN
    EXECUTE 'ALTER TABLE "shift" ADD COLUMN jobid integer';
  END IF;
END$$;`);
  }
}
