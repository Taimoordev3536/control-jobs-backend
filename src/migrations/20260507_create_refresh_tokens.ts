import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokens20260507 implements MigrationInterface {
  name = 'CreateRefreshTokens20260507';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_refresh_tokens" (
        "id"                       serial PRIMARY KEY,
        "user_id"                  int            NOT NULL,
        "token_hash"               varchar(64)    NOT NULL UNIQUE,
        "expires_at"               timestamp      NOT NULL,
        "revoked_at"               timestamp      NULL,
        "replaced_by_token_hash"   varchar(64)    NULL,
        "device_info"              varchar(500)   NULL,
        "ip_address"               varchar(64)    NULL,
        "last_used_at"             timestamp      NULL,
        "created_at"               timestamp      NOT NULL DEFAULT now(),
        CONSTRAINT "fk_refresh_tokens_user"
          FOREIGN KEY ("user_id") REFERENCES "cjobs_user"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user"      ON "cjobs_refresh_tokens"("user_id");
      CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_expires"   ON "cjobs_refresh_tokens"("expires_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_refresh_tokens" CASCADE`);
  }
}
