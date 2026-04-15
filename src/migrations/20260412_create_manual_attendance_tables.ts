import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateManualAttendanceTables20260412 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create manual_attendance_requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS manual_attendance_requests (
        id SERIAL PRIMARY KEY,
        public_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
        job_id INTEGER NOT NULL REFERENCES job(id) ON DELETE CASCADE,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        work_center_id INTEGER REFERENCES work_center(id) ON DELETE SET NULL,
        request_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        requested_date DATE NOT NULL,
        requested_check_in TIMESTAMPTZ,
        requested_check_out TIMESTAMPTZ,
        existing_work_session_id INTEGER REFERENCES work_sessions(id) ON DELETE SET NULL,
        original_check_in TIMESTAMPTZ,
        original_check_out TIMESTAMPTZ,
        reason TEXT,
        worker_notes TEXT,
        requested_by_user_id INTEGER NOT NULL REFERENCES cjobs_user(id),
        requested_by_role VARCHAR(20) NOT NULL,
        reviewed_by_user_id INTEGER REFERENCES cjobs_user(id),
        reviewed_by_role VARCHAR(20),
        reviewed_at TIMESTAMPTZ,
        reviewer_notes TEXT,
        result_work_session_id INTEGER REFERENCES work_sessions(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mar_job_id ON manual_attendance_requests(job_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mar_worker_id ON manual_attendance_requests(worker_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mar_status ON manual_attendance_requests(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mar_public_id ON manual_attendance_requests(public_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mar_requested_date ON manual_attendance_requests(requested_date);`);

    // 2. Create manual_attendance_permissions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS manual_attendance_permissions (
        id SERIAL PRIMARY KEY,
        job_id INTEGER UNIQUE REFERENCES job(id) ON DELETE CASCADE,
        client_id INTEGER UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
        employer_id INTEGER UNIQUE REFERENCES cjobs_empleadores(id) ON DELETE CASCADE,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        worker_can_request BOOLEAN NOT NULL DEFAULT TRUE,
        employer_can_create BOOLEAN NOT NULL DEFAULT TRUE,
        client_can_create BOOLEAN NOT NULL DEFAULT FALSE,
        max_retroactive_days INTEGER NOT NULL DEFAULT 7,
        max_requests_per_worker_month INTEGER NOT NULL DEFAULT 10,
        require_reason BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Add source column to work_sessions
    await queryRunner.query(`
      ALTER TABLE work_sessions
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'SCAN';
    `);

    // 4. Add source column to scan_logs
    await queryRunner.query(`
      ALTER TABLE scan_logs
      ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'SCAN';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE scan_logs DROP COLUMN IF EXISTS source;`);
    await queryRunner.query(`ALTER TABLE work_sessions DROP COLUMN IF EXISTS source;`);
    await queryRunner.query(`DROP TABLE IF EXISTS manual_attendance_permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS manual_attendance_requests;`);
  }
}
