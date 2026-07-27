import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records which document paid for a work session.
 *
 * Without this the hours query only filters by period, so issuing a second
 * receipt for the same month pays the same sessions again — verified against
 * live data before this migration was written.
 *
 * ON DELETE SET NULL so deleting a receipt returns its sessions to the pool
 * rather than destroying the attendance record, which must survive 4 years
 * under Art. 34.9 ET.
 */
export class SessionBillingLink20260727b implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE work_sessions
        ADD COLUMN IF NOT EXISTS salary_receipt_id INT
          REFERENCES cjobs_salary_receipts(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS client_invoice_id INT
          REFERENCES cjobs_client_invoices(id) ON DELETE SET NULL
    `);

    // Partial: the hours query looks for unclaimed sessions, which is the
    // common case, and the claimed ones are only read per document.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_work_sessions_salary_receipt
        ON work_sessions (salary_receipt_id) WHERE salary_receipt_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_work_sessions_client_invoice
        ON work_sessions (client_invoice_id) WHERE client_invoice_id IS NOT NULL
    `);

    // What the clock actually recorded, kept next to what was paid, so a
    // manual adjustment is visible on the document rather than silent.
    for (const table of ['cjobs_salary_receipts', 'cjobs_client_invoices']) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS computed_hours_qty NUMERIC(10,2)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_work_sessions_salary_receipt`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_work_sessions_client_invoice`);
    await queryRunner.query(`ALTER TABLE work_sessions DROP COLUMN IF EXISTS salary_receipt_id`);
    await queryRunner.query(`ALTER TABLE work_sessions DROP COLUMN IF EXISTS client_invoice_id`);
    await queryRunner.query(`ALTER TABLE cjobs_salary_receipts DROP COLUMN IF EXISTS computed_hours_qty`);
    await queryRunner.query(`ALTER TABLE cjobs_client_invoices DROP COLUMN IF EXISTS computed_hours_qty`);
  }
}
