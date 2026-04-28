import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 — Billing roadmap.
 * Creates the price book table `cjobs_rate_plans` and seeds the 3 plans
 * agreed with the client.
 *
 * Each (subTypes, tariffType) combination should match exactly one
 * active row at runtime; the matching service enforces that.
 */
export class CreateRatePlans20260428 implements MigrationInterface {
  name = 'CreateRatePlans20260428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Creating cjobs_rate_plans table');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_rate_plans" (
        "id"               serial PRIMARY KEY,
        "code"             varchar(50)    UNIQUE NOT NULL,
        "label"            varchar(100)   NOT NULL,
        "sub_types"        varchar(100)   NOT NULL,
        "tariff_type"      varchar(20)    NOT NULL,
        "monthly_fixed"    numeric(8,2)   NOT NULL,
        "per_workcenter"   numeric(8,2)   NOT NULL,
        "per_worker"       numeric(8,2)   NOT NULL,
        "is_active"        boolean        NOT NULL DEFAULT true,
        "created_at"       timestamp      NOT NULL DEFAULT now(),
        "updated_at"       timestamp      NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_rate_plans_active"
        ON "cjobs_rate_plans" ("is_active");
    `);

    console.log('🌱 Seeding 3 default rate plans');

    await queryRunner.query(`
      INSERT INTO "cjobs_rate_plans"
        ("code", "label", "sub_types", "tariff_type", "monthly_fixed", "per_workcenter", "per_worker")
      VALUES
        ('PARTICULAR_HOME', 'Particular - Home',          'INDIVIDUAL',          'HOME',    6.00, 5.00, 1.00),
        ('BUSINESS_STATIC', 'Empresa/Autónomo - Static',  'COMPANY,FREELANCER',  'STATIC',  8.00, 2.00, 1.00),
        ('BUSINESS_REMOTE', 'Empresa/Autónomo - Remote',  'COMPANY,FREELANCER',  'REMOTE', 12.00, 1.00, 1.00)
      ON CONFLICT ("code") DO NOTHING;
    `);

    console.log('✅ cjobs_rate_plans created and seeded');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('↩️  Dropping cjobs_rate_plans');
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_rate_plans" CASCADE`);
  }
}
