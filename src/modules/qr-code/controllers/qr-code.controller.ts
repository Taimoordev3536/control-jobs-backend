import { Controller, Get, Put, Post, Body, Param, UseGuards, Req, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QrCodeService } from '../services/qr-code.service';
import { QrEmailService } from '../services/qr-email.service';
import { UpdateWorkCenterQrDto } from '../dto/update-work-center-qr.dto';
import { SendStaticQrEmailDto } from '../dto/send-static-qr-email.dto';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';

@Controller('work-centers')
@UseGuards(JwtAuthGuard)
export class QrCodeController {
  constructor(
    private readonly qrCodeService: QrCodeService,
    private readonly qrEmailService: QrEmailService,
    @InjectRepository(WorkCenter)
    private readonly workCenterRepo: Repository<WorkCenter>,
  ) {}

  /**
   * Get work center details
   * GET /work-centers/:id
   */
  @Get(':id')
  async getWorkCenter(@Param('id', ParseIntPipe) workCenterId: number) {
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
      relations: ['client'],
    });

    if (!workCenter) {
      throw new NotFoundException(`Work center with ID ${workCenterId} not found`);
    }

    return {
      isSuccess: true,
      message: 'Work center retrieved successfully',
      data: workCenter,
      statusCode: 200,
    };
  }

  /**
   * Update QR code configuration for a work center
   * PUT /work-centers/:id/signing-methods/qr
   */
  @Put(':id/signing-methods/qr')
  async updateWorkCenterQr(
    @Param('id', ParseIntPipe) workCenterId: number,
    @Body() dto: UpdateWorkCenterQrDto,
    @Req() req,
  ) {
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
  async getWorkCenterQrCodes(@Param('id', ParseIntPipe) workCenterId: number) {
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
    @Param('id', ParseIntPipe) workCenterId: number,
    @Body() dto: SendStaticQrEmailDto,
  ) {
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
  async regenerateStaticQr(@Param('id', ParseIntPipe) workCenterId: number) {
    const result = await this.qrCodeService.regenerateStaticQr(workCenterId);

    return {
      message: 'Static QR code regenerated successfully. Previous QR code has been expired.',
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Preview email content (for testing)
   * GET /work-centers/:id/preview-qr-email
   */
  @Get(':id/preview-qr-email')
  async previewQrEmail(@Param('id', ParseIntPipe) workCenterId: number) {
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
