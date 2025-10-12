import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillJobWorkCenterId1765770000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // For jobs that have entries in the join table but a NULL legacy column, backfill the legacy column
    await queryRunner.query(`
      UPDATE "job" j
      SET "workCenterId" = sub.work_center_id
      FROM (
        SELECT job_id, MIN(work_center_id) AS work_center_id
        FROM job_work_centers
        GROUP BY job_id
      ) sub
      WHERE j.id = sub.job_id AND j."workCenterId" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert by nulling out the legacy column for jobs that have entries in the join table
    await queryRunner.query(`
      UPDATE "job" j
      SET "workCenterId" = NULL
      WHERE EXISTS (
        SELECT 1 FROM job_work_centers jwc WHERE jwc.job_id = j.id
      );
    `);
  }
}
