import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSigningMethodFields20251212 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add signing method tracking columns to scan_logs
    await queryRunner.query(`
      ALTER TABLE "scan_logs" 
      ADD COLUMN IF NOT EXISTS "signing_method" VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45),
      ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS "qr_token" TEXT;
    `);

    // Add check-in/out method tracking to work_sessions
    await queryRunner.query(`
      ALTER TABLE "work_sessions" 
      ADD COLUMN IF NOT EXISTS "check_in_method" VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "check_out_method" VARCHAR(20);
    `);

    // Add comments for documentation
    await queryRunner.query(`
      COMMENT ON COLUMN "scan_logs"."signing_method" IS 'Signing method used: web, ip, gps, qrcode';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "scan_logs"."ip_address" IS 'IP address of worker (if IP signing method used)';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "scan_logs"."latitude" IS 'GPS latitude (if GPS signing method used)';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "scan_logs"."longitude" IS 'GPS longitude (if GPS signing method used)';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "scan_logs"."qr_token" IS 'Scanned QR token (if QR signing method used)';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "work_sessions"."check_in_method" IS 'Method used for check-in: web, ip, gps, qrcode';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "work_sessions"."check_out_method" IS 'Method used for check-out: web, ip, gps, qrcode';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns from scan_logs
    await queryRunner.query(`
      ALTER TABLE "scan_logs" 
      DROP COLUMN IF EXISTS "signing_method",
      DROP COLUMN IF EXISTS "ip_address",
      DROP COLUMN IF EXISTS "latitude",
      DROP COLUMN IF EXISTS "longitude",
      DROP COLUMN IF EXISTS "qr_token";
    `);

    // Remove columns from work_sessions
    await queryRunner.query(`
      ALTER TABLE "work_sessions" 
      DROP COLUMN IF EXISTS "check_in_method",
      DROP COLUMN IF EXISTS "check_out_method";
    `);
  }
}
