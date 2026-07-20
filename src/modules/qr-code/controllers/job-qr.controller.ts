import { Controller, Get, Param, UseGuards, ParseUUIDPipe, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QrCodeService } from '../services/qr-code.service';
import { Job } from '../../job/entities/job.entity';
import { Client } from '../../clients/entities/client.entity';
import { ClientUser } from '../../clients/entities/client-user.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { UserRole } from '../../auth/enums/user-role.enum';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobQrController {
  constructor(
    private readonly qrCodeService: QrCodeService,
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
  ) {}

  /** The employer this user belongs to, or null. */
  private async employerIdOf(userId: number): Promise<number | null> {
    const link = await this.jobRepo.manager.findOne(EmployerUser, {
      where: { user: { id: userId } },
      relations: ['employer'],
    });
    return link?.employer?.id ?? null;
  }

  /** The client this user belongs to, or null. */
  private async clientIdOf(userId: number): Promise<number | null> {
    const link = await this.jobRepo.manager.findOne(ClientUser, { where: { userId } });
    return link?.clientId ?? null;
  }

  /**
   * Get merged dynamic QR for a job (includes all work centers)
   * GET /jobs/:id/merged-qr
   */
  @Get(':id/merged-qr')
  async getMergedDynamicQr(@Param('id', ParseUUIDPipe) jobId: string, @Req() req?) {
    // This response contains live check-in tokens, so it is restricted to the
    // job's own employer or client. Previously any authenticated user who knew
    // a job id could pull a working QR for it.
    await this.assertCanSeeJobQr(jobId, req);
    const result = await this.qrCodeService.getMergedDynamicQrForJob(jobId);

    return {
      message: 'Merged QR code generated successfully',
      data: result,
      statusCode: 200,
    };
  }

  private async assertCanSeeJobQr(jobPublicId: string, req: any): Promise<void> {
    if (req?.user?.role?.value === UserRole.Admin) return;

    const job = await this.jobRepo.findOne({
      where: { publicId: jobPublicId },
      relations: ['employer', 'client'],
    });
    if (!job) throw new NotFoundException('Job not found');

    const userId = req?.user?.id;
    if (job.employer?.id && (await this.employerIdOf(userId)) === job.employer.id) return;
    if (job.client?.id && (await this.clientIdOf(userId)) === job.client.id) return;

    throw new ForbiddenException('Access denied to this job');
  }

  /**
   * Get merged dynamic QR for all jobs scheduled TODAY for a client
   * GET /jobs/clients/:clientId/today-merged-qr
   */
  @Get('clients/:clientId/today-merged-qr')
  async getTodayMergedQrForClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Req() req?,
  ) {
    // Same credential-disclosure risk as :id/merged-qr — restrict to the client
    // itself, an employer that works with it, or an admin.
    if (req?.user?.role?.value !== UserRole.Admin) {
      const client = await this.jobRepo.manager.findOne(Client, {
        where: { publicId: clientId },
      });
      if (!client) throw new NotFoundException('Client not found');

      const userId = req?.user?.id;
      const isOwnClient = (await this.clientIdOf(userId)) === client.id;
      let isWorkingEmployer = false;
      if (!isOwnClient) {
        const employerId = await this.employerIdOf(userId);
        if (employerId) {
          const job = await this.jobRepo.findOne({
            where: { employer: { id: employerId }, client: { id: client.id } },
          });
          isWorkingEmployer = !!job;
        }
      }
      if (!isOwnClient && !isWorkingEmployer) {
        throw new ForbiddenException('Access denied to this client');
      }
    }

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
