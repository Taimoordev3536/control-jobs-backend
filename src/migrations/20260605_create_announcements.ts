import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnouncements20260605 implements MigrationInterface {
  name = 'CreateAnnouncements20260605';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_announcements" (
        "id"              bigserial    PRIMARY KEY,
        "public_id"       uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "sender_user_id"  integer      NOT NULL,
        "sender_role"     varchar(20)  NOT NULL,
        "segments"        jsonb        NOT NULL,
        "subject"         varchar(255) NOT NULL,
        "body"            text         NOT NULL,
        "severity"        varchar(20)  NOT NULL DEFAULT 'INFO',
        "scheduled_at"    timestamp    NULL,
        "status"          varchar(20)  NOT NULL DEFAULT 'SENT',
        "sent_at"         timestamp    NULL,
        "recipient_count" integer      NULL,
        "created_at"      timestamp    NOT NULL DEFAULT now(),
        CONSTRAINT "uq_announcements_public_id" UNIQUE ("public_id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_announcements_due"
        ON "cjobs_announcements"("scheduled_at")
        WHERE "status" = 'SCHEDULED';
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_announcements_sender"
        ON "cjobs_announcements"("sender_user_id", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_announcements";`);
  }
}
