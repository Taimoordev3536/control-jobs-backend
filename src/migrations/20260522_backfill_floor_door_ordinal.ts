import { MigrationInterface, QueryRunner } from 'typeorm';
import { normalizeFloorDoor } from '../common/utils/normalize-floor-door';

const TARGETS: Array<{ table: string; id: string }> = [
  { table: 'clients', id: 'id' },
  { table: 'workers', id: 'id' },
  { table: 'cjobs_partners', id: 'id' },
  { table: 'cjobs_empleadores', id: 'id' },
];

export class BackfillFloorDoorOrdinal20260522 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "floor_door_backfill_audit" (
        "id" SERIAL PRIMARY KEY,
        "table_name" VARCHAR(64) NOT NULL,
        "row_id" VARCHAR(64) NOT NULL,
        "old_value" VARCHAR(100),
        "new_value" VARCHAR(100),
        "ran_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    for (const { table, id } of TARGETS) {
      const rows: Array<{ id: string | number; floor_door: string }> = await queryRunner.query(
        `SELECT "${id}" AS id, "floor_door" FROM "${table}" WHERE "floor_door" IS NOT NULL AND "floor_door" <> ''`,
      );

      for (const row of rows) {
        const normalized = normalizeFloorDoor(row.floor_door);
        if (normalized && normalized !== row.floor_door) {
          await queryRunner.query(
            `INSERT INTO "floor_door_backfill_audit" ("table_name", "row_id", "old_value", "new_value") VALUES ($1, $2, $3, $4)`,
            [table, String(row.id), row.floor_door, normalized],
          );
          await queryRunner.query(
            `UPDATE "${table}" SET "floor_door" = $1 WHERE "${id}" = $2`,
            [normalized, row.id],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const auditRows: Array<{ table_name: string; row_id: string; old_value: string }> =
      await queryRunner.query(
        `SELECT "table_name", "row_id", "old_value" FROM "floor_door_backfill_audit" ORDER BY "id" DESC`,
      );

    for (const row of auditRows) {
      const target = TARGETS.find((t) => t.table === row.table_name);
      if (!target) continue;
      await queryRunner.query(
        `UPDATE "${target.table}" SET "floor_door" = $1 WHERE "${target.id}" = $2`,
        [row.old_value, row.row_id],
      );
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "floor_door_backfill_audit"`);
  }
}
