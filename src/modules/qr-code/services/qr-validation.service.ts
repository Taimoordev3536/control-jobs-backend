import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { QrCode, QrCodeType } from '../entities/qr-code.entity';
import { Job } from '../../job/entities/job.entity';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { QrMerger } from '../helpers/qr-merger';
import { QrValidationResult } from '../interfaces/qr-interfaces';
import { JobScheduleService } from '../../job/services/job-schedule.service';
import { madridCivilToday } from '../../../common/helpers/business-time';

/**
 * Floor for "is the nearest work center clearly the nearest?". A phone reporting
 * better accuracy than this indoors is usually optimistic, so never trust a gap
 * smaller than this even when the device claims a tight fix.
 */
const MIN_GPS_DECISION_MARGIN_M = 25;

export interface GpsSelectionResult {
  selectionType: 'auto' | 'manual';
  workCenterId?: number;
  workCenters?: Array<{
    id: number;
    name: string;
    address: string;
    distance: number;
  }>;
  message: string;
}

@Injectable()
export class QrValidationService {
  constructor(
    @InjectRepository(QrCode)
    private qrCodeRepo: Repository<QrCode>,
    @InjectRepository(Job)
    private jobRepo: Repository<Job>,
    @InjectRepository(WorkCenter)
    private workCenterRepo: Repository<WorkCenter>,
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
    requiredWorkCenterId?: number,
  ): Promise<QrValidationResult> {
    // Check if it's a merged token
    if (QrMerger.isMergedToken(scannedToken)) {
      return await this.validateMergedToken(
        scannedToken,
        jobId,
        enforceTodaySchedule,
        requiredWorkCenterId,
      );
    }

    // Single token validation
    const result = await this.validateSingleToken(scannedToken, jobId, enforceTodaySchedule);
    if (
      result.valid &&
      requiredWorkCenterId !== undefined &&
      result.workCenterId !== requiredWorkCenterId
    ) {
      return {
        valid: false,
        message: 'The scanned QR code does not belong to the selected work center.',
      };
    }
    return result;
  }

