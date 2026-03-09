import { Controller, Get, Param, UseGuards, ParseUUIDPipe, Req } from '@nestjs/common';
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
  async getMergedDynamicQr(@Param('id', ParseUUIDPipe) jobId: string) {
    const result = await this.qrCodeService.getMergedDynamicQrForJob(jobId);

    return {
      message: 'Merged QR code generated successfully',
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Get merged dynamic QR for all jobs scheduled TODAY for a client
   * GET /jobs/clients/:clientId/today-merged-qr
   */
  @Get('clients/:clientId/today-merged-qr')
  async getTodayMergedQrForClient(@Param('clientId', ParseUUIDPipe) clientId: string) {
    const result = await this.qrCodeService.getMergedDynamicQrForClient(clientId);

    return {
      message: 'Today\'s merged QR code generated successfully',
      data: result,
      statusCode: 200,
    };
  }

  /**
   * Get merged dynamic QR for all jobs scheduled TODAY for the authenticated client user
   * GET /jobs/client/today-merged-qr
   */
  @Get('client/today-merged-qr')
  async getTodayMergedQrForAuthenticatedClient(@Req() req) {
    const userId = req.user?.id;
    const result = await this.qrCodeService.getMergedDynamicQrForClientUser(userId);

    return {
      message: 'Today\'s merged QR code generated successfully',
      data: result,
      statusCode: 200,
    };
  }
}
