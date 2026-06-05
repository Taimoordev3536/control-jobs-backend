import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AnnouncementsService } from './announcements.service';

@Injectable()
export class AnnouncementCronService {
  private readonly logger = new Logger(AnnouncementCronService.name);

  constructor(private readonly announcements: AnnouncementsService) {}

  @Cron('* * * * *', { name: 'send-scheduled-announcements' })
  async sendScheduled() {
    const sent = await this.announcements.sendDue();
    if (sent > 0) {
      this.logger.log(`Sent ${sent} scheduled announcement(s)`);
    }
  }
}
