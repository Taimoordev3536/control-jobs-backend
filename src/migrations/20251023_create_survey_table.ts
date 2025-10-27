import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSurveyTable20251023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "survey" (
        "id" SERIAL PRIMARY KEY,
        "jobId" integer NULL,
        "employerId" integer NOT NULL,
        "clientId" integer NULL,
        "workerId" integer NULL,
        "questionText" varchar(500) NULL,
        "rateDigit" integer NULL,
        "textAlertTracking" text NULL,
        "greetingText" text NULL,
        "periodicity" varchar(20) NULL,
        "startDate" date NULL,
        "endDate" date NULL,
        "interval" integer NULL,
        "monthlyDays" text NULL,
        "monthlyWeekdays" text NULL,
        "monthlyStartWeekday" integer NULL,
        "monthlyEndWeekday" integer NULL,
        "sendTime" time NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Add optional foreign key constraints if the referenced tables exist
    await queryRunner.query(`ALTER TABLE "survey" ADD CONSTRAINT IF NOT EXISTS fk_survey_job FOREIGN KEY ("jobId") REFERENCES "job"(id) ON DELETE SET NULL;`).catch(() => {});
    await queryRunner.query(`ALTER TABLE "survey" ADD CONSTRAINT IF NOT EXISTS fk_survey_employer FOREIGN KEY ("employerId") REFERENCES "employer"(id) ON DELETE CASCADE;`).catch(() => {});
    await queryRunner.query(`ALTER TABLE "survey" ADD CONSTRAINT IF NOT EXISTS fk_survey_client FOREIGN KEY ("clientId") REFERENCES "client"(id) ON DELETE SET NULL;`).catch(() => {});
    await queryRunner.query(`ALTER TABLE "survey" ADD CONSTRAINT IF NOT EXISTS fk_survey_worker FOREIGN KEY ("workerId") REFERENCES "worker"(id) ON DELETE SET NULL;`).catch(() => {});
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "survey";`);
  }
}
