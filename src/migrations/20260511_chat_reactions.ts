import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatReactions20260511 implements MigrationInterface {
  name = 'ChatReactions20260511';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
        "id"          bigserial PRIMARY KEY,
        "message_id"  bigint      NOT NULL,
        "user_id"     int         NOT NULL,
        "emoji"       varchar(16) NOT NULL,
        "created_at"  timestamp   NOT NULL DEFAULT now(),
        CONSTRAINT "fk_chat_message_reactions_message"
          FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_chat_message_reactions_user"
          FOREIGN KEY ("user_id") REFERENCES "cjobs_user"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_chat_message_reactions_unique"
          UNIQUE ("message_id", "user_id", "emoji")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_message_reactions_message"
        ON "chat_message_reactions"("message_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message_reactions" CASCADE`);
  }
}
