import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationToUsers20260521 implements MigrationInterface {
  name = 'AddEmailVerificationToUsers20260521';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_user"
        ADD COLUMN IF NOT EXISTS "email_verified_at"              timestamp    NULL,
        ADD COLUMN IF NOT EXISTS "email_verification_token_hash"  varchar(64)  NULL,
        ADD COLUMN IF NOT EXISTS "email_verification_expires_at"  timestamp    NULL,
        ADD COLUMN IF NOT EXISTS "email_verification_sent_at"     timestamp    NULL;
    `);

    await queryRunner.query(`
      UPDATE "cjobs_user"
      SET    "email_verified_at" = COALESCE("email_verified_at", now());
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_email_verify_hash"
        ON "cjobs_user"("email_verification_token_hash")
        WHERE "email_verification_token_hash" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_user_email_verify_hash";
    `);
    await queryRunner.query(`
      ALTER TABLE "cjobs_user"
        DROP COLUMN IF EXISTS "email_verification_sent_at",
        DROP COLUMN IF EXISTS "email_verification_expires_at",
        DROP COLUMN IF EXISTS "email_verification_token_hash",
        DROP COLUMN IF EXISTS "email_verified_at";
    `);
  }
}
