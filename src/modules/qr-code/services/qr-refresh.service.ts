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

      // Only selected QRs get refreshed, so filter in SQL instead of in memory
      const dynamicQrCodes = await this.qrCodeRepo.find({
        select: ['id'],
        where: {
          type: QrCodeType.DYNAMIC,
          isActive: true,
          isSelected: true,
        },
      });

      if (dynamicQrCodes.length === 0) return;

      // One batched UPDATE instead of a save() per row: each row still gets
      // its own unique token, but the DB round trip happens once.
      const expiresAt = QrTokenGenerator.calculateDynamicExpiry();
      const values: string[] = [];
      const params: any[] = [now, expiresAt];
      dynamicQrCodes.forEach((qr, i) => {
        params.push(qr.id, QrTokenGenerator.generateDynamicToken());
        values.push(`($${params.length - 1}::uuid, $${params.length})`);
      });

      // Carry the outgoing token into previousToken so a code scanned just
      // before this rotation still validates while the worker completes the
      // GPS/work-center step. Its grace window is the rotation period itself.
      await this.qrCodeRepo.query(
        `UPDATE qr_codes AS q
            SET "previousToken" = q.token,
                "previousExpiresAt" = $2,
                token = v.token,
                "expiresAt" = $2,
                "lastRefreshedAt" = $1,
                "updatedAt" = CURRENT_TIMESTAMP
           FROM (VALUES ${values.join(', ')}) AS v(id, token)
          WHERE q.id = v.id`,
        params,
      );
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
