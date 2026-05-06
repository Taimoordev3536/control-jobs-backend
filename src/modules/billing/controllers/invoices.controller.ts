import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const scope = await this.access.resolveScope(req.user);
    return this.invoices.list({
      employerId: employerId ? Number(employerId) : undefined,
      status: status as InvoiceStatus | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      scope: scope as any,
    });
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

    if (level === 'page1Only') {
      // Strip the page-2 snapshots so Bronze partners can't see worksite
      // / worker names. The financial breakdown stays.
      const { workCenters: _wc, workers: _wk, ...page1 } = invoice as any;
      return { data: { ...page1, accessLevel: 'page1Only' } };
    }
    return { data: { ...invoice, accessLevel: 'full' } };
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
