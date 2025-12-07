import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeToSurveyJob20251207 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, clean up orphaned survey records (surveys with jobId that don't exist)
        await queryRunner.query(`
            DELETE FROM "survey" 
            WHERE "jobId" IS NOT NULL 
            AND "jobId" NOT IN (SELECT id FROM "job");
        `);

        // Drop the existing foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "survey" 
            DROP CONSTRAINT IF EXISTS "FK_survey_job";
        `);

        // Add the foreign key constraint with CASCADE delete
        await queryRunner.query(`
            ALTER TABLE "survey" 
            ADD CONSTRAINT "FK_survey_job" 
            FOREIGN KEY ("jobId") 
            REFERENCES "job"("id") 
            ON DELETE CASCADE;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the CASCADE constraint
        await queryRunner.query(`
            ALTER TABLE "survey" 
            DROP CONSTRAINT IF EXISTS "FK_survey_job";
        `);

        // Add back the constraint without CASCADE
        await queryRunner.query(`
            ALTER TABLE "survey" 
            ADD CONSTRAINT "FK_survey_job" 
            FOREIGN KEY ("jobId") 
            REFERENCES "job"("id");
        `);
    }
}
