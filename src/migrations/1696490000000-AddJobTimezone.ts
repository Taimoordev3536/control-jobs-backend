import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobTimezone1696490000000 implements MigrationInterface {
  name = 'AddJobTimezone1696490000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job" ADD COLUMN IF NOT EXISTS "timezone" varchar(64);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN IF EXISTS "timezone";`);
  }
}
