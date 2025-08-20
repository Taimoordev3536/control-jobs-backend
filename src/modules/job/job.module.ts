import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { Shift } from './entities/shift.entity';
import { SigningMethod } from './entities/signing-method.entity';
import { Alert } from './entities/alert.entity';
import { Task } from './entities/task.entity';
import {TaskHistory} from './entities/task-history.entity'
import { ScanLog } from './entities/scan-log.entity';
import { WorkSession } from './entities/work-session.entity';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { Worker } from '../workers/entities/worker.entity';
import { Client } from '../clients/entities/client.entity';
import { WorkCenter } from '../work-centers/entities/work-center.entity';
import { Employer } from '../employers/entities/employer.entity';
import { Survey } from '../survey/entities/survey.entity';
import { SurveyQuestion } from '../survey/entities/survey-question.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      Shift,
      SigningMethod,
      Alert,
      Task,
      TaskHistory,
      ScanLog,
      WorkSession,
      Worker,
      Client,
      WorkCenter,
      Employer,
      Survey,
      SurveyQuestion,
      EmployerUser,
      WorkerUser,
      ClientUser,
    ]),
  ],
  providers: [JobService],
  controllers: [JobController],
  exports: [TypeOrmModule],
})
export class JobModule {} 