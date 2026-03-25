import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { QrCode, QrCodeType } from '../entities/qr-code.entity';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { Job } from '../../job/entities/job.entity';
import { Client } from '../../clients/entities/client.entity';
import { ClientUser } from '../../clients/entities/client-user.entity';
import { QrTokenGenerator } from '../helpers/qr-token-generator';
import { QrImageGenerator } from '../helpers/qr-image-generator';
import { QrMerger } from '../helpers/qr-merger';
import { UpdateWorkCenterQrDto, WorkCenterQrResponseDto } from '../dto/update-work-center-qr.dto';
import { MergedQrResponse, MergedQrData } from '../interfaces/qr-interfaces';
import { JobScheduleService } from '../../job/services/job-schedule.service';

@Injectable()
export class QrCodeService {
  constructor(
    @InjectRepository(QrCode)
    private qrCodeRepo: Repository<QrCode>,
    @InjectRepository(WorkCenter)
    private workCenterRepo: Repository<WorkCenter>,
    @InjectRepository(Job)
    private jobRepo: Repository<Job>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(ClientUser)
    private clientUserRepo: Repository<ClientUser>,
    private jobScheduleService: JobScheduleService,
  ) {}

  /**
   * Update QR code configuration for a work center
   */
  async updateWorkCenterQr(
    workCenterId: number,
    dto: UpdateWorkCenterQrDto,
    employerId: number,
  ): Promise<WorkCenterQrResponseDto> {
    // Verify work center exists
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
    });

    if (!workCenter) {
      throw new NotFoundException(`Work center with ID ${workCenterId} not found`);
    }

    // Note: Permission is handled by CASL at the controller level
    // Employers can manage work centers they own directly OR through their clients

    const { selectedType, active } = dto;

    // Update the explicit boolean flag on the work center
    workCenter.isQrcodeActive = active;
    await this.workCenterRepo.save(workCenter);

    if (!active) {
      // Deactivate all QR codes for this work center
      await this.qrCodeRepo.update(
        { workCenterId },
        { isActive: false, isSelected: false },
      );

      return {
        staticQr: null,
        dynamicQr: null,
      };
    }

    // Handle QR code generation based on selected type
    if (selectedType === QrCodeType.STATIC) {
      return await this.activateStaticQr(workCenterId);
    } else {
      return await this.activateDynamicQr(workCenterId);
    }
  }

  /**
   * Activate static QR (also auto-generates dynamic as fallback)
   */
  private async activateStaticQr(workCenterId: number): Promise<WorkCenterQrResponseDto> {
    const now = new Date();

    // Find or create static QR
    let staticQr = await this.qrCodeRepo.findOne({
      where: { workCenterId, type: QrCodeType.STATIC },
    });

    if (!staticQr) {
      staticQr = this.qrCodeRepo.create({
        workCenterId,
        type: QrCodeType.STATIC,
        token: QrTokenGenerator.generateStaticToken(),
        isActive: true,
        isSelected: true,
        expiresAt: null,
        lastRefreshedAt: null,
      });
    } else {
      staticQr.isActive = true;
      staticQr.isSelected = true;
    }

    await this.qrCodeRepo.save(staticQr);

    // Deactivate dynamic QR (only ONE type can be active at a time)
    await this.qrCodeRepo.update(
      { workCenterId, type: QrCodeType.DYNAMIC },
      { isActive: false, isSelected: false },
    );

    // Generate QR image
    const staticQrImage = await QrImageGenerator.generateQrImage(staticQr.token);

    return {
      staticQr: {
        id: staticQr.id,
        token: staticQr.token,
        qrImage: staticQrImage,
        type: staticQr.type,
        isSelected: staticQr.isSelected,
        isActive: staticQr.isActive,
        expiresAt: null,
      },
      dynamicQr: null,
    };
  }

  /**
   * Activate dynamic QR only (deactivate static)
   */
  private async activateDynamicQr(workCenterId: number): Promise<WorkCenterQrResponseDto> {
    const now = new Date();

    // Deactivate static QR if exists
    await this.qrCodeRepo.update(
      { workCenterId, type: QrCodeType.STATIC },
      { isActive: false, isSelected: false },
    );

    // Find or create dynamic QR
    let dynamicQr = await this.qrCodeRepo.findOne({
      where: { workCenterId, type: QrCodeType.DYNAMIC },
    });

    if (!dynamicQr) {
      dynamicQr = this.qrCodeRepo.create({
        workCenterId,
        type: QrCodeType.DYNAMIC,
        token: QrTokenGenerator.generateDynamicToken(),
        isActive: true,
        isSelected: true,
        expiresAt: QrTokenGenerator.calculateDynamicExpiry(),
        lastRefreshedAt: now,
      });
    } else {
      dynamicQr.isActive = true;
      dynamicQr.isSelected = true;
      dynamicQr.token = QrTokenGenerator.generateDynamicToken();
      dynamicQr.expiresAt = QrTokenGenerator.calculateDynamicExpiry();
      dynamicQr.lastRefreshedAt = now;
    }

    await this.qrCodeRepo.save(dynamicQr);

    // Generate QR image
    const dynamicQrImage = await QrImageGenerator.generateQrImage(dynamicQr.token);

    return {
      staticQr: null,
      dynamicQr: {
        id: dynamicQr.id,
        token: dynamicQr.token,
        qrImage: dynamicQrImage,
        type: dynamicQr.type,
        isSelected: dynamicQr.isSelected,
        isActive: dynamicQr.isActive,
        expiresAt: dynamicQr.expiresAt,
        lastRefreshedAt: dynamicQr.lastRefreshedAt,
      },
    };
  }

  /**
   * Get QR codes for a work center
   */
  async getWorkCenterQrCodes(workCenterId: number): Promise<WorkCenterQrResponseDto> {
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
    });

    if (!workCenter) {
      throw new NotFoundException(`Work center with ID ${workCenterId} not found`);
    }

    const qrCodes = await this.qrCodeRepo.find({
      where: { workCenterId, isActive: true },
    });

    const staticQr = qrCodes.find(qr => qr.type === QrCodeType.STATIC);
    const dynamicQr = qrCodes.find(qr => qr.type === QrCodeType.DYNAMIC);

    const response: WorkCenterQrResponseDto = {
      staticQr: null,
      dynamicQr: null,
    };

    if (staticQr) {
      response.staticQr = {
        id: staticQr.id,
        token: staticQr.token,
        qrImage: await QrImageGenerator.generateQrImage(staticQr.token),
        type: staticQr.type,
        isSelected: staticQr.isSelected,
        isActive: staticQr.isActive,
        expiresAt: null,
      };
    }

    if (dynamicQr) {
      response.dynamicQr = {
        id: dynamicQr.id,
        token: dynamicQr.token,
        qrImage: await QrImageGenerator.generateQrImage(dynamicQr.token),
        type: dynamicQr.type,
        isSelected: dynamicQr.isSelected,
        isActive: dynamicQr.isActive,
        expiresAt: dynamicQr.expiresAt,
        lastRefreshedAt: dynamicQr.lastRefreshedAt,
      };
    }

    return response;
  }

  /**
   * Get merged dynamic QR for a job (includes all work centers)
   */
  async getMergedDynamicQrForJob(publicId: string): Promise<MergedQrResponse> {
    const job = await this.jobRepo.findOne({
      where: { publicId },
      relations: ['workCenters'],
    });

    if (!job) {
      throw new NotFoundException(`Job with public ID ${publicId} not found`);
    }

    if (!job.workCenters || job.workCenters.length === 0) {
      throw new BadRequestException('Job has no associated work centers');
    }

    // Get all QR codes for all work centers of this job
    const workCenterIds = job.workCenters.map(wc => wc.id);
    const qrCodes = await this.qrCodeRepo.find({
      where: workCenterIds.map(wcId => ({ workCenterId: wcId, isActive: true })),
      relations: ['workCenter'],
    });

    if (qrCodes.length === 0) {
      throw new NotFoundException('No active QR codes found for this job');
    }

    // Group QR codes by work center
    const workCenterMap = new Map<number, { name: string; address: string; qrCodes: QrCode[] }>();
    
    for (const qrCode of qrCodes) {
      const wcId = qrCode.workCenter.id;
      if (!workCenterMap.has(wcId)) {
        workCenterMap.set(wcId, {
          name: qrCode.workCenter.name,
          address: qrCode.workCenter.address,
          qrCodes: [],
        });
      }
      workCenterMap.get(wcId).qrCodes.push(qrCode);
    }

    // Build merged token data for all work centers
    const workCentersData: Array<{ id: number; name: string; tokens: string[]; type: 'static' | 'dynamic' }> = [];
    const workCentersResult: Array<{ id: number; name: string; qrType: 'static' | 'dynamic'; address: string }> = [];
    let earliestExpiry: Date | null = null;

    for (const [wcId, data] of workCenterMap.entries()) {
      const tokens: string[] = [];
      const staticQr = data.qrCodes.find(qr => qr.type === QrCodeType.STATIC);
      const dynamicQr = data.qrCodes.find(qr => qr.type === QrCodeType.DYNAMIC);

      // Include only the selected type's token (no fallback)
      if (staticQr?.isSelected) {
        tokens.push(staticQr.token);
      } else if (dynamicQr?.isSelected) {
        tokens.push(dynamicQr.token);
        if (dynamicQr.expiresAt && (!earliestExpiry || dynamicQr.expiresAt < earliestExpiry)) {
          earliestExpiry = dynamicQr.expiresAt;
        }
      }

      if (tokens.length > 0) {
        workCentersData.push({
          id: wcId,
          name: data.name,
          tokens,
          type: staticQr?.isSelected ? 'static' : 'dynamic',
        });

        workCentersResult.push({
          id: wcId,
          name: data.name,
          qrType: staticQr?.isSelected ? 'static' : 'dynamic',
          address: data.address,
        });
      }
    }

    if (workCentersData.length === 0) {
      throw new NotFoundException('No selected QR codes found for this job');
    }

    const mergedData: MergedQrData = {
      workCenters: workCentersData,
      jobId: job.id,
      generatedAt: new Date().toISOString(),
    };

    const mergedToken = QrMerger.createMergedToken(mergedData);
    const qrImage = await QrMerger.generateMergedQrImage(mergedToken);

    return {
      qrImage,
      mergedToken,
      workCenters: workCentersResult,
      expiresAt: earliestExpiry,
      refreshInterval: 30000, // 30 seconds in milliseconds
      generatedAt: new Date(),
    };
  }

  /**
   * Regenerate static QR code (expires old token)
   */
  async regenerateStaticQr(workCenterId: number): Promise<WorkCenterQrResponseDto> {
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
    });

    if (!workCenter) {
      throw new NotFoundException(`Work center with ID ${workCenterId} not found`);
    }

    // Find existing ACTIVE static QR (not old deactivated ones)
    const existingStaticQr = await this.qrCodeRepo.findOne({
      where: { 
        workCenterId, 
        type: QrCodeType.STATIC,
        isActive: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!existingStaticQr) {
      throw new NotFoundException('No active static QR code found for this work center');
    }

    // Deactivate old token (mark as expired)
    const wasSelected = existingStaticQr.isSelected || existingStaticQr.isActive;
    existingStaticQr.isActive = false;
    existingStaticQr.isSelected = false;
    await this.qrCodeRepo.save(existingStaticQr);

    // Create new static QR with new token (preserve selected state)
    const newStaticQr = this.qrCodeRepo.create({
      workCenterId,
      type: QrCodeType.STATIC,
      token: QrTokenGenerator.generateStaticToken(),
      isActive: wasSelected,
      isSelected: wasSelected,
      expiresAt: null,
      lastRefreshedAt: null,
    });

    await this.qrCodeRepo.save(newStaticQr);

    // Generate QR image
    const qrImage = await QrImageGenerator.generateQrImage(newStaticQr.token);

    return {
      staticQr: {
        id: newStaticQr.id,
        token: newStaticQr.token,
        qrImage,
        type: newStaticQr.type,
        isSelected: newStaticQr.isSelected,
        isActive: newStaticQr.isActive,
        expiresAt: null,
      },
      dynamicQr: null,
    };
  }

  /**
   * Get merged dynamic QR for all jobs scheduled TODAY for a client
   * This implements the Schedule-Based Job Filtering and Activation Rules:
   * 1. Filter jobs scheduled for today only
   * 2. Collect work centers from all today's jobs
   * 3. Only include work centers with explicitly activated QR codes (isSelected = true)
   * 4. Generate merged QR code
   */
  async getMergedDynamicQrForClient(publicId: string): Promise<MergedQrResponse> {
    const today = new Date();

    // Resolve publicId to numeric client id
    const client = await this.clientRepo.findOne({ where: { publicId } });
    if (!client) {
      throw new NotFoundException(`Client with public ID ${publicId} not found`);
    }
    const clientId = client.id;

    // 1. Get all jobs for this client
    const allJobs = await this.jobRepo.find({
      where: { client: { id: clientId } },
      relations: ['workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts', 'client'],
    });

    if (allJobs.length === 0) {
      throw new NotFoundException('No jobs found for this client');
    }

    // Get client name from the first job
    const clientName = allJobs[0]?.client?.name || 'Cliente';

    // 2. Filter jobs scheduled for today using JobScheduleService
    const todayJobs = this.jobScheduleService.filterJobsScheduledForDate(allJobs, today);

    if (todayJobs.length === 0) {
      throw new NotFoundException({
        message: 'No jobs scheduled for today',
        statusCode: 404,
        error: 'NO_JOBS_TODAY',
        details: {
          clientId,
          date: today.toISOString().split('T')[0],
          totalJobs: allJobs.length,
        },
      });
    }

    // 3. Collect all work centers from today's jobs (remove duplicates)
    const workCenterIds = new Set<number>();
    const jobWorkCenterMap = new Map<string, number[]>(); // Track which job has which WCs
    
    todayJobs.forEach(job => {
      const wcIds = job.workCenters?.map(wc => wc.id) || [];
      jobWorkCenterMap.set(job.jobName, wcIds);
      
      job.workCenters?.forEach(wc => workCenterIds.add(wc.id));
    });

    if (workCenterIds.size === 0) {
      throw new BadRequestException('Today\'s jobs have no associated work centers');
    }

    // 4. Get QR codes for these work centers
    // CRITICAL: Only include if isSelected = true AND isActive = true
    const qrCodes = await this.qrCodeRepo.find({
      where: {
        workCenterId: In(Array.from(workCenterIds)),
        isActive: true,
        isSelected: true, // CRITICAL: Must be explicitly selected by employer
      },
      relations: ['workCenter'],
    });

    if (qrCodes.length === 0) {
      throw new NotFoundException({
        message: 'No active QR codes found for today\'s scheduled jobs',
        statusCode: 404,
        error: 'NO_ACTIVE_QR',
        details: {
          scheduledJobs: todayJobs.map(j => ({ id: j.id, name: j.jobName })),
          workCenterIds: Array.from(workCenterIds),
          suggestion: 'Employer must activate QR codes for work centers',
        },
      });
    }

    // 5. Group QR codes by work center (same logic as getMergedDynamicQrForJob)
    const workCenterMap = new Map<number, { name: string; address: string; qrCodes: QrCode[] }>();
    
    for (const qrCode of qrCodes) {
      const wcId = qrCode.workCenter.id;
      if (!workCenterMap.has(wcId)) {
        workCenterMap.set(wcId, {
          name: qrCode.workCenter.name,
          address: qrCode.workCenter.address || '',
          qrCodes: [],
        });
      }
      workCenterMap.get(wcId).qrCodes.push(qrCode);
    }

    // 6. Build merged token data for all work centers
    const workCentersData: Array<{ id: number; name: string; tokens: string[]; type: 'static' | 'dynamic' }> = [];
    const workCentersResult: Array<{ id: number; name: string; qrType: 'static' | 'dynamic'; address: string }> = [];
    let earliestExpiry: Date | null = null;

    for (const [wcId, data] of workCenterMap.entries()) {
      const tokens: string[] = [];
      const staticQr = data.qrCodes.find(qr => qr.type === QrCodeType.STATIC && qr.isSelected);
      const dynamicQr = data.qrCodes.find(qr => qr.type === QrCodeType.DYNAMIC && qr.isSelected);

      // Include only the selected type's token (no fallback)
      if (staticQr) {
        tokens.push(staticQr.token);
      } else if (dynamicQr) {
        tokens.push(dynamicQr.token);
        if (dynamicQr.expiresAt && (!earliestExpiry || dynamicQr.expiresAt < earliestExpiry)) {
          earliestExpiry = dynamicQr.expiresAt;
        }
      }

      if (tokens.length > 0) {
        workCentersData.push({
          id: wcId,
          name: data.name,
          tokens,
          type: staticQr ? 'static' : 'dynamic',
        });

        workCentersResult.push({
          id: wcId,
          name: data.name,
          qrType: staticQr ? 'static' : 'dynamic',
          address: data.address,
        });
      }
    }

    if (workCentersData.length === 0) {
      throw new NotFoundException('No selected QR codes found for today\'s jobs');
    }

    // 7. Generate merged QR token and image
    const mergedData: MergedQrData = {
      workCenters: workCentersData,
      jobId: todayJobs[0].id, // Reference first job for compatibility
      generatedAt: new Date().toISOString(),
    };

    const mergedToken = QrMerger.createMergedToken(mergedData);
    const qrImage = await QrMerger.generateMergedQrImage(mergedToken);

    return {
      qrImage,
      mergedToken,
      workCenters: workCentersResult,
      expiresAt: earliestExpiry,
      refreshInterval: 30000, // 30 seconds in milliseconds
      generatedAt: new Date(),
      scheduledJobs: todayJobs.map(j => ({ id: j.id, jobName: j.jobName })),
      clientName,
    };
  }

  /**
   * Get today's merged QR for an authenticated client user
   * Looks up the client ID from the user ID, then calls getMergedDynamicQrForClient
   */
  async getMergedDynamicQrForClientUser(userId: number): Promise<MergedQrResponse> {
    // Find the client associated with this user
    const clientUser = await this.clientUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['client'],
    });

    if (!clientUser?.client?.publicId) {
      throw new NotFoundException('Client not found for this user');
    }

    // Delegate to existing method via publicId
    return this.getMergedDynamicQrForClient(clientUser.client.publicId);
  }
}
