import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkCenterGps20260219 implements MigrationInterface {
  name = 'AddWorkCenterGps20260219';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Starting migration: Add GPS fields to work_center');

    await queryRunner.query(`
      ALTER TABLE "work_center"
      ADD COLUMN IF NOT EXISTS "latitude"   DECIMAL(10, 8) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "longitude"  DECIMAL(11, 8) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS "gps_radius" INTEGER        DEFAULT 100;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "work_center"."latitude"   IS 'GPS latitude for location-based check-in';
      COMMENT ON COLUMN "work_center"."longitude"  IS 'GPS longitude for location-based check-in';
      COMMENT ON COLUMN "work_center"."gps_radius" IS 'Allowed check-in radius in meters (default 100)';
    `);

    console.log('✅ GPS columns added to work_center');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_center"
      DROP COLUMN IF EXISTS "latitude",
      DROP COLUMN IF EXISTS "longitude",
      DROP COLUMN IF EXISTS "gps_radius";
    `);
    console.log('↩️ GPS columns removed from work_center');
  }
}
