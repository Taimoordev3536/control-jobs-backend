import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AbsencesService } from '../modules/absences/absences.service';
import { DataSource } from 'typeorm';

/**
 * Fills days_count on absences created before it existed.
 * Dry run by default; --apply writes.
 */
(async () => {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ds = app.get(DataSource);
  const svc = app.get(AbsencesService);
  try {
    const rows = await ds.query(
      `SELECT id, worker_id, employer_id, to_char(start_date,'YYYY-MM-DD') s,
              to_char(end_date,'YYYY-MM-DD') e, type, status
         FROM cjobs_absence_requests WHERE days_count IS NULL ORDER BY id`);
    console.log(`${rows.length} absences without a day count`);
    for (const r of rows) {
      const days = await svc.daysForAbsence({
        employerId: r.employer_id, workerId: r.worker_id, startDate: r.s, endDate: r.e,
      });
      console.log(`  #${r.id} ${r.type}/${r.status} ${r.s}..${r.e} -> ${days} d`);
      if (apply) {
        await ds.query(`UPDATE cjobs_absence_requests SET days_count=$2 WHERE id=$1`, [r.id, days]);
      }
    }
    console.log(apply ? 'written' : 're-run with --apply to write');
  } finally {
    await app.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
