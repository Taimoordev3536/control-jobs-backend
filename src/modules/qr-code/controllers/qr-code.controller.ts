import { Controller, Get, Put, Post, Body, Param, UseGuards, Req, ParseUUIDPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QrCodeService } from '../services/qr-code.service';
import { QrEmailService } from '../services/qr-email.service';
import { QrValidationService } from '../services/qr-validation.service';
import { UpdateWorkCenterQrDto } from '../dto/update-work-center-qr.dto';
import { SendStaticQrEmailDto } from '../dto/send-static-qr-email.dto';
import { UpdateWorkCenterGpsDto } from '../dto/update-work-center-gps.dto';
import { GpsSelectionDto } from '../dto/gps-selection.dto';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { Job } from '../../job/entities/job.entity';

@Controller('work-centers')
@UseGuards(JwtAuthGuard)
export class QrCodeController {
  constructor(
    private readonly qrCodeService: QrCodeService,
    private readonly qrEmailService: QrEmailService,
    private readonly qrValidationService: QrValidationService,
    @InjectRepository(WorkCenter)
    private readonly workCenterRepo: Repository<WorkCenter>,
  ) {}

  /**
   * Get work center details
   * GET /work-centers/:id
   * REMOVED — handled by WorkCentersController which uses ParseUUIDPipe
   */

  private async resolveWorkCenterId(publicId: string): Promise<number> {
    const wc = await this.workCenterRepo.findOne({ where: { publicId } });
    if (!wc) throw new NotFoundException(`Work center not found`);
    return wc.id;
  }

  /**
   * Update QR code configuration for a work center
   * PUT /work-centers/:id/signing-methods/qr
   */
  @Put(':id/signing-methods/qr')
  async updateWorkCenterQr(
    @Param('id', ParseUUIDPipe) publicId: string,
    @Body() dto: UpdateWorkCenterQrDto,
    @Req() req,
  ) {
    const workCenterId = await this.resolveWorkCenterId(publicId);
    const userId = req.user?.id;
    
    // Get employer ID from user
    // TODO: Extract this to a helper or use existing employer resolution
    const employerId = await this.getEmployerIdFromUser(userId);

    const result = await this.qrCodeService.updateWorkCenterQr(
      workCenterId,
      dto,
      employerId,
    );

    return {
      message: 'QR code configuration updated successfully',
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Get QR codes for a work center
   * GET /work-centers/:id/qr-codes
   */
  @Get(':id/qr-codes')
  async getWorkCenterQrCodes(@Param('id', ParseUUIDPipe) publicId: string) {
    const workCenterId = await this.resolveWorkCenterId(publicId);
    const result = await this.qrCodeService.getWorkCenterQrCodes(workCenterId);

    return {
      message: 'QR codes retrieved successfully',
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Send static QR code via email
   * POST /work-centers/:id/send-static-qr
   */
  @Post(':id/send-static-qr')
  async sendStaticQrEmail(
    @Param('id', ParseUUIDPipe) publicId: string,
    @Body() dto: SendStaticQrEmailDto,
  ) {
    const workCenterId = await this.resolveWorkCenterId(publicId);
    const result = await this.qrEmailService.sendStaticQrEmail(
      workCenterId,
      dto.clientEmail,
      dto.includeInstructions ?? true,
    );

    return {
      message: result.message,
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Regenerate static QR code (expires old token)
   * POST /work-centers/:id/regenerate-static-qr
   */
  @Post(':id/regenerate-static-qr')
  async regenerateStaticQr(@Param('id', ParseUUIDPipe) publicId: string) {
    const workCenterId = await this.resolveWorkCenterId(publicId);
    const result = await this.qrCodeService.regenerateStaticQr(workCenterId);

    return {
      message: 'Static QR code regenerated successfully. Previous QR code has been expired.',
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Save GPS configuration for a work center
   * PUT /work-centers/:id/signing-methods/gps
   */
  @Put(':id/signing-methods/gps')
  async updateWorkCenterGps(
    @Param('id', ParseUUIDPipe) publicId: string,
    @Body() dto: UpdateWorkCenterGpsDto,
  ) {
    const workCenterId = await this.resolveWorkCenterId(publicId);
    const workCenter = await this.workCenterRepo.findOne({ where: { id: workCenterId } });
    if (!workCenter) throw new NotFoundException(`Work center ${workCenterId} not found`);

    if (dto.active) {
      if (dto.latitude == null || dto.longitude == null) {
        throw new BadRequestException('latitude and longitude are required when active is true');
      }
      workCenter.latitude  = dto.latitude;
      workCenter.longitude = dto.longitude;
      workCenter.gpsRadius = dto.radius ?? workCenter.gpsRadius ?? 100;
    } else {
      // Deactivate: clear coordinates
      workCenter.latitude  = null;
      workCenter.longitude = null;
    }

    await this.workCenterRepo.save(workCenter);

    return {
      message: 'GPS configuration saved successfully',
      data: {
        workCenterId,
        active: dto.active,
        latitude:  workCenter.latitude,
        longitude: workCenter.longitude,
        gpsRadius: workCenter.gpsRadius,
      },
      statusCode: 200,
    };
  }

  /**
   * GPS-based work center auto-selection for dynamic/merged QR codes
   * POST /work-centers/check-in/gps-select
   */
  @Post('check-in/gps-select')
  async selectWorkCenterByGps(@Body() dto: GpsSelectionDto) {
    let numericJobId: number | undefined;
    if (dto.jobId) {
      const job = await this.workCenterRepo.manager.findOne(Job, { where: { publicId: dto.jobId } });
      if (!job) throw new NotFoundException(`Job ${dto.jobId} not found`);
      numericJobId = job.id;
    }
    const result = await this.qrValidationService.selectWorkCenterByGps(
      dto.qrToken,
      dto.latitude,
      dto.longitude,
      numericJobId,
    );

    return {
      message: result.message,
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Preview email content (for testing)
   * GET /work-centers/:id/preview-qr-email
   */
  @Get(':id/preview-qr-email')
  async previewQrEmail(@Param('id', ParseUUIDPipe) publicId: string) {
    const workCenterId = await this.resolveWorkCenterId(publicId);
    const htmlContent = await this.qrEmailService.previewEmail(workCenterId, true);

    return {
      message: 'Email preview generated',
      data: { htmlContent },
      statusCode: 200,
    };
  }

  /**
   * Helper: Get employer ID from user
   * TODO: Move to shared service or use existing implementation
   */
  private async getEmployerIdFromUser(userId: number): Promise<number> {
    // For now, return a placeholder
    // In production, query EmployerUser table
    return 1; // TODO: Implement proper employer resolution
  }
}
