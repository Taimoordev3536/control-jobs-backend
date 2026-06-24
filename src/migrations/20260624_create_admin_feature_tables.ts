import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminFeatureTables20260624 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_tickets" (
        "id" SERIAL PRIMARY KEY,
        "public_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_user_id" integer NOT NULL,
        "requester_name" varchar(255) NULL,
        "requester_role" varchar(50) NULL,
        "subject" varchar(200) NULL,
        "message" text NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'OPEN',
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT uq_support_tickets_public_id UNIQUE ("public_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suggestions" (
        "id" SERIAL PRIMARY KEY,
        "public_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_user_id" integer NOT NULL,
        "requester_name" varchar(255) NULL,
        "requester_role" varchar(50) NULL,
        "message" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT uq_suggestions_public_id UNIQUE ("public_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" SERIAL PRIMARY KEY,
        "public_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_user_id" integer NULL,
        "actor_name" varchar(255) NULL,
        "actor_role" varchar(50) NULL,
        "action" varchar(100) NOT NULL,
        "detail" text NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT uq_audit_logs_public_id UNIQUE ("public_id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suggestions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets";`);
  }
}
