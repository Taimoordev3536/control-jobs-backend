import { Controller, Get, Put, Post, Body, Param, UseGuards, Req, Res, ParseUUIDPipe, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QrCodeService } from '../services/qr-code.service';
import { QrEmailService } from '../services/qr-email.service';
import { QrValidationService } from '../services/qr-validation.service';
import { QrPdfService } from '../services/qr-pdf.service';
import { UpdateWorkCenterQrDto } from '../dto/update-work-center-qr.dto';
import { SendStaticQrEmailDto } from '../dto/send-static-qr-email.dto';
import { UpdateWorkCenterGpsDto } from '../dto/update-work-center-gps.dto';
import { UpdateWorkCenterIpDto } from '../dto/update-work-center-ip.dto';
import { GpsSelectionDto } from '../dto/gps-selection.dto';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';
import { Job } from '../../job/entities/job.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { EmployerClient } from '../../employers/entities/employer-client.entity';
import { UserRole } from '../../auth/enums/user-role.enum';
import { isUUID } from 'class-validator';

@Controller('work-centers')
@UseGuards(JwtAuthGuard)
export class QrCodeController {
  constructor(
    private readonly qrCodeService: QrCodeService,
    private readonly qrEmailService: QrEmailService,
    private readonly qrValidationService: QrValidationService,
    private readonly qrPdfService: QrPdfService,
    @InjectRepository(WorkCenter)
    private readonly workCenterRepo: Repository<WorkCenter>,
  ) {}

  /**
   * Get work center details
   * GET /work-centers/:id
   * REMOVED — handled by WorkCentersController which uses ParseUUIDPipe
   */

  /**
   * Resolve the work center AND assert the caller may manage it.
   *
   * Every handler here mutates or discloses a check-in credential, so none of
   * them may run on a work center the caller does not own. Mirrors
   * WorkCentersService.verifyAccess: an employer owns a work center directly
   * (employer_id) or through an active client association.
   */
  private async resolveOwnedWorkCenterId(publicId: string, req: any): Promise<number> {
    const wc = await this.workCenterRepo.findOne({ where: { publicId } });
    if (!wc) throw new NotFoundException(`Work center not found`);

    // Admin supports every account and has no employerUsers row of its own.
    if (req?.user?.role?.value === UserRole.Admin) return wc.id;

    const link = await this.workCenterRepo.manager.findOne(EmployerUser, {
      where: { user: { id: req?.user?.id } },
      relations: ['employer'],
    });
    if (!link?.employer?.id) {
      throw new ForbiddenException('Access denied to this work center');
    }

    if (wc.employerId === link.employer.id) return wc.id;

    if (wc.clientId) {
      const association = await this.workCenterRepo.manager.findOne(EmployerClient, {
        where: {
          employer: { id: link.employer.id },
          client: { id: wc.clientId },
          isActive: true,
        },
      });
      if (association) return wc.id;
    }

    throw new ForbiddenException('Access denied to this work center');
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
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);

    const result = await this.qrCodeService.updateWorkCenterQr(
      workCenterId,
      dto,
    );

    return {
      message: 'QR code configuration updated successfully',
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Generate an A5 portrait PDF for the currently-selected QR code.
   * GET /work-centers/:id/qr-pdf
   *
   * Returns the PDF binary so the client can trigger a download. The layout
   * mirrors the client-side print template in qr-code-dialog.tsx (Puppeteer
   * renders the same HTML), producing consistent output across browsers,
   * printers, and user print-dialog settings.
   */
  @Get(':id/qr-pdf')
  async getWorkCenterQrPdf(
    @Param('id', ParseUUIDPipe) publicId: string,
    @Res() res: Response,
    @Req() req?,
  ) {
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);
    const pdf = await this.qrPdfService.generatePdfForWorkCenter(workCenterId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qr-${publicId}.pdf"`,
    );
    res.setHeader('Content-Length', pdf.length.toString());
    res.end(pdf);
  }

