import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { AddActiveToEmployersPartners20260717 } from './20260717_add_active_to_employers_partners';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
  username: process.env.DB_USER || process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DB_PASS || process.env.DATABASE_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'your_db',
  synchronize: false,
  logging: false,
  entities: [path.join(__dirname, '..', '..', 'src', '**', '*.entity.{ts,js}')],
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await new AddActiveToEmployersPartners20260717().up(queryRunner);

    const cols = await queryRunner.query(
      `SELECT table_name, column_name, column_default, is_nullable
         FROM information_schema.columns
        WHERE column_name = 'active'
          AND table_name IN ('cjobs_empleadores', 'cjobs_partners')
        ORDER BY table_name`,
    );
    console.table(cols);
    console.log(
      cols.length === 2
        ? 'OK: active column present on both tables'
        : `PROBLEM: expected 2 rows, got ${cols.length}`,
    );
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run();
