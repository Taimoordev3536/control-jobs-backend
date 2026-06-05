import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { AlertsModule } from '../realtime/alerts.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './services/announcements.service';
import { AudienceResolverService } from './services/audience-resolver.service';
import { AnnouncementCronService } from './services/announcement-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Announcement,
      PartnerUser,
      Employer,
      EmployerUser,
      EmployerClient,
      EmployerWorker,
      ClientUser,
      WorkerUser,
    ]),
    AlertsModule,
  ],
  controllers: [AnnouncementsController],
  providers: [
    AnnouncementsService,
    AudienceResolverService,
    AnnouncementCronService,
  ],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
