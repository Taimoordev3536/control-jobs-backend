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
  logging: false,
  ssl: { rejectUnauthorized: false },
});

const companyName = 'CONTROLJOBS TECH, S.L.U.';
const address = ['B31972524', 'Calle Sololá', '31003 Logroño', 'La Rioja'].join('\n');

async function run() {
  await AppDataSource.initialize();
  try {
    const existing = await AppDataSource.query(
      `SELECT id, "companyName", address, "invoiceSeries", "vatRate" FROM admin_config LIMIT 1`,
    );
    if (existing.length) {
      console.log('Existing admin_config row:', existing[0]);
      await AppDataSource.query(
        `UPDATE admin_config SET "companyName" = $1, address = $2 WHERE id = $3`,
        [companyName, address, existing[0].id],
      );
      console.log('Updated company name + address.');
    } else {
      await AppDataSource.query(
        `INSERT INTO admin_config ("companyName", address, "vatRate", "invoiceSeries", "paymentDetails")
         VALUES ($1, $2, $3, $4, $5)`,
        [companyName, address, 21, 'CJOBS', ''],
      );
      console.log('Inserted new admin_config row.');
    }
    console.log('✅ Done');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

run();
