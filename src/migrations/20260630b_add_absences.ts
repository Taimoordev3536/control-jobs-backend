import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAbsences20260630 implements MigrationInterface {
  name = 'AddAbsences20260630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_absence_requests" (
        "id"                   BIGSERIAL PRIMARY KEY,
        "public_id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "worker_id"            BIGINT NOT NULL REFERENCES "workers"("id") ON DELETE CASCADE,
        "employer_id"          BIGINT NOT NULL,
        "type"                 varchar(20) NOT NULL DEFAULT 'vacation',
        "start_date"           date NOT NULL,
        "end_date"             date NOT NULL,
        "reason"               text NULL,
        "status"               varchar(20) NOT NULL DEFAULT 'pending',
        "reviewer_notes"       text NULL,
        "reviewed_by_user_id"  integer NULL,
        "reviewed_at"          timestamptz NULL,
        "requested_by_user_id" integer NULL,
        "created_at"           timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_absence_requests_public_id" ON "cjobs_absence_requests"("public_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_absence_requests_employer" ON "cjobs_absence_requests"("employer_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_absence_requests_worker" ON "cjobs_absence_requests"("worker_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_absence_requests";`);
  }
}
