import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
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
      // Only a *rotated* token is evidence of theft: it was swapped for a
      // replacement, so a later replay means someone else still holds the
      // old one. A token without a replacement was killed by logout or a
      // previous revoke-all — replaying it is simply a dead session.
      if (existing.replacedByTokenHash) {
        const ageSeconds = (Date.now() - existing.revokedAt.getTime()) / 1000;
        // Within grace, a replayed rotated token is a racing concurrent
        // refresh: hand each caller a fresh token instead of flagging theft.
        if (ageSeconds <= ROTATION_GRACE_SECONDS) {
          const next = await this.issue(existing.userId, deviceInfo, ipAddress);
          return { userId: existing.userId, next };
        }
        await this.revokeAllForUser(existing.userId);
        this.logger.warn(
          `Refresh token reuse detected for user ${existing.userId}; all sessions revoked`,
        );
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      // Previously this path also called revokeAllForUser, which fed back on
      // itself: one revoke-all left every sibling token revoked-without-a-
      // replacement, so each still-open tab's refresh re-triggered another
      // revoke-all and logged a false theft warning, forever.
      throw new UnauthorizedException('Refresh token revoked');
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

  // Rotated/expired rows were never deleted and accumulate forever
  // (~20 rows per user). Expired tokens can no longer be used for
  // anything, including reuse detection, so purge them daily.
  @Cron('0 4 * * *')
  async purgeExpired(): Promise<void> {
    const res = await this.repo.delete({ expiresAt: LessThan(new Date()) });
    if (res.affected) {
      this.logger.log(`Purged ${res.affected} expired refresh tokens`);
    }
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
