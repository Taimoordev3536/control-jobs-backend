import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 9 — Billing roadmap.
 * Creates the `cjobs_invoices` table. Every line-item is denormalised so old
 * invoices remain a frozen snapshot of what was charged at the time, even if
 * rates or VAT change later.
 */
export class CreateInvoices20260428 implements MigrationInterface {
  name = 'CreateInvoices20260428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Creating cjobs_invoices table');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_invoices" (
        "id"                 serial PRIMARY KEY,
        "public_id"          uuid           UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
        "invoice_number"     varchar(50)    UNIQUE NOT NULL,
        "employer_id"        int            NOT NULL,
        "period_start"       date           NOT NULL,
        "period_end"         date           NOT NULL,
        "issue_date"         date           NOT NULL,
        "due_date"           date           NOT NULL,
        "is_prorated"        boolean        NOT NULL DEFAULT false,
        "prorated_days"      int            NULL,
        "days_in_month"      int            NULL,
        "monthly_fixed_rate" numeric(8,2)   NOT NULL,
        "per_workcenter_rate" numeric(8,2)  NOT NULL,
        "per_worker_rate"    numeric(8,2)   NOT NULL,
        "fixed_amount"       numeric(10,2)  NOT NULL,
        "workcenter_count"   int            NOT NULL,
        "workcenter_amount"  numeric(10,2)  NOT NULL,
        "worker_count"       int            NOT NULL,
        "worker_amount"      numeric(10,2)  NOT NULL,
        "subtotal"           numeric(10,2)  NOT NULL,
        "discount_pct"       numeric(5,2)   NOT NULL DEFAULT 0,
        "discount_amount"    numeric(10,2)  NOT NULL DEFAULT 0,
        "vat_pct"            numeric(5,2)   NOT NULL DEFAULT 0,
        "vat_amount"         numeric(10,2)  NOT NULL DEFAULT 0,
        "total"              numeric(10,2)  NOT NULL,
        "status"             varchar(20)    NOT NULL DEFAULT 'PENDING',
        "paid_at"            timestamp      NULL,
        "created_at"         timestamp      NOT NULL DEFAULT now(),
        "updated_at"         timestamp      NOT NULL DEFAULT now(),
        CONSTRAINT "fk_invoices_employer"
          FOREIGN KEY ("employer_id") REFERENCES "cjobs_empleadores"("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_invoices_employer_period"
          UNIQUE ("employer_id", "period_start")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoices_employer" ON "cjobs_invoices"("employer_id");
      CREATE INDEX IF NOT EXISTS "idx_invoices_period"   ON "cjobs_invoices"("period_start");
      CREATE INDEX IF NOT EXISTS "idx_invoices_status"   ON "cjobs_invoices"("status");
    `);

    console.log('✅ cjobs_invoices created');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('↩️  Dropping cjobs_invoices');
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_invoices" CASCADE`);
  }
}
