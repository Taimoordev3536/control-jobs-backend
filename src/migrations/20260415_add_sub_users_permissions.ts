import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubUsersPermissions20260415 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Shared enum type for sub-user permission
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE sub_user_permission_enum AS ENUM ('EDIT', 'VIEW_ONLY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Partner junction table
    await queryRunner.query(`
      ALTER TABLE "cjobs_partnersUsuarios"
      ADD COLUMN IF NOT EXISTS permission sub_user_permission_enum,
      ADD COLUMN IF NOT EXISTS parent_user_id INTEGER REFERENCES cjobs_user(id) ON DELETE SET NULL;
    `);

    // Employer junction table
    await queryRunner.query(`
      ALTER TABLE "employerUsers"
      ADD COLUMN IF NOT EXISTS permission sub_user_permission_enum,
      ADD COLUMN IF NOT EXISTS parent_user_id INTEGER REFERENCES cjobs_user(id) ON DELETE SET NULL;
    `);

    // Client junction table
    await queryRunner.query(`
      ALTER TABLE clients_users
      ADD COLUMN IF NOT EXISTS permission sub_user_permission_enum,
      ADD COLUMN IF NOT EXISTS parent_user_id INTEGER REFERENCES cjobs_user(id) ON DELETE SET NULL;
    `);

    // User table: is_active flag for soft-delete / deactivate
    await queryRunner.query(`
      ALTER TABLE cjobs_user
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `);

    // Backfill: any existing non-default junction rows are treated as legacy EDIT users
    // so no existing access is lost.
    await queryRunner.query(`
      UPDATE "cjobs_partnersUsuarios"
      SET permission = 'EDIT'
      WHERE is_default = false AND permission IS NULL;
    `);
    await queryRunner.query(`
      UPDATE "employerUsers"
      SET permission = 'EDIT'
      WHERE "isDefault" = false AND permission IS NULL;
    `);
    await queryRunner.query(`
      UPDATE clients_users
      SET permission = 'EDIT'
      WHERE "isDefault" = false AND permission IS NULL;
    `);

    // Helpful indexes for permission checks on hot paths
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_partner_users_parent_user
        ON "cjobs_partnersUsuarios" (parent_user_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employer_users_parent_user
        ON "employerUsers" (parent_user_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_client_users_parent_user
        ON clients_users (parent_user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_partner_users_parent_user;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_employer_users_parent_user;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_client_users_parent_user;`);

    await queryRunner.query(`
      ALTER TABLE "cjobs_partnersUsuarios"
      DROP COLUMN IF EXISTS permission,
      DROP COLUMN IF EXISTS parent_user_id;
    `);
    await queryRunner.query(`
      ALTER TABLE "employerUsers"
      DROP COLUMN IF EXISTS permission,
      DROP COLUMN IF EXISTS parent_user_id;
    `);
    await queryRunner.query(`
      ALTER TABLE clients_users
      DROP COLUMN IF EXISTS permission,
      DROP COLUMN IF EXISTS parent_user_id;
    `);
    await queryRunner.query(`
      ALTER TABLE cjobs_user
      DROP COLUMN IF EXISTS is_active;
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS sub_user_permission_enum;`);
  }
}
