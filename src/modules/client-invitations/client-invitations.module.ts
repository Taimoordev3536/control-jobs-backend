import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientInvitation } from './entities/client-invitation.entity';
import { ClientInvitationRedemption } from './entities/client-invitation-redemption.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { Client } from '../clients/entities/client.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { ClientInvitationService } from './services/client-invitation.service';
import { ClientInvitationsController } from './controllers/client-invitations.controller';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientInvitation,
      ClientInvitationRedemption,
      Employer,
      EmployerUser,
      EmployerClient,
      Client,
      ClientUser,
      User,
      Role,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'your-secret-key',
      }),
      inject: [ConfigService],
    }),
    CommonModule,
    AuthModule,
  ],
  controllers: [ClientInvitationsController],
  providers: [ClientInvitationService],
  exports: [ClientInvitationService],
})
export class ClientInvitationsModule {}
