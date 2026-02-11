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
import { QrCodeModule } from './modules/qr-code/qr-code.module';
import { WorkCentersModule } from './modules/work-centers/work-centers.module';
import { config } from 'dotenv';
import { AlertsModule } from './modules/realtime/alerts.module';

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
          ssl: configService.get('NODE_ENV') === 'production' ? {
            rejectUnauthorized: false
          } : false,
        };
      },
      inject: [ConfigService],
    }),
    CommonModule,
    AuthModule,
    PartnersModule,
    UsersModule,
    EmployersModule,
    ClientsModule,
    WorkersModule,
    JobModule,
    QrCodeModule,
    WorkCentersModule,
    AlertsModule,
  ],
})
export class AppModule { }
