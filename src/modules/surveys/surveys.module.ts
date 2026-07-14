import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { SurveyForm } from './entities/survey-form.entity';
import { SurveyFormQuestion } from './entities/survey-form-question.entity';
import { SurveyFormResponse } from './entities/survey-form-response.entity';
import { SurveyFormAnswer } from './entities/survey-form-answer.entity';
import { SurveyFormSubmission } from './entities/survey-form-submission.entity';
import { SurveyFormSettings } from './entities/survey-form-settings.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { AlertsModule } from '../realtime/alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SurveyForm,
      SurveyFormQuestion,
      SurveyFormResponse,
      SurveyFormAnswer,
      SurveyFormSubmission,
      SurveyFormSettings,
      EmployerUser,
      EmployerWorker,
      EmployerClient,
      WorkerUser,
      ClientUser,
    ]),
    AlertsModule,
  ],
  controllers: [SurveysController],
  providers: [SurveysService],
})
export class SurveysModule {}
