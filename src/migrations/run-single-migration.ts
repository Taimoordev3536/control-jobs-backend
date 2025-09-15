import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

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
});

async function runSingle() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    const migrationModule = await import('./1694770000000-MakeClientWorkCenterNullableAddObservation');
    const MigrationClass = Object.values(migrationModule)[0] as any;
    const migration = new MigrationClass();
    await migration.up(queryRunner);
    console.log('Applied migration: 1694770000000-MakeClientWorkCenterNullableAddObservation');
  } catch (err) {
    console.error('Migration failed', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

runSingle();
