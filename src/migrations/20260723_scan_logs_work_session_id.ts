import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Link each scan_log to the work_session it belongs to.
 *
 * Scans only stored job + worker + time, so the record-detail screen guessed
 * "which scans are this session's" from a time window. With back-to-back
 * sessions that share a boundary (e.g. check-out of session A and check-in of
 * session B both at 14:13), the ±60s window pulled both 14:13 scans into BOTH
 * records — so the same check-in/check-out appeared twice.
 *
 * A real foreign key removes the ambiguity: a scan belongs to exactly one
 * session. The backfill assigns existing scans by matching timestamps and
 * scan type (a check-out scan lines up with the session's check_out_time; a
 * check-in/break scan with its check_in_time), picking the closest session so
 * the shared-boundary case resolves correctly.
 */
export class ScanLogsWorkSessionId20260723 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scan_logs"
      ADD COLUMN IF NOT EXISTS work_session_id integer NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_scan_logs_work_session
      ON "scan_logs" (work_session_id);
    `);

    // Best-effort backfill. For each unlinked scan, pick the single closest
    // matching session — by check_out_time for check-out scans, by check_in_time
    // otherwise — within a 5s tolerance (scans are written a few hundred ms off
    // the session timestamp). DISTINCT ON keeps only the closest per scan.
    await queryRunner.query(`
      UPDATE scan_logs s
      SET work_session_id = m.session_id
      FROM (
        SELECT DISTINCT ON (sl.id) sl.id AS scan_id, ws.id AS session_id
        FROM scan_logs sl
        JOIN work_sessions ws
          ON ws.job_id = sl.job_id
         AND ws.worker_id = sl.worker_id
         AND (
           (sl."scanType" = 'check-out'
              AND ws.check_out_time IS NOT NULL
              AND ABS(EXTRACT(EPOCH FROM (sl.scan_time - ws.check_out_time))) <= 5)
           OR
           (sl."scanType" <> 'check-out'
              AND sl.scan_time >= ws.check_in_time - INTERVAL '5 seconds'
              AND (ws.check_out_time IS NULL
                   OR sl.scan_time <= ws.check_out_time + INTERVAL '5 seconds'))
         )
        WHERE sl.work_session_id IS NULL
        ORDER BY sl.id,
          CASE WHEN sl."scanType" = 'check-out'
               THEN ABS(EXTRACT(EPOCH FROM (sl.scan_time - ws.check_out_time)))
               ELSE ABS(EXTRACT(EPOCH FROM (sl.scan_time - ws.check_in_time)))
          END ASC
      ) m
      WHERE s.id = m.scan_id
        AND s.work_session_id IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_scan_logs_work_session;`);
    await queryRunner.query(`ALTER TABLE "scan_logs" DROP COLUMN IF EXISTS work_session_id;`);
  }
}
