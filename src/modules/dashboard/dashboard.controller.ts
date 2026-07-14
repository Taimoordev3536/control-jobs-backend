import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { BillingAccessService } from '../billing/services/billing-access.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly access: BillingAccessService,
  ) {}

  @Get('admin')
  async admin(@Req() req: any) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Admins only');
    }
    return { data: await this.dashboard.admin(req.user), isSuccess: true };
  }

  @Get('partner')
  async partner(@Req() req: any) {
    return { data: await this.dashboard.partner(req.user), isSuccess: true };
  }
}
