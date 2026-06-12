import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManualInvoices20260608 implements MigrationInterface {
  name = 'AddManualInvoices20260608';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        ADD COLUMN IF NOT EXISTS "invoice_type" varchar(20) NOT NULL DEFAULT 'NORMAL',
        ADD COLUMN IF NOT EXISTS "is_manual" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "rectifies_invoice_id" bigint NULL;
    `);

    // Swap the plain unique constraint for a partial one that exempts manual invoices.
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        DROP CONSTRAINT IF EXISTS "uq_invoices_employer_period";
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoices_employer_period"
        ON "cjobs_invoices" ("employer_id", "period_start")
        WHERE "is_manual" = false;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_invoice_lines" (
        "id"          BIGSERIAL PRIMARY KEY,
        "invoice_id"  BIGINT NOT NULL REFERENCES "cjobs_invoices"("id") ON DELETE CASCADE,
        "description" varchar(500) NOT NULL,
        "quantity"    numeric(10,2) NOT NULL DEFAULT 1,
        "unit_price"  numeric(10,2) NOT NULL,
        "line_total"  numeric(10,2) NOT NULL,
        "sort_order"  int NOT NULL DEFAULT 0,
        "created_at"  timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_invoice_line_invoice" ON "cjobs_invoice_lines"("invoice_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_invoice_lines";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_invoices_employer_period";`,
    );
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        ADD CONSTRAINT "uq_invoices_employer_period" UNIQUE ("employer_id", "period_start");
    `);
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        DROP COLUMN IF EXISTS "rectifies_invoice_id",
        DROP COLUMN IF EXISTS "is_manual",
        DROP COLUMN IF EXISTS "invoice_type";
    `);
  }
}
