/**
 * One-shot script to seed a real invoice into cjobs_invoices.
 * Use this to verify the /invoices list, detail, PDF, and mark-paid flows
 * end-to-end without flipping the cron flag.
 *
 * Run: npx ts-node src/scripts/seed-test-invoice.ts [employerIdOrName]
 *      Examples:
 *        npx ts-node src/scripts/seed-test-invoice.ts        # employer id 1
 *        npx ts-node src/scripts/seed-test-invoice.ts 7      # employer id 7
 *        npx ts-node src/scripts/seed-test-invoice.ts "emp 5" # by name
 *
 * Idempotency: if an invoice already exists for the same (employer, period),
 * the unique constraint will reject this insert — that's fine, it just means
 * you already have a test invoice for this month.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { AppModule } from '../app.module';
import { InvoiceService } from '../modules/billing/services/invoice.service';
import { Employer } from '../modules/employers/entities/employer.entity';

async function bootstrap() {
  // Allow passing a multi-word name like: ts-node seed.ts emp 5
  const argParts = process.argv.slice(2);
  const requested = argParts.length > 1 ? argParts.join(' ') : argParts[0];
  const numericId = requested && /^\d+$/.test(requested) ? Number(requested) : null;

  console.log(`🔄 Booting Nest app context...`);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const invoiceService = app.get(InvoiceService);
    const employerRepo = app.get<Repository<Employer>>(getRepositoryToken(Employer));

    // Pick employer: numeric id, then name lookup, then first available.
    let employer: Employer | null = null;
    if (numericId) {
      employer = await employerRepo.findOne({ where: { id: numericId } });
    } else if (requested) {
      employer = await employerRepo.findOne({
        where: { name: ILike(requested) },
      });
    } else {
      employer = await employerRepo.findOne({ where: {}, order: { id: 'ASC' } });
    }
    if (!employer) {
      throw new Error(
        `Could not find employer "${requested ?? '(default)'}" in the database.`,
      );
    }

    console.log(`👤 Using employer #${employer.id} "${employer.name}"`);
    console.log(
      `   Snapshotted rates: fija ${employer.monthlyFixedRate}€  /  per centro ${employer.perWorkCenterRate}€  /  per worker ${employer.perWorkerRate}€`,
    );

    // Period = current calendar month (full month, not prorated).
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    console.log(
      `📅 Generating invoice for period ${toIso(periodStart)} → ${toIso(periodEnd)}`,
    );

    const invoice = await invoiceService.createForEmployer(employer, {
      periodStart,
      periodEnd,
    });

    console.log('');
    console.log('✅ Invoice created');
    console.log('   Invoice number:', invoice.invoiceNumber);
    console.log('   Public id:     ', invoice.publicId);
    console.log('   Subtotal:      ', invoice.subtotal, '€');
    console.log('   Discount:      ', invoice.discountAmount, '€');
    console.log('   VAT:           ', invoice.vatAmount, '€');
    console.log('   Total:         ', invoice.total, '€');
    console.log('   Status:        ', invoice.status);
    console.log('');
    console.log(
      `🌐 View at: http://localhost:3000/invoices/${invoice.publicId}`,
    );
  } catch (err: any) {
    if (String(err?.message || '').includes('uq_invoices_employer_period')) {
      console.error(
        '⚠️  An invoice already exists for this employer and period. Pick another employer (npx ts-node src/scripts/seed-test-invoice.ts <id>) or delete the existing one.',
      );
    } else {
      console.error('❌ Failed to seed invoice:', err.message);
      console.error(err.stack);
    }
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

bootstrap();
