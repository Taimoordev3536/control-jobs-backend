import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode, QrCodeType } from '../entities/qr-code.entity';
import { Job } from '../../job/entities/job.entity';
import { QrMerger } from '../helpers/qr-merger';
import { QrValidationResult } from '../interfaces/qr-interfaces';
import { JobScheduleService } from '../../job/services/job-schedule.service';

@Injectable()
export class QrValidationService {
  constructor(
    @InjectRepository(QrCode)
    private qrCodeRepo: Repository<QrCode>,
    @InjectRepository(Job)
    private jobRepo: Repository<Job>,
    private jobScheduleService: JobScheduleService,
  ) {}

  /**
   * Validate a QR token against a job's work centers
   * @param scannedToken - The QR token scanned by worker
   * @param jobId - The job ID for validation
   * @param enforceTodaySchedule - Whether to enforce that job must be scheduled today (default: false for backward compatibility)
   */
  async validateQrToken(
    scannedToken: string,
    jobId: number,
    enforceTodaySchedule: boolean = false,
  ): Promise<QrValidationResult> {
    // Check if it's a merged token
    if (QrMerger.isMergedToken(scannedToken)) {
      return await this.validateMergedToken(scannedToken, jobId, enforceTodaySchedule);
    }

    // Single token validation
    return await this.validateSingleToken(scannedToken, jobId, enforceTodaySchedule);
  }

  /**
   * Validate a merged QR token
   */
  private async validateMergedToken(
    mergedToken: string,
    jobId: number,
    enforceTodaySchedule: boolean = false,
  ): Promise<QrValidationResult> {
    const mergedData = QrMerger.parseMergedToken(mergedToken);

    if (!mergedData || mergedData.jobId !== jobId) {
      return {
        valid: false,
        message: 'Invalid merged QR code or job mismatch',
      };
    }

    // Validate each work center's tokens
    for (const wc of mergedData.workCenters) {
      for (const token of wc.tokens) {
        const result = await this.validateSingleToken(token, jobId, enforceTodaySchedule);
        if (result.valid) {
          return {
            valid: true,
            workCenterId: wc.id,
            workCenterName: wc.name,
            qrType: result.qrType,
            message: 'Merged QR code validated successfully',
          };
        }
      }
    }

    return {
      valid: false,
      message: 'No valid tokens found in merged QR code',
    };
  }

  /**
   * Validate a single QR token
   */
  private async validateSingleToken(
    token: string,
    jobId: number,
    enforceTodaySchedule: boolean = false,
  ): Promise<QrValidationResult> {
    // Get job with work centers and seasonal schedules (for schedule validation)
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts'],
    });

    if (!job) {
      return {
        valid: false,
        message: 'Job not found',
      };
    }

    // SCHEDULE ENFORCEMENT: Check if job is scheduled for today
    if (enforceTodaySchedule) {
      const today = new Date();
      const isScheduledToday = this.jobScheduleService.isJobScheduledForDate(job, today);

      if (!isScheduledToday) {
        return {
          valid: false,
          message: 'This job is not scheduled for today. QR code scan rejected.',
        };
      }
    }

    if (!job.workCenters || job.workCenters.length === 0) {
      return {
        valid: false,
        message: 'Job has no associated work centers',
      };
    }

    // Get all active QR codes for all work centers of this job
    const workCenterIds = job.workCenters.map(wc => wc.id);
    const qrCodes = await this.qrCodeRepo.find({
      where: workCenterIds.map(wcId => ({ workCenterId: wcId, isActive: true })),
      relations: ['workCenter'],
    });

    const now = new Date();

    // Check each QR code
    for (const qrCode of qrCodes) {
      if (qrCode.token === token) {
        // Only validate if this QR is selected (not just active)
        if (!qrCode.isSelected) {
          continue;
        }

        // Check if it's a static QR
        if (qrCode.type === QrCodeType.STATIC) {
          return {
            valid: true,
            workCenterId: qrCode.workCenterId,
            workCenterName: qrCode.workCenter.name,
            qrType: 'static',
            message: 'Static QR code validated',
          };
        }

        // Check if it's a dynamic QR
        if (qrCode.type === QrCodeType.DYNAMIC) {
          // Check expiry
          if (qrCode.expiresAt && qrCode.expiresAt > now) {
            return {
              valid: true,
              workCenterId: qrCode.workCenterId,
              workCenterName: qrCode.workCenter.name,
              qrType: 'dynamic',
              message: 'Dynamic QR code validated',
            };
          } else {
            return {
              valid: false,
              message: 'Dynamic QR code has expired',
            };
          }
        }
      }
    }

    return {
      valid: false,
      message: 'QR code not found or not active for this job',
    };
  }

  /**
   * Validate QR token for any work center (used for testing)
   */
  async validateQrTokenForWorkCenter(
    token: string,
    workCenterId: number,
  ): Promise<QrValidationResult> {
    const qrCodes = await this.qrCodeRepo.find({
      where: { workCenterId, isActive: true },
      relations: ['workCenter'],
    });

    const now = new Date();

    for (const qrCode of qrCodes) {
      if (qrCode.token === token) {
        if (qrCode.type === QrCodeType.STATIC && qrCode.isActive) {
          return {
            valid: true,
            workCenterId: qrCode.workCenterId,
            workCenterName: qrCode.workCenter.name,
            qrType: 'static',
          };
        }

        if (
          qrCode.type === QrCodeType.DYNAMIC &&
          qrCode.expiresAt &&
          qrCode.expiresAt > now &&
          qrCode.isActive
        ) {
          return {
            valid: true,
            workCenterId: qrCode.workCenterId,
            workCenterName: qrCode.workCenter.name,
            qrType: 'dynamic',
          };
        }
      }
    }

    return { valid: false, message: 'Invalid or expired QR code' };
  }
}
