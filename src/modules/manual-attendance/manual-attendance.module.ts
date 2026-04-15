import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualAttendanceRequest } from './entities/manual-attendance-request.entity';
import { ManualAttendancePermission } from './entities/manual-attendance-permission.entity';
import { ManualAttendanceService } from './manual-attendance.service';
import { ManualAttendanceController } from './manual-attendance.controller';
import { Job } from '../job/entities/job.entity';
import { Worker } from '../workers/entities/worker.entity';
import { WorkCenter } from '../work-centers/entities/work-center.entity';
import { WorkSession } from '../job/entities/work-session.entity';
import { ScanLog } from '../job/entities/scan-log.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { User } from '../users/entities/user.entity';
import { AlertsModule } from '../realtime/alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ManualAttendanceRequest,
      ManualAttendancePermission,
      Job,
      Worker,
      WorkCenter,
      WorkSession,
      ScanLog,
      EmployerUser,
      WorkerUser,
      ClientUser,
      User,
    ]),
    AlertsModule,
  ],
  providers: [ManualAttendanceService],
  controllers: [ManualAttendanceController],
  exports: [ManualAttendanceService],
})
export class ManualAttendanceModule {}
