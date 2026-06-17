import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsIsRead20260616 implements MigrationInterface {
  name = 'NotificationsIsRead20260616';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "is_read" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP COLUMN IF EXISTS "is_read";
    `);
  }
}
