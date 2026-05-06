import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow NULL on `cjobs_empleadores.paymentMethodId`.
 *
 * The invitation-link signup flow intentionally leaves payment-method
 * collection for after the trial — the trial-end cron flips the employer
 * to AWAITING_PAYMENT_METHOD and they pick one via the new banner/modal.
 * Until then, the column stays NULL. Admin/partner creates and self-signup
 * still pass a real id, so existing rows are unaffected.
 */
export class MakePaymentMethodIdNullable20260514 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      ALTER COLUMN "paymentMethodId" DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      ALTER COLUMN "paymentMethodId" SET NOT NULL;
    `);
  }
}
