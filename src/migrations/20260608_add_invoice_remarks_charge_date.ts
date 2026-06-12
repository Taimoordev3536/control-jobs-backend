import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceRemarksChargeDate20260608 implements MigrationInterface {
  name = 'AddInvoiceRemarksChargeDate20260608';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        ADD COLUMN IF NOT EXISTS "remarks" text NULL,
        ADD COLUMN IF NOT EXISTS "charge_date" date NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        DROP COLUMN IF EXISTS "charge_date",
        DROP COLUMN IF EXISTS "remarks";
    `);
  }
}
