import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode, QrCodeType } from '../entities/qr-code.entity';
import { QrTokenGenerator } from '../helpers/qr-token-generator';

@Injectable()
export class QrRefreshService {
  private readonly logger = new Logger(QrRefreshService.name);
  private isRefreshing = false;

  constructor(
    @InjectRepository(QrCode)
    private qrCodeRepo: Repository<QrCode>,
  ) {}

  /**
   * Refresh all active dynamic QR codes every 30 seconds
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async refreshDynamicQRCodes() {
    // Prevent overlapping executions
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      const now = new Date();
      
      // Find all dynamic QR codes that are active
      const dynamicQrCodes = await this.qrCodeRepo.find({
        where: { 
          type: QrCodeType.DYNAMIC,
          isActive: true,
        },
      });

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
        }
      }
    } catch (error) {
      // AggregateError wraps multiple underlying errors (e.g. DB connection pool failures)
      // Expand inner errors for visibility
      if (error instanceof AggregateError) {
        this.logger.error(
          `❌ Error refreshing dynamic QR codes (AggregateError with ${error.errors?.length ?? 0} inner error(s)):`,
        );
        (error.errors ?? []).forEach((inner: Error, i: number) => {
          this.logger.error(`  [${i}] ${inner?.message ?? inner}`);
        });
      } else {
        this.logger.error(
          `❌ Error refreshing dynamic QR codes: ${(error as Error)?.message ?? error}`,
        );
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Determine if a dynamic QR should be refreshed
   * Refresh only if it's selected (no fallback logic)
   */
  private async shouldRefreshDynamicQr(dynamicQr: QrCode): Promise<boolean> {
    // Only refresh if dynamic is selected
    return dynamicQr.isSelected === true;
  }

  /**
   * Manually refresh a specific work center's dynamic QR
   */
  async refreshWorkCenterDynamicQr(workCenterId: number): Promise<void> {
    const dynamicQr = await this.qrCodeRepo.findOne({
      where: {
        workCenterId,
        type: QrCodeType.DYNAMIC,
        isActive: true,
      },
    });

    if (!dynamicQr) {
      return;
    }

    const now = new Date();
    dynamicQr.token = QrTokenGenerator.generateDynamicToken();
    dynamicQr.expiresAt = QrTokenGenerator.calculateDynamicExpiry();
    dynamicQr.lastRefreshedAt = now;

    await this.qrCodeRepo.save(dynamicQr);
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
