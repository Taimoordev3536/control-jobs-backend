import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { QrCode } from './entities/qr-code.entity';
import { WorkCenter } from '../work-centers/entities/work-center.entity';
import { Job } from '../job/entities/job.entity';
import { QrCodeService } from './services/qr-code.service';
import { QrValidationService } from './services/qr-validation.service';
import { QrRefreshService } from './services/qr-refresh.service';
import { QrEmailService } from './services/qr-email.service';
import { QrCodeController } from './controllers/qr-code.controller';
import { JobQrController } from './controllers/job-qr.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([QrCode, WorkCenter, Job]),
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  controllers: [QrCodeController, JobQrController],
  providers: [
    QrCodeService,
    QrValidationService,
    QrRefreshService,
    QrEmailService,
  ],
  exports: [
    QrCodeService,
    QrValidationService,
  ],
})
export class QrCodeModule {}
