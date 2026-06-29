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
import { Client } from '../clients/entities/client.entity';
import { Job } from '../job/entities/job.entity';
import { CommonModule } from '../../common/common.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Worker,
      WorkerUser,
      User,
      Role,
      Employer,
      EmployerWorker,
      Client,
      Job,
    ]),
    CommonModule,
    CloudinaryModule,
  ],
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
