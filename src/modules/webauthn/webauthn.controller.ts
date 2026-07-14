import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebauthnService } from './webauthn.service';

@UseGuards(JwtAuthGuard)
@Controller('webauthn')
export class WebauthnController {
  constructor(private webauthn: WebauthnService) {}

  @Get('status')
  async status(@Req() req) {
    return { registered: await this.webauthn.hasCredential(req.user.id) };
  }

  @Post('register/options')
  async registerOptions(@Req() req) {
    return this.webauthn.getRegistrationOptions(req.user.id, req.user?.name || req.user?.email);
  }

  @Post('register/verify')
  async registerVerify(@Req() req, @Body() body: any) {
    return this.webauthn.verifyRegistration(req.user.id, body?.response ?? body, body?.deviceLabel, req.headers?.origin);
  }

  @Post('auth/options')
  async authOptions(@Req() req) {
    return this.webauthn.getAuthOptions(req.user.id);
  }

  @Post('auth/verify')
  async authVerify(@Req() req, @Body() body: any) {
    return this.webauthn.verifyAuth(req.user.id, body?.response ?? body, req.headers?.origin);
  }
}
