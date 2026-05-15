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
  logging: true,
  entities: [],
  ssl:
    process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    const files = [
      '20260515_add_occupation_to_worker_invitations.ts',
      '20260515_add_type_to_client_invitations.ts',
    ];
    for (const file of files) {
      const mod = await import(path.join(__dirname, file));
      const cls = Object.values(mod).find(
        (v: any) => typeof v === 'function' && v.prototype?.up,
      ) as any;
      if (!cls) {
        console.warn(`Skipping ${file}: no migration class`);
        continue;
      }
      console.log('Applying:', file);
      await new cls().up(queryRunner);
    }
    console.log('Done');
  } catch (err) {
    console.error('Migration failed', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run();
