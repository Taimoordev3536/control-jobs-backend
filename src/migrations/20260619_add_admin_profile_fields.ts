import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminProfileFields20260619 implements MigrationInterface {
  name = 'AddAdminProfileFields20260619';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_admin_users"
        ADD COLUMN IF NOT EXISTS "nif" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "responsible" varchar(100) NULL,
        ADD COLUMN IF NOT EXISTS "address" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "street" varchar(100) NULL,
        ADD COLUMN IF NOT EXISTS "street_number" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "floor_door" varchar(50) NULL,
        ADD COLUMN IF NOT EXISTS "postal_code" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "city" varchar(100) NULL,
        ADD COLUMN IF NOT EXISTS "province" varchar(100) NULL,
        ADD COLUMN IF NOT EXISTS "country" varchar(100) NULL,
        ADD COLUMN IF NOT EXISTS "latitude" decimal(10,8) NULL,
        ADD COLUMN IF NOT EXISTS "longitude" decimal(11,8) NULL,
        ADD COLUMN IF NOT EXISTS "landline" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "mobile" varchar(20) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_admin_users"
        DROP COLUMN IF EXISTS "mobile",
        DROP COLUMN IF EXISTS "landline",
        DROP COLUMN IF EXISTS "longitude",
        DROP COLUMN IF EXISTS "latitude",
        DROP COLUMN IF EXISTS "country",
        DROP COLUMN IF EXISTS "province",
        DROP COLUMN IF EXISTS "city",
        DROP COLUMN IF EXISTS "postal_code",
        DROP COLUMN IF EXISTS "floor_door",
        DROP COLUMN IF EXISTS "street_number",
        DROP COLUMN IF EXISTS "street",
        DROP COLUMN IF EXISTS "address",
        DROP COLUMN IF EXISTS "responsible",
        DROP COLUMN IF EXISTS "nif";
    `);
  }
}
