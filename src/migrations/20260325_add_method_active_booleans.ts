import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMethodActiveBooleans20260325 implements MigrationInterface {
  name = 'AddMethodActiveBooleans20260325';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Starting migration: Add method active boolean columns to work_center');

    await queryRunner.query(`
      ALTER TABLE "work_center"
      ADD COLUMN IF NOT EXISTS "is_gps_active"    BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "is_qrcode_active" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "is_ip_active"     BOOLEAN DEFAULT false;
    `);

    // Backfill: set is_gps_active = true for work centers that already have GPS coordinates configured
    await queryRunner.query(`
      UPDATE "work_center"
      SET "is_gps_active" = true
      WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "work_center"."is_gps_active"    IS 'Whether GPS check-in method is active for this work center';
      COMMENT ON COLUMN "work_center"."is_qrcode_active" IS 'Whether QR Code check-in method is active for this work center';
      COMMENT ON COLUMN "work_center"."is_ip_active"     IS 'Whether IP check-in method is active for this work center';
    `);

    console.log('✅ Method active boolean columns added to work_center (GPS backfilled)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_center"
      DROP COLUMN IF EXISTS "is_gps_active",
      DROP COLUMN IF EXISTS "is_qrcode_active",
      DROP COLUMN IF EXISTS "is_ip_active";
    `);
    console.log('↩️ Method active boolean columns removed from work_center');
  }
}
