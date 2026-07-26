import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-employer / per-job / per-worker attendance rules. Everything is nullable:
 * NULL means inherit from the level above, so a job row that sets one number
 * does not wipe the rest.
 */
export class CreateAttendancePolicy20260726b implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attendance_policy (
        id SERIAL PRIMARY KEY,
        employer_id INTEGER UNIQUE REFERENCES cjobs_empleadores(id) ON DELETE CASCADE,
        job_id INTEGER UNIQUE REFERENCES job(id) ON DELETE CASCADE,
        worker_id INTEGER UNIQUE REFERENCES workers(id) ON DELETE CASCADE,

        extra_hours_allowed BOOLEAN,
        close_after_shift_end_mins INTEGER,
        record_scheduled_end BOOLEAN,
        extra_hours_wait_mins INTEGER,
        notify_worker_after_mins INTEGER,
        notify_employer_after_mins INTEGER,
        free_notify_worker_mins INTEGER,
        free_notify_employer_mins INTEGER,
        free_close_after_mins INTEGER,
        early_checkin_mins INTEGER,
        count_early_checkin BOOLEAN,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT attendance_policy_one_scope CHECK (
          (employer_id IS NOT NULL)::int
          + (job_id IS NOT NULL)::int
          + (worker_id IS NOT NULL)::int = 1
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_attendance_policy_employer ON attendance_policy (employer_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_attendance_policy_job ON attendance_policy (job_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_attendance_policy_worker ON attendance_policy (worker_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS attendance_policy`);
  }
}
