import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CreateManualInvoiceDto } from '../dto/create-manual-invoice.dto';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { InvoiceService } from '../services/invoice.service';
import { InvoicePdfService } from '../services/invoice-pdf.service';
import { BillingAccessService } from '../services/billing-access.service';
import { InvoiceStatus } from '../entities/invoice.entity';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoiceService,
    private readonly pdf: InvoicePdfService,
    private readonly access: BillingAccessService,
  ) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('employerId') employerId?: string,
    @Query('partnerId') partnerId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const scope = await this.access.resolveScope(req.user);
    return this.invoices.list({
      employerId: employerId ? Number(employerId) : undefined,
      partnerId: partnerId ? Number(partnerId) : undefined,
      status: status as InvoiceStatus | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      scope: scope as any,
    });
  }

  @Get('form-context')
  async formContext(@Req() req: any, @Query('employerId') employerId?: string) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can access the invoice form');
    }
    return { data: await this.invoices.getInvoiceFormContext(employerId ? Number(employerId) : undefined) };
  }

  @Post()
  async createManual(@Req() req: any, @Body() dto: CreateManualInvoiceDto) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can create manual invoices');
    }
    const invoice = await this.invoices.createManual(dto);
    return { data: invoice };
  }

  @Get('invoiced-months')
  async invoicedMonths(@Req() req: any, @Query('employerId') employerId?: string) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can generate invoices');
    }
    if (!employerId) throw new BadRequestException('employerId is required');
    const data = await this.invoices.getInvoicedMonths(Number(employerId));
    return { data };
  }

  @Post('generate-preview')
  async generatePreview(
    @Req() req: any,
    @Body() body: { employerId: number; periodStart: string; periodEnd: string },
  ) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can generate invoices');
    }
    if (!body?.employerId || !body?.periodStart || !body?.periodEnd) {
      throw new BadRequestException('employerId, periodStart and periodEnd are required');
    }
    const data = await this.invoices.previewForEmployer(
      Number(body.employerId),
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
    return { data };
  }

  @Post('generate')
  async generate(
    @Req() req: any,
    @Body()
    body: {
      employerId: number;
      periodStart: string;
      periodEnd: string;
      chargeDate?: string;
      workCenterIds?: number[];
      workerIds?: number[];
      fixedFee?: number;
      discountPct?: number;
    },
  ) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can generate invoices');
    }
    if (!body?.employerId || !body?.periodStart || !body?.periodEnd) {
      throw new BadRequestException('employerId, periodStart and periodEnd are required');
    }
    assertChargeDateNotPast(body.chargeDate);
    try {
      const custom =
        Array.isArray(body.workCenterIds) ||
        Array.isArray(body.workerIds) ||
        body.fixedFee !== undefined ||
        body.discountPct !== undefined ||
        body.chargeDate !== undefined;
      const invoice = custom
        ? await this.invoices.createCustomForEmployer(Number(body.employerId), {
            periodStart: new Date(body.periodStart),
            periodEnd: new Date(body.periodEnd),
            chargeDate: body.chargeDate || undefined,
            workCenterIds: (body.workCenterIds || []).map(Number),
            workerIds: (body.workerIds || []).map(Number),
            fixedFee: Number(body.fixedFee ?? 0),
            discountPct: Number(body.discountPct ?? 0),
          })
        : await this.invoices.generateForEmployer(
            Number(body.employerId),
            new Date(body.periodStart),
            new Date(body.periodEnd),
          );
      return { data: invoice };
    } catch (e: any) {
      if (String(e?.message || '').includes('uq_invoices_employer_period') || e?.code === '23505') {
        throw new BadRequestException(
          'An invoice already exists for this employer and period',
        );
      }
      throw e;
    }
  }

  @Get(':publicId')
  async getOne(@Req() req: any, @Param('publicId') publicId: string) {
    const invoice = await this.invoices.findByPublicId(publicId);
    const scope = await this.access.resolveScope(req.user);
    // Throws 403 for Affiliate partners; returns 'page1Only' for Bronze.
    const level = await this.access.assertInvoiceDetailAccess(
      scope,
      invoice.employerId,
    );

    const context = await this.invoices.getInvoiceFormContext(invoice.employerId);

    if ((invoice as any).paymentMethod) {
      context.payment = {
        ...context.payment,
        methodId: (invoice as any).paymentMethodId,
        methodCode: (invoice as any).paymentMethod.name,
        methodName: (invoice as any).paymentMethod.name,
      };
    }

    const isLastInvoice = await this.invoices.isLastInvoice(
      (invoice as any).invoiceNumber,
    );

    if (level === 'page1Only') {
      // Strip the page-2 snapshots so Bronze partners can't see worksite
      // / worker names. The financial breakdown stays.
      const { workCenters: _wc, workers: _wk, ...page1 } = invoice as any;
      return { data: { ...page1, ...context, accessLevel: 'page1Only', isLastInvoice } };
    }
    return { data: { ...invoice, ...context, accessLevel: 'full', isLastInvoice } };
  }

  @Post(':publicId/payment-method')
  async setPaymentMethod(
    @Req() req: any,
    @Param('publicId') publicId: string,
    @Body() body: { paymentMethodId: number },
  ) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can change the payment method');
    }
    const invoice = await this.invoices.setPaymentMethod(
      publicId,
      Number(body?.paymentMethodId),
    );
    return { data: invoice };
  }

  @Get(':publicId/edit')
  async editContext(@Req() req: any, @Param('publicId') publicId: string) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can edit invoices');
    }
    return { data: await this.invoices.getEditContext(publicId) };
  }

  @Patch(':publicId')
  async update(
    @Req() req: any,
    @Param('publicId') publicId: string,
    @Body()
    body: {
      chargeDate?: string;
      workCenterIds?: number[];
      workerIds?: number[];
      fixedFee?: number;
      discountPct?: number;
    },
  ) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can edit invoices');
    }
    assertChargeDateNotPast(body.chargeDate);
    const invoice = await this.invoices.updateInvoice(publicId, {
      chargeDate: body.chargeDate ?? undefined,
      workCenterIds: (body.workCenterIds || []).map(Number),
      workerIds: (body.workerIds || []).map(Number),
      fixedFee: Number(body.fixedFee ?? 0),
      discountPct: Number(body.discountPct ?? 0),
    });
    return { data: invoice };
  }

  @Delete(':publicId')
  async remove(@Req() req: any, @Param('publicId') publicId: string) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can delete invoices');
    }
    await this.invoices.deleteInvoice(publicId);
    return { data: { ok: true } };
  }

  @Post(':publicId/mark-paid')
  async markPaid(@Req() req: any, @Param('publicId') publicId: string) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can mark invoices as paid');
    }
    const invoice = await this.invoices.markPaid(publicId);
    return { data: invoice };
  }

  @Post(':publicId/cancel')
  async cancel(@Req() req: any, @Param('publicId') publicId: string) {
    if (!this.access.isAdmin(req.user)) {
      throw new ForbiddenException('Only admins can cancel invoices');
    }
    const invoice = await this.invoices.cancel(publicId);
    return { data: invoice };
  }

  @Post('bulk-pdf')
  async bulkPdf(
    @Req() req: any,
    @Body() body: { publicIds?: string[] },
    @Res() res: Response,
  ) {
    const ids = Array.isArray(body?.publicIds) ? body.publicIds : [];
    if (!ids.length) throw new BadRequestException('publicIds is required');

    const scope = await this.access.resolveScope(req.user);
    const items: Array<{ publicId: string; level: 'full' | 'page1Only' }> = [];
    for (const publicId of ids) {
      const invoice = await this.invoices.findByPublicId(publicId);
      const level = await this.access.assertInvoiceDetailAccess(
        scope,
        invoice.employerId,
      );
      items.push({ publicId, level });
    }

    const buffer = await this.pdf.renderMany(items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="invoices.pdf"');
    res.send(buffer);
  }

  @Post('bulk-receipts')
  async bulkReceipts(
    @Req() req: any,
    @Body() body: { publicIds?: string[] },
    @Res() res: Response,
  ) {
    const ids = Array.isArray(body?.publicIds) ? body.publicIds : [];
    if (!ids.length) throw new BadRequestException('publicIds is required');

    const scope = await this.access.resolveScope(req.user);
    const items: Array<{ publicId: string }> = [];
    for (const publicId of ids) {
      const invoice = await this.invoices.findByPublicId(publicId);
      await this.access.assertInvoiceDetailAccess(scope, invoice.employerId);
      items.push({ publicId });
    }

    const buffer = await this.pdf.renderReceipts(items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="receipts.pdf"');
    res.send(buffer);
  }

  @Get(':publicId/pdf')
  async getPdf(
    @Req() req: any,
    @Param('publicId') publicId: string,
    @Res() res: Response,
  ) {
    const invoice = await this.invoices.findByPublicId(publicId);
    const scope = await this.access.resolveScope(req.user);
    const level = await this.access.assertInvoiceDetailAccess(
      scope,
      invoice.employerId,
    );
    const buffer = await this.pdf.render(publicId, { level });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${invoice.invoiceNumber}.pdf"`,
    );
    res.send(buffer);
  }
}

function assertChargeDateNotPast(chargeDate?: string): void {
  if (!chargeDate) return;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (chargeDate < todayIso) {
    throw new BadRequestException('The charge date cannot be earlier than today');
  }
}
