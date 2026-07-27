import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';
import { ClientFile } from './entities/client-file.entity';
import { ClientInvoice } from './entities/client-invoice.entity';
import { ClientInvoiceLine } from './entities/client-invoice-line.entity';
import { PaymentMethod } from '../../shared/entities/payment-method.entity';
import { ClientUser } from './entities/client-user.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { CommonModule } from '../../common/common.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ClientFile, ClientInvoice, ClientInvoiceLine, PaymentMethod, ClientUser, User, Role, Employer, EmployerClient, EmployerUser]),
    CommonModule,
    CloudinaryModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
