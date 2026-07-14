import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientRequestAudit20260714 implements MigrationInterface {
  name = 'ClientRequestAudit20260714';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_client_requests"
        ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" integer,
        ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_client_requests"
        DROP COLUMN IF EXISTS "reviewed_by_user_id",
        DROP COLUMN IF EXISTS "reviewed_at";
    `);
  }
}
