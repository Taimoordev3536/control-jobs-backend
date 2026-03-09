import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add public_id (UUID) to task_history table.
 *
 * Part of UUID migration Phase 6 — Operational entities.
 * TaskHistory is returned in task detail API responses.
 *
 * Strategy: SAFE additive migration
 *   1. Add nullable UUID column
 *   2. Backfill existing rows with uuid_generate_v4()
 *   3. Set NOT NULL + DEFAULT + UNIQUE INDEX
 *
 * Rollback: Drop the public_id column (no data loss, no FK changes).
 */
export class AddPublicIdToTaskHistory20260309 implements MigrationInterface {
  name = 'AddPublicIdToTaskHistory20260309';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    const table = 'task_history';

    const colExists = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'public_id'`,
      [table],
    );

    if (colExists.length > 0) {
      console.log(`  ⏭  ${table}.public_id already exists, skipping`);
      return;
    }

    console.log(`  ➕ Adding public_id to ${table}...`);

    await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "public_id" UUID`);
    await queryRunner.query(`UPDATE "${table}" SET "public_id" = uuid_generate_v4() WHERE "public_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "public_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "public_id" SET DEFAULT uuid_generate_v4()`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_${table}_public_id" ON "${table}"("public_id")`,
    );

    console.log(`  ✅ ${table}.public_id added successfully`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'task_history';
    console.log(`  🗑  Removing public_id from ${table}...`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_${table}_public_id"`);
    await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "public_id"`);
  }
}
