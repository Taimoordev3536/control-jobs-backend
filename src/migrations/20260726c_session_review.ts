import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a session be closed without claiming to know the hours.
 *
 * review_status:
 *   NULL                 normal session, nothing owed
 *   NEEDS_CONFIRMATION   auto-closed at the shift's scheduled end; a human
 *                        only has to agree
 *   NEEDS_TIME           auto-closed on a free job, where there is no shift to
 *                        guess from, so the hours are blank until someone
 *                        enters them
 *   CONFIRMED            a human has accepted or corrected it
 *
 * Anything not NULL and not CONFIRMED is excluded from pay and invoices.
 */
export class SessionReview20260726c implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE work_sessions
        ADD COLUMN IF NOT EXISTS review_status VARCHAR(30),
        ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS worker_notified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS employer_notified_at TIMESTAMPTZ
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_work_sessions_review
        ON work_sessions (review_status) WHERE review_status IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_work_sessions_open
        ON work_sessions (check_in_time) WHERE check_out_time IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_work_sessions_review`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_work_sessions_open`);
    await queryRunner.query(`
      ALTER TABLE work_sessions
        DROP COLUMN IF EXISTS review_status,
        DROP COLUMN IF EXISTS auto_closed_at,
        DROP COLUMN IF EXISTS reviewed_by_user_id,
        DROP COLUMN IF EXISTS reviewed_at,
        DROP COLUMN IF EXISTS worker_notified_at,
        DROP COLUMN IF EXISTS employer_notified_at
    `);
  }
}
