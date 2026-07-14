import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientRequestsController } from './client-requests.controller';
import { ClientRequestsService } from './client-requests.service';
import { ClientRequest } from './entities/client-request.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { Job } from '../job/entities/job.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { AlertsModule } from '../realtime/alerts.module';

@Module({
  imports: [TypeOrmModule.forFeature([ClientRequest, ClientUser, Job, EmployerClient, EmployerUser]), AlertsModule],
  controllers: [ClientRequestsController],
  providers: [ClientRequestsService],
})
export class ClientRequestsModule {}
