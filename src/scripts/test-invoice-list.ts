/**
 * Diagnostic: invokes the same InvoiceService.list query that the
 * /invoices endpoint uses, with a partner-scoped filter, to surface
 * the actual TypeORM error if any.
 *
 * Run: npx ts-node src/scripts/test-invoice-list.ts <partnerId>
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InvoiceService } from '../modules/billing/services/invoice.service';

async function bootstrap() {
  const partnerId = Number(process.argv[2]) || 1;
  console.log(`🔄 Booting context, testing partner-scoped invoice list (partnerId=${partnerId})…`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const invoices = app.get(InvoiceService);
    const result = await invoices.list({
      page: 1,
      pageSize: 100,
      scope: { kind: 'partner', partnerId },
    });
    console.log('');
    console.log(`✅ Query OK — ${result.data.length} invoice(s) returned (total ${result.total})`);
    for (const inv of result.data) {
      console.log(
        `   ${inv.invoiceNumber}  employer #${inv.employerId}  ${inv.total} EUR  ${inv.status}`,
      );
    }
  } catch (err: any) {
    console.error('❌ Query failed:');
    console.error(err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 6).join('\n'));
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap();
