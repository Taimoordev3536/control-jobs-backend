import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BillingPreviewService } from '../services/billing-preview.service';
import { BillingAccessService } from '../services/billing-access.service';
import { BillingCronService } from '../services/billing-cron.service';
import { EmployersService } from '../../employers/employers.service';
import { previousMonthRangeMadrid } from '../../../common/helpers/business-time';
import { isUUID } from 'class-validator';

interface PreviewBody {
  employerId: string | number; // accepts numeric id or publicId UUID
}

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly preview: BillingPreviewService,
    private readonly employers: EmployersService,
    private readonly access: BillingAccessService,
    private readonly cron: BillingCronService,
  ) {}

  /**
   * Admin recovery: (re)run the previous-month close now — invoices,
   * commissions and bank tasks. Idempotent: only creates what's missing,
   * never deletes/overwrites an issued invoice. For when the scheduled cron
   * was missed (e.g. server down at month start).
   */
  @Post('run-monthly')
  async runMonthly(@Req() req: any) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can run the monthly billing close');
    }
    const { startIso, endIso } = previousMonthRangeMadrid();
    await this.cron.runMonthlyCloseNow();
    return {
      isSuccess: true,
      message: 'Monthly close completed',
      data: { periodStart: startIso, periodEnd: endIso },
    };
  }

  /** Live preview of the current month's bill for an employer. No DB writes. */
  @Post('preview')
  async previewCurrentMonth(@Req() req: any, @Body() body: PreviewBody) {
    const numericId = await this.resolveEmployerId(body.employerId);
    const scope = await this.access.resolveScope(req.user);
    await this.access.assertCanViewEmployer(scope, numericId);
    const data = await this.preview.previewCurrentMonth(numericId);
    return { data };
  }

  private async resolveEmployerId(idOrPublicId: string | number): Promise<number> {
    if (typeof idOrPublicId === 'number') return idOrPublicId;
    if (isUUID(idOrPublicId)) {
      return this.employers.resolvePublicId(idOrPublicId);
    }
    const n = parseInt(String(idOrPublicId), 10);
    return n;
  }
}
