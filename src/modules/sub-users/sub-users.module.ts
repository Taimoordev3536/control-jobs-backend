import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { SubUsersController } from './sub-users.controller';
import { SubUsersService } from './sub-users.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { AdminUser } from '../users/entities/admin-user.entity';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, AdminUser, PartnerUser, EmployerUser, ClientUser]),
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SubUsersController],
  providers: [SubUsersService],
  exports: [SubUsersService],
})
export class SubUsersModule {}
