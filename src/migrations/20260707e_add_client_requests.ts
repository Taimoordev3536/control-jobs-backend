import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientRequests20260707 implements MigrationInterface {
  name = 'AddClientRequests20260707';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_client_requests" (
        "id"              BIGSERIAL PRIMARY KEY,
        "public_id"       uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_id"       BIGINT NOT NULL,
        "employer_id"     BIGINT NOT NULL,
        "type"            varchar(20) NOT NULL,
        "job_id"          BIGINT NULL,
        "subject"         varchar(200) NULL,
        "description"     text NULL,
        "start_date"      date NULL,
        "end_date"        date NULL,
        "status"          varchar(20) NOT NULL DEFAULT 'pending',
        "reviewer_notes"  text NULL,
        "created_at"      timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_client_requests_public_id" ON "cjobs_client_requests"("public_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_client_requests_client" ON "cjobs_client_requests"("client_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_client_requests_employer" ON "cjobs_client_requests"("employer_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_client_requests";`);
  }
}
