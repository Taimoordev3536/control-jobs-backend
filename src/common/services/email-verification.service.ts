import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from './email.service';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_THROTTLE_MS = 60 * 1000;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async issueToken(userId: number, recipientName?: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`issueToken: user ${userId} not found`);
      return;
    }
    if (user.emailVerifiedAt) {
      this.logger.log(`issueToken: user ${userId} already verified, skipping`);
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hash(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpiresAt = expiresAt;
    user.emailVerificationSentAt = now;
    await this.userRepo.save(user);

    const verifyLink = this.buildVerifyLink(rawToken);
    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        recipientName || user.name || user.email,
        verifyLink,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${user.email}: ${err?.message}`,
      );
    }
  }

  async verifyToken(rawToken: string): Promise<{ email: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Invalid verification token');
    }
    const tokenHash = this.hash(rawToken);
    const user = await this.userRepo.findOne({
      where: { emailVerificationTokenHash: tokenHash },
    });
    if (!user) {
      throw new BadRequestException('Invalid or already-used verification link');
    }
    if (
      user.emailVerificationExpiresAt &&
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Verification link has expired');
    }

    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await this.userRepo.save(user);
    return { email: user.email };
  }

  // Silent on non-existent / already-verified accounts to avoid leaking which emails are registered.
  async resend(email: string): Promise<void> {
    const emailLower = String(email || '').trim().toLowerCase();
    if (!emailLower) return;

    const user = await this.userRepo.findOne({ where: { email: emailLower } });
    if (!user || user.emailVerifiedAt) return;

    if (
      user.emailVerificationSentAt &&
      Date.now() - user.emailVerificationSentAt.getTime() < RESEND_THROTTLE_MS
    ) {
      throw new BadRequestException(
        'Please wait a moment before requesting another verification email',
      );
    }

    await this.issueToken(user.id, user.name);
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private buildVerifyLink(rawToken: string): string {
    const base = this.configService.get<string>('FRONTEND_URL') || '';
    return `${base.replace(/\/$/, '')}/verify-email?token=${rawToken}`;
  }
}
