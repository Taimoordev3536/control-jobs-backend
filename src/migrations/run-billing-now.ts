import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BillingCronService } from '../modules/billing/services/billing-cron.service';

/**
 * One-shot: boots the app context and runs the real monthly-close cron methods
 * (previous month = June when run in July). Same code the scheduler runs.
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const svc = app.get(BillingCronService, { strict: false });
    console.log('▶ generateMonthlyInvoices…');
    await svc.generateMonthlyInvoices();
    console.log('▶ generateMonthlyCommissions…');
    await svc.generateMonthlyCommissions();
    console.log('▶ generateMonthlyBankTasks…');
    await svc.generateMonthlyBankTasks();
    console.log('✅ Billing run complete');
  } catch (e) {
    console.error('Billing run failed:', e);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
run();
