import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressComponentsToWorkCenter20260130 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new address component columns to work_center table
    await queryRunner.query(`
      ALTER TABLE work_center 
      ADD COLUMN IF NOT EXISTS street VARCHAR(100),
      ADD COLUMN IF NOT EXISTS street_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS floor VARCHAR(50),
      ADD COLUMN IF NOT EXISTS locality VARCHAR(100),
      ADD COLUMN IF NOT EXISTS province VARCHAR(100),
      ADD COLUMN IF NOT EXISTS country VARCHAR(100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the address component columns
    await queryRunner.query(`
      ALTER TABLE work_center 
      DROP COLUMN IF EXISTS street,
      DROP COLUMN IF EXISTS street_number,
      DROP COLUMN IF EXISTS floor,
      DROP COLUMN IF EXISTS locality,
      DROP COLUMN IF EXISTS province,
      DROP COLUMN IF EXISTS country;
    `);
  }
}
