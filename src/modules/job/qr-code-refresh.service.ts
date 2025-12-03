import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode, QrCodeType } from './entities/qr-code.entity';

@Injectable()
export class QrCodeRefreshService {
  constructor(
    @InjectRepository(QrCode) private qrCodeRepo: Repository<QrCode>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshDynamicQRCodes() {
    const now = new Date();
    const qrCodes = await this.qrCodeRepo.find({ where: { type: QrCodeType.DYNAMIC, isActive: true } });
    for (const qr of qrCodes) {
      qr.token = this.generateQrToken();
      qr.lastRefreshedAt = now;
      qr.expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
      await this.qrCodeRepo.save(qr);
    }
  }

  private generateQrToken(): string {
    const bytes = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(bytes);
    } else if (typeof require !== 'undefined') {
      require('crypto').randomFillSync(bytes);
    }
    return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
