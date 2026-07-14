import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationConsent } from './entities/location-consent.entity';

/** Current version of the location-consent wording. Bump to force re-consent. */
export const LOCATION_CONSENT_VERSION = '1';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(LocationConsent) private repo: Repository<LocationConsent>,
  ) {}

  async getLocationStatus(userId: number) {
    const row = await this.repo.findOne({ where: { userId } });
    const granted = !!row?.granted && row.consentVersion === LOCATION_CONSENT_VERSION;
    return {
      granted,
      version: LOCATION_CONSENT_VERSION,
      grantedAt: row?.grantedAt ?? null,
    };
  }

  /** Convenience used by check-in enforcement. */
  async hasLocationConsent(userId: number): Promise<boolean> {
    return (await this.getLocationStatus(userId)).granted;
  }

  async grantLocation(userId: number, meta?: { userAgent?: string; ipAddress?: string }) {
    let row = await this.repo.findOne({ where: { userId } });
    if (!row) row = this.repo.create({ userId });
    row.granted = true;
    row.consentVersion = LOCATION_CONSENT_VERSION;
    row.grantedAt = new Date();
    row.revokedAt = null;
    row.userAgent = meta?.userAgent ?? row.userAgent ?? null;
    row.ipAddress = meta?.ipAddress ?? row.ipAddress ?? null;
    await this.repo.save(row);
    return { granted: true, version: LOCATION_CONSENT_VERSION, grantedAt: row.grantedAt };
  }

  async revokeLocation(userId: number) {
    const row = await this.repo.findOne({ where: { userId } });
    if (row) {
      row.granted = false;
      row.revokedAt = new Date();
      await this.repo.save(row);
    }
    return { granted: false, version: LOCATION_CONSENT_VERSION, grantedAt: null };
  }
}
