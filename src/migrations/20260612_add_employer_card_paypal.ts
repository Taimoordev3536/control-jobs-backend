import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployerCardPaypal20260612 implements MigrationInterface {
  name = 'AddEmployerCardPaypal20260612';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores"
        ADD COLUMN IF NOT EXISTS "card_last4" varchar(4) NULL,
        ADD COLUMN IF NOT EXISTS "paypal_email" varchar(255) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores"
        DROP COLUMN IF EXISTS "paypal_email",
        DROP COLUMN IF EXISTS "card_last4";
    `);
  }
}
