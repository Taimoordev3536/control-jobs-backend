import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Method 2 — Employer invitation flow.
 * Audit table for invitations sent to prospective employers. The token
 * itself is a stateless JWT; this row exists so admin/partner can see
 * a history of what they sent and revoke it before expiry if needed.
 */
export class CreateEmployerInvitations20260428 implements MigrationInterface {
  name = 'CreateEmployerInvitations20260428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Creating cjobs_employer_invitations table');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_employer_invitations" (
        "id"                     serial PRIMARY KEY,
        "public_id"              uuid           UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
        "email"                  varchar(255)   NOT NULL,
        "partner_id"             int            NOT NULL,
        "trial_days"             int            NOT NULL DEFAULT 15,
        "issued_by_user_id"      int            NOT NULL,
        "status"                 varchar(20)    NOT NULL DEFAULT 'PENDING',
        "accepted_at"            timestamp      NULL,
        "accepted_employer_id"   int            NULL,
        "expires_at"             timestamp      NOT NULL,
        "created_at"             timestamp      NOT NULL DEFAULT now(),
        "updated_at"             timestamp      NOT NULL DEFAULT now(),
        CONSTRAINT "fk_emp_invitations_partner"
          FOREIGN KEY ("partner_id") REFERENCES "cjobs_partners"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_emp_invitations_issuer"
          FOREIGN KEY ("issued_by_user_id") REFERENCES "cjobs_user"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_emp_invitations_employer"
          FOREIGN KEY ("accepted_employer_id") REFERENCES "cjobs_empleadores"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_emp_invitations_email"   ON "cjobs_employer_invitations"("email");
      CREATE INDEX IF NOT EXISTS "idx_emp_invitations_partner" ON "cjobs_employer_invitations"("partner_id");
      CREATE INDEX IF NOT EXISTS "idx_emp_invitations_status"  ON "cjobs_employer_invitations"("status");
    `);

    console.log('✅ cjobs_employer_invitations created');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('↩️  Dropping cjobs_employer_invitations');
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_employer_invitations" CASCADE`);
  }
}
