import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogoToEmployers20260507 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      ADD COLUMN IF NOT EXISTS logo_public_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS logo_url       VARCHAR(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      DROP COLUMN IF EXISTS logo_public_id,
      DROP COLUMN IF EXISTS logo_url;
    `);
  }
}
