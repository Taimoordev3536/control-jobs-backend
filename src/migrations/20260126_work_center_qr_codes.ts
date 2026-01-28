import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkCenterQrCodes20260126000000 implements MigrationInterface {
  name = 'WorkCenterQrCodes20260126000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Starting migration: Work Center-Based QR Codes');

    // Step 1: Add new columns
    console.log('📝 Adding work_center_id and is_selected columns...');
    await queryRunner.query(`
      ALTER TABLE "qr_codes" 
      ADD COLUMN IF NOT EXISTS "work_center_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "is_selected" BOOLEAN DEFAULT false
    `);

    // Step 2: Add foreign key constraint
    console.log('🔗 Adding foreign key constraint to work_center...');
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_qr_codes_work_center'
          AND table_name = 'qr_codes'
        ) THEN
          ALTER TABLE "qr_codes"
          ADD CONSTRAINT "fk_qr_codes_work_center"
          FOREIGN KEY ("work_center_id")
          REFERENCES "work_center"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Step 3: Create index on work_center_id
    console.log('📊 Creating index on work_center_id...');
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_qr_codes_work_center_id" 
      ON "qr_codes"("work_center_id")
    `);

    // Step 4: Create unique constraint for active QR codes per work center
    console.log('🔐 Creating unique constraint for work center QR codes...');
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_qr_codes_work_center_type_active"
      ON "qr_codes"("work_center_id", "type", "isActive")
      WHERE "isActive" = true
    `);

    // Step 5: Drop old indexes
    console.log('🗑️ Dropping old owner-based indexes...');
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_qr_codes_ownertype_ownerid_type"
    `);

    // Step 6: Remove old columns (owner_type and owner_id)
    // Note: Only do this after data migration if you have existing data
    console.log('⚠️ Removing owner_type and owner_id columns...');
    await queryRunner.query(`
      ALTER TABLE "qr_codes"
      DROP COLUMN IF EXISTS "ownerType",
      DROP COLUMN IF EXISTS "ownerId"
    `);

    // Step 7: Add work_center_id to scan_logs (optional but recommended)
    console.log('📝 Adding work_center_id to scan_logs...');
    await queryRunner.query(`
      ALTER TABLE "scan_logs"
      ADD COLUMN IF NOT EXISTS "work_center_id" INTEGER
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_scan_logs_work_center_id"
      ON "scan_logs"("work_center_id")
    `);

    // Step 8: Add work_center_id to work_sessions (optional but recommended)
    console.log('📝 Adding work_center_id to work_sessions...');
    await queryRunner.query(`
      ALTER TABLE "work_sessions"
      ADD COLUMN IF NOT EXISTS "work_center_id" INTEGER
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_work_sessions_work_center_id"
      ON "work_sessions"("work_center_id")
    `);

    // Step 9: Add comments for documentation
    console.log('📄 Adding column comments...');
    await queryRunner.query(`
      COMMENT ON COLUMN "qr_codes"."work_center_id" IS 'FK to work_center - each work center has its own QR codes'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "qr_codes"."is_selected" IS 'Indicates which QR type (static/dynamic) is currently selected by employer'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "scan_logs"."work_center_id" IS 'Work center where check-in occurred (captured from QR validation)'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "work_sessions"."work_center_id" IS 'Work center for this work session'
    `);

    console.log('✅ Migration completed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⏮️ Reverting migration: Work Center-Based QR Codes');

    // Remove comments
    await queryRunner.query(`
      COMMENT ON COLUMN "work_sessions"."work_center_id" IS NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "scan_logs"."work_center_id" IS NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "qr_codes"."is_selected" IS NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "qr_codes"."work_center_id" IS NULL
    `);

    // Remove work_center_id from work_sessions
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_work_sessions_work_center_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "work_sessions"
      DROP COLUMN IF EXISTS "work_center_id"
    `);

    // Remove work_center_id from scan_logs
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_scan_logs_work_center_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "scan_logs"
      DROP COLUMN IF EXISTS "work_center_id"
    `);

    // Re-add owner columns
    await queryRunner.query(`
      ALTER TABLE "qr_codes"
      ADD COLUMN "ownerType" VARCHAR(20),
      ADD COLUMN "ownerId" BIGINT
    `);

    // Drop new constraints and indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_qr_codes_work_center_type_active"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_qr_codes_work_center_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "qr_codes"
      DROP CONSTRAINT IF EXISTS "fk_qr_codes_work_center"
    `);

    // Remove new columns
    await queryRunner.query(`
      ALTER TABLE "qr_codes"
      DROP COLUMN IF EXISTS "is_selected",
      DROP COLUMN IF EXISTS "work_center_id"
    `);

    // Recreate old index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_qr_codes_ownertype_ownerid_type"
      ON "qr_codes"("ownerType", "ownerId", "type")
    `);

    console.log('✅ Migration reverted successfully!');
  }
}
