import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SurveyService } from './survey.service';

@UseGuards(JwtAuthGuard)
@Controller('surveys')
export class SurveyController {
  constructor(private survey: SurveyService) {}

  @Get('status')
  async status(@Req() req, @Query('jobId') jobId: string, @Query('date') date?: string) {
    return this.survey.getStatus(req.user.id, jobId, date);
  }

  @Post(':surveyPublicId/response')
  async submit(@Req() req, @Param('surveyPublicId') surveyPublicId: string, @Body() body: any) {
    return this.survey.submit(req.user.id, surveyPublicId, {
      date: body?.date,
      rating: body?.rating,
      reason: body?.reason,
    });
  }
}
