import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActiveToEmployersPartners20260717 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores"
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
    `);
    await queryRunner.query(`
      ALTER TABLE "cjobs_partners"
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_empleadores" DROP COLUMN IF EXISTS active;
    `);
    await queryRunner.query(`
      ALTER TABLE "cjobs_partners" DROP COLUMN IF EXISTS active;
    `);
  }
}
