import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EmployerInvitationService } from '../services/employer-invitation.service';
import { SelfRegistrationService } from '../services/self-registration.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { SelfRegisterEmployerDto } from '../dto/self-register.dto';

@Controller('employer-invitations')
export class EmployerInvitationsController {
  constructor(
    private readonly service: EmployerInvitationService,
    private readonly selfRegistration: SelfRegistrationService,
  ) {}

  // ---- Authenticated endpoints ----

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateInvitationDto) {
    const result = await this.service.create(req.user, dto);
    return { data: result };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: any) {
    const data = await this.service.list(req.user);
    return { data };
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
  async accept(@Body() dto: AcceptInvitationDto) {
    const result = await this.service.accept(dto);
    return { data: result };
  }

  /**
   * Method 3 — public self-registration. No auth, no token. Anyone can
   * sign up as an employer; the new account is associated with the
   * platform's system partner (SYSTEM_PARTNER_ID env var).
   */
  @Post('self-register')
  async selfRegister(
    @Body() dto: SelfRegisterEmployerDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const result = await this.selfRegistration.register(dto, userAgent ?? null, ip ?? null);
    return { data: result };
  }
}
