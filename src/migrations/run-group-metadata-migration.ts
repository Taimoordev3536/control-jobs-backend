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
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'postgres',
  synchronize: false,
  logging: true,
  ssl: process.env.DATABASE_HOST?.includes('supabase') ||
       process.env.DB_HOST?.includes('supabase') ||
       process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

async function run() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    const modulePath = path.join(__dirname, '20260513_add_name_and_image_to_chat_conversations.ts');
    const mod = await import(modulePath);
    const Cls = Object.values(mod).find(
      (v: any) => typeof v === 'function' && v.prototype && typeof v.prototype.up === 'function',
    ) as any;
    if (!Cls) throw new Error('Migration class not found');
    console.log('Applying 20260513_add_name_and_image_to_chat_conversations...');
    await new Cls().up(queryRunner);
    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run();
