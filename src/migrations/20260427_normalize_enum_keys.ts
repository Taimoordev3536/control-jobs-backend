import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalize enum/lookup values to language-neutral UPPERCASE keys so the
 * frontend can map them through the i18n layer.
 *
 * Tables affected:
 *  - employerTypes        (PG enum column "name")
 *  - employerSubTypes     (PG enum column "name")
 *  - cjobs_paymentMethods (varchar column "name")
 *  - gender               (varchar column "name")
 *
 * Note: TypeORM auto-names native PG enum types as `<table>_<column>_enum`.
 */
export class NormalizeEnumKeys20260427 implements MigrationInterface {
  name = 'NormalizeEnumKeys20260427';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Normalizing enum/lookup values to UPPERCASE keys');

    // --- employerTypes (native PG enum) ---
    await queryRunner.query(
      `ALTER TYPE "employerTypes_name_enum" RENAME VALUE 'Home'   TO 'HOME'`,
    );
    await queryRunner.query(
      `ALTER TYPE "employerTypes_name_enum" RENAME VALUE 'Static' TO 'STATIC'`,
    );
    await queryRunner.query(
      `ALTER TYPE "employerTypes_name_enum" RENAME VALUE 'Remote' TO 'REMOTE'`,
    );

    // --- employerSubTypes (native PG enum) ---
    await queryRunner.query(
      `ALTER TYPE "employerSubTypes_name_enum" RENAME VALUE 'Individual'    TO 'INDIVIDUAL'`,
    );
    await queryRunner.query(
      `ALTER TYPE "employerSubTypes_name_enum" RENAME VALUE 'Self-Employed' TO 'FREELANCER'`,
    );
    await queryRunner.query(
      `ALTER TYPE "employerSubTypes_name_enum" RENAME VALUE 'Company'       TO 'COMPANY'`,
    );

    // --- cjobs_paymentMethods (varchar) ---
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'TRANSFER'     WHERE name = 'Transfer'`);
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'DIRECT_DEBIT' WHERE name = 'Direct Debit'`);
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'CARD'         WHERE name = 'Card'`);
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'PAYPAL'       WHERE name = 'PayPal'`);
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'OTHERS'       WHERE name = 'Others'`);

    // --- gender (varchar) ---
    await queryRunner.query(`UPDATE "gender" SET name = 'MALE'   WHERE name IN ('Male', 'male', 'Man', 'man')`);
    await queryRunner.query(`UPDATE "gender" SET name = 'FEMALE' WHERE name IN ('Female', 'female', 'Woman', 'woman')`);
    await queryRunner.query(`UPDATE "gender" SET name = 'OTHER'  WHERE name IN ('Other', 'other')`);

    console.log('✅ Enum/lookup values normalized to UPPERCASE keys');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('↩️  Reverting enum/lookup values to legacy display strings');

    // employerTypes
    await queryRunner.query(`ALTER TYPE "employerTypes_name_enum" RENAME VALUE 'HOME'   TO 'Home'`);
    await queryRunner.query(`ALTER TYPE "employerTypes_name_enum" RENAME VALUE 'STATIC' TO 'Static'`);
    await queryRunner.query(`ALTER TYPE "employerTypes_name_enum" RENAME VALUE 'REMOTE' TO 'Remote'`);

    // employerSubTypes
    await queryRunner.query(`ALTER TYPE "employerSubTypes_name_enum" RENAME VALUE 'INDIVIDUAL' TO 'Individual'`);
    await queryRunner.query(`ALTER TYPE "employerSubTypes_name_enum" RENAME VALUE 'FREELANCER' TO 'Self-Employed'`);
    await queryRunner.query(`ALTER TYPE "employerSubTypes_name_enum" RENAME VALUE 'COMPANY'    TO 'Company'`);

    // cjobs_paymentMethods
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'Transfer'     WHERE name = 'TRANSFER'`);
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'Direct Debit' WHERE name = 'DIRECT_DEBIT'`);
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'Card'         WHERE name = 'CARD'`);
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'PayPal'       WHERE name = 'PAYPAL'`);
    await queryRunner.query(`UPDATE "cjobs_paymentMethods" SET name = 'Others'       WHERE name = 'OTHERS'`);

    // gender
    await queryRunner.query(`UPDATE "gender" SET name = 'Male'   WHERE name = 'MALE'`);
    await queryRunner.query(`UPDATE "gender" SET name = 'Female' WHERE name = 'FEMALE'`);
    await queryRunner.query(`UPDATE "gender" SET name = 'Other'  WHERE name = 'OTHER'`);
  }
}
