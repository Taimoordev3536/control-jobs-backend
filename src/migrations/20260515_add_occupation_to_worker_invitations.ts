import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOccupationToWorkerInvitations20260515
  implements MigrationInterface
{
  name = 'AddOccupationToWorkerInvitations20260515';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_worker_invitations"
      ADD COLUMN IF NOT EXISTS "occupation" varchar(120) NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_worker_invitations"
      DROP COLUMN IF EXISTS "occupation"
    `);
  }
}
