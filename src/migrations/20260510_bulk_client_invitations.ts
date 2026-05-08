import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Greenfield: bulk-link invitations from an employer to many clients
 * (the employer's B2B customers). Mirrors the worker invitation table.
 */
export class BulkClientInvitations20260510 implements MigrationInterface {
  name = 'BulkClientInvitations20260510';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_client_invitations" (
        "id"                serial PRIMARY KEY,
        "public_id"         uuid          NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
        "description"       varchar(255)  NOT NULL DEFAULT '',
        "employer_id"       int           NOT NULL,
        "issued_by_user_id" int           NOT NULL,
        "max_redemptions"   int           NULL,
        "status"            varchar(20)   NOT NULL DEFAULT 'PENDING',
        "expires_at"        timestamp     NULL,
        "created_at"        timestamp     NOT NULL DEFAULT now(),
        "updated_at"        timestamp     NOT NULL DEFAULT now(),
        CONSTRAINT "fk_client_inv_employer"
          FOREIGN KEY ("employer_id")
          REFERENCES "cjobs_empleadores"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_client_inv_issued_by"
          FOREIGN KEY ("issued_by_user_id")
          REFERENCES "cjobs_user"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_client_inv_employer"
        ON "cjobs_client_invitations"("employer_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_client_invitation_redemptions" (
        "id"                  serial PRIMARY KEY,
        "invitation_id"       int          NOT NULL,
        "redeemed_client_id"  int          NOT NULL,
        "redeemed_user_id"    int          NOT NULL,
        "redeemed_email"      varchar(255) NOT NULL,
        "redeemed_at"         timestamp    NOT NULL DEFAULT now(),
        CONSTRAINT "fk_client_inv_red_invitation"
          FOREIGN KEY ("invitation_id")
          REFERENCES "cjobs_client_invitations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_client_inv_red_client"
          FOREIGN KEY ("redeemed_client_id")
          REFERENCES "clients"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_client_inv_red_user"
          FOREIGN KEY ("redeemed_user_id")
          REFERENCES "cjobs_user"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_client_inv_red_email"
          UNIQUE ("invitation_id", "redeemed_email")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_client_inv_red_invitation"
        ON "cjobs_client_invitation_redemptions"("invitation_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_client_invitation_redemptions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_client_invitations" CASCADE`);
  }
}
