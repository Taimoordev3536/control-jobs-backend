import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsBannerDismissed20260605 implements MigrationInterface {
  name = 'NotificationsBannerDismissed20260605';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "banner_dismissed" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP COLUMN IF EXISTS "banner_dismissed";
    `);
  }
}
