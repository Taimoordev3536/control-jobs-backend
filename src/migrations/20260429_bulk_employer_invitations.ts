import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convert cjobs_employer_invitations from per-email single-use to
 * reusable bulk-link invitations. Adds description / discount / max
 * fields, relaxes email + expires_at to nullable, and creates the
 * redemptions audit table that tracks every employer who signed up
 * via a given link.
 *
 * `cjobs_user` is the actual users table in this project (FK target
 * for issuer / redeemed user).
 */
export class BulkEmployerInvitations20260429 implements MigrationInterface {
  name = 'BulkEmployerInvitations20260429';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Migrating cjobs_employer_invitations → bulk semantics');

    await queryRunner.query(`
      ALTER TABLE "cjobs_employer_invitations"
        ADD COLUMN IF NOT EXISTS "description"      varchar(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS "discount_percent" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "max_redemptions"  int          NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "cjobs_employer_invitations"
        ALTER COLUMN "email"      DROP NOT NULL,
        ALTER COLUMN "expires_at" DROP NOT NULL;
    `);

    console.log('🔄 Creating cjobs_employer_invitation_redemptions');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_employer_invitation_redemptions" (
        "id"                     serial PRIMARY KEY,
        "invitation_id"          int            NOT NULL,
        "redeemed_employer_id"   int            NOT NULL,
        "redeemed_user_id"       int            NOT NULL,
        "redeemed_email"         varchar(255)   NOT NULL,
        "redeemed_at"            timestamp      NOT NULL DEFAULT now(),
        CONSTRAINT "fk_inv_redemptions_invitation"
          FOREIGN KEY ("invitation_id")
          REFERENCES "cjobs_employer_invitations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_inv_redemptions_employer"
          FOREIGN KEY ("redeemed_employer_id")
          REFERENCES "cjobs_empleadores"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_inv_redemptions_user"
          FOREIGN KEY ("redeemed_user_id")
          REFERENCES "cjobs_user"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_inv_redemptions_email_per_invitation"
          UNIQUE ("invitation_id", "redeemed_email")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inv_redemptions_invitation"
        ON "cjobs_employer_invitation_redemptions"("invitation_id");
    `);

    // One-time backfill: any historical row that was already ACCEPTED in
    // the single-use model becomes one redemption row in the new model.
    await queryRunner.query(`
      INSERT INTO "cjobs_employer_invitation_redemptions"
        ("invitation_id", "redeemed_employer_id", "redeemed_user_id",
         "redeemed_email", "redeemed_at")
      SELECT
        inv."id",
        inv."accepted_employer_id",
        eu."userId",
        inv."email",
        COALESCE(inv."accepted_at", inv."updated_at")
      FROM "cjobs_employer_invitations" inv
      JOIN "employerUsers" eu
        ON eu."employerId" = inv."accepted_employer_id"
       AND eu."isDefault" = true
      WHERE inv."status" = 'ACCEPTED'
        AND inv."accepted_employer_id" IS NOT NULL
        AND inv."email" IS NOT NULL
      ON CONFLICT ("invitation_id", "redeemed_email") DO NOTHING;
    `);

    console.log('✅ Bulk invitation migration complete');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('↩️  Reverting bulk employer invitations migration');
    await queryRunner.query(
      `DROP TABLE IF EXISTS "cjobs_employer_invitation_redemptions" CASCADE`,
    );
    await queryRunner.query(`
      ALTER TABLE "cjobs_employer_invitations"
        DROP COLUMN IF EXISTS "description",
        DROP COLUMN IF EXISTS "discount_percent",
        DROP COLUMN IF EXISTS "max_redemptions";
    `);
    // Note: we intentionally do NOT re-impose NOT NULL on email/expires_at
    // because new bulk rows may legitimately have NULL values.
  }
}
