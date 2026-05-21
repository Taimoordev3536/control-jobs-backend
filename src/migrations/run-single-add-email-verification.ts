import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { AddEmailVerificationToUsers20260521 } from './20260521_add_email_verification_to_users';

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
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await new AddEmailVerificationToUsers20260521().up(queryRunner);
    console.log('Email verification columns added');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run();
