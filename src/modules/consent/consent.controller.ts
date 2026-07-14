import { Controller, Get, Post, Delete, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsentService } from './consent.service';

@UseGuards(JwtAuthGuard)
@Controller('consent')
export class ConsentController {
  constructor(private consent: ConsentService) {}

  @Get('location')
  async status(@Req() req) {
    return this.consent.getLocationStatus(req.user.id);
  }

  @Post('location')
  async grant(@Req() req) {
    const ip = (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
    return this.consent.grantLocation(req.user.id, {
      userAgent: req.headers?.['user-agent'],
      ipAddress: ip,
    });
  }

  @Delete('location')
  async revoke(@Req() req) {
    return this.consent.revokeLocation(req.user.id);
  }
}
