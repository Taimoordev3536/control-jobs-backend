import { Module } from '@nestjs/common';
import { AlertsGateway } from './alerts.gateway';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Notification]),
  ],
  providers: [AlertsGateway, AlertsService],
  controllers: [AlertsController],
  exports: [AlertsGateway, AlertsService],
})
export class AlertsModule {}
