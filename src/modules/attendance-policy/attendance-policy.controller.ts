import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttendancePolicyService } from './attendance-policy.service';
import { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';

@Controller('attendance-policy')
@UseGuards(JwtAuthGuard)
export class AttendancePolicyController {
  constructor(private readonly service: AttendancePolicyService) {}

  @Get('employer')
  async getEmployer(@Req() req) {
    const data = await this.service.getForEmployer(req.user);
    return { message: 'Success', data, isSuccess: true };
  }

  @Put('employer')
  async putEmployer(@Body() dto: UpdateAttendancePolicyDto, @Req() req) {
    const data = await this.service.upsertForEmployer(dto, req.user);
    return { message: 'Attendance rules updated', data, isSuccess: true };
  }

  @Get('job/:jobId')
  async getJob(@Param('jobId') jobId: string, @Req() req) {
    const data = await this.service.getForJob(jobId, req.user);
    return { message: 'Success', data, isSuccess: true };
  }

  @Put('job/:jobId')
  async putJob(@Param('jobId') jobId: string, @Body() dto: UpdateAttendancePolicyDto, @Req() req) {
    const data = await this.service.upsertForJob(jobId, dto, req.user);
    return { message: 'Attendance rules updated', data, isSuccess: true };
  }

  @Delete('job/:jobId')
  async clearJob(@Param('jobId') jobId: string, @Req() req) {
    await this.service.clearForJob(jobId, req.user);
    return { message: 'Now inheriting the company rules', isSuccess: true };
  }

  @Get('worker/:workerId')
  async getWorker(@Param('workerId') workerId: string, @Req() req) {
    const data = await this.service.getForWorker(workerId, req.user);
    return { message: 'Success', data, isSuccess: true };
  }

  @Put('worker/:workerId')
  async putWorker(@Param('workerId') workerId: string, @Body() dto: UpdateAttendancePolicyDto, @Req() req) {
    const data = await this.service.upsertForWorker(workerId, dto, req.user);
    return { message: 'Attendance rules updated', data, isSuccess: true };
  }

  @Delete('worker/:workerId')
  async clearWorker(@Param('workerId') workerId: string, @Req() req) {
    await this.service.clearForWorker(workerId, req.user);
    return { message: 'Now inheriting', isSuccess: true };
  }

  /** The merged result the system will actually act on. */
  @Get('job/:jobId/resolved')
  async resolved(@Param('jobId') jobId: string, @Query('workerId') workerId: string, @Req() req) {
    const data = await this.service.resolveForJob(jobId, req.user, workerId);
    return { message: 'Success', data, isSuccess: true };
  }
}
