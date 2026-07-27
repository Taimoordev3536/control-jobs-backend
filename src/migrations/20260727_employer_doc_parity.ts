import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brings salary receipts and client invoices to the same shape as admin
 * invoices: free-form lines beyond the fixed + hours pair, and a payment
 * method on the document.
 *
 * The existing fixed/hours columns stay: every issued document keeps its
 * current numbers, and a document with no line rows still renders exactly as
 * it does today.
 */
export class EmployerDocParity20260727 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, parent, fk] of [
      ['cjobs_salary_receipt_lines', 'cjobs_salary_receipts', 'receipt_id'],
      ['cjobs_client_invoice_lines', 'cjobs_client_invoices', 'invoice_id'],
    ]) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id BIGSERIAL PRIMARY KEY,
          ${fk} INT NOT NULL REFERENCES ${parent}(id) ON DELETE CASCADE,
          description VARCHAR(500) NOT NULL,
          quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
          unit_price NUMERIC(12,2) NOT NULL,
          line_total NUMERIC(12,2) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_${fk}_lines ON ${table} (${fk})`,
      );
    }

    for (const table of ['cjobs_salary_receipts', 'cjobs_client_invoices']) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS payment_method_id INT
            REFERENCES "cjobs_paymentMethods"(id) ON DELETE SET NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cjobs_salary_receipt_lines`);
    await queryRunner.query(`DROP TABLE IF EXISTS cjobs_client_invoice_lines`);
    await queryRunner.query(`ALTER TABLE cjobs_salary_receipts DROP COLUMN IF EXISTS payment_method_id`);
    await queryRunner.query(`ALTER TABLE cjobs_client_invoices DROP COLUMN IF EXISTS payment_method_id`);
  }
}
