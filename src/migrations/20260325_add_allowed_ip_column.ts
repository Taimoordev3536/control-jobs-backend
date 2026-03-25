import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllowedIpColumn20260325 implements MigrationInterface {
  name = 'AddAllowedIpColumn20260325';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Adding allowed_ip column to work_center');

    await queryRunner.query(`
      ALTER TABLE "work_center"
      ADD COLUMN IF NOT EXISTS "allowed_ip" VARCHAR(45) DEFAULT NULL;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "work_center"."allowed_ip" IS 'Public IP address allowed for IP-based check-in at this work center';
    `);

    console.log('✅ allowed_ip column added to work_center');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_center"
      DROP COLUMN IF EXISTS "allowed_ip";
    `);
    console.log('↩️ allowed_ip column removed from work_center');
  }
}
