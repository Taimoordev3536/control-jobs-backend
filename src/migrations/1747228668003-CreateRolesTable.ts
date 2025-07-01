import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRolesTable1747228668003 implements MigrationInterface {
    name = 'CreateRolesTable1747228668003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, create the table if it doesn't exist
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "cjobs_roles" (
                "id" SERIAL PRIMARY KEY,
                "name" VARCHAR NOT NULL,
                "value" INTEGER NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        // Then, add the unique constraint if it doesn't exist
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'UQ_roles_value' 
                    AND conrelid = 'cjobs_roles'::regclass
                ) THEN
                    ALTER TABLE "cjobs_roles" ADD CONSTRAINT "UQ_roles_value" UNIQUE ("value");
                END IF;
            END $$;
        `);

        // Finally, insert the roles
        await queryRunner.query(`
            INSERT INTO "cjobs_roles" ("name", "value")
            SELECT 'Admin', 1 WHERE NOT EXISTS (SELECT 1 FROM "cjobs_roles" WHERE "value" = 1);
            
            INSERT INTO "cjobs_roles" ("name", "value")
            SELECT 'Partner', 2 WHERE NOT EXISTS (SELECT 1 FROM "cjobs_roles" WHERE "value" = 2);
            
            INSERT INTO "cjobs_roles" ("name", "value")
            SELECT 'Worker', 3 WHERE NOT EXISTS (SELECT 1 FROM "cjobs_roles" WHERE "value" = 3);
            
            INSERT INTO "cjobs_roles" ("name", "value")
            SELECT 'Client', 4 WHERE NOT EXISTS (SELECT 1 FROM "cjobs_roles" WHERE "value" = 4);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "cjobs_roles"`);
    }
} 