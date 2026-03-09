import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add public_id (UUID) columns to all externally-exposed entity tables.
 *
 * Strategy: SAFE additive migration — no existing columns are modified or removed.
 *   - Adds a nullable UUID column
 *   - Populates existing rows with uuid_generate_v4()
 *   - Sets NOT NULL + DEFAULT + UNIQUE INDEX
 *
 * Rollback: Simply drop the public_id columns (no data loss, no FK changes).
 */
export class AddPublicIdToEntities20260306 implements MigrationInterface {
  name = 'AddPublicIdToEntities20260306';

  // Tables that are exposed via public API routes and need a public_id
  private readonly tables = [
    'cjobs_user',
    'cjobs_partners',
    'cjobs_empleadores',
    'clients',
    'workers',
    'work_center',
    'job',
    'survey',
    'receipt',
    'alert',
    'task',
    'notifications',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid-ossp extension exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    for (const table of this.tables) {
      // Check if column already exists (idempotent)
      const colExists = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'public_id'`,
        [table],
      );

      if (colExists.length > 0) {
        console.log(`  ⏭  ${table}.public_id already exists, skipping`);
        continue;
      }

      console.log(`  ➕ Adding public_id to ${table}...`);

      // 1. Add nullable UUID column
      await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "public_id" UUID`);

      // 2. Populate all existing rows
      await queryRunner.query(`UPDATE "${table}" SET "public_id" = uuid_generate_v4() WHERE "public_id" IS NULL`);

      // 3. Set NOT NULL constraint
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "public_id" SET NOT NULL`);

      // 4. Set default for future inserts
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "public_id" SET DEFAULT uuid_generate_v4()`);

      // 5. Create unique index for fast lookups
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "idx_${table}_public_id" ON "${table}"("public_id")`,
      );

      console.log(`  ✅ ${table}.public_id added successfully`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      console.log(`  🗑  Removing public_id from ${table}...`);
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_${table}_public_id"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "public_id"`);
    }
  }
}
