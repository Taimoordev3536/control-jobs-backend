import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ClientRequestsService } from './client-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('client-requests')
@UseGuards(JwtAuthGuard)
export class ClientRequestsController {
  constructor(private readonly requests: ClientRequestsService) {}

  @Post()
  async create(
    @Req() req,
    @Body() body: { type?: string; jobPublicId?: string; subject?: string; description?: string; startDate?: string; endDate?: string },
  ) {
    const data = await this.requests.createForClient(req.user.id, body);
    return { message: 'Request created', data, isSuccess: true, statusCode: 201 };
  }

  @Get('mine')
  async mine(@Req() req) {
    const data = await this.requests.listMine(req.user.id);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Get()
  async list(@Req() req) {
    const data = await this.requests.listForEmployer(req.user.id);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Patch(':publicId/review')
  async review(@Req() req, @Param('publicId') publicId: string, @Body() body: { status?: string; reviewerNotes?: string }) {
    const data = await this.requests.review(req.user.id, publicId, body);
    return { message: 'Request reviewed', data, isSuccess: true, statusCode: 200 };
  }
}
