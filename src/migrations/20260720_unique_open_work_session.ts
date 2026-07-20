import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One open session per (job, worker), enforced by the database.
 *
 * The application checked for an existing open session before inserting, but
 * two concurrent check-ins could both read "none" before either wrote, opening
 * two sessions and double-counting the worker's hours. A partial unique index
 * closes that window: the second insert fails at write time, whatever the
 * timing. Closed sessions (check_out_time NOT NULL) are unaffected, so a worker
 * can still check in again on later days.
 */
export class UniqueOpenWorkSession20260720 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_work_sessions_open_per_job_worker
      ON "work_sessions" (job_id, worker_id)
      WHERE check_out_time IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_work_sessions_open_per_job_worker;
    `);
  }
}
