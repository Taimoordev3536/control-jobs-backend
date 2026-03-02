import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameLocalityToCity20260302 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients RENAME COLUMN locality TO city;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients RENAME COLUMN city TO locality;
    `);
  }
}
