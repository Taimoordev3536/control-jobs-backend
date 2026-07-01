import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackupTables20260630 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "backups" (
        "id" SERIAL PRIMARY KEY,
        "public_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "filename" varchar(255) NOT NULL,
        "provider" varchar(30) NOT NULL DEFAULT 'LOCAL',
        "ref" text NULL,
        "size_bytes" bigint NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'SUCCESS',
        "error" text NULL,
        "triggered_by" varchar(255) NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT uq_backups_public_id UNIQUE ("public_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "backup_settings" (
        "id" SERIAL PRIMARY KEY,
        "enabled" boolean NOT NULL DEFAULT false,
        "interval_hours" integer NOT NULL DEFAULT 24,
        "provider" varchar(30) NOT NULL DEFAULT 'LOCAL',
        "keep_last" integer NOT NULL DEFAULT 7,
        "local_path" text NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cloud_connections" (
        "id" SERIAL PRIMARY KEY,
        "provider" varchar(30) NOT NULL,
        "refresh_token" text NOT NULL,
        "account_email" varchar(255) NULL,
        "folder_id" text NULL,
        "connected_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT uq_cloud_connections_provider UNIQUE ("provider")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cloud_connections";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "backup_settings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "backups";`);
  }
}
