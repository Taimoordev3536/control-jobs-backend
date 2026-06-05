import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnnouncementsService } from './services/announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { PreviewAudienceDto } from './dto/preview-audience.dto';
import { AudienceSender, SenderRole } from './audience.types';

const ROLE_VALUE_TO_NAME: Record<number, SenderRole> = {
  1: 'ADMIN',
  2: 'PARTNER',
  3: 'EMPLOYER',
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1, 2, 3) // Admin, Partner, Employer
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('audiences')
  async audiences(@Req() req: any) {
    const data = await this.announcements.availableAudiences(this.sender(req));
    return { data };
  }

  @Post('preview')
  async preview(@Req() req: any, @Body() dto: PreviewAudienceDto) {
    return this.announcements.preview(this.sender(req), dto.segments);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateAnnouncementDto) {
    const data = await this.announcements.create(this.sender(req), dto);
    return { message: 'Announcement created', data };
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.announcements.listForSender(
      this.sender(req).userId,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Delete(':publicId')
  async cancel(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
  ) {
    const data = await this.announcements.cancel(
      publicId,
      this.sender(req).userId,
    );
    return { message: 'Announcement cancelled', data };
  }

  private sender(req: any): AudienceSender {
    const user = req.user;
    const roleName = ROLE_VALUE_TO_NAME[user?.role?.value];
    if (!roleName) {
      throw new ForbiddenException('Your role cannot send announcements');
    }
    return { userId: user.id, roleName };
  }
}
