import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brings salary receipts and client invoices up to the integrity the admin
 * invoice table already has.
 *
 * Spanish law requires an unbroken sequence per series, and neither table had
 * a unique constraint on its document number — the count-based generator would
 * happily reuse one after a delete or under concurrency.
 *
 * Statuses are also normalised to upper case so every document in the system
 * uses the same vocabulary; the two tables stored 'pending' while billing used
 * 'PENDING', which is why the bank-operations sweep silently matched nothing.
 */
export class DocumentIntegrity20260726d implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE cjobs_salary_receipts SET status = UPPER(status)`);
    await queryRunner.query(`UPDATE cjobs_client_invoices SET status = UPPER(status)`);

    await queryRunner.query(`
      ALTER TABLE cjobs_salary_receipts
        ALTER COLUMN status SET DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);
    await queryRunner.query(`
      ALTER TABLE cjobs_client_invoices
        ALTER COLUMN status SET DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    // The sequence guarantee. Scoped per employer, matching how the numbers
    // are generated.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_salary_receipts_number
        ON cjobs_salary_receipts (employer_id, receipt_number)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_client_invoices_number
        ON cjobs_client_invoices (employer_id, invoice_number)
    `);

    // employer_id is filtered on every list and by the bank sweep, and was
    // both unindexed and unconstrained.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_salary_receipts_employer
        ON cjobs_salary_receipts (employer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_invoices_employer
        ON cjobs_client_invoices (employer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_salary_receipts_period
        ON cjobs_salary_receipts (period_start)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_invoices_period
        ON cjobs_client_invoices (period_start)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_salary_receipts_status
        ON cjobs_salary_receipts (status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_invoices_status
        ON cjobs_client_invoices (status)
    `);

    // A receipt or invoice must never total less than zero; a refund is a
    // credit note, not a negative payslip. One reached production.
    await queryRunner.query(`
      ALTER TABLE cjobs_salary_receipts
        DROP CONSTRAINT IF EXISTS chk_salary_receipts_non_negative
    `);
    await queryRunner.query(`
      ALTER TABLE cjobs_salary_receipts
        ADD CONSTRAINT chk_salary_receipts_non_negative
        CHECK (total >= 0 AND hours_qty >= 0 AND hour_rate >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE cjobs_client_invoices
        DROP CONSTRAINT IF EXISTS chk_client_invoices_non_negative
    `);
    await queryRunner.query(`
      ALTER TABLE cjobs_client_invoices
        ADD CONSTRAINT chk_client_invoices_non_negative
        CHECK (total >= 0 AND hours_qty >= 0 AND hour_rate >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cjobs_salary_receipts DROP CONSTRAINT IF EXISTS chk_salary_receipts_non_negative`);
    await queryRunner.query(`ALTER TABLE cjobs_client_invoices DROP CONSTRAINT IF EXISTS chk_client_invoices_non_negative`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_salary_receipts_number`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_client_invoices_number`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_salary_receipts_employer`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_client_invoices_employer`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_salary_receipts_period`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_client_invoices_period`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_salary_receipts_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_client_invoices_status`);
  }
}
