import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloudConnection } from '../entities/cloud-connection.entity';
import { StorageProvider, SaveResult } from './storage-provider.interface';
import { msConfigured, msRefresh } from './cloud-oauth';

const FOLDER = 'ControlJobs Backups';
const GRAPH = 'https://graph.microsoft.com/v1.0';

@Injectable()
export class OneDriveProvider implements StorageProvider {
  key = 'ONEDRIVE';
  label = 'OneDrive';

  constructor(
    @InjectRepository(CloudConnection) private readonly connRepo: Repository<CloudConnection>,
  ) {}

  async isConnected(): Promise<boolean> {
    if (!msConfigured()) return false;
    return !!(await this.connRepo.findOne({ where: { provider: this.key } }));
  }

  private async token(): Promise<string> {
    const c = await this.connRepo.findOne({ where: { provider: this.key } });
    if (!c) throw new Error('OneDrive is not connected');
    return msRefresh(c.refreshToken);
  }

  async save(filename: string, buffer: Buffer): Promise<SaveResult> {
    const token = await this.token();
    const path = encodeURIComponent(`${FOLDER}/${filename}`);
    const res = await fetch(`${GRAPH}/me/drive/root:/${path}:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: buffer,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `OneDrive upload failed (${res.status})`);
    return { ref: json.id };
  }

  async load(ref: string): Promise<Buffer> {
    const token = await this.token();
    const res = await fetch(`${GRAPH}/me/drive/items/${ref}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`OneDrive download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  async remove(ref: string): Promise<void> {
    const token = await this.token();
    await fetch(`${GRAPH}/me/drive/items/${ref}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
