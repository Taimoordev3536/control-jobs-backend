import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoicePaymentMethod20260612 implements MigrationInterface {
  name = 'AddInvoicePaymentMethod20260612';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        ADD COLUMN IF NOT EXISTS "payment_method_id" integer NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        DROP CONSTRAINT IF EXISTS "fk_invoices_payment_method";
    `);
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        ADD CONSTRAINT "fk_invoices_payment_method"
        FOREIGN KEY ("payment_method_id")
        REFERENCES "cjobs_paymentMethods"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        DROP CONSTRAINT IF EXISTS "fk_invoices_payment_method";
    `);
    await queryRunner.query(`
      ALTER TABLE "cjobs_invoices"
        DROP COLUMN IF EXISTS "payment_method_id";
    `);
  }
}
