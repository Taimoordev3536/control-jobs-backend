
import { Controller, Post, Body, Req, UseGuards, Get, Param, Patch, Query,Delete,Request,HttpException, HttpStatus, } from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { RecordScanDto, GenerateQrCodeDto } from './dto/scan.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobStatus } from './enums/job-status.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  // @UseGuards(JwtAuthGuard)
  // @Post()
  // async createJob(@Body() createJobDto: CreateJobDto, @Req() req) {
  //   const employerUserId = req.user.id;
  //   const job = await this.jobService.createJob(createJobDto, employerUserId);
  //   return { message: 'Job created successfully', data: job };
  // }

@UseGuards(JwtAuthGuard)
@Post()
async createJob(@Body() createJobDto: CreateJobDto, @Req() req) {
  try {
    const employerUserId = req.user.id;
    const job = await this.jobService.createJob(createJobDto, employerUserId);
    return { message: 'Job created successfully', data: job };
  } catch (error) {
    // Include full error details in the response to aid debugging
    const errMsg = error?.message || String(error);
    const errStack = error?.stack || '';
    console.error('createJob error:', errMsg, errStack);
    throw new HttpException({
      message: 'Failed to create job',
      error: errMsg,
      details: process.env.NODE_ENV === 'development' ? errStack : undefined,
    }, HttpStatus.BAD_REQUEST);
  }
}



  // Get all weekly shift recurrences for a job
  @UseGuards(JwtAuthGuard)
  @Get(':jobId/shift-recurrence')
  async getJobShiftRecurrences(@Param('jobId') jobId: number) {
    return await this.jobService.getJobShiftRecurrences(jobId);
  }



  //##### delete job ####

@UseGuards(JwtAuthGuard)
@Delete(':id')
async deleteJob(@Param('id') jobId: number, @Req() req) {
  const employerUserId = req.user.id;
  await this.jobService.deleteJob(jobId, employerUserId);
  return { message: 'Job deleted successfully' };
}

  
//show job data task-tab
@UseGuards(JwtAuthGuard)
@Get('tasks-tab')
async getTasksTabData(@Req() req) {
  const employerUserId = req.user.id;
  const data = await this.jobService.getTasksTabDataForUser(employerUserId);
  return { message: 'Success', data, isSuccess: true, statusCode: 200 };
}


  @Get('raw')
  async getAllJobsRaw() {
    return this.jobService.getAllJobsRaw();
  }

//job for employer dashboard
@UseGuards(JwtAuthGuard)
@Get('employer/all-jobs')
async getAllJobsForEmployerFromToken(@Req() req) {
  const userId = req.user?.id;
  return this.jobService.getAllJobsByEmployerFromToken(userId);
}

//job for worker dashboard
@UseGuards(JwtAuthGuard)
@Get('worker/all-jobs')
async getAllJobsForWorkerFromToken(@Req() req) {
  const userId = req.user?.id;
  return this.jobService.getAllJobsByWorkerFromToken(userId);
}

//job for client dashboard
@UseGuards(JwtAuthGuard)
@Get('client/all-jobs')
async getAllJobsForClientFromToken(@Req() req) {
  const userId = req.user?.id;
  return this.jobService.getAllJobsByClientFromToken(userId);
}




// @UseGuards(JwtAuthGuard)
// @Get('client/job-history')
// async getJobHistoryForClient(@Req() req, @Query('jobId') jobId?: number) {
//   const userId = req.user?.id;
//   return this.jobService.getJobHistoryForClient(userId, jobId ? parseInt(jobId.toString()) : undefined);
// }

