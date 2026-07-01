import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { BackupService } from './backup.service';

// Public — this is the OAuth redirect target hit by the browser after the user
// authorizes Google/Microsoft, so it carries no JWT.
@Controller('backup/cloud')
export class BackupCloudController {
  constructor(private readonly backupService: BackupService) {}

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    try {
      if (!code) throw new Error('Missing authorization code');
      await this.backupService.handleCallback(provider.toUpperCase(), code);
      res.redirect(`${base}/support/backup?cloud=connected`);
    } catch {
      res.redirect(`${base}/support/backup?cloud=error`);
    }
  }
}
