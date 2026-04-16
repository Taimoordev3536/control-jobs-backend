import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminUsersTable20260416 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure the permission enum already exists (created by the sub-users migration)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE sub_user_permission_enum AS ENUM ('EDIT', 'VIEW_ONLY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cjobs_admin_users (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES cjobs_user(id) ON DELETE CASCADE,
        is_default BOOLEAN NOT NULL DEFAULT false,
        permission sub_user_permission_enum,
        parent_user_id INTEGER REFERENCES cjobs_user(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_user_id
        ON cjobs_admin_users (user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_parent_user_id
        ON cjobs_admin_users (parent_user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_admin_users_parent_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_admin_users_user_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS cjobs_admin_users;`);
  }
}
