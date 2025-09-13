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
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST') || 'localhost',
        port: +configService.get<number>('DATABASE_PORT') || 5432,
        username: configService.get('DATABASE_USERNAME') || 'jobs_control',
        password: configService.get('DATABASE_PASSWORD') || 'jobscontrol123',
        database: configService.get('DATABASE_NAME') || 'jobscontrol',
        // entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // synchronize: true,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('DB_SYNC') === 'true',
        ssl: configService.get('NODE_ENV') === 'production' ? {
          rejectUnauthorized: false
        } : false,
      }),
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
    AlertsModule,
  ],
})
export class AppModule { }
