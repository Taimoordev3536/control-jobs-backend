import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupService } from './backup.service';

@Injectable()
export class BackupCronService {
  private readonly logger = new Logger(BackupCronService.name);

  constructor(private readonly backupService: BackupService) {}

  @Cron('0 * * * *', { name: 'scheduled-backup' })
  async tick(): Promise<void> {
    try {
      const settings = await this.backupService.getSettings();
      if (!settings.enabled) return;
      if (!(await this.backupService.isBackupDue(settings))) return;
      this.logger.log('Running scheduled backup');
      await this.backupService.runBackup('Scheduler', settings.provider);
    } catch (e: any) {
      this.logger.error(`Scheduled backup failed: ${e?.message ?? e}`);
    }
  }
}
