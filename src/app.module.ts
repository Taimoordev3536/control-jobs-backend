import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { PartnersModule } from './modules/partners/partners.module';
import { EmployersModule } from './modules/employers/employers.module'; 
import { UsersModule } from './modules/users/users.module';
import {ClientsModule } from './modules/clients/clients.module';
import { WorkersModule } from './modules/workers/workers.module';
import { JobModule } from './modules/job/job.module';
import { WebauthnModule } from './modules/webauthn/webauthn.module';
import { ConsentModule } from './modules/consent/consent.module';
import { SurveyModule } from './modules/survey/survey.module';
import { QrCodeModule } from './modules/qr-code/qr-code.module';
import { WorkCentersModule } from './modules/work-centers/work-centers.module';
import { config } from 'dotenv';
import { AlertsModule } from './modules/realtime/alerts.module';
import { ManualAttendanceModule } from './modules/manual-attendance/manual-attendance.module';
import { AbsencesModule } from './modules/absences/absences.module';
import { ClientRequestsModule } from './modules/client-requests/client-requests.module';
import { SubUsersModule } from './modules/sub-users/sub-users.module';
import { BillingModule } from './modules/billing/billing.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmployerInvitationsModule } from './modules/employer-invitations/employer-invitations.module';
import { WorkerInvitationsModule } from './modules/worker-invitations/worker-invitations.module';
import { ClientInvitationsModule } from './modules/client-invitations/client-invitations.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { SupportModule } from './modules/support/support.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminConfigModule } from './modules/admin/admin-config.module';
import { FaqModule } from './modules/faq/faq.module';
import { ImportModule } from './modules/import/import.module';
import { BackupModule } from './modules/backup/backup.module';

config();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          type: 'postgres' as const,
          host: configService.get<string>('DATABASE_HOST') || 'localhost',
          port: +configService.get<number>('DATABASE_PORT') || 5432,
          username: configService.get<string>('DATABASE_USERNAME') || 'jobs_control',
          password: configService.get<string>('DATABASE_PASSWORD') || 'jobscontrol123',
          database: configService.get<string>('DATABASE_NAME') || 'jobscontrol',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('DB_SYNC') === 'true',
          ssl: configService.get<string>('DATABASE_HOST')?.includes('supabase') ||
               configService.get<string>('DATABASE_HOST')?.includes('amazonaws')
            ? { rejectUnauthorized: false }
            : false,
          extra: {
            max: +configService.get<number>('DATABASE_POOL_MAX') || 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
          },
        };
      },
      inject: [ConfigService],
    }),
    CommonModule,
    AuthModule,
    WebauthnModule,
    ConsentModule,
    SurveyModule,
    PartnersModule,
    UsersModule,
    EmployersModule,
    ClientsModule,
    WorkersModule,
    JobModule,
    QrCodeModule,
    WorkCentersModule,
    AlertsModule,
    ManualAttendanceModule,
    AbsencesModule,
    ClientRequestsModule,
    SubUsersModule,
    BillingModule,
    DashboardModule,
    EmployerInvitationsModule,
    WorkerInvitationsModule,
    ClientInvitationsModule,
    ChatModule,
    PaymentMethodsModule,
    AnnouncementsModule,
    SupportModule,
    AuditModule,
    AdminConfigModule,
    FaqModule,
    ImportModule,
    BackupModule,
  ],
})
export class AppModule { }