  /**
   * Get QR codes for a work center
   * GET /work-centers/:id/qr-codes
   */
  @Get(':id/qr-codes')
  async getWorkCenterQrCodes(@Param('id', ParseUUIDPipe) publicId: string, @Req() req?) {
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);
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
    @Req() req?,
  ) {
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);
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
  async regenerateStaticQr(@Param('id', ParseUUIDPipe) publicId: string, @Req() req?) {
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);
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
    @Req() req?,
  ) {
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);
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
      // Deactivate: only update config fields if provided (preserve existing config)
      if (dto.latitude != null)  workCenter.latitude  = dto.latitude;
      if (dto.longitude != null) workCenter.longitude = dto.longitude;
      if (dto.radius != null)    workCenter.gpsRadius = dto.radius;
    }

    // Update address fields when provided (reverse-geocoded from GPS dialog)
    if (dto.address != null)      workCenter.address      = dto.address;
    if (dto.street != null)       workCenter.street        = dto.street;
    if (dto.streetNumber != null)  workCenter.streetNumber  = dto.streetNumber;
    if (dto.locality != null)     workCenter.locality      = dto.locality;
    if (dto.province != null)     workCenter.province      = dto.province;
    if (dto.country != null)      workCenter.country       = dto.country;
    if (dto.postalCode != null)   workCenter.postalCode    = dto.postalCode;

    // Set the explicit boolean flag — config (lat/lng/radius) is always preserved
    workCenter.isGpsActive = dto.active;

    await this.workCenterRepo.save(workCenter);

    return {
      message: 'GPS configuration saved successfully',
      data: {
        workCenterId,
        active: workCenter.isGpsActive,
        latitude:  workCenter.latitude,
        longitude: workCenter.longitude,
        gpsRadius: workCenter.gpsRadius,
      },
      statusCode: 200,
    };
  }

  /**
   * Save IP configuration for a work center
   * PUT /work-centers/:id/signing-methods/ip
   */
  @Put(':id/signing-methods/ip')
  async updateWorkCenterIp(
    @Param('id', ParseUUIDPipe) publicId: string,
    @Body() dto: UpdateWorkCenterIpDto,
    @Req() req?,
  ) {
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);
    const workCenter = await this.workCenterRepo.findOne({ where: { id: workCenterId } });
    if (!workCenter) throw new NotFoundException(`Work center ${workCenterId} not found`);

    if (dto.active && !dto.ipAddress) {
      throw new BadRequestException('ipAddress is required when active is true');
    }

    if (dto.ipAddress != null) {
      workCenter.allowedIp = dto.ipAddress;
    }

    workCenter.isIpActive = dto.active;

    await this.workCenterRepo.save(workCenter);

    return {
      message: 'IP configuration saved successfully',
      data: {
        workCenterId,
        active: workCenter.isIpActive,
        ipAddress: workCenter.allowedIp,
      },
      statusCode: 200,
    };
  }

  /**
   * Turn the Web method on or off for a work center.
   * PUT /work-centers/:id/signing-methods/web
   *
   * Web needs no configuration of its own — no radius, no address, no token —
   * so this is a switch and nothing else.
   */
  @Put(':id/signing-methods/web')
  async updateWorkCenterWeb(
    @Param('id', ParseUUIDPipe) publicId: string,
    @Body() dto: { active: boolean },
    @Req() req?,
  ) {
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);
    const workCenter = await this.workCenterRepo.findOne({ where: { id: workCenterId } });
    if (!workCenter) throw new NotFoundException(`Work center ${workCenterId} not found`);

    workCenter.isWebActive = !!dto?.active;
    await this.workCenterRepo.save(workCenter);

    return {
      message: 'Web configuration saved successfully',
      data: { workCenterId, active: workCenter.isWebActive },
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
      // Match /jobs/scan, which accepts either form. Querying publicId with a
      // numeric id made Postgres reject the value as a malformed uuid (a 500),
      // rather than simply finding the job.
      const where: any = isUUID(dto.jobId)
        ? { publicId: dto.jobId }
        : { id: Number(dto.jobId) };
      if (!isUUID(dto.jobId) && Number.isNaN(Number(dto.jobId))) {
        throw new BadRequestException(`Invalid jobId: ${dto.jobId}`);
      }
      const job = await this.workCenterRepo.manager.findOne(Job, { where });
      if (!job) throw new NotFoundException(`Job ${dto.jobId} not found`);
      numericJobId = job.id;
    }
    const result = await this.qrValidationService.selectWorkCenterByGps(
      dto.qrToken,
      dto.latitude,
      dto.longitude,
      numericJobId,
      dto.accuracy,
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
  async previewQrEmail(@Param('id', ParseUUIDPipe) publicId: string, @Req() req?) {
    const workCenterId = await this.resolveOwnedWorkCenterId(publicId, req);
    const htmlContent = await this.qrEmailService.previewEmail(workCenterId, true);

    return {
      message: 'Email preview generated',
      data: { htmlContent },
      statusCode: 200,
    };
  }

}
