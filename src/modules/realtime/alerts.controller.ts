import { Controller, Delete, Get, Param, Post, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async getRecent(@Req() req: any) {
    const user = req.user;
    const userId = user?.id;
    const role = (user?.role?.name || user?.role || '').toString().toUpperCase();
    await this.alertsService.pruneOlderThanDays(5);
    const items = await this.alertsService.getRecentForRecipient(role, userId, 5);
    return { data: items, isSuccess: true };
  }

  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    const user = req.user;
    const userId = user?.id;
    const role = (user?.role?.name || user?.role || '').toString().toUpperCase();
    const count = await this.alertsService.countUnreadForRecipient(role, userId);
    return { data: { count }, isSuccess: true };
  }

  @Post('read-all')
  async markAllRead(@Req() req: any) {
    const user = req.user;
    const userId = user?.id;
    const role = (user?.role?.name || user?.role || '').toString().toUpperCase();
    await this.alertsService.markAllReadForRecipient(role, userId);
    return { isSuccess: true };
  }

  @Delete(':id')
  async dismiss(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const user = req.user;
    const userId = user?.id;
    const role = (user?.role?.name || user?.role || '').toString().toUpperCase();
    await this.alertsService.dismissForRecipient(id, role, userId);
    return { isSuccess: true };
  }

  @Post(':id/dismiss-banner')
  async dismissBanner(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const user = req.user;
    const userId = user?.id;
    const role = (user?.role?.name || user?.role || '').toString().toUpperCase();
    await this.alertsService.dismissBannerForRecipient(id, role, userId);
    return { isSuccess: true };
  }
}


