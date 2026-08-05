import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployersController } from './employers.controller';
import { EmployersService } from './employers.service';
import { PendingEmployersService } from './services/pending-employers.service';
import { Employer } from './entities/employer.entity';
import { EmployerHoliday } from './entities/employer-holiday.entity';
import { EmployerType } from './entities/employer-type.entity';
import { EmployerSubType } from './entities/employer-sub-type.entity';
import { EmployerClient } from './entities/employer-client.entity';
import { EmployerWorkCenter } from './entities/employer-work-center.entity';
import { EmployerWorker } from './entities/employer-worker.entity';
import { EmployerUser } from './entities/employer-user.entity';
import { PaymentMethod } from '../../shared/entities/payment-method.entity';
import { EmployerInvitation } from '../employer-invitations/entities/employer-invitation.entity';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employer,
      EmployerHoliday,
      EmployerType,
      EmployerSubType,
      EmployerClient,
      EmployerWorkCenter,
      EmployerWorker,
      EmployerUser,
      PaymentMethod,
      EmployerInvitation,
      PartnerUser,
    ]),
    CommonModule,
    AuthModule,
    UsersModule,
    forwardRef(() => BillingModule),
    CloudinaryModule,
    PaymentMethodsModule,
    AuditModule,
  ],
  controllers: [EmployersController],
  providers: [EmployersService, PendingEmployersService],
  exports: [EmployersService, PendingEmployersService],
})
export class EmployersModule { }
