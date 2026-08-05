
import { Controller, Post, Body, Req, UseGuards, Get, Param, Patch, Put, Query,Delete,Request,HttpException, HttpStatus, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { RecordScanDto } from './dto/scan.dto';
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
  async getJobShiftRecurrences(@Param('jobId', ParseUUIDPipe) jobId: string) {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    return await this.jobService.getJobShiftRecurrences(numericJobId);
  }



  //##### delete job ####

@UseGuards(JwtAuthGuard)
@Delete(':id')
async deleteJob(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
  const numericJobId = await this.jobService.resolvePublicId(id);
  const employerUserId = req.user.id;
  await this.jobService.deleteJob(numericJobId, employerUserId);
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

@UseGuards(JwtAuthGuard)
@Get('control')
async getControl(@Req() req, @Query('date') date?: string) {
  const data = await this.jobService.getControlForDate(req.user.id, date);
  return { message: 'Success', data, isSuccess: true, statusCode: 200 };
}

@UseGuards(JwtAuthGuard)
@Get('incidents')
async getIncidents(@Req() req, @Query('date') date?: string) {
  const data = await this.jobService.getIncidentsForDate(req.user.id, date);
  return { message: 'Success', data, isSuccess: true, statusCode: 200 };
}

@UseGuards(JwtAuthGuard)
@Get('occupation')
async getOccupation(
  @Req() req,
  @Query('start') start: string,
  @Query('end') end: string,
  @Query('workerIds') workerIds?: string,
) {
  return this.jobService.getEmployerOccupation(req.user.id, start, end, workerIds);
}

@UseGuards(JwtAuthGuard)
@Get('worker/my-calendar')
async getWorkerCalendar(@Req() req, @Query('start') start: string, @Query('end') end: string) {
  return this.jobService.getWorkerCalendar(req.user.id, start, end);
}

// Same calendar for a specific worker (employer viewing one of their workers).
@UseGuards(JwtAuthGuard)
@Get('worker-calendar/:publicId')
async getWorkerCalendarByPublicId(
  @Req() req,
  @Param('publicId') publicId: string,
  @Query('start') start: string,
  @Query('end') end: string,
) {
  return this.jobService.getWorkerCalendarByPublicId(req.user.id, publicId, start, end);
}

@UseGuards(JwtAuthGuard)
@Get('worker/day')
async getWorkerJobsForDate(@Req() req, @Query('date') date?: string) {
  return this.jobService.getWorkerJobsForDate(req.user.id, date);
}

// Whether this worker is clocked in right now, independent of calendar day.
@UseGuards(JwtAuthGuard)
@Get('worker/active-session')
async getWorkerActiveSession(@Req() req) {
  return this.jobService.getWorkerActiveSession(req.user.id);
}

@UseGuards(JwtAuthGuard)
@Get('worker/pending')
async getWorkerPendingCheckins(@Req() req, @Query('days') days?: string) {
  return this.jobService.getWorkerPendingCheckins(req.user.id, days ? Number(days) : 30);
}

@UseGuards(JwtAuthGuard)
@Get('planner/nearby')
async getPlannerNearby(
  @Req() req,
  @Query('lat') lat: string,
  @Query('lng') lng: string,
  @Query('radius') radius?: string,
  @Query('date') date?: string,
) {
  return this.jobService.getNearbyAvailableWorkers(req.user.id, Number(lat), Number(lng), Number(radius), date);
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

@UseGuards(JwtAuthGuard)
@Get('client/day')
async getClientJobsForDate(@Req() req, @Query('date') date?: string) {
  return this.jobService.getClientJobsForDate(req.user.id, date);
}

@UseGuards(JwtAuthGuard)
@Get('client/work-session-records')
async getClientWorkSessionRecords(@Req() req, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('jobId') jobId?: string) {
  return this.jobService.getClientWorkSessionRecords(req.user.id, startDate, endDate, jobId);
}

@UseGuards(JwtAuthGuard)
@Get('record/:recordId')
async getRecordDetail(@Param('recordId') recordId: string) {
  return this.jobService.getRecordDetail(recordId);
}

@UseGuards(JwtAuthGuard)
@Get('client/my-calendar')
async getClientMyCalendar(@Req() req, @Query('start') start: string, @Query('end') end: string) {
  return this.jobService.getClientMyCalendar(req.user.id, start, end);
}

// List all jobs for a specific client (used by the Clients detail page's
// "Jobs" tab where an employer/admin browses a particular client rather
// than being scoped to their own client via the auth token).
@UseGuards(JwtAuthGuard)
@Get('by-client/:publicId')
async getAllJobsByClientPublicId(@Param('publicId', ParseUUIDPipe) publicId: string) {
  return this.jobService.getAllJobsByClientPublicId(publicId);
}

@UseGuards(JwtAuthGuard)
@Get('client-calendar/:publicId')
async getClientCalendar(
  @Param('publicId', ParseUUIDPipe) publicId: string,
  @Query('start') start: string,
  @Query('end') end: string,
) {
  return this.jobService.getClientCalendar(publicId, start, end);
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
  // Note: QR code generation is now handled by QrCodeModule
  // Use PUT /work-centers/:id/signing-methods/qr instead

  @UseGuards(JwtAuthGuard)
  @Post('scan')
  async recordScan(@Body() recordScanDto: RecordScanDto, @Req() req): Promise<{ status: string; scanData: any }> {
    const userId = req.user?.id;
    // With 'trust proxy' enabled, req.ip is the real client IP (behind Render/etc.)
    const serverIp = req.ip || req.socket?.remoteAddress || null;
    return await this.jobService.recordScan(recordScanDto, userId, serverIp);
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
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    return await this.jobService.getJobScanHistory(numericJobId, startDate, endDate);
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
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() updateJobStatusDto: UpdateJobStatusDto,
    @Req() req
  ): Promise<{ message: string; job: any }> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    const userId = req.user?.id;
    return await this.jobService.updateJobStatus(numericJobId, updateJobStatusDto, userId);
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

  // Get complete job data for editing
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getJobById(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    try {
      const userId = req.user?.id;
      const job = await this.jobService.getJobByPublicIdForEdit(id, userId);
      return { 
        message: 'Job fetched successfully', 
        data: job,
        isSuccess: true,
        statusCode: 200
      };
    } catch (error) {
      const errMsg = error?.message || String(error);
      console.error('getJobById error:', errMsg);
      throw new HttpException({
        message: 'Failed to fetch job',
        error: errMsg,
        isSuccess: false,
      }, HttpStatus.BAD_REQUEST);
    }
  }

  // Update complete job
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateJobDto: UpdateJobDto,
    @Req() req
  ) {
    try {
      const numericId = await this.jobService.resolvePublicId(id);
      const userId = req.user?.id;
      const job = await this.jobService.updateJob(numericId, updateJobDto, userId);
      return {
        message: 'Job updated successfully',
        data: job,
        isSuccess: true,
        statusCode: 200
      };
    } catch (error) {
      const errMsg = error?.message || String(error);
      console.error('updateJob error:', errMsg);
      throw new HttpException({
        message: 'Failed to update job',
        error: errMsg,
        isSuccess: false,
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':jobId/auto-update-status')
  async autoUpdateJobStatus(@Param('jobId', ParseUUIDPipe) jobId: string): Promise<{ message: string }> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    await this.jobService.autoUpdateJobStatus(numericJobId);
    return { message: 'Job status auto-updated successfully' };
  }

  // ========== Work Session Management Endpoints ========== //

  @UseGuards(JwtAuthGuard)
  @Get(':jobId/worker/:workerId/session-status')
  async getWorkerSessionStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('workerId', ParseUUIDPipe) workerId: string
  ): Promise<any> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    const numericWorkerId = await this.jobService.resolveWorkerPublicId(workerId);
    return await this.jobService.getWorkerSessionStatus(numericJobId, numericWorkerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':jobId/worker/session-status')
  async getCurrentWorkerSessionStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req
  ): Promise<any> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    const userId = req.user?.id;
    const workerId = await this.jobService.getWorkerIdFromUserId(userId);
    return await this.jobService.getWorkerSessionStatus(numericJobId, workerId);
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
  async getJobTaskStatus(@Param('jobId', ParseUUIDPipe) jobId: string): Promise<any> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    return await this.jobService.getJobTaskStatus(numericJobId);
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

  @UseGuards(JwtAuthGuard)
  @Post(':jobId/tasks/:taskId/toggle')
  async toggleTaskCompletion(
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
    @Req() req
  ) {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    const numericTaskId = await this.jobService.resolveTaskPublicId(taskId);
    const userId = req.user.id;
    const workerId = await this.jobService.getWorkerIdFromUserId(userId);
    return this.jobService.toggleTaskCompletion(numericTaskId, workerId, numericJobId);
  }


  // Fetch task history for a job, worker, and date
  @Get(':jobId/task-history')
  async getTaskHistoryForJobWorkerDate(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('workerId') workerId: string,
    @Query('date') date?: string
  ): Promise<any> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    const numericWorkerId = await this.jobService.resolveWorkerPublicId(workerId);
    return await this.jobService.getTaskHistoryForJobWorkerDate(numericJobId, numericWorkerId, date);
  }

  // Get all tasks for a job and worker (includes today's per-worker status)
  @UseGuards(JwtAuthGuard)
  @Get(':jobId/worker/:workerId/tasks')
  async getTasksForJobWorker(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('workerId', ParseUUIDPipe) workerId: string,
  ): Promise<any> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    const numericWorkerId = await this.jobService.resolveWorkerPublicId(workerId);
    return await this.jobService.getTasksForJobWorker(numericJobId, numericWorkerId);
  }

  // Get today's tasks for a job grouped by work center
  @UseGuards(JwtAuthGuard)
  @Get(':jobId/today-tasks')
  async getTodayTasksByWorkCenter(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req
  ): Promise<any> {
    const numericJobId = await this.jobService.resolvePublicId(jobId);
    const userId = req.user.id;
    const workerId = await this.jobService.getWorkerIdFromUserId(userId);
    return await this.jobService.getTodayTasksByWorkCenter(numericJobId, workerId);
  }

  // Get task detail by task id
  @UseGuards(JwtAuthGuard)
  @Get('tasks/:taskId')
  async getTaskById(@Param('taskId', ParseUUIDPipe) taskId: string): Promise<any> {
    const numericTaskId = await this.jobService.resolveTaskPublicId(taskId);
    return await this.jobService.getTaskById(numericTaskId);
  }

  // Convenience: allow GET for quick testing (no persistence)
  @UseGuards(JwtAuthGuard)
  @Get('tasks/:taskId/generate-recurrence')
  async generateRecurrenceForTaskGet(@Param('taskId', ParseUUIDPipe) taskId: string): Promise<any> {
    const numericTaskId = await this.jobService.resolveTaskPublicId(taskId);
    return await this.jobService.generateRecurrenceForTask(numericTaskId, false)
  }

  // ========== Employer Records Endpoints ========== //

  @UseGuards(JwtAuthGuard)
  @Get('employer/work-session-records')
  async getEmployerWorkSessionRecords(
    @Req() req,
    @Query('jobId') jobId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const userId = req.user?.id;
    let numericJobId: number | undefined;
    if (jobId) {
      numericJobId = await this.jobService.resolvePublicId(jobId);
    }
    return await this.jobService.getEmployerWorkSessionRecords(userId, numericJobId, startDate, endDate);
  }

  /** The daily record for a period, as an inspection would ask for it. */
  @UseGuards(JwtAuthGuard)
  @Get('employer/work-session-records/pdf')
  async getEmployerRecordsPdf(
    @Req() req,
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('workerId') workerId?: string,
    @Query('jobId') jobId?: string,
  ) {
    const { buffer, fileName } = await this.jobService.renderAttendanceRecordPdf(req.user?.id, {
      startDate,
      endDate,
      workerPublicId: workerId,
      jobPublicId: jobId,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get('employer/work-session/:workSessionId')
  async getWorkSessionDetail(
    @Req() req,
    @Param('workSessionId', ParseUUIDPipe) workSessionId: string,
  ): Promise<any> {
    const userId = req.user?.id;
    const ws = await this.jobService.resolveWorkSessionPublicId(workSessionId);
    return await this.jobService.getWorkSessionDetail(userId, ws);
  }

  // ========== Worker Records Endpoint ========== //

  @UseGuards(JwtAuthGuard)
  @Get('worker/work-session-records')
  async getWorkerWorkSessionRecords(
    @Req() req,
    @Query('jobId') jobId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const userId = req.user?.id;
    let numericJobId: number | undefined;
    if (jobId) {
      numericJobId = await this.jobService.resolvePublicId(jobId);
    }
    return await this.jobService.getWorkerWorkSessionRecords(userId, numericJobId, startDate, endDate);
  }

}