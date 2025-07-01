import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpService } from './otp.service';
import { OTP } from './otp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OTP])],
  controllers: [],
  providers: [OtpService],
  exports: [OtpService],
})
export class OTPModule {}
