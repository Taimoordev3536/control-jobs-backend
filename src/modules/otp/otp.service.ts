import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { OTP } from './otp.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OTP)
    private otpRepository: Repository<OTP>,
  ) { }

  async generateAndSendOtp({
    userId,
    phoneNumber,
    intent,
  }: {
    phoneNumber: string;
    intent: 'register' | 'login';
    userId: number;
  }): Promise<{ message: string; otp?: string }> {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(new Date().getTime() + 10 * 60 * 1000); // 10 minutes

    try {
      const existingOtp = await this.otpRepository
        .createQueryBuilder('otp')
        .where('otp.userId = :userId', { userId })
        .andWhere('otp.intent = :intent', { intent })
        .getOne();

      if (existingOtp) {
        existingOtp.otp = otp;
        existingOtp.expiresAt = expiry;
        await this.otpRepository.save(existingOtp);
      } else {
        await this.otpRepository.save({
          userId,
          otp,
          expiresAt: expiry,
          intent,
          createdAt: new Date(),
        });
      }

      // Send OTP via SMS API
      await this.sendOtp(phoneNumber, otp);
      const data: {
        message: string;
        otp?: string;
      } = { message: 'OTP sent successfully' };

      if (process.env.NODE_ENV !== 'PROD') {
        console.log('OTP code sent via SMS: ', otp);
        data.otp = otp;
      }

      return data;
    } catch (error) {
      console.error('Failed to generate and send OTP', error);
      throw new InternalServerErrorException('Failed to generate and send OTP');
    }
  }

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    const message = `Your OTP code is ${otp}`;
    const senderId = process.env.OTP_API_SENDER_ID;
    const apiKey = process.env.OTP_API_KEY;
    const clientId = process.env.OTP_API_CLIENT_ID;

    const baseUrl = process.env.OTP_API_BASE_URL;

    const url = `${baseUrl}?SenderId=${senderId}&Message=${encodeURIComponent(
      message,
    )}&MobileNumbers=${phoneNumber}&ApiKey=${apiKey}&ClientId=${clientId}`;

    try {
      await axios.get(url, {
        headers: { accept: 'text/plain' },
      });
      return;
    } catch (error) {
      console.error('Failed to send OTP via SMS', error);
      throw new InternalServerErrorException('Failed to send OTP via SMS');
    }
  }

  async verifyOtp({
    otp,
    intent,
    userId,
  }: {
    phoneNumber: string;
    otp: number;
    intent: 'register' | 'login';
    userId: number;
  }): Promise<boolean> {
    const otpRecord = await this.otpRepository
      .createQueryBuilder('otp')
      .where('otp.userId = :userId', { userId })
      .andWhere('otp.intent = :intent', { intent })
      .andWhere('otp.otp = :otp', { otp })
      .getOne();

    if (!otpRecord) {
      throw new UnauthorizedException('Incorrect OTP, please try again');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('OTP has expired, please try again');
    }

    await this.otpRepository.delete(otpRecord.id);

    return true;
  }
}
