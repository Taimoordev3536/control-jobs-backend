import 'reflect-metadata';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

/**
 * Restores a backup straight from a local .json.gz.
 *
 * BackupService.restore() resolves the file through a `backups` row, so it
 * cannot run against a database that does not have one — which is every
 * database rebuilt after the old one was lost. This path needs only the file.
 *
 * Dry run by default; --apply writes.
 *
 *   npm run restore:from-file -- backups/backup-20260806-130000.json.gz
 *   npm run restore:from-file -- backups/backup-20260806-130000.json.gz --apply
 */
(async () => {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const apply = process.argv.includes('--apply');
  if (!file) {
    console.error('usage: restore-from-file <backup.json.gz> [--apply]');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`not found: ${file}`);
    process.exit(1);
  }

  let payload: any;
  try {
    payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  } catch {
    console.error('backup file is corrupt or unreadable');
    process.exit(1);
  }

  const data: Record<string, any[]> = payload?.data ?? {};
  const excluded = new Set(['backups', 'backup_settings', 'migrations']);
  const tables = Object.keys(data).filter((t) => !excluded.has(t));
  const totalRows = tables.reduce((n, t) => n + (data[t]?.length ?? 0), 0);

  console.log(`backup   : ${file}`);
  console.log(`taken    : ${payload?.meta?.createdAt ?? 'unknown'}`);
  console.log(`tables   : ${tables.length}`);
  console.log(`rows     : ${totalRows}`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ds = app.get(DataSource);

  try {
    const present: string[] = (
      await ds.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)
    ).map((r: any) => r.table_name);
    const missing = tables.filter((t) => !present.includes(t));
    if (missing.length) {
      console.log(`\nMISSING TABLES (${missing.length}) — create the schema first (DB_SYNC=true, then the migrations):`);
      console.log('  ' + missing.join('\n  '));
      if (apply) {
        console.error('\nrefusing to write into an incomplete schema');
        process.exit(1);
      }
    }

    if (!apply) {
      console.log('\ndry run — nothing written. Re-run with --apply.');
      return;
    }

    let rowsRestored = 0;
    await ds.transaction(async (manager) => {
      await manager.query(`SET session_replication_role = replica`);
      try {
        for (const table of tables) {
          await manager.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        }
        const CHUNK = 200;
        for (const table of tables) {
          const rows = data[table] ?? [];
          if (rows.length === 0) continue;
          const types: Record<string, string> = {};
          for (const c of await manager.query(
            `SELECT column_name, data_type FROM information_schema.columns
              WHERE table_schema='public' AND table_name=$1`,
            [table],
          )) {
            types[c.column_name] = c.data_type;
          }
          const cols = Object.keys(rows[0]);
          if (cols.length === 0) continue;
          const colList = cols.map((c) => `"${c}"`).join(', ');
          for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const params: any[] = [];
            const tuples: string[] = [];
            let p = 0;
            for (const row of chunk) {
              tuples.push(`(${cols.map(() => `$${++p}`).join(', ')})`);
              for (const c of cols) {
                const v = row[c];
                params.push(v != null && /json/.test(types[c] || '') ? JSON.stringify(v) : v);
              }
            }
            await manager.query(
              `INSERT INTO "${table}" (${colList}) VALUES ${tuples.join(', ')}`,
              params,
            );
            rowsRestored += chunk.length;
          }
          console.log(`  ${table}: ${rows.length}`);
        }

        const unaligned: string[] = [];
        for (const table of tables) {
          const rows = data[table] ?? [];
          if (rows.length === 0 || !Object.keys(rows[0]).includes('id')) continue;
          const owned = await manager.query(`SELECT pg_get_serial_sequence($1, 'id') AS s`, [
            `"${table}"`,
          ]);
          let seq: string | null = owned?.[0]?.s ?? null;
          if (!seq) {
            const def = await manager.query(
              `SELECT column_default AS d FROM information_schema.columns
                WHERE table_schema='public' AND table_name=$1 AND column_name='id'`,
              [table],
            );
            // keep the literal verbatim, quotes included — see BackupService.idSequence
            const m = /nextval\('([^']+)'::regclass\)/.exec(def?.[0]?.d ?? '');
            seq = m ? m[1] : null;
          }
          if (seq) {
            await manager.query(
              `SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
              [seq],
            );
          } else {
            unaligned.push(table);
          }
        }
        if (unaligned.length) {
          console.log(`\nno id sequence found (uuid or natural key, expected): ${unaligned.join(', ')}`);
        }
      } finally {
        try {
          await manager.query(`SET session_replication_role = DEFAULT`);
        } catch {
          /* transaction already aborted — let the original error surface */
        }
      }
    });

    console.log(`\nrestored ${tables.length} tables, ${rowsRestored} rows`);
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
