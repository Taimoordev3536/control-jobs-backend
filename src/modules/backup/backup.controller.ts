import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { BackupService } from './backup.service';
import { AuditService } from '../audit/audit.service';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list() {
    const data = await this.backupService.list();
    return { isSuccess: true, statusCode: 200, message: 'Backups', data };
  }

  @Get('providers')
  async providers() {
    const data = await this.backupService.listProviders();
    return { isSuccess: true, statusCode: 200, message: 'Providers', data };
  }

  @Get('cloud/:provider/auth-url')
  async authUrl(@Param('provider') provider: string) {
    const key = provider.toUpperCase();
    const url = this.backupService.getAuthUrl(key, key);
    return { isSuccess: true, statusCode: 200, message: 'Auth URL', data: { url } };
  }

  @Delete('cloud/:provider')
  async disconnectCloud(@Param('provider') provider: string) {
    const data = await this.backupService.disconnect(provider.toUpperCase());
    return { isSuccess: true, statusCode: 200, message: 'Disconnected', data };
  }

  @Get('settings')
  async getSettings() {
    const data = await this.backupService.getSettings();
    return { isSuccess: true, statusCode: 200, message: 'Settings', data };
  }

  @Put('settings')
  async updateSettings(@Body() dto: any) {
    const data = await this.backupService.updateSettings(dto);
    return { isSuccess: true, statusCode: 200, message: 'Settings updated', data };
  }

  @Post('run')
  async run(@Request() req, @Body() dto: { provider?: string }) {
    const data = await this.backupService.runBackup(req.user?.name ?? 'Admin', dto?.provider);
    await this.audit.record({
      actorUserId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role?.name,
      action: 'BACKUP_CREATED',
      detail: `${dto?.provider || 'local'} — ${data.status}`,
    });
    return { isSuccess: data.status === 'SUCCESS', statusCode: 201, message: 'Backup executed', data };
  }

  @Get(':publicId/download')
  async download(@Param('publicId') publicId: string, @Res() res: Response) {
    const { buffer, filename } = await this.backupService.downloadBuffer(publicId);
    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  @Post(':publicId/restore')
  async restore(@Request() req, @Param('publicId') publicId: string) {
    const data = await this.backupService.restore(publicId);
    // Logged after the fact on purpose: a restore truncates every table,
    // audit_logs included, so an entry written first would erase itself.
    await this.audit.record({
      actorUserId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role?.name,
      action: 'BACKUP_RESTORED',
      detail: `Backup ${publicId} — ${data.tablesRestored} tables, ${data.rowsRestored} rows. `
        + 'Everything before this point was replaced.',
    });
    return { isSuccess: true, statusCode: 200, message: 'Backup restored', data };
  }

  @Delete(':publicId')
  async remove(@Request() req, @Param('publicId') publicId: string) {
    const data = await this.backupService.remove(publicId);
    await this.audit.record({
      actorUserId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role?.name,
      action: 'BACKUP_DELETED',
      detail: `Backup ${publicId}`,
    });
    return { isSuccess: true, statusCode: 200, message: 'Backup deleted', data };
  }
}
