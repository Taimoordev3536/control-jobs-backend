import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployersController } from './employers.controller';
import { EmployersService } from './employers.service';
import { Employer } from './entities/employer.entity';
import { EmployerType } from './entities/employer-type.entity';
import { EmployerSubType } from './entities/employer-sub-type.entity';
import { EmployerClient } from './entities/employer-client.entity';
import { EmployerWorkCenter } from './entities/employer-work-center.entity';
import { EmployerWorker } from './entities/employer-worker.entity';
import { EmployerUser } from './entities/employer-user.entity';
import { PaymentMethod } from '../../shared/entities/payment-method.entity';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employer,
      EmployerType,
      EmployerSubType,
      EmployerClient,
      EmployerWorkCenter,
      EmployerWorker,
      EmployerUser,
      PaymentMethod
    ]),
    CommonModule,
    AuthModule,
    UsersModule,
    forwardRef(() => BillingModule),
    CloudinaryModule,
    PaymentMethodsModule,
  ],
  controllers: [EmployersController],
  providers: [EmployersService],
  exports: [EmployersService],
})
export class EmployersModule { }
