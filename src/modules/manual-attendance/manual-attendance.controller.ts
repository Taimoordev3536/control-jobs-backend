import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ManualAttendanceService } from './manual-attendance.service';
import { CreateManualAttendanceRequestDto } from './dto/create-manual-attendance-request.dto';
import { ReviewManualAttendanceRequestDto } from './dto/review-manual-attendance-request.dto';
import { UpdateManualAttendancePermissionDto } from './dto/update-manual-attendance-permission.dto';
import { QueryManualAttendanceRequestsDto } from './dto/query-manual-attendance-requests.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('manual-attendance')
@UseGuards(JwtAuthGuard)
export class ManualAttendanceController {
  constructor(private readonly service: ManualAttendanceService) {}

  // ─── Request Endpoints ────────────────────────────────────────────

  /**
   * Create a manual attendance request (Worker, Employer, Client).
   * Workers create requests that need approval.
   */
  @Post('requests')
  async createRequest(
    @Body() dto: CreateManualAttendanceRequestDto,
    @Req() req,
  ) {
    const request = await this.service.createRequest(dto, req.user.id);
    return { message: 'Manual attendance request created', data: request, isSuccess: true };
  }

  /**
   * Direct entry by Employer/Client - creates and auto-approves.
   * This is the "Edit button" flow - no approval needed.
   */
  @Post('direct-entry')
  async directCreateAttendance(
    @Body() dto: CreateManualAttendanceRequestDto,
    @Req() req,
  ) {
    const result = await this.service.directCreateAttendance(dto, req.user.id);
    return {
      message: 'Attendance entry created and approved',
      data: result,
      isSuccess: true,
    };
  }

  /**
   * Get all requests (Employer/Client see their scoped requests, Worker sees own).
   */
  @Get('requests')
  async getRequests(
    @Query() query: QueryManualAttendanceRequestsDto,
    @Req() req,
  ) {
    const requests = await this.service.getRequests(req.user.id, query);
    return { message: 'Success', data: requests, isSuccess: true };
  }

  /**
   * Worker's own requests list.
   */
  @Get('requests/my')
  async getMyRequests(@Req() req) {
    const requests = await this.service.getMyRequests(req.user.id);
    return { message: 'Success', data: requests, isSuccess: true };
  }

  /**
   * Get count of pending requests (for badge display).
   */
  @Get('requests/pending/count')
  async getPendingCount(@Req() req) {
    const count = await this.service.getPendingCount(req.user.id);
    return { message: 'Success', data: { count }, isSuccess: true };
  }

  /**
   * Get a specific request by its publicId.
   */
  @Get('requests/:publicId')
  async getRequestById(@Param('publicId', ParseUUIDPipe) publicId: string) {
    const request = await this.service.getRequestByPublicId(publicId);
    return { message: 'Success', data: request, isSuccess: true };
  }

  /**
   * Approve or reject a request (Employer/Client only).
   */
  @Patch('requests/:publicId/review')
  async reviewRequest(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: ReviewManualAttendanceRequestDto,
    @Req() req,
  ) {
    const result = await this.service.reviewRequest(publicId, dto, req.user.id);
    return {
      message: dto.action === 'APPROVE' ? 'Request approved' : 'Request rejected',
      data: result,
      isSuccess: true,
    };
  }

  /**
   * Cancel a pending request (only by the original requester).
   */
  @Patch('requests/:publicId/cancel')
  async cancelRequest(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Req() req,
  ) {
    const result = await this.service.cancelRequest(publicId, req.user.id);
    return { message: 'Request cancelled', data: result, isSuccess: true };
  }

  // ─── Permission Endpoints ─────────────────────────────────────────

  /**
   * Get employer-level manual attendance permission defaults.
   */
  @Get('permissions/employer')
  async getEmployerPermissions(@Req() req) {
    const perm = await this.service.getPermissionForEmployer(req.user.id);
    return { message: 'Success', data: perm, isSuccess: true };
  }

  /**
   * Create or update employer-level permissions.
   */
  @Put('permissions/employer')
  async upsertEmployerPermissions(
    @Body() dto: UpdateManualAttendancePermissionDto,
    @Req() req,
  ) {
    const perm = await this.service.upsertPermissionForEmployer(req.user.id, dto);
    return { message: 'Permissions updated', data: perm, isSuccess: true };
  }

  /**
   * Get client-level manual attendance permissions.
   */
  @Get('permissions/client')
  async getClientPermissions(@Req() req) {
    const perm = await this.service.getPermissionForClient(req.user.id);
    return { message: 'Success', data: perm, isSuccess: true };
  }

  /**
   * Create or update client-level permissions.
   */
  @Put('permissions/client')
  async upsertClientPermissions(
    @Body() dto: UpdateManualAttendancePermissionDto,
    @Req() req,
  ) {
    const perm = await this.service.upsertPermissionForClient(req.user.id, dto);
    return { message: 'Permissions updated', data: perm, isSuccess: true };
  }

  /**
   * Get job-level manual attendance permissions.
   */
  @Get('permissions/job/:jobId')
  async getJobPermissions(@Param('jobId', ParseUUIDPipe) jobId: string) {
    const perm = await this.service.getPermissionForJob(jobId);
    return { message: 'Success', data: perm, isSuccess: true };
  }

  /**
   * Create or update job-level permissions.
   */
  @Put('permissions/job/:jobId')
  async upsertJobPermissions(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: UpdateManualAttendancePermissionDto,
  ) {
    const perm = await this.service.upsertPermissionForJob(jobId, dto);
    return { message: 'Permissions updated', data: perm, isSuccess: true };
  }

  /**
   * Get the effective (resolved) permissions for a job.
   * Resolves: Job-level → Client-level → Employer-level hierarchy.
   */
  @Get('permissions/job/:jobId/resolved')
  async getResolvedJobPermissions(@Param('jobId', ParseUUIDPipe) jobId: string) {
    const perm = await this.service.getEffectivePermissionsByJobPublicId(jobId);
    return { message: 'Success', data: perm, isSuccess: true };
  }
}
