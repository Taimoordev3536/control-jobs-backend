import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminReviewFixes20260629 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Support ticket replies ---
    await queryRunner.query(`
      ALTER TABLE "support_tickets"
        ADD COLUMN IF NOT EXISTS "response" text NULL,
        ADD COLUMN IF NOT EXISTS "responded_by_name" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMP WITH TIME ZONE NULL;
    `);

    // --- Admin accounting (Contabilidad) fields from the old application ---
    await queryRunner.query(`
      ALTER TABLE "admin_config"
        ADD COLUMN IF NOT EXISTS "iva_text_particulares_tai" text NULL,
        ADD COLUMN IF NOT EXISTS "iva_text_autonomos_fuera_tai" text NULL,
        ADD COLUMN IF NOT EXISTS "iban" varchar(50) NULL,
        ADD COLUMN IF NOT EXISTS "swift_bic" varchar(50) NULL,
        ADD COLUMN IF NOT EXISTS "paypal" varchar(255) NULL;
    `);

    // --- Admin-managed FAQs (Ayuda) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "faqs" (
        "id" SERIAL PRIMARY KEY,
        "public_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "question" text NOT NULL,
        "answer" text NOT NULL,
        "audience" varchar(20) NOT NULL DEFAULT 'ALL',
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT uq_faqs_public_id UNIQUE ("public_id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "faqs";`);
    await queryRunner.query(`
      ALTER TABLE "admin_config"
        DROP COLUMN IF EXISTS "iva_text_particulares_tai",
        DROP COLUMN IF EXISTS "iva_text_autonomos_fuera_tai",
        DROP COLUMN IF EXISTS "iban",
        DROP COLUMN IF EXISTS "swift_bic",
        DROP COLUMN IF EXISTS "paypal";
    `);
    await queryRunner.query(`
      ALTER TABLE "support_tickets"
        DROP COLUMN IF EXISTS "response",
        DROP COLUMN IF EXISTS "responded_by_name",
        DROP COLUMN IF EXISTS "responded_at";
    `);
  }
}
