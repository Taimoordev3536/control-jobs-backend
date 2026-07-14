import { MigrationInterface, QueryRunner } from 'typeorm';

export class SurveyForms20260714c implements MigrationInterface {
  name = 'SurveyForms20260714c';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_survey_forms" (
        "id" SERIAL PRIMARY KEY,
        "public_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employer_id" integer NOT NULL,
        "title" varchar(200) NOT NULL,
        "description" text,
        "audience" varchar(20) NOT NULL,
        "anonymous" boolean NOT NULL DEFAULT false,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "start_date" date,
        "end_date" date,
        "retention_days" integer,
        "created_by_user_id" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_survey_forms_public_id" UNIQUE ("public_id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_survey_forms_employer" ON "cjobs_survey_forms" ("employer_id");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_survey_form_questions" (
        "id" SERIAL PRIMARY KEY,
        "public_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "form_id" integer NOT NULL,
        "order_index" integer NOT NULL DEFAULT 0,
        "text" varchar(500) NOT NULL,
        "type" varchar(20) NOT NULL,
        "required" boolean NOT NULL DEFAULT true,
        "options" jsonb,
        CONSTRAINT "uq_survey_q_public_id" UNIQUE ("public_id"),
        CONSTRAINT "fk_survey_q_form" FOREIGN KEY ("form_id") REFERENCES "cjobs_survey_forms"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_survey_q_form" ON "cjobs_survey_form_questions" ("form_id");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_survey_form_responses" (
        "id" SERIAL PRIMARY KEY,
        "public_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "form_id" integer NOT NULL,
        "respondent_user_id" integer,
        "respondent_role" varchar(20) NOT NULL,
        "submitted_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_survey_resp_public_id" UNIQUE ("public_id"),
        CONSTRAINT "fk_survey_resp_form" FOREIGN KEY ("form_id") REFERENCES "cjobs_survey_forms"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_survey_resp_form" ON "cjobs_survey_form_responses" ("form_id");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_survey_form_answers" (
        "id" SERIAL PRIMARY KEY,
        "response_id" integer NOT NULL,
        "question_id" integer NOT NULL,
        "question_text" text NOT NULL,
        "question_type" varchar(20) NOT NULL,
        "value_number" integer,
        "value_bool" boolean,
        "value_text" text,
        "value_choices" jsonb,
        CONSTRAINT "fk_survey_ans_resp" FOREIGN KEY ("response_id") REFERENCES "cjobs_survey_form_responses"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_survey_ans_resp" ON "cjobs_survey_form_answers" ("response_id");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_survey_form_submissions" (
        "id" SERIAL PRIMARY KEY,
        "form_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "submitted_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_survey_submission" UNIQUE ("form_id", "user_id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_survey_sub_form" ON "cjobs_survey_form_submissions" ("form_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_survey_sub_user" ON "cjobs_survey_form_submissions" ("user_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_survey_form_submissions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_survey_form_answers";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_survey_form_responses";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_survey_form_questions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_survey_forms";`);
  }
}
