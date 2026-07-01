import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AbsencesService } from './absences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@Controller('absences')
export class AbsencesController {
  constructor(private readonly absences: AbsencesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async list(@Req() req, @Query('status') status?: string) {
    return this.absences.listForEmployer(req.user.id, status);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async mine(@Req() req) {
    return this.absences.listMine(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req, @Body() body: { type?: string; startDate?: string; endDate?: string; reason?: string }) {
    return this.absences.createForWorker(req.user.id, body);
  }

  @Patch(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Employer)
  async review(@Req() req, @Param('id') id: string, @Body() body: { status?: string; reviewerNotes?: string }) {
    return this.absences.review(req.user.id, id, body);
  }
}
