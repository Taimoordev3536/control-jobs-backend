import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeClientWorkCenterNullableAddObservation1694770000000 implements MigrationInterface {
  name = 'MakeClientWorkCenterNullableAddObservation1694770000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Depending on your DB naming conventions adjust column/table names if necessary
    // Make clientId and workCenterId nullable
    await queryRunner.query(`ALTER TABLE "job" ALTER COLUMN "clientId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "job" ALTER COLUMN "workCenterId" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the migration: set columns NOT NULL
    // Note: setting NOT NULL back requires that no NULLs exist; handle data cleanup before running down
    await queryRunner.query(`ALTER TABLE "job" ALTER COLUMN "workCenterId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "job" ALTER COLUMN "clientId" SET NOT NULL`);
  }
}
