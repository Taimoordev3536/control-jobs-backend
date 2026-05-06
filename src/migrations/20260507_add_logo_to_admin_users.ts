import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogoToAdminUsers20260507 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_admin_users
      ADD COLUMN IF NOT EXISTS logo_public_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS logo_url       VARCHAR(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_admin_users
      DROP COLUMN IF EXISTS logo_public_id,
      DROP COLUMN IF EXISTS logo_url;
    `);
  }
}
