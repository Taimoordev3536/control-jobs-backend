import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RatePlanService } from '../services/rate-plan.service';
import { UpdateRatePlanDto } from '../dto/rate-plan.dto';

function isAdmin(req: any): boolean {
  return String(req?.user?.role?.name || '').toLowerCase() === 'admin';
}

@Controller('rate-plans')
export class RatePlansController {
  constructor(private readonly ratePlanService: RatePlanService) {}

  // Public — used by the invitation accept page to render an estimate before
  // the user has an account. Rates are not sensitive (they're the price book).
  @Get('match')
  async match(
    @Query('subTypeId', ParseIntPipe) subTypeId: number,
    @Query('typeId', ParseIntPipe) typeId: number,
  ) {
    const plan = await this.ratePlanService.findMatch(subTypeId, typeId);
    if (!plan) return { data: null };
    const rates = this.ratePlanService.getEffectiveRates(plan);
    return {
      data: {
        ...plan,
        monthlyFixed: rates.monthlyFixed,
        perWorkCenter: rates.perWorkCenter,
        perWorker: rates.perWorker,
      },
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.ratePlanService.findAll().then((data) => ({ data }));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRatePlanDto,
  ) {
    if (!isAdmin(req)) throw new ForbiddenException('Only admins can change rates');

    // Capture the live (pre-change) rates so the notification can show
    // "before vs after" honestly even if the admin re-saves later.
    const beforePlan = await this.ratePlanService.findById(id);
    const previousLive = {
      fixed: Number(beforePlan.monthlyFixed),
      perWorkCenter: Number(beforePlan.perWorkCenter),
      perWorker: Number(beforePlan.perWorker),
    };

    const plan = await this.ratePlanService.scheduleRateChange(id, {
      monthlyFixed: dto.monthlyFixed,
      perWorkCenter: dto.perWorkCenter,
      perWorker: dto.perWorker,
    });
    if (plan.pendingEffectiveAt) {
      this.ratePlanService
        .notifyAffectedEmployers(id, 'SCHEDULED', previousLive)
        .catch(() => undefined);
    }
    return { data: plan };
  }

  @Post(':id/cancel-pending')
  @UseGuards(JwtAuthGuard)
  async cancelPending(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    if (!isAdmin(req)) throw new ForbiddenException('Only admins can cancel pending rates');
    const plan = await this.ratePlanService.cancelPending(id);
    this.ratePlanService
      .notifyAffectedEmployers(id, 'CANCELLED')
      .catch(() => undefined);
    return { data: plan };
  }
}
