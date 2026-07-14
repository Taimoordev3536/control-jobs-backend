import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { DeviceCredential } from './entities/device-credential.entity';

@Injectable()
export class WebauthnService {
  private readonly rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  private readonly rpName = process.env.WEBAUTHN_RP_NAME || 'ControlJobs';
  private readonly origins = (process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // short-lived, in-memory state
  private challenges = new Map<number, { challenge: string; exp: number }>();
  private verified = new Map<number, number>(); // userId → expiresAt (ms)

  constructor(
    @InjectRepository(DeviceCredential) private credRepo: Repository<DeviceCredential>,
  ) {}

  private setChallenge(userId: number, challenge: string) {
    this.challenges.set(userId, { challenge, exp: Date.now() + 5 * 60 * 1000 });
  }
  private takeChallenge(userId: number): string | null {
    const c = this.challenges.get(userId);
    this.challenges.delete(userId);
    if (!c || c.exp < Date.now()) return null;
    return c.challenge;
  }
  private parseTransports(t: string | null): any {
    if (!t) return undefined;
    try {
      return JSON.parse(t);
    } catch {
      return undefined;
    }
  }

  async hasCredential(userId: number): Promise<boolean> {
    return (await this.credRepo.count({ where: { userId } })) > 0;
  }

  /** Set by a successful auth; the check-in scan consumes it to prove biometric verification. */
  markVerified(userId: number) {
    this.verified.set(userId, Date.now() + 3 * 60 * 1000);
  }
  consumeRecentVerification(userId: number): boolean {
    const exp = this.verified.get(userId);
    if (!exp) return false;
    this.verified.delete(userId);
    return exp > Date.now();
  }

  async getRegistrationOptions(userId: number, userName: string) {
    const existing = await this.credRepo.find({ where: { userId } });
    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: new TextEncoder().encode(String(userId)),
      userName: userName || `user-${userId}`,
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: this.parseTransports(c.transports),
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    this.setChallenge(userId, options.challenge);
    return options;
  }

  async verifyRegistration(userId: number, response: any, deviceLabel?: string, origin?: string) {
    const expectedChallenge = this.takeChallenge(userId);
    if (!expectedChallenge) return { verified: false, error: 'Challenge expired — retry' };
    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin ? [origin, ...this.origins] : this.origins,
        expectedRPID: this.rpID,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return { verified: false, error: 'Registration could not be verified' };
      }
      const { credential } = verification.registrationInfo;
      await this.credRepo.save(
        this.credRepo.create({
          userId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString('base64'),
          counter: String(credential.counter ?? 0),
          transports: credential.transports ? JSON.stringify(credential.transports) : null,
          deviceLabel: deviceLabel || null,
        }),
      );
      return { verified: true };
    } catch (e: any) {
      console.error('WebAuthn register verify failed:', e?.message);
      return { verified: false, error: e?.message || 'Verification error' };
    }
  }

  async getAuthOptions(userId: number) {
    const creds = await this.credRepo.find({ where: { userId } });
    if (creds.length === 0) return { error: 'No registered device' } as any;
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: this.parseTransports(c.transports),
      })),
      userVerification: 'preferred',
    });
    this.setChallenge(userId, options.challenge);
    return options;
  }

  async verifyAuth(userId: number, response: any, origin?: string) {
    const expectedChallenge = this.takeChallenge(userId);
    if (!expectedChallenge) return { verified: false, error: 'Challenge expired — retry' };

    const cred = await this.credRepo.findOne({ where: { userId, credentialId: response?.id } });
    if (!cred) return { verified: false, error: 'Unknown device credential' };

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin ? [origin, ...this.origins] : this.origins,
        expectedRPID: this.rpID,
        credential: {
          id: cred.credentialId,
          publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64')),
          counter: Number(cred.counter),
          transports: this.parseTransports(cred.transports),
        },
      });
      if (!verification.verified) return { verified: false, error: 'Verification failed' };

      cred.counter = String(verification.authenticationInfo.newCounter);
      cred.lastUsedAt = new Date();
      await this.credRepo.save(cred);
      this.markVerified(userId);
      return { verified: true };
    } catch (e: any) {
      console.error('WebAuthn auth verify failed:', e?.message);
      return { verified: false, error: e?.message || 'Verification error' };
    }
  }
}
