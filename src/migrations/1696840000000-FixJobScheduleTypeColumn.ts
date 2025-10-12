import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixJobScheduleTypeColumn1696840000000 implements MigrationInterface {
  name = 'FixJobScheduleTypeColumn1696840000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // If the unquoted column (lowercased scheduletype) exists but the quoted camelCase "scheduleType" doesn't,
    // rename the lowercased column to the quoted camelCase name so it matches the entity metadata.
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job' AND column_name='scheduletype')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job' AND column_name='scheduleType') THEN
    EXECUTE 'ALTER TABLE "job" RENAME COLUMN scheduletype TO "scheduleType"';
  END IF;
END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Attempt to revert: if the quoted "scheduleType" exists and the lowercased version does not, rename back to lowercased.
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job' AND column_name='scheduleType')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job' AND column_name='scheduletype') THEN
    EXECUTE 'ALTER TABLE "job" RENAME COLUMN "scheduleType" TO scheduletype';
  END IF;
END$$;`);
  }
}
