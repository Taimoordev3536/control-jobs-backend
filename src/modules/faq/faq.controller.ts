import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Controller('faqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  list() {
    return this.faqService.list();
  }

  @Post()
  @Roles(UserRole.Admin)
  create(@Body() dto: CreateFaqDto) {
    return this.faqService.create(dto);
  }

  @Put(':publicId')
  @Roles(UserRole.Admin)
  update(@Param('publicId') publicId: string, @Body() dto: UpdateFaqDto) {
    return this.faqService.update(publicId, dto);
  }

  @Delete(':publicId')
  @Roles(UserRole.Admin)
  remove(@Param('publicId') publicId: string) {
    return this.faqService.remove(publicId);
  }
}
