import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkerInvitationService } from '../services/worker-invitation.service';
import { CreateWorkerInvitationDto } from '../dto/create-worker-invitation.dto';
import { UpdateWorkerInvitationDto } from '../dto/update-worker-invitation.dto';
import { AcceptWorkerInvitationDto } from '../dto/accept-worker-invitation.dto';

@Controller('worker-invitations')
export class WorkerInvitationsController {
  constructor(private readonly service: WorkerInvitationService) {}

  // ---- Authenticated endpoints ----

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateWorkerInvitationDto) {
    const result = await this.service.create(req.user, dto);
    return { data: result };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: any) {
    const data = await this.service.list(req.user);
    return { data };
  }

  @Patch(':publicId')
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: any,
    @Param('publicId') publicId: string,
    @Body() dto: UpdateWorkerInvitationDto,
  ) {
    const data = await this.service.update(req.user, publicId, dto);
    return { data };
  }

  @Delete(':publicId')
  @UseGuards(JwtAuthGuard)
  async remove(@Req() req: any, @Param('publicId') publicId: string) {
    await this.service.remove(req.user, publicId);
    return { data: { deleted: true } };
  }

  @Post(':publicId/revoke')
  @UseGuards(JwtAuthGuard)
  async revoke(@Req() req: any, @Param('publicId') publicId: string) {
    await this.service.revoke(req.user, publicId);
    return { data: { revoked: true } };
  }

  @Get(':publicId/redemptions')
  @UseGuards(JwtAuthGuard)
  async redemptions(@Req() req: any, @Param('publicId') publicId: string) {
    const data = await this.service.listRedemptions(req.user, publicId);
    return { data };
  }

  // ---- Public endpoints (token-based) ----

  @Get('verify')
  async verify(@Query('token') token: string) {
    const result = await this.service.verify(token || '');
    return { data: result };
  }

  @Post('accept')
  async accept(@Body() dto: AcceptWorkerInvitationDto) {
    const result = await this.service.accept(dto);
    return { data: result };
  }
}
