import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Survey } from './entities/survey.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { Job } from '../job/entities/job.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { AlertsModule } from '../realtime/alerts.module';
import { SurveyService } from './survey.service';
import { SurveyController } from './survey.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Survey, SurveyResponse, Job, WorkerUser, ClientUser, EmployerUser]),
    AlertsModule,
  ],
  providers: [SurveyService],
  controllers: [SurveyController],
  exports: [SurveyService],
})
export class SurveyModule {}
