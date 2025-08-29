import { Controller, Delete, Get, Param, UseGuards, Req } from '@nestjs/common';
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
    await this.alertsService.pruneOlderThanDays(2);
    const items = await this.alertsService.getRecentForRecipient(role, userId, 2);
    return { data: items, isSuccess: true };
  }

  @Delete(':id')
  async dismiss(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    const userId = user?.id;
    const role = (user?.role?.name || user?.role || '').toString().toUpperCase();
    await this.alertsService.dismissForRecipient(+id, role, userId);
    return { isSuccess: true };
  }
}


