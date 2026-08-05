import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives the Web method the same work-centre switch QR, GPS and IP already had.
 *
 * The agreed rule is that the real restriction lives at the work centre, but
 * Web had no column, no endpoint and no gate — so a web check-in succeeded
 * unconditionally however the other three were locked down.
 *
 * Defaults to true so nothing changes for existing sites until someone turns
 * it off.
 */
export class WebMethodSwitch20260805 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE work_center
        ADD COLUMN IF NOT EXISTS is_web_active BOOLEAN NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_center DROP COLUMN IF EXISTS is_web_active`);
  }
}
