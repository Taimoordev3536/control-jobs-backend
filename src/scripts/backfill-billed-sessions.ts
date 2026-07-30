import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

/**
 * Links sessions to the document that already paid for them.
 *
 * Documents issued before work_sessions carried salary_receipt_id /
 * client_invoice_id left their hours looking unbilled, so the same period
 * could be paid a second time. This claims them retroactively.
 *
 * Only unambiguous cases: a session is claimed when exactly one document
 * covers it. Where two documents overlap the same period the link cannot be
 * inferred, so those are listed and left alone for a person to decide.
 *
 * Dates stay inside SQL throughout — reading a DATE column into JS shifts it
 * by the process timezone, which would move the period boundary by a day.
 *
 *   npx ts-node -T src/scripts/backfill-billed-sessions.ts          # report
 *   npx ts-node -T src/scripts/backfill-billed-sessions.ts --apply  # write
 */
(async () => {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ds = app.get(DataSource);

  const AMBIGUOUS_RECEIPTS = `
    SELECT a.id
      FROM cjobs_salary_receipts a
      JOIN cjobs_salary_receipts b
        ON b.worker_id = a.worker_id AND b.id <> a.id
       AND b.period_start <= a.period_end AND b.period_end >= a.period_start
     WHERE a.status <> 'CANCELLED'`;

  const AMBIGUOUS_INVOICES = `
    SELECT a.id
      FROM cjobs_client_invoices a
      JOIN cjobs_client_invoices b
        ON b.client_id = a.client_id AND b.id <> a.id
       AND b.period_start <= a.period_end AND b.period_end >= a.period_start
     WHERE a.status <> 'CANCELLED'`;

  const receiptMatch = `
    FROM work_sessions ws
    JOIN cjobs_salary_receipts r
      ON r.worker_id = ws.worker_id
     AND ws.check_in_time >= r.period_start
     AND ws.check_in_time < (r.period_end + INTERVAL '1 day')
   WHERE ws.salary_receipt_id IS NULL
     AND (ws.review_status IS NULL OR ws.review_status = 'CONFIRMED')
     AND r.status <> 'CANCELLED'
     AND r.id NOT IN (${AMBIGUOUS_RECEIPTS})`;

  const invoiceMatch = `
    FROM work_sessions ws
    JOIN job j ON j.id = ws.job_id
    JOIN cjobs_client_invoices i
      ON i.client_id = j."clientId"
     AND ws.check_in_time >= i.period_start
     AND ws.check_in_time < (i.period_end + INTERVAL '1 day')
   WHERE ws.client_invoice_id IS NULL
     AND (ws.review_status IS NULL OR ws.review_status = 'CONFIRMED')
     AND i.status <> 'CANCELLED'
     AND i.id NOT IN (${AMBIGUOUS_INVOICES})`;

  try {
    const skippedR = await ds.query(
      `SELECT DISTINCT receipt_number FROM cjobs_salary_receipts
        WHERE id IN (${AMBIGUOUS_RECEIPTS})`);
    const skippedI = await ds.query(
      `SELECT DISTINCT invoice_number FROM cjobs_client_invoices
        WHERE id IN (${AMBIGUOUS_INVOICES})`);

    const planR = await ds.query(
      `SELECT r.receipt_number AS doc, COUNT(*)::int AS sessions,
              ROUND(SUM(ws.total_work_minutes) / 60.0, 2) AS hours ${receiptMatch}
       GROUP BY 1 ORDER BY 1`);
    const planI = await ds.query(
      `SELECT i.invoice_number AS doc, COUNT(*)::int AS sessions,
              ROUND(SUM(ws.total_work_minutes) / 60.0, 2) AS hours ${invoiceMatch}
       GROUP BY 1 ORDER BY 1`);

    console.log(apply ? '=== applying ===' : '=== dry run, nothing written ===');
    console.log('\nsalary receipts:');
    console.log(planR.length
      ? planR.map((r: any) => `  ${r.doc}: ${r.sessions} sessions, ${r.hours} h`).join('\n')
      : '  nothing to link');
    console.log('\nclient invoices:');
    console.log(planI.length
      ? planI.map((r: any) => `  ${r.doc}: ${r.sessions} sessions, ${r.hours} h`).join('\n')
      : '  nothing to link');

    if (skippedR.length || skippedI.length) {
      console.log('\nleft alone — overlapping periods, the link cannot be inferred:');
      for (const r of skippedR) console.log(`  ${r.receipt_number}`);
      for (const i of skippedI) console.log(`  ${i.invoice_number}`);
    }

    if (!apply) {
      console.log('\nre-run with --apply to write these links.');
      return;
    }

    // TypeORM hands back [rows, affectedCount] for UPDATE .. RETURNING, so the
    // count is the second element — rows.length is always 2.
    const affected = async (sql: string): Promise<number> => {
      const res = await ds.query(sql);
      return Array.isArray(res) && typeof res[1] === 'number' ? res[1] : (res?.length ?? 0);
    };

    const nR = await affected(
      `WITH m AS (SELECT ws.id AS sid, r.id AS did ${receiptMatch})
       UPDATE work_sessions SET salary_receipt_id = m.did
         FROM m WHERE work_sessions.id = m.sid
       RETURNING 1`);
    const nI = await affected(
      `WITH m AS (SELECT ws.id AS sid, i.id AS did ${invoiceMatch})
       UPDATE work_sessions SET client_invoice_id = m.did
         FROM m WHERE work_sessions.id = m.sid
       RETURNING 1`);

    console.log(`\nlinked ${nR} sessions to receipts, ${nI} to invoices`);

    const [left] = await ds.query(
      `SELECT COUNT(*)::int c ${receiptMatch}`);
    const [leftI] = await ds.query(
      `SELECT COUNT(*)::int c ${invoiceMatch}`);
    console.log(`re-run would now link ${left.c} + ${leftI.c} — 0 means it is idempotent`);
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