// @UseGuards(JwtAuthGuard)
// @Get('client/analytics')
// async getJobAnalyticsForClient(@Req() req) {
//   const userId = req.user?.id;
//   return this.jobService.getJobAnalyticsForClient(userId);
// }

  // ========== QR Code and Scanning Endpoints ========== //

  @UseGuards(JwtAuthGuard)
  @Post('generate-qr')
  async generateJobQrCode(@Body() generateQrCodeDto: GenerateQrCodeDto) {
    // Return the new QR code structure directly
    return await this.jobService.generateJobQrCode(generateQrCodeDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('scan')
  async recordScan(@Body() recordScanDto: RecordScanDto, @Req() req): Promise<{ status: string; scanData: any }> {
    const userId = req.user?.id;
    return await this.jobService.recordScan(recordScanDto, userId);
  }

  // @UseGuards(JwtAuthGuard)
  // @Get(':jobId/scan-history')
  // async getJobScanHistory(@Param('jobId') jobId: number): Promise<any[]> {
  //   return await this.jobService.getJobScanHistory(jobId);
  // }


// @UseGuards(JwtAuthGuard)
// @Get(':jobId/scan-history')
// async getJobScanHistory(
//   @Param('jobId') jobId: number,
//   @Request() req, // Add this to access the authenticated user
//   @Query('startDate') startDate?: string,
//   @Query('endDate') endDate?: string,
// ): Promise<any> {
//   const userId = req.user.id; // Get user ID from the authenticated request
//   return await this.jobService.getJobScanHistory(jobId, userId, startDate, endDate);
// }

  @UseGuards(JwtAuthGuard)
  @Get(':jobId/scan-history')
  async getJobScanHistory(
    @Param('jobId') jobId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return await this.jobService.getJobScanHistory(jobId, startDate, endDate);
  }

  // @UseGuards(JwtAuthGuard)
  // @Get('worker/:workerId/scan-history')
  // async getWorkerScanHistory(@Param('workerId') workerId: number): Promise<any[]> {
  //   return await this.jobService.getWorkerScanHistory(workerId);
  // }

  // @UseGuards(JwtAuthGuard)
  // @Get(':jobId/attendance-summary')
  // async getTodayAttendanceSummary(@Param('jobId') jobId: number): Promise<any> {
  //   return await this.jobService.getTodayAttendanceSummary(jobId);
  // }

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

  // ========== Work Session Management Endpoints ========== //

  @UseGuards(JwtAuthGuard)
  @Get(':jobId/worker/:workerId/session-status')
  async getWorkerSessionStatus(
    @Param('jobId') jobId: number,
    @Param('workerId') workerId: number
  ): Promise<any> {
    return await this.jobService.getWorkerSessionStatus(jobId, workerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':jobId/worker/session-status')
  async getCurrentWorkerSessionStatus(
    @Param('jobId') jobId: number,
    @Req() req
  ): Promise<any> {
    const userId = req.user?.id;
    const workerId = await this.jobService.getWorkerIdFromUserId(userId);
    return await this.jobService.getWorkerSessionStatus(jobId, workerId);
  }

  // ========== Task Management Endpoints ========== //

  // @UseGuards(JwtAuthGuard)
  // @Post('tasks/:taskId/complete')
  // async completeTask(
  //   @Param('taskId') taskId: number,
  //   @Req() req
  // ): Promise<any> {
  //   const userId = req.user?.id;
  //   const workerId = await this.jobService.getWorkerIdFromUserId(userId);
  //   return await this.jobService.completeTask(taskId, workerId);
  // }

  @UseGuards(JwtAuthGuard)
  @Get(':jobId/task-status')
  async getJobTaskStatus(@Param('jobId') jobId: number): Promise<any> {
    return await this.jobService.getJobTaskStatus(jobId);
  }

  // @Post(':taskId/toggle-task/:workerId')
  // async toggleTaskCompletion(
  //   @Param('taskId') taskId: number,
  //   @Param('workerId') workerId: number,
  //   @Req() req: any,
  // ) {
  //   const userId = req.user.id; // Assuming user ID is available in request (e.g., from JWT)
  //   return await this.jobService.toggleTaskCompletion(taskId, workerId, userId);
  // }

// job.controller.ts
// job.controller.ts
  @UseGuards(JwtAuthGuard)
  @Post(':jobId/tasks/:taskId/toggle') // ✅ Correct path parameter syntax
  async toggleTaskCompletion(
    @Param('jobId') jobId: number,
    @Param('taskId') taskId: number,
    @Req() req
  ) {
    const userId = req.user.id;
    const workerId = await this.jobService.getWorkerIdFromUserId(userId);
    return this.jobService.toggleTaskCompletion(taskId, workerId, jobId);
  }


  // Fetch task history for a job, worker, and date
  @Get(':jobId/task-history')
  async getTaskHistoryForJobWorkerDate(
    @Param('jobId') jobId: number,
    @Query('workerId') workerId: number,
    @Query('date') date?: string
  ): Promise<any> {
    return await this.jobService.getTaskHistoryForJobWorkerDate(jobId, workerId, date);
  }

  // Get all tasks for a job and worker (includes today's per-worker status)
  @UseGuards(JwtAuthGuard)
  @Get(':jobId/worker/:workerId/tasks')
  async getTasksForJobWorker(
    @Param('jobId') jobId: number,
    @Param('workerId') workerId: number,
  ): Promise<any> {
    return await this.jobService.getTasksForJobWorker(jobId, workerId);
  }

  // Get task detail by task id
  @UseGuards(JwtAuthGuard)
  @Get('tasks/:taskId')
  async getTaskById(@Param('taskId') taskId: number): Promise<any> {
    return await this.jobService.getTaskById(taskId);
  }

  // Generate recurrence for a task based on stored config
  // @UseGuards(JwtAuthGuard)
  // @Post('tasks/:taskId/generate-recurrence')
  // async generateRecurrenceForTask(@Param('taskId') taskId: number, @Query('persist') persist?: string): Promise<any> {
  //   const doPersist = persist === 'true'
  //   return await this.jobService.generateRecurrenceForTask(taskId, doPersist)
  // }

  // Convenience: allow GET for quick testing (no persistence)
  @UseGuards(JwtAuthGuard)
  @Get('tasks/:taskId/generate-recurrence')
  async generateRecurrenceForTaskGet(@Param('taskId') taskId: number): Promise<any> {
    return await this.jobService.generateRecurrenceForTask(taskId, false)
  }


}