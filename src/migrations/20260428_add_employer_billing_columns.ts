import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — Billing roadmap.
 * Adds the rate-snapshot + trial columns to `employers`. After this, every
 * employer carries the 3 rates they agreed to at signup so future price
 * changes don't retroactively affect existing customers.
 *
 * For pre-existing rows, we backfill rates from the matching rate plan.
 * Rows that don't match any plan keep zero rates and ACTIVE status.
 */
export class AddEmployerBillingColumns20260428 implements MigrationInterface {
  name = 'AddEmployerBillingColumns20260428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Adding billing snapshot columns to employers');

    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores"
        ADD COLUMN IF NOT EXISTS "rate_plan_id"        int           NULL,
        ADD COLUMN IF NOT EXISTS "monthly_fixed_rate"  numeric(8,2)  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "per_workcenter_rate" numeric(8,2)  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "per_worker_rate"     numeric(8,2)  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "trial_ends_at"       timestamp     NULL,
        ADD COLUMN IF NOT EXISTS "billing_status"      varchar(20)   NOT NULL DEFAULT 'ACTIVE';
    `);

    // FK to rate plans (only if cjobs_rate_plans exists at this point — it will, given migration order)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_employers_rate_plan'
        ) THEN
          ALTER TABLE "cjobs_empleadores"
            ADD CONSTRAINT "fk_employers_rate_plan"
            FOREIGN KEY ("rate_plan_id") REFERENCES "cjobs_rate_plans"("id");
        END IF;
      END$$;
    `);

    console.log('🔁 Backfilling existing employers with snapshot rates');

    // Match each existing employer to a rate plan based on its
    // current type (HOME/STATIC/REMOTE) and subType (INDIVIDUAL/COMPANY/FREELANCER).
    // The names live in lookup tables (employerTypes.name, employerSubTypes.name).
    await queryRunner.query(`
      UPDATE "cjobs_empleadores" e
      SET
        "rate_plan_id"        = rp.id,
        "monthly_fixed_rate"  = rp.monthly_fixed,
        "per_workcenter_rate" = rp.per_workcenter,
        "per_worker_rate"     = rp.per_worker
      FROM "cjobs_rate_plans" rp
      JOIN "employerTypes"    et ON et.name::text = rp.tariff_type
      JOIN "employerSubTypes" est ON position(est.name::text in rp.sub_types) > 0
      WHERE e."typeId"    = et.id
        AND e."subTypeId" = est.id
        AND rp.is_active  = true;
    `);

    console.log('✅ Employer billing columns added and backfilled');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('↩️  Removing employer billing columns');
    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores"
        DROP CONSTRAINT IF EXISTS "fk_employers_rate_plan",
        DROP COLUMN IF EXISTS "rate_plan_id",
        DROP COLUMN IF EXISTS "monthly_fixed_rate",
        DROP COLUMN IF EXISTS "per_workcenter_rate",
        DROP COLUMN IF EXISTS "per_worker_rate",
        DROP COLUMN IF EXISTS "trial_ends_at",
        DROP COLUMN IF EXISTS "billing_status";
    `);
  }
}
