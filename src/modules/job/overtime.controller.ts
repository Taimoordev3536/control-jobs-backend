import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OvertimeService } from './services/overtime.service';

@Controller('overtime')
@UseGuards(JwtAuthGuard)
export class OvertimeController {
  constructor(private readonly service: OvertimeService) {}

  /** Overtime waiting on a decision, for the caller's own workers. */
  @Get()
  async list(@Req() req) {
    const data = await this.service.listPending(req.user.id);
    return { message: 'Success', data, isSuccess: true };
  }

  @Get('count')
  async count(@Req() req) {
    const count = await this.service.countPending(req.user.id);
    return { message: 'Success', data: { count }, isSuccess: true };
  }

  /** The caller's own overtime for a year. Workers only. */
  @Get('mine')
  async mine(@Query('year') year: string, @Req() req) {
    const data = await this.service.mine(req.user.id, year ? Number(year) : undefined);
    return { message: 'Success', data, isSuccess: true };
  }

  /** A worker's approved overtime for a year, against the cap. */
  @Get('worker/:workerPublicId/annual')
  async annual(
    @Param('workerPublicId') workerPublicId: string,
    @Query('year') year: string,
    @Req() req,
  ) {
    const data = await this.service.annualForWorker(
      workerPublicId,
      req.user.id,
      year ? Number(year) : undefined,
    );
    return { message: 'Success', data, isSuccess: true };
  }

  @Post(':publicId/approve')
  async approve(
    @Param('publicId') publicId: string,
    @Body() body: { compensation?: 'PAID' | 'TIME_OFF'; acknowledgeCap?: boolean },
    @Req() req,
  ) {
    const data = await this.service.approve(
      publicId, req.user.id, body?.compensation, !!body?.acknowledgeCap,
    );
    return { message: 'Approved', data, isSuccess: true };
  }

  @Post(':publicId/reject')
  async reject(@Param('publicId') publicId: string, @Req() req) {
    const data = await this.service.reject(publicId, req.user.id);
    return { message: 'Rejected', data, isSuccess: true };
  }
}
