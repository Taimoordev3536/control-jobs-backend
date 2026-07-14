import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalize every instant column to `timestamptz`.
 *
 * Background: many older tables stored instants (created_at, expires_at,
 * paid_at, ...) as plain `timestamp without time zone`. They were kept correct
 * at runtime only by the pg type-parser in main.ts, which reads such columns as
 * UTC. This migration makes the schema itself correct so the interpretation no
 * longer depends on that read-side shim, and so `DB_SYNC=true` environments
 * (whose entities now declare `timestamptz`) don't fight the column type.
 *
 * Safety:
 *  - Only columns whose current type is `timestamp without time zone` are
 *    touched — `date`, `time`, and already-`timestamptz` columns are skipped,
 *    so the migration is idempotent and safe to re-run.
 *  - The stored values are UTC wall-clock (that is the assumption main.ts
 *    already relies on), so `USING col AT TIME ZONE 'UTC'` reinterprets them as
 *    the exact same UTC instants — no data is shifted.
 *  - Scoped to the public schema; the TypeORM bookkeeping table is excluded.
 */
export class TimestamptzInstants20260707 implements MigrationInterface {
  name = 'TimestamptzInstants20260707';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
      BEGIN
        FOR r IN
          SELECT c.table_name AS tbl, c.column_name AS col
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema AND t.table_name = c.table_name
          WHERE c.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
            AND c.data_type = 'timestamp without time zone'
            AND c.table_name <> 'migrations'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
            r.tbl, r.col, r.col
          );
          RAISE NOTICE 'timestamptz: converted %.%', r.tbl, r.col;
        END LOOP;
      END $$;
    `);
  }

  /**
   * Down is intentionally a no-op. Reverting to `timestamp without time zone`
   * would strip timezone information and re-introduce the very ambiguity this
   * migration removes; there is no safe automatic rollback.
   */
  public async down(): Promise<void> {
    // no-op by design
  }
}
