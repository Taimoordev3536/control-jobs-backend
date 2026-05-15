import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTypeToClientInvitations20260515
  implements MigrationInterface
{
  name = 'AddTypeToClientInvitations20260515';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_client_invitations"
      ADD COLUMN IF NOT EXISTS "type" varchar(20) NOT NULL DEFAULT 'company'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_client_invitations"
      DROP COLUMN IF EXISTS "type"
    `);
  }
}
