import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Worker bank account for salary payments ("Cuenta bancaria para cobros",
 * shown in the worker self-service Mis datos page).
 */
export class AddWorkerBank20260707 implements MigrationInterface {
  name = 'AddWorkerBank20260707';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workers"
        ADD COLUMN IF NOT EXISTS "bank_iban"   varchar(40)  NULL,
        ADD COLUMN IF NOT EXISTS "bank_swift"  varchar(20)  NULL,
        ADD COLUMN IF NOT EXISTS "bank_holder" varchar(150) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workers"
        DROP COLUMN IF EXISTS "bank_iban",
        DROP COLUMN IF EXISTS "bank_swift",
        DROP COLUMN IF EXISTS "bank_holder";
    `);
  }
}
