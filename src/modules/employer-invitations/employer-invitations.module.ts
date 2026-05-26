import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmployerInvitation } from './entities/employer-invitation.entity';
import { EmployerInvitationRedemption } from './entities/employer-invitation-redemption.entity';
import { Partner } from '../partners/entities/partner.entity';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { User } from '../users/entities/user.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerInvitationService } from './services/employer-invitation.service';
import { SelfRegistrationService } from './services/self-registration.service';
import { EmployerInvitationsController } from './controllers/employer-invitations.controller';
import { EmployersModule } from '../employers/employers.module';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployerInvitation,
      EmployerInvitationRedemption,
      Partner,
      PartnerUser,
      User,
      Employer,
      EmployerUser,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'your-secret-key',
      }),
      inject: [ConfigService],
    }),
    EmployersModule,
    CommonModule,
    AuthModule,
    PaymentMethodsModule,
  ],
  controllers: [EmployerInvitationsController],
  providers: [EmployerInvitationService, SelfRegistrationService],
  exports: [EmployerInvitationService, SelfRegistrationService],
})
export class EmployerInvitationsModule {}
