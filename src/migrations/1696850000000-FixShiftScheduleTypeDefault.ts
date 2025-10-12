import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixShiftScheduleTypeDefault1696850000000 implements MigrationInterface {
  name = 'FixShiftScheduleTypeDefault1696850000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // If the legacy scheduleType column exists on shift, make it have a default and allow nulls so
    // inserts from the new entity shape succeed without providing this column.
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='scheduleType') THEN
    BEGIN
  EXECUTE 'ALTER TABLE "shift" ALTER COLUMN "scheduleType" SET DEFAULT ''flexible''';
      EXECUTE 'ALTER TABLE "shift" ALTER COLUMN "scheduleType" DROP NOT NULL';
    END;
  END IF;
END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='scheduleType') THEN
    BEGIN
      -- best-effort revert: remove default (can't re-add NOT NULL safely)
      EXECUTE 'ALTER TABLE "shift" ALTER COLUMN "scheduleType" DROP DEFAULT';
    END;
  END IF;
END$$;`);
  }
}
