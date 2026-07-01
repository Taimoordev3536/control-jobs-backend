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
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { EmployerHoliday } from '../employers/entities/employer-holiday.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { AlertsModule } from '../realtime/alerts.module';
import { QrCodeModule } from '../qr-code/qr-code.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JobScheduleService } from './services/job-schedule.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
      EmployerUser,
      EmployerWorker,
      EmployerHoliday,
      WorkerUser,
      ClientUser,
    ]),
    AlertsModule,
    QrCodeModule,
  ],
  providers: [JobService, JobScheduleService],
  controllers: [JobController],
  exports: [TypeOrmModule],
})
export class JobModule {} 