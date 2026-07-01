import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupRecord } from './entities/backup-record.entity';
import { BackupSettings } from './entities/backup-settings.entity';
import { CloudConnection } from './entities/cloud-connection.entity';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { GoogleDriveProvider } from './storage/google-drive.provider';
import { OneDriveProvider } from './storage/onedrive.provider';
import { BackupController } from './backup.controller';
import { BackupCloudController } from './backup-cloud.controller';
import { BackupService } from './backup.service';
import { BackupCronService } from './backup-cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([BackupRecord, BackupSettings, CloudConnection])],
  controllers: [BackupController, BackupCloudController],
  providers: [BackupService, LocalStorageProvider, GoogleDriveProvider, OneDriveProvider, BackupCronService],
  exports: [BackupService],
})
export class BackupModule {}
