import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressComponentsToPartners20260305 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add address component columns to cjobs_partners table
    await queryRunner.query(`
      ALTER TABLE cjobs_partners 
      ADD COLUMN IF NOT EXISTS street VARCHAR(100),
      ADD COLUMN IF NOT EXISTS street_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS floor_door VARCHAR(50),
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS province VARCHAR(100),
      ADD COLUMN IF NOT EXISTS country VARCHAR(100),
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove address component columns from cjobs_partners table
    await queryRunner.query(`
      ALTER TABLE cjobs_partners 
      DROP COLUMN IF EXISTS street,
      DROP COLUMN IF EXISTS street_number,
      DROP COLUMN IF EXISTS floor_door,
      DROP COLUMN IF EXISTS postal_code,
      DROP COLUMN IF EXISTS city,
      DROP COLUMN IF EXISTS province,
      DROP COLUMN IF EXISTS country,
      DROP COLUMN IF EXISTS latitude,
      DROP COLUMN IF EXISTS longitude;
    `);
  }
}
