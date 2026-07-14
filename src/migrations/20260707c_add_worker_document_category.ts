import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Category for worker documents so the worker "Documentos" screen can split
 * them into the Justificantes and Otros tabs. Existing rows default to 'otros'.
 */
export class AddWorkerDocumentCategory20260707 implements MigrationInterface {
  name = 'AddWorkerDocumentCategory20260707';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_worker_documents"
        ADD COLUMN IF NOT EXISTS "category" varchar(20) NOT NULL DEFAULT 'otros';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cjobs_worker_documents" DROP COLUMN IF EXISTS "category";
    `);
  }
}
