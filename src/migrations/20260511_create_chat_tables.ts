import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatTables20260511 implements MigrationInterface {
  name = 'CreateChatTables20260511';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_conversations" (
        "id"                  bigserial PRIMARY KEY,
        "public_id"           uuid        NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
        "kind"                varchar(20) NOT NULL,
        "created_by_user_id"  int         NULL,
        "last_message_at"     timestamp   NULL,
        "created_at"          timestamp   NOT NULL DEFAULT now(),
        "updated_at"          timestamp   NOT NULL DEFAULT now(),
        CONSTRAINT "fk_chat_conversations_creator"
          FOREIGN KEY ("created_by_user_id") REFERENCES "cjobs_user"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_conversations_last_message"
        ON "chat_conversations"("last_message_at" DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_conversation_participants" (
        "id"                     bigserial PRIMARY KEY,
        "conversation_id"        bigint      NOT NULL,
        "participant_type"       varchar(20) NOT NULL,
        "participant_entity_id"  int         NOT NULL,
        "joined_at"              timestamp   NOT NULL DEFAULT now(),
        CONSTRAINT "fk_chat_participants_conversation"
          FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_chat_participants_unique"
          UNIQUE ("conversation_id", "participant_type", "participant_entity_id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_participants_lookup"
        ON "chat_conversation_participants"("participant_type", "participant_entity_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id"                  bigserial PRIMARY KEY,
        "public_id"           uuid        NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
        "conversation_id"     bigint      NOT NULL,
        "sender_user_id"      int         NOT NULL,
        "sender_entity_type"  varchar(20) NOT NULL,
        "sender_entity_id"    int         NOT NULL,
        "body"                text        NOT NULL,
        "edited_at"           timestamp   NULL,
        "deleted_at"          timestamp   NULL,
        "created_at"          timestamp   NOT NULL DEFAULT now(),
        CONSTRAINT "fk_chat_messages_conversation"
          FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_chat_messages_sender"
          FOREIGN KEY ("sender_user_id") REFERENCES "cjobs_user"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_conversation_created"
        ON "chat_messages"("conversation_id", "created_at" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_messages_body_trgm"
        ON "chat_messages" USING gin ("body" gin_trgm_ops);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_message_reads" (
        "id"         bigserial PRIMARY KEY,
        "message_id" bigint    NOT NULL,
        "user_id"    int       NOT NULL,
        "read_at"    timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "fk_chat_message_reads_message"
          FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_chat_message_reads_user"
          FOREIGN KEY ("user_id") REFERENCES "cjobs_user"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_chat_message_reads_unique"
          UNIQUE ("message_id", "user_id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chat_message_reads_user"
        ON "chat_message_reads"("user_id", "message_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message_reads" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_conversation_participants" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_conversations" CASCADE`);
  }
}
