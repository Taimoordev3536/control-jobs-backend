import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkerInvitation } from './entities/worker-invitation.entity';
import { WorkerInvitationRedemption } from './entities/worker-invitation-redemption.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { Worker } from '../workers/entities/worker.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { WorkerInvitationService } from './services/worker-invitation.service';
import { WorkerInvitationsController } from './controllers/worker-invitations.controller';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkerInvitation,
      WorkerInvitationRedemption,
      Employer,
      EmployerUser,
      EmployerWorker,
      Worker,
      WorkerUser,
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
  controllers: [WorkerInvitationsController],
  providers: [WorkerInvitationService],
  exports: [WorkerInvitationService],
})
export class WorkerInvitationsModule {}
