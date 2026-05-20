import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { PaymentMethodSelfServiceFlag20260518 } from './20260518_payment_method_self_service_flag';
import { NullLegacyNonSelfServicePayments20260518 } from './20260518_null_legacy_non_self_service_payments';
import { DropDeadEmployerFeeColumn20260518 } from './20260518_drop_dead_employer_fee_column';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: +(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'postgres',
  synchronize: false,
  logging: true,
  entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  try {
    const migrations = [
      new PaymentMethodSelfServiceFlag20260518(),
      new NullLegacyNonSelfServicePayments20260518(),
      new DropDeadEmployerFeeColumn20260518(),
    ];
    for (const m of migrations) {
      console.log(`Applying ${m.constructor.name}...`);
      await m.up(qr);
    }
    console.log('All payment-method/fee migrations applied.');
  } catch (err) {
    console.error('Failed:', err);
    process.exitCode = 1;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

run();
