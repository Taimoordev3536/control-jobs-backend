import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrPreviousToken20260720 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "qr_codes"
      ADD COLUMN IF NOT EXISTS "previousToken" VARCHAR(44);
    `);
    await queryRunner.query(`
      ALTER TABLE "qr_codes"
      ADD COLUMN IF NOT EXISTS "previousExpiresAt" TIMESTAMPTZ;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_qr_codes_previous_token
      ON "qr_codes" ("previousToken");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_qr_codes_previous_token;`);
    await queryRunner.query(`ALTER TABLE "qr_codes" DROP COLUMN IF EXISTS "previousExpiresAt";`);
    await queryRunner.query(`ALTER TABLE "qr_codes" DROP COLUMN IF EXISTS "previousToken";`);
  }
}
