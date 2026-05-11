import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatReplyPin20260511 implements MigrationInterface {
  name = 'ChatReplyPin20260511';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        ADD COLUMN IF NOT EXISTS "replied_to_message_id" bigint NULL,
        ADD COLUMN IF NOT EXISTS "pinned_at" timestamp NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        ADD CONSTRAINT "fk_chat_messages_replied_to"
        FOREIGN KEY ("replied_to_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL
    `).catch(() => undefined);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_pinned"
        ON "chat_messages"("conversation_id", "pinned_at") WHERE "pinned_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_chat_messages_pinned"`);
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        DROP CONSTRAINT IF EXISTS "fk_chat_messages_replied_to",
        DROP COLUMN IF EXISTS "replied_to_message_id",
        DROP COLUMN IF EXISTS "pinned_at"
    `);
  }
}
