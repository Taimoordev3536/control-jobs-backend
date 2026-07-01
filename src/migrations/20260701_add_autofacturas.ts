import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutofacturas20260701 implements MigrationInterface {
  name = 'AddAutofacturas20260701';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_autofacturas" (
        "id"                 BIGSERIAL PRIMARY KEY,
        "public_id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "autofactura_number" varchar(60) NOT NULL,
        "partner_id"         BIGINT NOT NULL REFERENCES "cjobs_partners"("id") ON DELETE RESTRICT,
        "issue_date"         date NOT NULL,
        "period_start"       date NOT NULL,
        "period_end"         date NOT NULL,
        "payment_date"       date NULL,
        "subtotal"           numeric(12,2) NOT NULL DEFAULT 0,
        "retention_pct"      numeric(5,2) NOT NULL DEFAULT 0,
        "retention_amount"   numeric(12,2) NOT NULL DEFAULT 0,
        "vat_pct"            numeric(5,2) NOT NULL DEFAULT 21,
        "vat_amount"         numeric(12,2) NOT NULL DEFAULT 0,
        "total"              numeric(12,2) NOT NULL DEFAULT 0,
        "status"             varchar(20) NOT NULL DEFAULT 'PENDING',
        "is_manual"          boolean NOT NULL DEFAULT false,
        "notes"              text NULL,
        "paid_at"            timestamptz NULL,
        "created_at"         timestamp NOT NULL DEFAULT now(),
        "updated_at"         timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_autofacturas_public_id" ON "cjobs_autofacturas"("public_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_autofacturas_partner" ON "cjobs_autofacturas"("partner_id");`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_autofacturas_partner_number" ON "cjobs_autofacturas"("partner_id","autofactura_number");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_autofactura_lines" (
        "id"              BIGSERIAL PRIMARY KEY,
        "autofactura_id"  BIGINT NOT NULL REFERENCES "cjobs_autofacturas"("id") ON DELETE CASCADE,
        "description"     varchar(500) NOT NULL,
        "amount"          numeric(12,2) NOT NULL DEFAULT 0,
        "sort_order"      int NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_autofactura_line_parent" ON "cjobs_autofactura_lines"("autofactura_id");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_autofactura_sources" (
        "id"               BIGSERIAL PRIMARY KEY,
        "autofactura_id"   BIGINT NOT NULL REFERENCES "cjobs_autofacturas"("id") ON DELETE CASCADE,
        "employer_type"    varchar(20) NULL,
        "employer_name"    varchar(255) NULL,
        "invoice_number"   varchar(60) NULL,
        "subtotal"         numeric(12,2) NOT NULL DEFAULT 0,
        "commission"       numeric(12,2) NOT NULL DEFAULT 0,
        "discount"         numeric(12,2) NOT NULL DEFAULT 0,
        "total_commission" numeric(12,2) NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_autofactura_source_parent" ON "cjobs_autofactura_sources"("autofactura_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_autofactura_sources";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_autofactura_lines";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_autofacturas";`);
  }
}
