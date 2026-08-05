import { Controller, Get, Post, Delete, Body, Param, Req, Res, UseGuards, ForbiddenException, Query } from '@nestjs/common';
import type { Response } from 'express';
import { AutofacturaService } from '../services/autofactura.service';
import { AutofacturaPdfService } from '../services/autofactura-pdf.service';
import { BillingAccessService } from '../services/billing-access.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { previousMonthRangeMadrid } from '../../../common/helpers/business-time';

@Controller('commissions')
@UseGuards(JwtAuthGuard)
export class AutofacturasController {
  constructor(
    private readonly service: AutofacturaService,
    private readonly access: BillingAccessService,
    private readonly pdf: AutofacturaPdfService,
  ) {}

  private async assertAdmin(req: any) {
    const scope = await this.access.resolveScope(req.user);
    if (scope.kind !== 'all') throw new ForbiddenException('Admin only');
    return scope;
  }

  @Get()
  async list(@Req() req: any, @Query('partnerId') partnerId?: string) {
    const scope = await this.access.resolveScope(req.user);
    const data = await this.service.list(scope, partnerId);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Post()
  async createManual(@Req() req: any, @Body() body: any) {
    await this.assertAdmin(req);
    const data = await this.service.createManual(body);
    return { message: 'Created', data, isSuccess: true, statusCode: 201 };
  }

  @Post('generate')
  async generate(@Req() req: any, @Body() body: { partnerId: string; periodStart: string; periodEnd: string }) {
    await this.assertAdmin(req);
    const data = await this.service.generateForPartner(body.partnerId, body.periodStart, body.periodEnd);
    return { message: 'Generated', data, isSuccess: true, statusCode: 201 };
  }

  @Post('run-monthly')
  async runMonthly(@Req() req: any, @Body() body: { periodStart?: string; periodEnd?: string }) {
    await this.assertAdmin(req);
    let { periodStart, periodEnd } = body || ({} as any);
    if (!periodStart || !periodEnd) {
      // Default to the previous calendar month anchored to Madrid — the same
      // source of truth the monthly cron uses — so a manual run on day 1 in the
      // post-midnight window doesn't bill the month-before-last.
      const range = previousMonthRangeMadrid();
      periodStart = range.startIso;
      periodEnd = range.endIso;
    }
    const created = await this.service.generateMonthlyForAllPartners(periodStart, periodEnd);
    return { message: 'Generated', data: { created, periodStart, periodEnd }, isSuccess: true, statusCode: 201 };
  }

  @Post('bulk-pdf')
  async bulkPdf(@Req() req: any, @Body() body: { publicIds: string[] }, @Res() res: Response) {
    const scope = await this.access.resolveScope(req.user);
    const items = await this.service.loadManyScoped(body?.publicIds || [], scope);
    const buffer = await this.pdf.renderMany(items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="autofacturas.pdf"');
    res.send(buffer);
  }

  @Post('bank-batch')
  async bankBatch(@Req() req: any, @Body() body: { publicIds: string[] }, @Res() res: Response) {
    await this.assertAdmin(req);
    const scope = await this.access.resolveScope(req.user);
    const items = (await this.service.loadManyScoped(body?.publicIds || [], scope)).filter((a) => a.status === 'PENDING');
    const buffer = await this.pdf.renderBankBatch(items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ordenes-pago.pdf"');
    res.send(buffer);
  }

  @Get('context')
  async context(@Req() req: any) {
    const scope = await this.access.resolveScope(req.user);
    // Company (ControlJobs "Denominación") is fine for any billing user; partner
    // + next-number preview only for admin creating a manual self-invoice.
    const partnerId = scope.kind === 'all' ? (req.query?.partnerId as string | undefined) : undefined;
    const data = await this.service.getContext(partnerId);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Get(':publicId')
  async detail(@Req() req: any, @Param('publicId') publicId: string) {
    const scope = await this.access.resolveScope(req.user);
    const data = await this.service.findByPublicId(publicId, scope);
    return { message: 'Success', data, isSuccess: true, statusCode: 200 };
  }

  @Get(':publicId/pdf')
  async pdfOne(@Req() req: any, @Param('publicId') publicId: string, @Res() res: Response) {
    const scope = await this.access.resolveScope(req.user);
    await this.service.findByPublicId(publicId, scope);
    const af = await this.service.loadEntity(publicId);
    const hideEmployerNames = scope.kind === 'partner' && (scope.partnerTier === 'Bronze' || scope.partnerTier === 'Affiliate');
    const buffer = await this.pdf.render(af, { hideEmployerNames });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${af.autofacturaNumber}.pdf"`);
    res.send(buffer);
  }

  @Post(':publicId/mark-paid')
  async markPaid(@Req() req: any, @Param('publicId') publicId: string) {
    await this.assertAdmin(req);
    const data = await this.service.markPaid(publicId);
    return { message: 'Paid', data, isSuccess: true, statusCode: 200 };
  }

  @Post(':publicId/cancel')
  async cancel(@Req() req: any, @Param('publicId') publicId: string) {
    await this.assertAdmin(req);
    const data = await this.service.cancel(publicId);
    return { message: 'Cancelled', data, isSuccess: true, statusCode: 200 };
  }

  @Delete(':publicId')
  async remove(@Req() req: any, @Param('publicId') publicId: string) {
    await this.assertAdmin(req);
    return this.service.remove(publicId);
  }
}
