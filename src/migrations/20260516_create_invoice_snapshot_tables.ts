import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Snapshot the work centers and workers that contributed to each invoice
 * at the moment the invoice was issued. The cron only stored *counts*
 * before — but the spec (§3 footnote 1) requires showing the actual names
 * on the invoice's "page 2" so partners can audit how the billed total was
 * computed. Snapshot is the right approach: workforce changes after the
 * invoice can't retroactively distort what the bill represented.
 *
 * Two separate tables (rather than one polymorphic `invoice_lines` with a
 * `kind` enum) so each query is straightforward and the columns aren't
 * mostly-nullable.
 */
export class CreateInvoiceSnapshotTables20260516 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cjobs_invoice_workcenters (
        id              BIGSERIAL PRIMARY KEY,
        invoice_id      BIGINT NOT NULL REFERENCES cjobs_invoices(id) ON DELETE CASCADE,
        work_center_id  BIGINT NULL,
        name            VARCHAR(255) NOT NULL,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_invoice_wc_invoice ON cjobs_invoice_workcenters(invoice_id);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cjobs_invoice_workers (
        id          BIGSERIAL PRIMARY KEY,
        invoice_id  BIGINT NOT NULL REFERENCES cjobs_invoices(id) ON DELETE CASCADE,
        worker_id   BIGINT NULL,
        name        VARCHAR(255) NOT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_invoice_wk_invoice ON cjobs_invoice_workers(invoice_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cjobs_invoice_workers;`);
    await queryRunner.query(`DROP TABLE IF EXISTS cjobs_invoice_workcenters;`);
  }
}
