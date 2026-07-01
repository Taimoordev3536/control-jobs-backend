import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as zlib from 'zlib';
import { BackupRecord } from './entities/backup-record.entity';
import { BackupSettings } from './entities/backup-settings.entity';
import { CloudConnection } from './entities/cloud-connection.entity';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { GoogleDriveProvider } from './storage/google-drive.provider';
import { OneDriveProvider } from './storage/onedrive.provider';
import { StorageProvider } from './storage/storage-provider.interface';
import {
  googleConfigured,
  msConfigured,
  googleAuthUrl,
  msAuthUrl,
  googleExchangeCode,
  msExchangeCode,
} from './storage/cloud-oauth';

@Injectable()
export class BackupService {
  private readonly providers: StorageProvider[];

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(BackupRecord) private readonly recordRepo: Repository<BackupRecord>,
    @InjectRepository(BackupSettings) private readonly settingsRepo: Repository<BackupSettings>,
    @InjectRepository(CloudConnection) private readonly connRepo: Repository<CloudConnection>,
    private readonly local: LocalStorageProvider,
    private readonly gdrive: GoogleDriveProvider,
    private readonly onedrive: OneDriveProvider,
  ) {
    this.providers = [local, gdrive, onedrive];
  }

  private getProvider(key: string): StorageProvider {
    const p = this.providers.find((x) => x.key === (key || 'LOCAL'));
    if (!p) throw new BadRequestException(`Storage provider "${key}" is not available`);
    return p;
  }

  async listProviders() {
    const conns = await this.connRepo.find();
    const byKey = new Map(conns.map((c) => [c.provider, c]));
    const configured = (key: string) =>
      key === 'GDRIVE' ? googleConfigured() : key === 'ONEDRIVE' ? msConfigured() : true;
    return Promise.all(
      this.providers.map(async (p) => ({
        key: p.key,
        label: p.label,
        connected: await p.isConnected(),
        configured: configured(p.key),
        accountEmail: byKey.get(p.key)?.accountEmail ?? null,
      })),
    );
  }

  getAuthUrl(provider: string, state: string): string {
    if (provider === 'GDRIVE') {
      if (!googleConfigured()) throw new BadRequestException('Google Drive credentials are not configured');
      return googleAuthUrl(state);
    }
    if (provider === 'ONEDRIVE') {
      if (!msConfigured()) throw new BadRequestException('OneDrive credentials are not configured');
      return msAuthUrl(state);
    }
    throw new BadRequestException(`Cannot connect provider "${provider}"`);
  }

  async handleCallback(provider: string, code: string): Promise<void> {
    const result =
      provider === 'GDRIVE'
        ? await googleExchangeCode(code)
        : provider === 'ONEDRIVE'
          ? await msExchangeCode(code)
          : null;
    if (!result) throw new BadRequestException(`Cannot connect provider "${provider}"`);
    if (!result.refreshToken) {
      throw new BadRequestException('Provider did not return a refresh token; re-authorize with consent');
    }
    let conn = await this.connRepo.findOne({ where: { provider } });
    if (!conn) conn = this.connRepo.create({ provider });
    conn.refreshToken = result.refreshToken;
    conn.accountEmail = result.email;
    conn.folderId = null;
    await this.connRepo.save(conn);
  }

  async disconnect(provider: string): Promise<{ isSuccess: boolean }> {
    await this.connRepo.delete({ provider });
    return { isSuccess: true };
  }

  async getSettings(): Promise<BackupSettings> {
    let s = await this.settingsRepo.findOne({ where: {} });
    if (!s) {
      s = await this.settingsRepo.save(this.settingsRepo.create({}));
    }
    return s;
  }

  async updateSettings(dto: Partial<BackupSettings>): Promise<BackupSettings> {
    const s = await this.getSettings();
    Object.assign(s, dto);
    return this.settingsRepo.save(s);
  }

  private stamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  // Logical backup: every public table's rows serialized to gzipped JSON.
  private async createDumpBuffer(): Promise<Buffer> {
    const tables: { tablename: string }[] = await this.dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const data: Record<string, any[]> = {};
    const rowCounts: Record<string, number> = {};
    for (const { tablename } of tables) {
      const rows = await this.dataSource.query(`SELECT * FROM "${tablename}"`);
      data[tablename] = rows;
      rowCounts[tablename] = rows.length;
    }
    const payload = {
      meta: { createdAt: new Date().toISOString(), version: 1, rowCounts },
      data,
    };
    return zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  }

  async runBackup(triggeredBy: string, providerKey?: string): Promise<BackupRecord> {
    const settings = await this.getSettings();
    const key = providerKey || settings.provider || 'LOCAL';
    const provider = this.getProvider(key);
    const filename = `backup-${this.stamp()}.json.gz`;

    try {
      const buffer = await this.createDumpBuffer();
      const { ref } = await provider.save(filename, buffer, settings);
      const record = await this.recordRepo.save(
        this.recordRepo.create({
          filename,
          provider: key,
          ref,
          sizeBytes: buffer.length,
          status: 'SUCCESS',
          triggeredBy,
        }),
      );
      await this.enforceRetention(key, settings.keepLast);
      return record;
    } catch (e: any) {
      return this.recordRepo.save(
        this.recordRepo.create({
          filename,
          provider: key,
          status: 'FAILED',
          error: e?.message ?? 'Backup failed',
          triggeredBy,
        }),
      );
    }
  }

  // Keep the newest `keepLast` successful backups per provider; remove the rest.
  private async enforceRetention(providerKey: string, keepLast: number): Promise<void> {
    const keep = Math.max(1, keepLast || 7);
    const all = await this.recordRepo.find({
      where: { provider: providerKey, status: 'SUCCESS' },
      order: { createdAt: 'DESC' },
    });
    const stale = all.slice(keep);
    for (const r of stale) {
      try {
        if (r.ref) await this.getProvider(r.provider).remove(r.ref);
      } catch {
        /* ignore storage errors during prune */
      }
      await this.recordRepo.delete({ id: r.id });
    }
  }

  async list(): Promise<BackupRecord[]> {
    return this.recordRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getRecord(publicId: string): Promise<BackupRecord> {
    const r = await this.recordRepo.findOne({ where: { publicId } });
    if (!r) throw new NotFoundException('Backup not found');
    return r;
  }

  async downloadBuffer(publicId: string): Promise<{ buffer: Buffer; filename: string }> {
    const r = await this.getRecord(publicId);
    if (r.status !== 'SUCCESS' || !r.ref) throw new BadRequestException('Backup file not available');
    const buffer = await this.getProvider(r.provider).load(r.ref);
    return { buffer, filename: r.filename };
  }

  async isBackupDue(settings: BackupSettings): Promise<boolean> {
    const last = await this.recordRepo.findOne({
      where: { status: 'SUCCESS' },
      order: { createdAt: 'DESC' },
    });
    if (!last) return true;
    const hours = (Date.now() - new Date(last.createdAt).getTime()) / 3_600_000;
    return hours >= (settings.intervalHours || 24);
  }

  // Replaces all current data with the backup's. FK constraints are bypassed via
  // session_replication_role so insertion order doesn't matter. The backup
  // bookkeeping tables are left intact so a restore never erases its own history.
  async restore(publicId: string): Promise<{ tablesRestored: number; rowsRestored: number }> {
    const { buffer } = await this.downloadBuffer(publicId);
    let payload: any;
    try {
      payload = JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
    } catch {
      throw new BadRequestException('Backup file is corrupt or unreadable');
    }
    const data: Record<string, any[]> = payload?.data ?? {};
    const excluded = new Set(['backups', 'backup_settings', 'migrations']);
    const tables = Object.keys(data).filter((t) => !excluded.has(t));

    let rowsRestored = 0;
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SET session_replication_role = replica`);
      try {
        for (const table of tables) {
          await manager.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        }
        const CHUNK = 200;
        for (const table of tables) {
          const rows = data[table] ?? [];
          if (rows.length === 0) continue;
          const types = await this.columnTypes(manager, table);
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
            await manager.query(`INSERT INTO "${table}" (${colList}) VALUES ${tuples.join(', ')}`, params);
            rowsRestored += chunk.length;
          }
        }
        // realign serial sequences to MAX(id) after inserting explicit ids
        for (const table of tables) {
          const rows = data[table] ?? [];
          if (rows.length === 0 || !Object.keys(rows[0]).includes('id')) continue;
          const seq = await manager.query(`SELECT pg_get_serial_sequence($1, 'id') AS s`, [`"${table}"`]);
          if (seq?.[0]?.s) {
            await manager.query(
              `SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
              [seq[0].s],
            );
          }
        }
      } finally {
        try {
          await manager.query(`SET session_replication_role = DEFAULT`);
        } catch {
          /* transaction already aborted — let the original error surface */
        }
      }
    });

    return { tablesRestored: tables.length, rowsRestored };
  }

  private async columnTypes(manager: any, table: string): Promise<Record<string, string>> {
    const cols: { column_name: string; data_type: string }[] = await manager.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
      [table],
    );
    const map: Record<string, string> = {};
    for (const c of cols) map[c.column_name] = c.data_type;
    return map;
  }

  async remove(publicId: string): Promise<{ isSuccess: boolean }> {
    const r = await this.getRecord(publicId);
    if (r.ref) {
      try {
        await this.getProvider(r.provider).remove(r.ref);
      } catch {
        /* ignore */
      }
    }
    await this.recordRepo.delete({ id: r.id });
    return { isSuccess: true };
  }
}
