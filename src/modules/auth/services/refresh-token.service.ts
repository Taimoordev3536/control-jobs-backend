import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { RefreshToken } from '../entities/refresh-token.entity';

export interface IssuedToken {
  raw: string;
  expiresAt: Date;
  record: RefreshToken;
}

const REFRESH_TTL_DAYS = 30;
// Grace window for parallel refresh attempts. NextAuth re-runs its jwt
// callback per request, and two near-simultaneous requests (React strict
// mode, multiple tabs, prefetch) can both hit /auth/refresh with the same
// token before one finishes. Without this window the second call looks
// like a stolen-token replay. With it, we return the just-issued
// replacement and only flag as theft if the replay arrives later.
const ROTATION_GRACE_SECONDS = 30;

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  async issue(
    userId: number,
    deviceInfo?: string | null,
    ipAddress?: string | null,
  ): Promise<IssuedToken> {
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = this.hash(raw);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    const record = await this.repo.save(
      this.repo.create({
        userId,
        tokenHash,
        expiresAt,
        deviceInfo: deviceInfo ?? null,
        ipAddress: ipAddress ?? null,
      }),
    );

    return { raw, expiresAt, record };
  }

  async rotate(
    rawToken: string,
    deviceInfo?: string | null,
    ipAddress?: string | null,
  ): Promise<{ userId: number; next: IssuedToken }> {
    const tokenHash = this.hash(rawToken);
    const existing = await this.repo.findOne({ where: { tokenHash } });
    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    if (existing.revokedAt) {
      const ageSeconds = (Date.now() - existing.revokedAt.getTime()) / 1000;
      if (
        existing.replacedByTokenHash &&
        ageSeconds <= ROTATION_GRACE_SECONDS
      ) {
        const replacement = await this.repo.findOne({
          where: { tokenHash: existing.replacedByTokenHash },
        });
        if (replacement && !replacement.revokedAt) {
          // We can't return the raw replacement (we never persisted it), so
          // issue a fresh one keyed off the same user and chain the replaced
          // record forward. This still rotates, but doesn't punish the
          // racing caller.
          const next = await this.issue(existing.userId, deviceInfo, ipAddress);
          replacement.revokedAt = new Date();
          replacement.replacedByTokenHash = next.record.tokenHash;
          replacement.lastUsedAt = new Date();
          await this.repo.save(replacement);
          return { userId: existing.userId, next };
        }
      }
      await this.revokeAllForUser(existing.userId);
      this.logger.warn(
        `Refresh token reuse detected for user ${existing.userId}; all sessions revoked`,
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const next = await this.issue(existing.userId, deviceInfo, ipAddress);

    existing.revokedAt = new Date();
    existing.replacedByTokenHash = next.record.tokenHash;
    existing.lastUsedAt = new Date();
    await this.repo.save(existing);

    return { userId: existing.userId, next };
  }

  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.repo.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.repo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
