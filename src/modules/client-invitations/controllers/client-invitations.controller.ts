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
import { ClientInvitationService } from '../services/client-invitation.service';
import { CreateClientInvitationDto } from '../dto/create-client-invitation.dto';
import { UpdateClientInvitationDto } from '../dto/update-client-invitation.dto';
import { AcceptClientInvitationDto } from '../dto/accept-client-invitation.dto';

@Controller('client-invitations')
export class ClientInvitationsController {
  constructor(private readonly service: ClientInvitationService) {}

  // ---- Authenticated endpoints ----

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateClientInvitationDto) {
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
    @Body() dto: UpdateClientInvitationDto,
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
  async accept(@Body() dto: AcceptClientInvitationDto) {
    const result = await this.service.accept(dto);
    return { data: result };
  }
}
