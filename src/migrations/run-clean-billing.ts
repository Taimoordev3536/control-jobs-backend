import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * DEV/TEST utility: wipes all GENERATED billing output so the monthly cron
 * can regenerate from a clean slate. Removes invoices, commissions
 * (autofacturas), bank operations, and salary receipts — plus their child
 * rows. Does NOT touch config/source data (rate plans, employers, jobs,
 * attendance), so regeneration recomputes from the same underlying work.
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DB_PORT || process.env.DATABASE_PORT || 5432),
  username: process.env.DB_USER || process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DB_PASS || process.env.DATABASE_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'postgres',
  synchronize: false,
  logging: false,
  entities: [path.join(__dirname, '..', '..', 'src', '**', '*.entity.{ts,js}')],
  ssl: { rejectUnauthorized: false },
});

const TABLES = [
  'cjobs_invoice_lines',
  'cjobs_invoice_workers',
  'cjobs_invoice_workcenters',
  'cjobs_autofactura_lines',
  'cjobs_autofactura_sources',
  'cjobs_bank_operations',
  'cjobs_salary_receipts',
  'cjobs_autofacturas',
  'cjobs_invoices',
];

async function run() {
  // Production guard — this permanently deletes billing records, which is
  // illegal to do to already-issued invoices in Spain (Verifactu). Only runs
  // when explicitly confirmed, and never when NODE_ENV=production.
  if (String(process.env.NODE_ENV).toLowerCase() === 'production') {
    console.error('❌ Refusing to wipe billing data: NODE_ENV=production.');
    process.exit(1);
  }
  if (String(process.env.CONFIRM_WIPE).toUpperCase() !== 'YES') {
    console.error('❌ Safety guard: set CONFIRM_WIPE=YES to run this destructive wipe.');
    console.error('   Example:  CONFIRM_WIPE=YES npx ts-node src/migrations/run-clean-billing.ts');
    process.exit(1);
  }
  const host = process.env.DATABASE_HOST || process.env.DB_HOST || '';
  if (/supabase|prod|render/i.test(host)) {
    console.warn(`⚠️  Target DB host looks production-like: ${host}`);
  }

  await AppDataSource.initialize();
  try {
    console.log('Rows before cleanup:');
    for (const t of TABLES) {
      const r = await AppDataSource.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
      console.log(`  ${t}: ${r[0].c}`);
    }
    await AppDataSource.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY`);
    console.log('✅ Billing data cleared (invoices, commissions, bank ops, salary receipts). IDs reset.');
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

run();
