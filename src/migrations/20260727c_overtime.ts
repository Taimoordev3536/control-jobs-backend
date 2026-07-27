import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Overtime per session, frozen once the session closes.
 *
 * It was only ever derived on the fly from the job's current schedule, so
 * editing a schedule silently rewrote how much overtime last month held.
 * Art. 35.5 ET requires the daily record to distinguish overtime, which means
 * it has to be stored, not recomputed.
 *
 * basis_minutes records the worked total the figure came from, so a later
 * correction to the times is detected and recomputed without every close path
 * having to remember to do it.
 */
export class Overtime20260727c implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE work_sessions
        ADD COLUMN IF NOT EXISTS overtime_minutes INT,
        ADD COLUMN IF NOT EXISTS overtime_basis_minutes INT,
        ADD COLUMN IF NOT EXISTS overtime_status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS overtime_compensation VARCHAR(20)
    `);

    await queryRunner.query(`
      ALTER TABLE work_sessions
        DROP CONSTRAINT IF EXISTS chk_work_sessions_overtime
    `);
    await queryRunner.query(`
      ALTER TABLE work_sessions
        ADD CONSTRAINT chk_work_sessions_overtime CHECK (
          (overtime_minutes IS NULL OR overtime_minutes >= 0)
          AND (overtime_status IS NULL OR overtime_status IN ('PENDING','APPROVED','REJECTED'))
          AND (overtime_compensation IS NULL OR overtime_compensation IN ('PAID','TIME_OFF'))
        )
    `);

    // The approval queue reads pending overtime only, which is a thin slice.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_work_sessions_overtime_pending
        ON work_sessions (worker_id, check_in_time)
        WHERE overtime_status = 'PENDING'
    `);
    // The annual counter sums approved overtime per worker.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_work_sessions_overtime_approved
        ON work_sessions (worker_id, check_in_time)
        WHERE overtime_status = 'APPROVED'
    `);

    // Rules live with the rest of the attendance policy: they come from the
    // convenio colectivo and differ by sector, so none of them is hardcoded.
    await queryRunner.query(`
      ALTER TABLE attendance_policy
        ADD COLUMN IF NOT EXISTS overtime_requires_approval BOOLEAN,
        ADD COLUMN IF NOT EXISTS overtime_annual_cap_hours INTEGER,
        ADD COLUMN IF NOT EXISTS overtime_rate_multiplier NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS overtime_default_compensation VARCHAR(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_work_sessions_overtime_pending`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_work_sessions_overtime_approved`);
    await queryRunner.query(`ALTER TABLE work_sessions DROP CONSTRAINT IF EXISTS chk_work_sessions_overtime`);
    await queryRunner.query(`
      ALTER TABLE work_sessions
        DROP COLUMN IF EXISTS overtime_minutes,
        DROP COLUMN IF EXISTS overtime_basis_minutes,
        DROP COLUMN IF EXISTS overtime_status,
        DROP COLUMN IF EXISTS overtime_compensation
    `);
    await queryRunner.query(`
      ALTER TABLE attendance_policy
        DROP COLUMN IF EXISTS overtime_requires_approval,
        DROP COLUMN IF EXISTS overtime_annual_cap_hours,
        DROP COLUMN IF EXISTS overtime_rate_multiplier,
        DROP COLUMN IF EXISTS overtime_default_compensation
    `);
  }
}
