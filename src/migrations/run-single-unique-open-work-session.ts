import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { UniqueOpenWorkSession20260720 } from './20260720_unique_open_work_session';

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
    // Refuse to proceed if the data already violates the rule — creating the
    // index would fail anyway, and a clear message beats a Postgres error.
    const dups = await queryRunner.query(`
      SELECT job_id, worker_id, COUNT(*)::int AS open_count
        FROM work_sessions
       WHERE check_out_time IS NULL
       GROUP BY job_id, worker_id
      HAVING COUNT(*) > 1
    `);
    if (dups.length > 0) {
      console.table(dups);
      throw new Error(
        `Found ${dups.length} job+worker pair(s) with more than one open session. ` +
        'Close the extras before adding the unique index.',
      );
    }

    await new UniqueOpenWorkSession20260720().up(queryRunner);

    const idx = await queryRunner.query(`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE tablename = 'work_sessions'
         AND indexname = 'uq_work_sessions_open_per_job_worker'
    `);
    console.table(idx);
    console.log(
      idx.length === 1
        ? 'OK: one open session per job+worker is now enforced by the database'
        : 'PROBLEM: index was not created',
    );
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run();
