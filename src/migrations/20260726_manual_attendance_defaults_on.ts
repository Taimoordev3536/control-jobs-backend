import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * manual_attendance_permissions defaulted is_enabled and client_can_create to
 * FALSE, while the service treats "no row at all" as fully enabled. The two
 * disagreed, so the first row ever written for a company — even one saving an
 * unrelated field like max_retroactive_days — switched manual attendance off
 * for every one of its jobs.
 *
 * The column defaults now match the service. Existing rows are deliberately
 * left alone: a row that says false may be a real decision, and this migration
 * must not silently re-enable a feature someone chose to turn off.
 */
export class ManualAttendanceDefaultsOn20260726 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE manual_attendance_permissions
        ALTER COLUMN is_enabled SET DEFAULT TRUE
    `);
    await queryRunner.query(`
      ALTER TABLE manual_attendance_permissions
        ALTER COLUMN client_can_create SET DEFAULT TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE manual_attendance_permissions
        ALTER COLUMN is_enabled SET DEFAULT FALSE
    `);
    await queryRunner.query(`
      ALTER TABLE manual_attendance_permissions
        ALTER COLUMN client_can_create SET DEFAULT FALSE
    `);
  }
}
