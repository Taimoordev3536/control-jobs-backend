import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropDeadEmployerFeeColumn20260518 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores"
      DROP COLUMN IF EXISTS "fee";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores"
      ADD COLUMN "fee" numeric(5,2) NOT NULL DEFAULT 0;
    `);
  }
}
