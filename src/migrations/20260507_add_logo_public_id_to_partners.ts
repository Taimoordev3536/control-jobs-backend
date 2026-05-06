import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogoPublicIdToPartners20260507 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // logoUrl already exists on cjobs_partners; we add the Cloudinary public_id
    // companion so the upload flow can clean up the old asset on replace.
    await queryRunner.query(`
      ALTER TABLE cjobs_partners
      ADD COLUMN IF NOT EXISTS logo_public_id VARCHAR(255);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_partners
      DROP COLUMN IF EXISTS logo_public_id;
    `);
  }
}
