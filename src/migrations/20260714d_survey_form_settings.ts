import { MigrationInterface, QueryRunner } from 'typeorm';

export class SurveyFormSettings20260714d implements MigrationInterface {
  name = 'SurveyFormSettings20260714d';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cjobs_survey_form_settings" (
        "id" SERIAL PRIMARY KEY,
        "employer_id" integer NOT NULL,
        "retention_days" integer,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_survey_settings_employer" UNIQUE ("employer_id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_survey_settings_employer" ON "cjobs_survey_form_settings" ("employer_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_survey_form_settings";`);
  }
}
