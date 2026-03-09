import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Runs only the Phase 2/3/6 UUID migrations (new public_id columns):
 *   - work_sessions
 *   - work_session_day
 *   - scan_logs
 *   - task_history
 *   - survey_response
 */

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
  username: process.env.DB_USER || process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DB_PASS || process.env.DATABASE_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'your_db',
  synchronize: false,
  logging: true,
});

async function run() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  const migrations = [
    { file: './20260309_add_public_id_to_work_sessions', name: 'work_sessions + work_session_day' },
    { file: './20260309_add_public_id_to_scan_logs', name: 'scan_logs' },
    { file: './20260309_add_public_id_to_task_history', name: 'task_history' },
    { file: './20260309_add_public_id_to_survey_response', name: 'survey_response' },
  ];

  try {
    for (const m of migrations) {
      console.log(`\n🔄 Running migration: ${m.name}`);
      const mod = await import(m.file);
      const MigrationClass = Object.values(mod)[0] as any;
      const instance = new MigrationClass();
      await instance.up(queryRunner);
      console.log(`✅ Completed: ${m.name}`);
    }
    console.log('\n🎉 All UUID Phase 2 migrations applied successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run();
