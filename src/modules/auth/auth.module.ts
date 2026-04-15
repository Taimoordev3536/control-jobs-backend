import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { OTPModule } from '../otp/otp.module';
import { LocalHelperStrategy } from './strategies/local-helper.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../users/entities/role.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { RolesGuard } from './guards/roles.guard';
import { CaslGuard } from './guards/casl.guard';
import { ViewOnlyBlockerInterceptor } from './guards/view-only-blocker.guard';
import { AbilityFactory } from './casl/ability.factory';
import { CaslModule } from './casl/casl.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { Partner } from '../partners/entities/partner.entity';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';

@Module({
  imports: [
    ConfigModule,
  TypeOrmModule.forFeature([Role, Partner, PartnerUser, EmployerUser, ClientUser]),
    OTPModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          console.warn('JWT_SECRET is not set in environment variables, using default secret');
        }
        console.log('JwtModule initialized with secret:', secret ? '***' : 'default');
        return {
          secret: secret || 'your-secret-key',
          signOptions: { expiresIn: '7d' },
        };
      },
      inject: [ConfigService],
    }),
    CaslModule,
    forwardRef(() => UsersModule),
    CommonModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    LocalHelperStrategy,
    JwtStrategy,
    RolesGuard,
    CaslGuard,
    ViewOnlyBlockerInterceptor,
    AbilityFactory,
  ],
  exports: [AuthService, RolesGuard, CaslGuard, ViewOnlyBlockerInterceptor, AbilityFactory, CaslModule],
})
export class AuthModule { }
