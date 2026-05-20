import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentMethodSelfServiceFlag20260518 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_paymentMethods"
      ADD COLUMN IF NOT EXISTS "is_self_service" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "display_order" int NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      UPDATE "cjobs_paymentMethods"
      SET "is_self_service" = true,
          "display_order" = CASE name
            WHEN 'DIRECT_DEBIT' THEN 1
            WHEN 'CARD' THEN 2
            WHEN 'PAYPAL' THEN 3
          END
      WHERE name IN ('DIRECT_DEBIT', 'CARD', 'PAYPAL');
    `);

    await queryRunner.query(`
      UPDATE "cjobs_paymentMethods"
      SET "display_order" = CASE name
            WHEN 'TRANSFER' THEN 10
            WHEN 'OTHERS' THEN 11
          END
      WHERE name IN ('TRANSFER', 'OTHERS');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_paymentMethods"
      DROP COLUMN IF EXISTS "is_self_service",
      DROP COLUMN IF EXISTS "display_order";
    `);
  }
}
