import { MigrationInterface, QueryRunner } from 'typeorm';

export class PendingRateChanges20260507 implements MigrationInterface {
  name = 'PendingRateChanges20260507';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_rate_plans"
        ADD COLUMN IF NOT EXISTS "pending_monthly_fixed"  numeric(8,2)  NULL,
        ADD COLUMN IF NOT EXISTS "pending_per_workcenter" numeric(8,2)  NULL,
        ADD COLUMN IF NOT EXISTS "pending_per_worker"     numeric(8,2)  NULL,
        ADD COLUMN IF NOT EXISTS "pending_effective_at"   timestamp     NULL,
        ADD COLUMN IF NOT EXISTS "pending_notified_at"    timestamp     NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_rate_plans_pending_effective"
        ON "cjobs_rate_plans"("pending_effective_at")
        WHERE "pending_effective_at" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_rate_plans"
        DROP COLUMN IF EXISTS "pending_monthly_fixed",
        DROP COLUMN IF EXISTS "pending_per_workcenter",
        DROP COLUMN IF EXISTS "pending_per_worker",
        DROP COLUMN IF EXISTS "pending_effective_at",
        DROP COLUMN IF EXISTS "pending_notified_at";
    `);
  }
}
