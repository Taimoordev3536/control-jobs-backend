import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { BackfillFloorDoorOrdinal20260522 } from './20260522_backfill_floor_door_ordinal';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
  username: process.env.DB_USER || process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DB_PASS || process.env.DATABASE_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'your_db',
  synchronize: false,
  logging: true,
  entities: [path.join(__dirname, '..', '..', 'src', '**', '*.entity.{ts,js}')],
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const direction = (process.argv[2] || 'up').toLowerCase();
  if (direction !== 'up' && direction !== 'down') {
    console.error(`Unknown direction "${direction}". Use "up" or "down".`);
    process.exit(1);
  }

  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  const migration = new BackfillFloorDoorOrdinal20260522();
  try {
    if (direction === 'up') {
      await migration.up(queryRunner);
      const audit: Array<{ count: string }> = await queryRunner.query(
        `SELECT COUNT(*)::text AS count FROM "floor_door_backfill_audit"`,
      );
      console.log(`Backfill done. ${audit[0]?.count ?? 0} rows updated.`);
      console.log(
        `Inspect changes:  SELECT table_name, row_id, old_value, new_value FROM "floor_door_backfill_audit" ORDER BY id;`,
      );
    } else {
      await migration.down(queryRunner);
      console.log('Backfill reversed. floor_door values restored, audit table dropped.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run();
