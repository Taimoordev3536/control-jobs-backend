import { Controller, Get, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QrCodeService } from '../services/qr-code.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobQrController {
  constructor(private readonly qrCodeService: QrCodeService) {}

  /**
   * Get merged dynamic QR for a job (includes all work centers)
   * GET /jobs/:id/merged-qr
   */
  @Get(':id/merged-qr')
  async getMergedDynamicQr(@Param('id', ParseIntPipe) jobId: number) {
    const result = await this.qrCodeService.getMergedDynamicQrForJob(jobId);

    return {
      message: 'Merged QR code generated successfully',
      data: result,
      statusCode: 200,
    };
  }
}
