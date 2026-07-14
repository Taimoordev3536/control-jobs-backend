import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Client bank account for payments ("Cuenta bancaria para cobros"),
 * shown in the client self-service Mis datos page.
 */
export class AddClientBank20260707 implements MigrationInterface {
  name = 'AddClientBank20260707';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "bank_iban"   varchar(40)  NULL,
        ADD COLUMN IF NOT EXISTS "bank_swift"  varchar(20)  NULL,
        ADD COLUMN IF NOT EXISTS "bank_holder" varchar(150) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        DROP COLUMN IF EXISTS "bank_iban",
        DROP COLUMN IF EXISTS "bank_swift",
        DROP COLUMN IF EXISTS "bank_holder";
    `);
  }
}
