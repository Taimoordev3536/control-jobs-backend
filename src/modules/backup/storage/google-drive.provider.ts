import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloudConnection } from '../entities/cloud-connection.entity';
import { StorageProvider, SaveResult } from './storage-provider.interface';
import { googleConfigured, googleRefresh } from './cloud-oauth';

const FOLDER_NAME = 'ControlJobs Backups';

@Injectable()
export class GoogleDriveProvider implements StorageProvider {
  key = 'GDRIVE';
  label = 'Google Drive';

  constructor(
    @InjectRepository(CloudConnection) private readonly connRepo: Repository<CloudConnection>,
  ) {}

  async isConnected(): Promise<boolean> {
    if (!googleConfigured()) return false;
    return !!(await this.connRepo.findOne({ where: { provider: this.key } }));
  }

  private async connection(): Promise<CloudConnection> {
    const c = await this.connRepo.findOne({ where: { provider: this.key } });
    if (!c) throw new Error('Google Drive is not connected');
    return c;
  }

  private async token(c: CloudConnection): Promise<string> {
    return googleRefresh(c.refreshToken);
  }

  private async ensureFolder(c: CloudConnection, token: string): Promise<string> {
    if (c.folderId) return c.folderId;
    const q = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const found = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    let id = found?.files?.[0]?.id;
    if (!id) {
      const created = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
      }).then((r) => r.json());
      id = created.id;
    }
    c.folderId = id;
    await this.connRepo.save(c);
    return id;
  }

  async save(filename: string, buffer: Buffer): Promise<SaveResult> {
    const c = await this.connection();
    const token = await this.token(c);
    const folderId = await this.ensureFolder(c, token);

    const boundary = `cjobs-${Date.now()}`;
    const meta = JSON.stringify({ name: filename, parents: [folderId] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `Drive upload failed (${res.status})`);
    return { ref: json.id };
  }

  async load(ref: string): Promise<Buffer> {
    const c = await this.connection();
    const token = await this.token(c);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${ref}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  async remove(ref: string): Promise<void> {
    const c = await this.connection();
    const token = await this.token(c);
    await fetch(`https://www.googleapis.com/drive/v3/files/${ref}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
