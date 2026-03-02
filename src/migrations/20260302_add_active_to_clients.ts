import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveToClients20260302 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients 
      DROP COLUMN IF EXISTS active;
    `);
  }
}
