import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RatePlanService } from '../services/rate-plan.service';
import { UpdateRatePlanDto } from '../dto/rate-plan.dto';

@Controller('rate-plans')
@UseGuards(JwtAuthGuard)
export class RatePlansController {
  constructor(private readonly ratePlanService: RatePlanService) {}

  @Get()
  list() {
    return this.ratePlanService.findAll().then((data) => ({ data }));
  }

  /**
   * Resolve the matching rate plan for a (subTypeId, typeId) pair.
   * Used by the Add Employer modal to render the estimación box live.
   */
  @Get('match')
  async match(
    @Query('subTypeId', ParseIntPipe) subTypeId: number,
    @Query('typeId', ParseIntPipe) typeId: number,
  ) {
    const plan = await this.ratePlanService.findMatch(subTypeId, typeId);
    return { data: plan };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRatePlanDto,
  ) {
    const plan = await this.ratePlanService.update(id, dto as any);
    return { data: plan };
  }
}
