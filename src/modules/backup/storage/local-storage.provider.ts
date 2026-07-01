import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider, SaveResult } from './storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  key = 'LOCAL';
  label = 'Local / Server';

  private dir(settings?: any): string {
    return (
      settings?.localPath ||
      process.env.BACKUP_DIR ||
      path.join(process.cwd(), 'backups')
    );
  }

  async isConnected(): Promise<boolean> {
    return true;
  }

  async save(filename: string, buffer: Buffer, settings?: any): Promise<SaveResult> {
    const dir = this.dir(settings);
    fs.mkdirSync(dir, { recursive: true });
    const full = path.join(dir, filename);
    fs.writeFileSync(full, buffer);
    return { ref: full };
  }

  async load(ref: string): Promise<Buffer> {
    return fs.promises.readFile(ref);
  }

  async remove(ref: string): Promise<void> {
    try {
      await fs.promises.unlink(ref);
    } catch {
      /* already gone */
    }
  }
}
