import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';
import { AbsenceRequest } from './entities/absence-request.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { AlertsModule } from '../realtime/alerts.module';
import { AttendancePolicyModule } from '../attendance-policy/attendance-policy.module';

@Module({
  imports: [TypeOrmModule.forFeature([AbsenceRequest, EmployerUser, EmployerWorker, WorkerUser]), AlertsModule, AttendancePolicyModule],
  controllers: [AbsencesController],
  providers: [AbsencesService],
})
export class AbsencesModule {}
