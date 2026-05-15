import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNameAndImageToChatConversations20260513 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_conversations
      ADD COLUMN IF NOT EXISTS name             VARCHAR(120),
      ADD COLUMN IF NOT EXISTS image_public_id  VARCHAR(255),
      ADD COLUMN IF NOT EXISTS image_url        VARCHAR(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_conversations
      DROP COLUMN IF EXISTS name,
      DROP COLUMN IF EXISTS image_public_id,
      DROP COLUMN IF EXISTS image_url;
    `);
  }
}
