import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode, QrCodeType } from '../entities/qr-code.entity';
import { QrTokenGenerator } from '../helpers/qr-token-generator';

@Injectable()
export class QrRefreshService {
  private readonly logger = new Logger(QrRefreshService.name);

  constructor(
    @InjectRepository(QrCode)
    private qrCodeRepo: Repository<QrCode>,
  ) {}

  /**
   * Refresh all active dynamic QR codes every 3 minutes
   */
  @Cron('*/3 * * * *') // Every 3 minutes
  async refreshDynamicQRCodes() {
    this.logger.log('🔄 Starting dynamic QR code refresh...');

    try {
      const now = new Date();
      
      // Find all dynamic QR codes that are active
      const dynamicQrCodes = await this.qrCodeRepo.find({
        where: { 
          type: QrCodeType.DYNAMIC,
          isActive: true,
        },
      });

      this.logger.log(`Found ${dynamicQrCodes.length} active dynamic QR codes`);

      let refreshedCount = 0;

      for (const qrCode of dynamicQrCodes) {
        // Check if this dynamic QR should be refreshed
        const shouldRefresh = await this.shouldRefreshDynamicQr(qrCode);

        if (shouldRefresh) {
          // Generate new token
          qrCode.token = QrTokenGenerator.generateDynamicToken();
          qrCode.expiresAt = QrTokenGenerator.calculateDynamicExpiry();
          qrCode.lastRefreshedAt = now;

          await this.qrCodeRepo.save(qrCode);
          refreshedCount++;

          this.logger.debug(
            `✅ Refreshed dynamic QR for work center ${qrCode.workCenterId}`,
          );
        }
      }

      this.logger.log(
        `✅ Dynamic QR refresh completed: ${refreshedCount}/${dynamicQrCodes.length} refreshed`,
      );
    } catch (error) {
      this.logger.error('❌ Error refreshing dynamic QR codes:', error);
    }
  }

  /**
   * Determine if a dynamic QR should be refreshed
   * Refresh if:
   * 1. It's selected (primary choice), OR
   * 2. Static QR is selected (dynamic is fallback)
   */
  private async shouldRefreshDynamicQr(dynamicQr: QrCode): Promise<boolean> {
    // If dynamic is selected, always refresh
    if (dynamicQr.isSelected) {
      return true;
    }

    // Check if static sibling exists and is selected
    const staticSibling = await this.qrCodeRepo.findOne({
      where: {
        workCenterId: dynamicQr.workCenterId,
        type: QrCodeType.STATIC,
        isActive: true,
      },
    });

    // If static is selected, dynamic acts as fallback and should be refreshed
    if (staticSibling?.isSelected) {
      return true;
    }

    // Otherwise, don't refresh
    return false;
  }

  /**
   * Manually refresh a specific work center's dynamic QR
   */
  async refreshWorkCenterDynamicQr(workCenterId: number): Promise<void> {
    this.logger.log(`Manually refreshing dynamic QR for work center ${workCenterId}`);

    const dynamicQr = await this.qrCodeRepo.findOne({
      where: {
        workCenterId,
        type: QrCodeType.DYNAMIC,
        isActive: true,
      },
    });

    if (!dynamicQr) {
      this.logger.warn(`No active dynamic QR found for work center ${workCenterId}`);
      return;
    }

    const now = new Date();
    dynamicQr.token = QrTokenGenerator.generateDynamicToken();
    dynamicQr.expiresAt = QrTokenGenerator.calculateDynamicExpiry();
    dynamicQr.lastRefreshedAt = now;

    await this.qrCodeRepo.save(dynamicQr);
    this.logger.log(`✅ Manually refreshed dynamic QR for work center ${workCenterId}`);
  }

  /**
   * Get next refresh time
   */
  getNextRefreshTime(): Date {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextRefreshMinute = Math.ceil((minutes + 1) / 3) * 3;
    
    const nextRefresh = new Date(now);
    nextRefresh.setMinutes(nextRefreshMinute, 0, 0);
    
    if (nextRefresh <= now) {
      nextRefresh.setMinutes(nextRefresh.getMinutes() + 3);
    }
    
    return nextRefresh;
  }
}
