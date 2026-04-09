import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSummerPeriodToClients20260409 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS summer_start_date character varying;
    `);
    await queryRunner.query(`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS summer_end_date character varying;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients
      DROP COLUMN IF EXISTS summer_end_date;
    `);
    await queryRunner.query(`
      ALTER TABLE clients
      DROP COLUMN IF EXISTS summer_start_date;
    `);
  }
}
