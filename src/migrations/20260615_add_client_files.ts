import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientFiles20260615 implements MigrationInterface {
  name = 'AddClientFiles20260615';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_client_files" (
        "id"                 BIGSERIAL PRIMARY KEY,
        "public_id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_id"          BIGINT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "file_name"          varchar(255) NOT NULL,
        "url"                text NOT NULL,
        "storage_public_id"  varchar(500) NOT NULL,
        "resource_type"      varchar(20) NOT NULL DEFAULT 'raw',
        "mime_type"          varchar(150) NULL,
        "size_bytes"         bigint NULL,
        "description"        varchar(255) NULL,
        "uploaded_by_user_id" integer NULL,
        "created_at"         timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_client_files_public_id" ON "cjobs_client_files"("public_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_client_files_client" ON "cjobs_client_files"("client_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_client_files";`);
  }
}