  /**
   * Validate a merged QR token
   */
  private async validateMergedToken(
    mergedToken: string,
    jobId: number,
    enforceTodaySchedule: boolean = false,
    requiredWorkCenterId?: number,
  ): Promise<QrValidationResult> {
    const mergedData = QrMerger.parseMergedToken(mergedToken);

    if (!mergedData) {
      return {
        valid: false,
        message: 'Invalid merged QR code — could not parse token',
      };
    }

    // NOTE: We intentionally do NOT enforce mergedData.jobId === jobId here.
    // The "today merged QR" embeds only the first job's ID for legacy reasons but
    // contains work-center tokens from ALL of today's jobs.
    // Worker-to-job assignment is already enforced in recordScan before this call.
    // We instead check whether any token in this merged QR belongs to a work center
    // of the worker's actual job (via validateSingleToken).

    // Validate each work center's tokens against the worker's job. When the
    // worker picked a work center (GPS/manual selector), only a token belonging
    // to THAT work center counts — otherwise the selection would let any token
    // in the merged QR stand in for any other.
    for (const wc of mergedData.workCenters) {
      for (const token of wc.tokens) {
        const result = await this.validateSingleToken(token, jobId, enforceTodaySchedule);
        if (result.valid) {
          const resolvedWcId = result.workCenterId ?? wc.id;
          if (requiredWorkCenterId !== undefined && resolvedWcId !== requiredWorkCenterId) {
            continue;
          }
          return {
            valid: true,
            workCenterId: result.workCenterId ?? wc.id,
            workCenterName: result.workCenterName ?? wc.name,
            qrType: result.qrType,
            message: 'Merged QR code validated successfully',
          };
        }
      }
    }

    return {
      valid: false,
      message:
        requiredWorkCenterId !== undefined
          ? 'The scanned QR code does not belong to the selected work center, or it has expired. Please rescan.'
          : 'No valid tokens found in merged QR code for this job',
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
      // Madrid civil day — the schedule readers compare local civil fields.
      const today = madridCivilToday();
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
      // A dynamic code rotates every 30s while the worker is still completing
      // GPS/work-center selection, so the token they scanned may already be the
      // previous one. Accept it until its own grace expiry passes.
      const isCurrent = qrCode.token === token;
      const isWithinGrace =
        !isCurrent &&
        !!qrCode.previousToken &&
        qrCode.previousToken === token &&
        !!qrCode.previousExpiresAt &&
        qrCode.previousExpiresAt > now;

      if (isCurrent || isWithinGrace) {
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
          if (isWithinGrace || (qrCode.expiresAt && qrCode.expiresAt > now)) {
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
   * GPS-based work center auto-selection for dynamic/merged QR codes.
   * Returns auto-selected work center if exactly one is within radius,
   * otherwise returns all eligible work centers for manual selection.
   */
  async selectWorkCenterByGps(
    mergedToken: string,
    workerLat?: number,
    workerLng?: number,
    jobId?: number,
    accuracyMeters?: number,
  ): Promise<GpsSelectionResult> {
    const mergedData = QrMerger.parseMergedToken(mergedToken);

    if (!mergedData) {
      return { selectionType: 'manual', message: 'Invalid merged QR token — manual selection required' };
    }

    const hasFix =
      workerLat != null && workerLng != null && !(workerLat === 0 && workerLng === 0);

    let workCenterIds = mergedData.workCenters.map(wc => wc.id);

    // When a jobId is provided, restrict to only work centers that belong to this job
    // AND are present in the merged QR token (i.e. have a merged/dynamic QR code)
    if (jobId) {
      const job = await this.jobRepo.findOne({
        where: { id: jobId },
        relations: ['workCenters'],
      });
      if (job?.workCenters?.length) {
        const jobWcIds = new Set(job.workCenters.map(wc => wc.id));
        workCenterIds = workCenterIds.filter(id => jobWcIds.has(id));
      }
    }

    if (workCenterIds.length === 0) {
      return { selectionType: 'manual', workCenters: [], message: 'No work centers in this job match the scanned QR code.' };
    }

    const workCenters = await this.workCenterRepo.find({
      where: { id: In(workCenterIds) },
    });

    // Only one work center of this job is in the scanned code — there is nothing
    // to disambiguate, so don't make the worker wait for GPS or tap a list.
    if (workCenters.length === 1) {
      return {
        selectionType: 'auto',
        workCenterId: workCenters[0].id,
        message: `"${workCenters[0].name}"`,
      };
    }

    // Without a fix there is nothing to rank by; ask.
    const nearby = !hasFix
      ? []
      : workCenters
          .filter(wc => wc.latitude != null && wc.longitude != null)
          .map(wc => ({
            id: wc.id,
            name: wc.name,
            address: wc.address,
            distance: this.calculateDistance(
              workerLat!, workerLng!,
              Number(wc.latitude), Number(wc.longitude),
            ),
            radius: wc.gpsRadius ?? 100,
          }))
          .filter(wc => wc.distance <= wc.radius)
          .sort((a, b) => a.distance - b.distance);

    if (nearby.length === 1) {
      return {
        selectionType: 'auto',
        workCenterId: nearby[0].id,
        message: `Auto-selected "${nearby[0].name}" (${Math.round(nearby[0].distance)}m away)`,
      };
    }

    // Several in range: auto-pick only when the winner is clearly closer than the
    // runner-up. Sites in one building can sit metres apart, and a phone fix is
    // routinely ±20m indoors — guessing there would silently file attendance
    // against the wrong work center, which is worse than one extra tap.
    if (nearby.length > 1) {
      const margin = Math.max(accuracyMeters ?? 0, MIN_GPS_DECISION_MARGIN_M);
      if (nearby[1].distance - nearby[0].distance > margin) {
        return {
          selectionType: 'auto',
          workCenterId: nearby[0].id,
          message: `Auto-selected "${nearby[0].name}" (${Math.round(nearby[0].distance)}m away)`,
        };
      }
    }

    // Zero or multiple nearby — fall back to manual.
    // Include ALL work centers from the token (not just GPS-configured ones) so the
    // worker is never stuck even if GPS coordinates are missing.
    const allForManual = workCenters.map(wc => ({
      id: wc.id,
      name: wc.name,
      address: wc.address,
      distance:
        hasFix && wc.latitude != null && wc.longitude != null
          ? this.calculateDistance(workerLat!, workerLng!, Number(wc.latitude), Number(wc.longitude))
          : -1,
    }));

    return {
      selectionType: 'manual',
      workCenters: allForManual,
      message: !hasFix
        ? 'Select your work center'
        : nearby.length === 0
          ? 'No work center found near you — please select yours'
          : 'Several work centers are close together — please select yours',
    };
  }

  /** Haversine distance in metres between two GPS coordinates */
  private calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
  ): number {
    const R = 6_371_000; // Earth radius in metres
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
