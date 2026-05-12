import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatAttachments20260512 implements MigrationInterface {
  name = 'ChatAttachments20260512';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_messages" ALTER COLUMN "body" DROP NOT NULL`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_message_attachments" (
        "id"             bigserial PRIMARY KEY,
        "public_id"      uuid        NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
        "message_id"     bigint      NOT NULL,
        "kind"           varchar(20) NOT NULL,
        "url"            text        NOT NULL,
        "cloudinary_id"  varchar(255) NOT NULL,
        "mime_type"      varchar(80) NULL,
        "size_bytes"     int         NULL,
        "width"          int         NULL,
        "height"         int         NULL,
        "original_name"  varchar(255) NULL,
        "position"       smallint    NOT NULL DEFAULT 0,
        "created_at"     timestamp   NOT NULL DEFAULT now(),
        CONSTRAINT "fk_chat_message_attachments_message"
          FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_message_attachments_msg"
        ON "chat_message_attachments"("message_id", "position");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message_attachments" CASCADE`);
  }
}
