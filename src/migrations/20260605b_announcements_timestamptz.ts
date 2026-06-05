import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnnouncementsTimestamptz20260605 implements MigrationInterface {
  name = 'AnnouncementsTimestamptz20260605';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_announcements"
        ALTER COLUMN "scheduled_at" TYPE timestamptz USING "scheduled_at" AT TIME ZONE 'UTC',
        ALTER COLUMN "sent_at"      TYPE timestamptz USING "sent_at" AT TIME ZONE 'UTC';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_announcements"
        ALTER COLUMN "scheduled_at" TYPE timestamp USING "scheduled_at" AT TIME ZONE 'UTC',
        ALTER COLUMN "sent_at"      TYPE timestamp USING "sent_at" AT TIME ZONE 'UTC';
    `);
  }
}
