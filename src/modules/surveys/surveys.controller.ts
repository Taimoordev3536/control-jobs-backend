import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('survey-forms')
@UseGuards(JwtAuthGuard)
export class SurveysController {
  constructor(private readonly surveys: SurveysService) {}

  // ---- Respondent (worker/client) ----
  @Get('mine')
  async mine(@Req() req) {
    const data = await this.surveys.listMine(req.user.id);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Post(':publicId/submit')
  async submit(@Req() req, @Param('publicId') publicId: string, @Body() body: any) {
    const data = await this.surveys.submit(req.user.id, publicId, body);
    return { message: 'Survey submitted', data, isSuccess: true, statusCode: 201 };
  }

  @Get(':publicId/my-response')
  async myResponse(@Req() req, @Param('publicId') publicId: string) {
    const data = await this.surveys.myResponse(req.user.id, publicId);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  // ---- Employer ----
  @Post()
  async create(@Req() req, @Body() body: any) {
    const data = await this.surveys.create(req.user.id, body);
    return { message: 'Survey created', data, isSuccess: true, statusCode: 201 };
  }

  @Get()
  async list(@Req() req) {
    const data = await this.surveys.list(req.user.id);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Get('settings')
  async getSettings(@Req() req) {
    const data = await this.surveys.getSettings(req.user.id);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Patch('settings')
  async updateSettings(@Req() req, @Body() body: any) {
    const data = await this.surveys.updateSettings(req.user.id, body);
    return { message: 'Settings updated', data, isSuccess: true, statusCode: 200 };
  }

  @Get(':publicId/results')
  async results(@Req() req, @Param('publicId') publicId: string) {
    const data = await this.surveys.results(req.user.id, publicId);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Get(':publicId')
  async getOne(@Req() req, @Param('publicId') publicId: string) {
    const data = await this.surveys.getOne(req.user.id, publicId);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Patch(':publicId')
  async update(@Req() req, @Param('publicId') publicId: string, @Body() body: any) {
    const data = await this.surveys.update(req.user.id, publicId, body);
    return { message: 'Survey updated', data, isSuccess: true, statusCode: 200 };
  }

  @Delete(':publicId')
  async remove(@Req() req, @Param('publicId') publicId: string) {
    const data = await this.surveys.remove(req.user.id, publicId);
    return { message: 'Survey deleted', data, isSuccess: true, statusCode: 200 };
  }
}
