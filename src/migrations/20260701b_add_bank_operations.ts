import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBankOperations20260701b implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_bank_operations" (
        "id"           BIGSERIAL PRIMARY KEY,
        "public_id"    uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scope_type"   varchar(20) NOT NULL,
        "employer_id"  BIGINT NULL,
        "tab"          varchar(20) NOT NULL,
        "kind"         varchar(10) NOT NULL,
        "period_start" date NOT NULL,
        "period_end"   date NOT NULL,
        "item_count"   int NOT NULL DEFAULT 0,
        "total_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "source"       varchar(10) NOT NULL DEFAULT 'MANUAL',
        "status"       varchar(20) NOT NULL DEFAULT 'PENDING',
        "ref_ids"      jsonb NULL,
        "notes"        text NULL,
        "done_at"      timestamptz NULL,
        "created_at"   timestamp NOT NULL DEFAULT now(),
        "updated_at"   timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_bank_ops_public_id" ON "cjobs_bank_operations"("public_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bank_ops_scope" ON "cjobs_bank_operations"("scope_type","employer_id","tab");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_bank_operations";`);
  }
}
