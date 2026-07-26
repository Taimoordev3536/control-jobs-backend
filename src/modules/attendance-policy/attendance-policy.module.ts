import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendancePolicy } from './entities/attendance-policy.entity';
import { AttendancePolicyService } from './attendance-policy.service';
import { AttendancePolicyController } from './attendance-policy.controller';
import { Job } from '../job/entities/job.entity';
import { Worker } from '../workers/entities/worker.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AttendancePolicy, Job, Worker, EmployerUser, EmployerWorker, User])],
  controllers: [AttendancePolicyController],
  providers: [AttendancePolicyService],
  // Exported so the auto-close work in the next phase can read the rules.
  exports: [AttendancePolicyService],
})
export class AttendancePolicyModule {}
