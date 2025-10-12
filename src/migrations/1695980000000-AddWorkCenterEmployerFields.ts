import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkCenterEmployerFields1695980000000 implements MigrationInterface {
  name = 'AddWorkCenterEmployerFields1695980000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns if they don't exist
    await queryRunner.query(`ALTER TABLE "work_center" ADD COLUMN IF NOT EXISTS "landline" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "work_center" ADD COLUMN IF NOT EXISTS "postal_code" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "work_center" ADD COLUMN IF NOT EXISTS "employer_id" integer`);

    // Make client_id nullable
    await queryRunner.query(`ALTER TABLE "work_center" ALTER COLUMN "client_id" DROP NOT NULL`);

    // Add foreign key to employers table (cjobs_empleadores) if not exists
    await queryRunner.query(`DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_center_employer') THEN\n    EXECUTE 'ALTER TABLE "work_center" ADD CONSTRAINT "fk_work_center_employer" FOREIGN KEY ("employer_id") REFERENCES "cjobs_empleadores"("id") ON DELETE SET NULL';\n  END IF;\nEND\n$$;`);

    // Optional: add FK to clients table if not present
    await queryRunner.query(`DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_center_client') THEN\n    EXECUTE 'ALTER TABLE "work_center" ADD CONSTRAINT "fk_work_center_client" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL';\n  END IF;\nEND\n$$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "work_center" DROP CONSTRAINT IF EXISTS "fk_work_center_client"`);
    await queryRunner.query(`ALTER TABLE "work_center" DROP CONSTRAINT IF EXISTS "fk_work_center_employer"`);

    // Revert client_id nullable (set NOT NULL) only if you ensure no NULLs exist
    await queryRunner.query(`ALTER TABLE "work_center" ALTER COLUMN "client_id" SET NOT NULL`);

    // Drop added columns
    await queryRunner.query(`ALTER TABLE "work_center" DROP COLUMN IF EXISTS "employer_id"`);
    await queryRunner.query(`ALTER TABLE "work_center" DROP COLUMN IF EXISTS "postal_code"`);
    await queryRunner.query(`ALTER TABLE "work_center" DROP COLUMN IF EXISTS "landline"`);
  }
}
