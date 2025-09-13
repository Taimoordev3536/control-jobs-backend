import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { Partner } from './entities/partner.entity';
import { PartnerTier } from './entities/partner-type.entity';
import { PartnerUser } from './entities/partner-user.entity';
import { User } from '../users/entities/user.entity';
import { PaymentMethod } from '../../shared/entities/payment-method.entity';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Partner,
      PartnerTier,
      PartnerUser,
      User,
      PaymentMethod
    ]),
    AuthModule,
    CommonModule,
  ],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule { }
