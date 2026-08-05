import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Days on an absence, and the yearly allowance to measure them against.
 *
 * Nothing counted days at all, so an approved request told nobody how much of
 * the year it used. days_count is stored rather than derived: the public
 * holiday calendar can change later, and last year's holiday must not move
 * with it.
 */
export class VacationBalance20260805b implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE cjobs_absence_requests
        ADD COLUMN IF NOT EXISTS days_count NUMERIC(5,1)
    `);

    // Alongside the other inherited rules: company default, worker override.
    await queryRunner.query(`
      ALTER TABLE attendance_policy
        ADD COLUMN IF NOT EXISTS vacation_days_per_year INTEGER,
        ADD COLUMN IF NOT EXISTS vacation_count_mode VARCHAR(20)
    `);

    // The balance sums approved vacation per worker per year.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_absence_worker_year
        ON cjobs_absence_requests (worker_id, start_date)
        WHERE status = 'approved'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_absence_worker_year`);
    await queryRunner.query(`ALTER TABLE cjobs_absence_requests DROP COLUMN IF EXISTS days_count`);
    await queryRunner.query(`
      ALTER TABLE attendance_policy
        DROP COLUMN IF EXISTS vacation_days_per_year,
        DROP COLUMN IF EXISTS vacation_count_mode
    `);
  }
}
