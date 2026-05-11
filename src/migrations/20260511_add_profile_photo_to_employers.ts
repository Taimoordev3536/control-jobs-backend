import { MigrationInterface, QueryRunner } from 'typeorm';

// Employer identity (nav avatar, WhatsApp profile, etc.) is intentionally
// stored separately from `logo_*` — the latter is the brand image printed
// in QR-code PDF footers. Other roles still re-use `logo_*` as their avatar.
export class AddProfilePhotoToEmployers20260511 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      ADD COLUMN IF NOT EXISTS profile_photo_public_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS profile_photo_url       VARCHAR(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      DROP COLUMN IF EXISTS profile_photo_public_id,
      DROP COLUMN IF EXISTS profile_photo_url;
    `);
  }
}
