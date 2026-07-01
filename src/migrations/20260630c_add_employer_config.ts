import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployerConfig20260630 implements MigrationInterface {
  name = 'AddEmployerConfig20260630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores"
        ADD COLUMN IF NOT EXISTS "def_billing_fixed_amount" numeric(12,2) NULL,
        ADD COLUMN IF NOT EXISTS "def_billing_hours_label" varchar(120) NOT NULL DEFAULT 'Horas de servicio',
        ADD COLUMN IF NOT EXISTS "def_billing_hour_rate" numeric(12,2) NULL,
        ADD COLUMN IF NOT EXISTS "def_billing_vat_pct" numeric(5,2) NOT NULL DEFAULT 21,
        ADD COLUMN IF NOT EXISTS "def_salary_fixed_amount" numeric(12,2) NULL,
        ADD COLUMN IF NOT EXISTS "def_salary_hours_label" varchar(120) NOT NULL DEFAULT 'Horas de trabajo',
        ADD COLUMN IF NOT EXISTS "def_salary_hour_rate" numeric(12,2) NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_employer_holidays" (
        "id"          BIGSERIAL PRIMARY KEY,
        "public_id"   uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employer_id" BIGINT NOT NULL REFERENCES "cjobs_empleadores"("id") ON DELETE CASCADE,
        "date"        date NOT NULL,
        "name"        varchar(120) NULL,
        "created_at"  timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_employer_holiday" ON "cjobs_employer_holidays"("employer_id","date");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_employer_holidays";`);
    await queryRunner.query(`ALTER TABLE "employers"
      DROP COLUMN IF EXISTS "def_billing_fixed_amount",
      DROP COLUMN IF EXISTS "def_billing_hours_label",
      DROP COLUMN IF EXISTS "def_billing_hour_rate",
      DROP COLUMN IF EXISTS "def_billing_vat_pct",
      DROP COLUMN IF EXISTS "def_salary_fixed_amount",
      DROP COLUMN IF EXISTS "def_salary_hours_label",
      DROP COLUMN IF EXISTS "def_salary_hour_rate";`);
  }
}
