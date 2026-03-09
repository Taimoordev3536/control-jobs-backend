import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add public_id (UUID) to work_sessions and work_session_day tables.
 *
 * Part of UUID migration Phase 3 — Work Session & Records Flow.
 * These tables are exposed via API route params and responses.
 *
 * Strategy: SAFE additive migration
 *   1. Add nullable UUID column
 *   2. Backfill existing rows with uuid_generate_v4()
 *   3. Set NOT NULL + DEFAULT + UNIQUE INDEX
 *
 * Rollback: Drop the public_id columns (no data loss, no FK changes).
 */
export class AddPublicIdToWorkSessions20260309 implements MigrationInterface {
  name = 'AddPublicIdToWorkSessions20260309';

  private readonly tables = ['work_sessions', 'work_session_day'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    for (const table of this.tables) {
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

      // 2. Backfill all existing rows
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
