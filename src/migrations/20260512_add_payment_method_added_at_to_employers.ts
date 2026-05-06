import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Capture the moment an employer adds a payment method after their trial ends.
 * The monthly billing cron prorates from this date instead of the original
 * trial-end date — service is unbilled while the employer is between
 * trial-end and adding their card (per spec §6, "AWAITING_PAYMENT_METHOD"
 * state).
 */
export class AddPaymentMethodAddedAtToEmployers20260512
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      ADD COLUMN IF NOT EXISTS payment_method_added_at TIMESTAMP NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      DROP COLUMN IF EXISTS payment_method_added_at;
    `);
  }
}
