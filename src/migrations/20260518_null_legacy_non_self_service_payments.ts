import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullLegacyNonSelfServicePayments20260518 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "cjobs_empleadores"
      SET "paymentMethodId" = NULL,
          "billing_status" = CASE
            WHEN "billing_status" = 'ACTIVE' THEN 'AWAITING_PAYMENT_METHOD'
            ELSE "billing_status"
          END
      WHERE "paymentMethodId" IN (
        SELECT id FROM "cjobs_paymentMethods" WHERE is_self_service = false
      );
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only — legacy mapping cannot be reconstructed from null.
  }
}
