import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhase3Tables20260630 implements MigrationInterface {
  name = 'AddPhase3Tables20260630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_worker_documents" (
        "id"                  BIGSERIAL PRIMARY KEY,
        "public_id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "worker_id"           BIGINT NOT NULL REFERENCES "workers"("id") ON DELETE CASCADE,
        "file_name"           varchar(255) NOT NULL,
        "url"                 text NOT NULL,
        "storage_public_id"   varchar(500) NOT NULL,
        "resource_type"       varchar(20) NOT NULL DEFAULT 'raw',
        "mime_type"           varchar(150) NULL,
        "size_bytes"          bigint NULL,
        "description"         varchar(255) NULL,
        "uploaded_by_user_id" integer NULL,
        "created_at"          timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_worker_documents_public_id" ON "cjobs_worker_documents"("public_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_worker_documents_worker" ON "cjobs_worker_documents"("worker_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_salary_receipts" (
        "id"                  BIGSERIAL PRIMARY KEY,
        "public_id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "worker_id"           BIGINT NOT NULL REFERENCES "workers"("id") ON DELETE CASCADE,
        "employer_id"         BIGINT NOT NULL,
        "receipt_number"      varchar(60) NOT NULL,
        "issue_date"          date NOT NULL,
        "period_start"        date NOT NULL,
        "period_end"          date NOT NULL,
        "fixed_label"         varchar(120) NOT NULL DEFAULT 'Gastos fijos',
        "fixed_amount"        numeric(12,2) NULL,
        "hours_label"         varchar(120) NOT NULL DEFAULT 'Horas de trabajo',
        "hours_qty"           numeric(10,2) NOT NULL DEFAULT 0,
        "hour_rate"           numeric(12,2) NOT NULL DEFAULT 0,
        "hours_amount"        numeric(12,2) NOT NULL DEFAULT 0,
        "total"               numeric(12,2) NOT NULL DEFAULT 0,
        "status"              varchar(20) NOT NULL DEFAULT 'pending',
        "notes"               varchar(255) NULL,
        "uploaded_by_user_id" integer NULL,
        "created_at"          timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_salary_receipts_public_id" ON "cjobs_salary_receipts"("public_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_salary_receipts_worker" ON "cjobs_salary_receipts"("worker_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_client_invoices" (
        "id"                  BIGSERIAL PRIMARY KEY,
        "public_id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_id"           BIGINT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "employer_id"         BIGINT NOT NULL,
        "invoice_number"      varchar(60) NOT NULL,
        "issue_date"          date NOT NULL,
        "due_date"            date NULL,
        "period_start"        date NOT NULL,
        "period_end"          date NOT NULL,
        "fixed_label"         varchar(120) NOT NULL DEFAULT 'Gastos fijos',
        "fixed_amount"        numeric(12,2) NULL,
        "hours_label"         varchar(120) NOT NULL DEFAULT 'Horas de servicio',
        "hours_qty"           numeric(10,2) NOT NULL DEFAULT 0,
        "hour_rate"           numeric(12,2) NOT NULL DEFAULT 0,
        "hours_amount"        numeric(12,2) NOT NULL DEFAULT 0,
        "subtotal"            numeric(12,2) NOT NULL DEFAULT 0,
        "vat_pct"             numeric(5,2) NOT NULL DEFAULT 0,
        "vat_amount"          numeric(12,2) NOT NULL DEFAULT 0,
        "total"               numeric(12,2) NOT NULL DEFAULT 0,
        "status"              varchar(20) NOT NULL DEFAULT 'pending',
        "notes"               varchar(255) NULL,
        "uploaded_by_user_id" integer NULL,
        "created_at"          timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_client_invoices_public_id" ON "cjobs_client_invoices"("public_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_client_invoices_client" ON "cjobs_client_invoices"("client_id");`,
    );

    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "billing_fixed_amount" numeric(12,2) NULL,
        ADD COLUMN IF NOT EXISTS "billing_hours_label" varchar(120) NOT NULL DEFAULT 'Horas de servicio',
        ADD COLUMN IF NOT EXISTS "billing_hour_rate" numeric(12,2) NULL,
        ADD COLUMN IF NOT EXISTS "billing_vat_pct" numeric(5,2) NOT NULL DEFAULT 21;
    `);

    await queryRunner.query(`
      ALTER TABLE "workers"
        ADD COLUMN IF NOT EXISTS "salary_fixed_amount" numeric(12,2) NULL,
        ADD COLUMN IF NOT EXISTS "salary_hours_label" varchar(120) NOT NULL DEFAULT 'Horas de trabajo',
        ADD COLUMN IF NOT EXISTS "salary_hour_rate" numeric(12,2) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workers" DROP COLUMN IF EXISTS "salary_fixed_amount", DROP COLUMN IF EXISTS "salary_hours_label", DROP COLUMN IF EXISTS "salary_hour_rate";`);
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "billing_fixed_amount", DROP COLUMN IF EXISTS "billing_hours_label", DROP COLUMN IF EXISTS "billing_hour_rate", DROP COLUMN IF EXISTS "billing_vat_pct";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_client_invoices";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_salary_receipts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_worker_documents";`);
  }
}
