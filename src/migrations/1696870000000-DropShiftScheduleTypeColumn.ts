import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropShiftScheduleTypeColumn1696870000000 implements MigrationInterface {
  name = 'DropShiftScheduleTypeColumn1696870000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy scheduleType column from shift if it exists. Handle both lowercased and quoted camelCase variants.
    await queryRunner.query(`DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='scheduletype') THEN
    EXECUTE 'ALTER TABLE "shift" DROP COLUMN IF EXISTS scheduletype CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='scheduleType') THEN
    EXECUTE 'ALTER TABLE "shift" DROP COLUMN IF EXISTS "scheduleType" CASCADE';
  END IF;
END$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate a nullable scheduleType column using an existing enum if available. We avoid creating enums here.
    await queryRunner.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift' AND column_name='scheduletype') THEN
    BEGIN
      -- Add a nullable text column as a safe fallback (won't error if enum doesn't exist)
      EXECUTE 'ALTER TABLE "shift" ADD COLUMN scheduletype text';
    END;
  END IF;
END$$;`);
  }
}
