import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';
import { Worker } from './entities/worker.entity';
import { WorkerUser } from './entities/worker-user.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, WorkerUser, User, Role, Employer, EmployerWorker]), CommonModule],
  controllers: [WorkersController],
  providers: [WorkersService],
})
export class WorkersModule {}
