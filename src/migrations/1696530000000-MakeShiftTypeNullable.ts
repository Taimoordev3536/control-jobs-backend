import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeShiftTypeNullable1696530000000 implements MigrationInterface {
  name = 'MakeShiftTypeNullable1696530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shift" ALTER COLUMN "shiftType" DROP NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shift" ALTER COLUMN "shiftType" SET NOT NULL;`);
  }
}
