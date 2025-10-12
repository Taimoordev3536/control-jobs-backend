import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateJobWorkCenters1765760000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Create join table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS job_work_centers (
        job_id integer NOT NULL,
        work_center_id integer NOT NULL,
        CONSTRAINT pk_job_work_centers PRIMARY KEY (job_id, work_center_id)
      );
    `);

    // 2) Copy existing single-column values into the join table (if any)
    // Use quoted column name because older dumps use "workCenterId" with camelCase
    await queryRunner.query(`
      INSERT INTO job_work_centers (job_id, work_center_id)
      SELECT id, "workCenterId"
      FROM "job"
      WHERE "workCenterId" IS NOT NULL;
    `);

    // 3) Add foreign key constraints to keep referential integrity
    // Only add constraints if they don't already exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS(
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_jwc_job'
        ) THEN
          ALTER TABLE job_work_centers
            ADD CONSTRAINT fk_jwc_job FOREIGN KEY (job_id) REFERENCES "job"(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS(
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_jwc_work_center'
        ) THEN
          ALTER TABLE job_work_centers
            ADD CONSTRAINT fk_jwc_work_center FOREIGN KEY (work_center_id) REFERENCES work_center(id) ON DELETE CASCADE;
        END IF;
      END$$;
    `);

    // Note: we intentionally DO NOT DROP the legacy "workCenterId" column here to keep a safe, backwards-compatible migration.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore single-column values from join table (pick the smallest work_center_id if multiple)
    await queryRunner.query(`
      ALTER TABLE "job" ADD COLUMN IF NOT EXISTS "workCenterId" integer;
    `);

    await queryRunner.query(`
      UPDATE "job" j
      SET "workCenterId" = sub.work_center_id
      FROM (
        SELECT job_id, MIN(work_center_id) AS work_center_id
        FROM job_work_centers
        GROUP BY job_id
      ) sub
      WHERE j.id = sub.job_id;
    `);

    // Drop constraints then drop join table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'fk_jwc_job') THEN
          ALTER TABLE job_work_centers DROP CONSTRAINT fk_jwc_job;
        END IF;
        IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'fk_jwc_work_center') THEN
          ALTER TABLE job_work_centers DROP CONSTRAINT fk_jwc_work_center;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS job_work_centers;
    `);
  }
}
