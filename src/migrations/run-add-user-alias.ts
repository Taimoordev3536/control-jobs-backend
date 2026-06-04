import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  port: +(process.env.DATABASE_PORT || process.env.DB_PORT || 5432),
  username: process.env.DATABASE_USERNAME || process.env.DB_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DATABASE_NAME || process.env.DB_NAME || 'jobscontrol',
  synchronize: false,
  logging: true,
  entities: [],
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await queryRunner.query(
      `ALTER TABLE "cjobs_user" ADD COLUMN IF NOT EXISTS "alias" varchar(255)`,
    );
    console.log('alias column added to cjobs_user');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run();
