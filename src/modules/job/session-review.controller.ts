import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionReviewService } from './services/session-review.service';

@Controller('session-review')
@UseGuards(JwtAuthGuard)
export class SessionReviewController {
  constructor(private readonly service: SessionReviewService) {}

  /** Everything waiting on a human. Clients see their jobs but cannot settle. */
  @Get()
  async list(@Req() req) {
    const data = await this.service.list(req.user.id);
    return { message: 'Success', data, isSuccess: true };
  }

  @Get('count')
  async count(@Req() req) {
    const count = await this.service.countPending(req.user.id);
    return { message: 'Success', data: { count }, isSuccess: true };
  }

  @Get(':publicId')
  async get(@Param('publicId') publicId: string, @Req() req) {
    const data = await this.service.get(publicId, req.user.id);
    return { message: 'Success', data, isSuccess: true };
  }

  @Post(':publicId/confirm')
  async confirm(@Param('publicId') publicId: string, @Req() req) {
    const data = await this.service.confirm(publicId, req.user.id);
    return { message: 'Confirmed', data, isSuccess: true };
  }

  @Post(':publicId/correct')
  async correct(
    @Param('publicId') publicId: string,
    @Body() body: { checkOutTime: string; note?: string },
    @Req() req,
  ) {
    const data = await this.service.correct(
      publicId,
      req.user.id,
      new Date(body.checkOutTime),
      body.note,
    );
    return { message: 'Updated', data, isSuccess: true };
  }

  @Post(':publicId/force-close')
  async forceClose(
    @Param('publicId') publicId: string,
    @Body() body: { checkOutTime?: string },
    @Req() req,
  ) {
    const data = await this.service.forceClose(
      publicId,
      req.user.id,
      body?.checkOutTime ? new Date(body.checkOutTime) : undefined,
    );
    return { message: 'Session closed', data, isSuccess: true };
  }
}
