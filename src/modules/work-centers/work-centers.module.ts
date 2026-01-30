import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkCentersController } from './work-centers.controller';
import { WorkCentersService } from './work-centers.service';
import { WorkCenter } from './entities/work-center.entity';
import { Client } from '../clients/entities/client.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkCenter,
      Client,
      Employer,
      EmployerUser,
      EmployerClient,
    ]),
  ],
  controllers: [WorkCentersController],
  providers: [WorkCentersService],
  exports: [WorkCentersService],
})
export class WorkCentersModule {}
