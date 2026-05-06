import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';
import { ClientUser } from './entities/client-user.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { CommonModule } from '../../common/common.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ClientUser, User, Role, Employer, EmployerClient]),
    CommonModule,
    CloudinaryModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
