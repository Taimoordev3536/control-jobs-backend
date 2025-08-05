
import { Controller, Post, Body, Req, UseGuards, Get, Param, Patch, Query } from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { RecordScanDto, GenerateQrCodeDto } from './dto/scan.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobStatus } from './enums/job-status.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createJob(@Body() createJobDto: CreateJobDto, @Req() req) {
    const employerUserId = req.user.id;
    const job = await this.jobService.createJob(createJobDto, employerUserId);
    return { message: 'Job created successfully', data: job };
  }

@UseGuards(JwtAuthGuard)
@Get('tasks-tab')
async getTasksTabData(@Req() req) {
  const employerUserId = req.user.id;
  return this.jobService.getTasksTabDataForUser(employerUserId);
}


  @Get('raw')
  async getAllJobsRaw() {
    return this.jobService.getAllJobsRaw();
  }


@UseGuards(JwtAuthGuard)
@Get('employer/all-jobs')
async getAllJobsForEmployerFromToken(@Req() req) {
  const userId = req.user?.id;
  return this.jobService.getAllJobsByEmployerFromToken(userId);
}

@UseGuards(JwtAuthGuard)
@Get('worker/all-jobs')
async getAllJobsForWorkerFromToken(@Req() req) {
  const userId = req.user?.id;
  return this.jobService.getAllJobsByWorkerFromToken(userId);
}

@UseGuards(JwtAuthGuard)
@Get('client/all-jobs')
async getAllJobsForClientFromToken(@Req() req) {
  const userId = req.user?.id;
  return this.jobService.getAllJobsByClientFromToken(userId);
}

  // ========== QR Code and Scanning Endpoints ========== //

  @UseGuards(JwtAuthGuard)
  @Post('generate-qr')
  async generateJobQrCode(@Body() generateQrCodeDto: GenerateQrCodeDto): Promise<{ qrCode: string; jobData: any }> {
    return await this.jobService.generateJobQrCode(generateQrCodeDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('scan')
  async recordScan(@Body() recordScanDto: RecordScanDto, @Req() req): Promise<{ status: string; scanData: any }> {
    const userId = req.user?.id;
    return await this.jobService.recordScan(recordScanDto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':jobId/scan-history')
  async getJobScanHistory(@Param('jobId') jobId: number): Promise<any[]> {
    return await this.jobService.getJobScanHistory(jobId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('worker/:workerId/scan-history')
  async getWorkerScanHistory(@Param('workerId') workerId: number): Promise<any[]> {
    return await this.jobService.getWorkerScanHistory(workerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':jobId/attendance-summary')
  async getTodayAttendanceSummary(@Param('jobId') jobId: number): Promise<any> {
    return await this.jobService.getTodayAttendanceSummary(jobId);
  }

  // ========== Job Status Management Endpoints ========== //

  @UseGuards(JwtAuthGuard)
  @Patch(':jobId/status')
  async updateJobStatus(
    @Param('jobId') jobId: number,
    @Body() updateJobStatusDto: UpdateJobStatusDto,
    @Req() req
  ): Promise<{ message: string; job: any }> {
    const userId = req.user?.id;
    return await this.jobService.updateJobStatus(jobId, updateJobStatusDto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:status')
  async getJobsByStatus(
    @Param('status') status: JobStatus,
    @Req() req
  ): Promise<any[]> {
    const userId = req.user?.id;
    return await this.jobService.getJobsByStatus(status, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':jobId/auto-update-status')
  async autoUpdateJobStatus(@Param('jobId') jobId: number): Promise<{ message: string }> {
    await this.jobService.autoUpdateJobStatus(jobId);
    return { message: 'Job status auto-updated successfully' };
  }

}