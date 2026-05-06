import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widen `cjobs_empleadores.billing_status` from VARCHAR(20) to VARCHAR(40).
 * The new state value `AWAITING_PAYMENT_METHOD` (24 chars) doesn't fit in
 * the original 20-char column, so saves to it fail with Postgres 22001
 * "value too long for type character varying(20)".
 */
export class WidenBillingStatusColumn20260513 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      ALTER COLUMN billing_status TYPE VARCHAR(40);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_empleadores
      ALTER COLUMN billing_status TYPE VARCHAR(20);
    `);
  }
}
