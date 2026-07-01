import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
// svg-to-pdfkit has no first-party types; require with `any` cast.
// Lets us draw the SVG logo directly without rasterising it first.
const SVGtoPDF = require('svg-to-pdfkit') as (
  doc: any,
  svg: string,
  x?: number,
  y?: number,
  options?: any,
) => void;
import { Invoice } from '../entities/invoice.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { AdminConfig } from '../../admin/entities/admin-config.entity';
import { AdminUser } from '../../users/entities/admin-user.entity';
import { CompanyIdentity, resolveCompanyIdentity } from '../helpers/company-identity';
import { RatePlan } from '../entities/rate-plan.entity';

const PAYMENT_LABELS: Record<string, string> = {
  DIRECT_DEBIT: 'Domiciliación',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  PAYPAL: 'PayPal',
  OTHERS: 'Otros',
};

function maskIbanPdf(iban?: string | null): string | null {
  if (!iban) return null;
  const clean = iban.replace(/\s+/g, '');
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)} **** **** **** **** ${clean.slice(-4)}`;
}

const fmtEur = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return `${(num || 0).toFixed(2).replace('.', ',')} €`;
};

// ISO ("2026-04-28") → dd/mm/aaaa for Spanish legal documents.
const fmtDateEs = (iso: string | Date | null | undefined): string => {
  if (!iso) return '';
  const s = iso instanceof Date ? iso.toISOString() : String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
  REFUNDED: 'Reembolsada',
};

@Injectable()
export class InvoicePdfService {
  /** Cached SVG markup so we don't read disk on every render. */
  private logoSvg: string | null = null;

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(AdminConfig)
    private readonly adminConfigRepo: Repository<AdminConfig>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
    @InjectRepository(RatePlan)
    private readonly ratePlanRepo: Repository<RatePlan>,
  ) {}

  /** Payment-method text (label + masked identifier) and tariff for the header. */
  private async buildExtras(
    invoice: Invoice,
    employer: Employer | null,
  ): Promise<{ paymentText: string | null; tariffText: string | null }> {
    const methodCode =
      (invoice as any).paymentMethod?.name ||
      (employer?.paymentMethod as any)?.name ||
      null;
    const label = methodCode ? PAYMENT_LABELS[methodCode] || methodCode : null;
    let detail = '';
    if (methodCode === 'DIRECT_DEBIT' || methodCode === 'TRANSFER') {
      const m = maskIbanPdf(employer?.accountIban);
      if (m) detail = `IBAN: ${m}`;
    } else if (methodCode === 'CARD' && (employer as any)?.cardLast4) {
      detail = `Nº: **** **** **** ${(employer as any).cardLast4}`;
    } else if (methodCode === 'PAYPAL' && (employer as any)?.paypalEmail) {
      detail = `eMail: ${(employer as any).paypalEmail}`;
    }
    const paymentText = label ? (detail ? `${label}   ${detail}` : label) : null;

    let tariffText: string | null = null;
    if (employer?.ratePlanId) {
      const rp = await this.ratePlanRepo.findOne({ where: { id: employer.ratePlanId } });
      if (rp) tariffText = rp.tariffType || rp.label;
    }
    return { paymentText, tariffText };
  }

  private getLogoSvg(): string | null {
    if (this.logoSvg) return this.logoSvg;
    // Resolve from this service file's location so it works in both
    // ts-node (src/) and compiled (dist/) layouts.
    const candidates = [
      path.join(__dirname, '..', 'assets', 'logo.svg'),
      path.join(__dirname, '..', '..', 'assets', 'logo.svg'),
      path.join(process.cwd(), 'src', 'modules', 'billing', 'assets', 'logo.svg'),
      path.join(process.cwd(), 'dist', 'src', 'modules', 'billing', 'assets', 'logo.svg'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          this.logoSvg = fs.readFileSync(p, 'utf8');
          return this.logoSvg;
        }
      } catch {
        /* try next */
      }
    }
    return null;
  }

  /**
   * Render an invoice as a PDF buffer.
   * Layout uses explicit Y-cursor tracking instead of relying on PDFKit's
   * auto-flow, so columns line up exactly and totals don't collide.
   * All glyphs stay within WinAnsi (Latin-1) — PDFKit's default Helvetica
   * font cannot render U+2192 (→) etc.
   */
  /**
   * Render an invoice PDF.
   *
   * `level` gates the page-2 content (worksites + workers). Bronze partners
   * and any caller passing 'page1Only' get the financial breakdown only;
   * Affiliates never reach this code path (controller throws 403 first).
   */
  async render(
    publicId: string,
    opts?: { level?: 'full' | 'page1Only'; hideEmployer?: boolean },
  ): Promise<Buffer> {
    const level = opts?.level ?? 'full';
    const invoice = await this.loadInvoice(publicId);
    const employer = await this.employerRepo.findOne({
      where: { id: invoice.employerId },
      relations: ['paymentMethod'],
    });
    const config = (await this.adminConfigRepo.find({ take: 1 }))[0];
    const company = await resolveCompanyIdentity(this.adminUserRepo);
    const extras = await this.buildExtras(invoice, employer);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const done = this.collect(doc);
    this.drawInvoice(doc, invoice, employer, config, company, level, extras, !!opts?.hideEmployer);
    doc.end();
    return done;
  }

  /** Merge several invoices into one multi-page PDF (accounting ledger). */
  async renderMany(
    items: Array<{ publicId: string; level?: 'full' | 'page1Only'; hideEmployer?: boolean }>,
  ): Promise<Buffer> {
    const config = (await this.adminConfigRepo.find({ take: 1 }))[0];
    const company = await resolveCompanyIdentity(this.adminUserRepo);
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const done = this.collect(doc);
    let first = true;
    for (const item of items) {
      const invoice = await this.loadInvoice(item.publicId);
      const employer = await this.employerRepo.findOne({
        where: { id: invoice.employerId },
        relations: ['paymentMethod'],
      });
      const extras = await this.buildExtras(invoice, employer);
      if (!first) doc.addPage();
      first = false;
      this.drawInvoice(doc, invoice, employer, config, company, item.level ?? 'full', extras, !!item.hideEmployer);
    }
    doc.end();
    return done;
  }

  /**
   * Issue collection receipts (recibos de cobro) for the selected invoices,
   * one per page, ordered by the employer's payment method.
   */
  async renderReceipts(
    items: Array<{ publicId: string }>,
  ): Promise<Buffer> {
    const config = (await this.adminConfigRepo.find({ take: 1 }))[0];
    const company = await resolveCompanyIdentity(this.adminUserRepo);

    const loaded = [] as Array<{
      invoice: Invoice;
      employer: Employer | null;
      methodName: string;
    }>;
    for (const item of items) {
      const invoice = await this.loadInvoice(item.publicId);
      const employer = await this.employerRepo.findOne({
        where: { id: invoice.employerId },
        relations: ['paymentMethod'],
      });
      const methodName =
        (employer?.paymentMethod as any)?.name || 'Sin forma de pago';
      loaded.push({ invoice, employer, methodName });
    }
    loaded.sort((a, b) => a.methodName.localeCompare(b.methodName));

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const done = this.collect(doc);
    let first = true;
    for (const row of loaded) {
      if (!first) doc.addPage();
      first = false;
      this.drawReceipt(doc, row.invoice, row.employer, config, company, row.methodName);
    }
    doc.end();
    return done;
  }

  private drawReceipt(
    doc: any,
    invoice: Invoice,
    employer: Employer | null,
    config: AdminConfig | undefined,
    company: CompanyIdentity | null,
    methodName: string,
  ): void {
    const companyName = company?.name || config?.companyName || 'ControlJobs';
    const MARGIN = 48;
    const CONTENT_WIDTH = doc.page.width - 2 * MARGIN;
    const PURPLE = '#662D91';
    const TEXT_DARK = '#222222';
    const TEXT_MUTED = '#666666';

    let leftY = MARGIN;
    const svg = this.getLogoSvg();
    if (svg) {
      try {
        SVGtoPDF(doc, svg, MARGIN, leftY, {
          width: 150,
          preserveAspectRatio: 'xMinYMin meet',
        });
        leftY += 56;
      } catch {
        doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold');
        doc.text(companyName, MARGIN, leftY);
        leftY += 24;
      }
    } else {
      doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold');
      doc.text(companyName, MARGIN, leftY);
      leftY += 24;
    }

    doc.fontSize(22).fillColor(TEXT_DARK).font('Helvetica-Bold');
    doc.text('RECIBO DE COBRO', MARGIN, MARGIN, {
      width: CONTENT_WIDTH,
      align: 'right',
    });

    let y = Math.max(leftY, MARGIN + 30) + 30;

    const employerName = employer?.name || `Empleador #${invoice.employerId}`;
    const line = (text: string, bold = false) => {
      doc.fontSize(11).fillColor(TEXT_DARK).font(bold ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(text, MARGIN, y, { width: CONTENT_WIDTH });
      y = doc.y + 8;
    };

    line(`He recibido de ${employerName}` + (employer?.taxId ? ` (NIF: ${employer.taxId})` : ''));
    line(`la cantidad de ${fmtEur(invoice.total)}`, true);
    line(
      `en concepto de la factura Nº ${invoice.invoiceNumber} de fecha ${fmtDateEs(invoice.issueDate)}.`,
    );

    y += 8;
    doc.fontSize(11).fillColor(TEXT_MUTED).font('Helvetica-Bold');
    doc.text(`Forma de pago: ${methodName}`, MARGIN, y);
    y += 50;

    doc.fontSize(10).fillColor(TEXT_MUTED).font('Helvetica');
    doc.text('Firma y sello:', MARGIN, y);
    doc
      .moveTo(MARGIN + 80, y + 10)
      .lineTo(MARGIN + 280, y + 10)
      .lineWidth(0.5)
      .strokeColor('#999999')
      .stroke();
  }

  /** Rotated, faded status stamp centered at (cx, cy). */
  private drawStatusStamp(doc: any, status: string, cx: number, cy: number): void {
    const label = (STATUS_LABELS[status] || status).toUpperCase();
    const color =
      status === 'PAID'
        ? '#16a34a'
        : status === 'CANCELLED' || status === 'REFUNDED'
          ? '#9ca3af'
          : '#ef4444';
    doc.save();
    doc.fillOpacity(0.7).strokeOpacity(0.7);
    doc.rotate(-18, { origin: [cx, cy] });
    doc.fontSize(26).font('Helvetica-Bold').fillColor(color);
    const textW = doc.widthOfString(label);
    const boxW = textW + 28;
    const boxH = 42;
    doc.lineWidth(3).strokeColor(color);
    doc.roundedRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 4).stroke();
    doc.text(label, cx - textW / 2, cy - 13, { lineBreak: false });
    doc.restore();
    doc.fillOpacity(1).strokeOpacity(1);
  }

  private async loadInvoice(publicId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { publicId },
      relations: ['workCenters', 'workers', 'lines', 'paymentMethod'],
    });
    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  private collect(doc: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    return new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private drawInvoice(
    doc: any,
    invoice: Invoice,
    employer: Employer | null,
    config: AdminConfig | undefined,
    company: CompanyIdentity | null,
    level: 'full' | 'page1Only',
    extras?: { paymentText: string | null; tariffText: string | null },
    hideEmployer = false,
  ): void {
    const MARGIN = 48;
    const PAGE_WIDTH = doc.page.width;
    const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
    const RIGHT_EDGE = MARGIN + CONTENT_WIDTH;

    // Brand colours
    const PURPLE = '#662D91';
    const TEXT_DARK = '#222222';
    const TEXT_MUTED = '#666666';
    const BORDER = '#dddddd';

    // ============================================================
    // HEADER — left: logo + company + metadata / right: FACTURA + client
    // ============================================================
    const LEFT_W = 290;
    const RIGHT_X = MARGIN + 310;
    const RIGHT_W = RIGHT_EDGE - RIGHT_X;
    let leftY = MARGIN;
    let rightY = MARGIN;

    // Left — render the SVG logo if available, otherwise fall back to text.
    const companyName = company?.name || config?.companyName || 'ControlJobs';
    const svg = this.getLogoSvg();
    if (svg) {
      try {
        SVGtoPDF(doc, svg, MARGIN, leftY, {
          width: 150,
          preserveAspectRatio: 'xMinYMin meet',
        });
        leftY += 50;
      } catch {
        doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold');
        doc.text(companyName, MARGIN, leftY);
        leftY += 24;
      }
    } else {
      doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold');
      doc.text(companyName, MARGIN, leftY);
      leftY += 24;
    }

    doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica-Bold');
    doc.text(companyName, MARGIN, leftY, { width: LEFT_W });
    leftY = doc.y + 2;

    doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica');
    const companyLines = company
      ? [
          company.taxId,
          [company.address, company.floorDoor].filter(Boolean).join(' '),
          [company.postalCode, company.city].filter(Boolean).join(' '),
          company.province,
          company.country,
        ]
      : [config?.address];
    for (const lineText of companyLines) {
      if (!lineText) continue;
      doc.text(lineText, MARGIN, leftY, { width: LEFT_W });
      leftY = doc.y;
    }

    leftY += 16;
    doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica');
    const metaRow = (label: string, value: string) => {
      doc.text(`${label}: ${value}`, MARGIN, leftY, { width: LEFT_W });
      leftY = doc.y + 3;
    };
    metaRow('Nº', invoice.invoiceNumber);
    metaRow('Fecha', fmtDateEs(invoice.issueDate));
    if (invoice.chargeDate) metaRow('Fecha de cargo', fmtDateEs(invoice.chargeDate));
    // Per spec §8: always show calendar-day count in parens, prorated or not.
    const periodDays =
      invoice.proratedDays ??
      Math.round(
        (new Date(invoice.periodEnd).getTime() -
          new Date(invoice.periodStart).getTime()) /
          86_400_000,
      ) + 1;
    metaRow(
      'Periodo',
      `${fmtDateEs(invoice.periodStart)} - ${fmtDateEs(invoice.periodEnd)} (${periodDays} días)`,
    );
    if (extras?.paymentText) metaRow('Forma de pago', extras.paymentText);
    if (extras?.tariffText) metaRow('Tarifa', extras.tariffText);

    rightY = MARGIN + 18;
    doc.fontSize(24).fillColor(TEXT_DARK).font('Helvetica-Bold');
    const docTitle = Number(invoice.total) < 0 ? 'ABONO' : 'FACTURA';
    doc.text(docTitle, RIGHT_X, rightY, { width: RIGHT_W, align: 'right' });
    rightY += 38;

    doc.fontSize(11).fillColor(TEXT_DARK).font('Helvetica-Bold');
    doc.text(hideEmployer ? '—' : employer?.name || `Empleador #${invoice.employerId}`, RIGHT_X, rightY, {
      width: RIGHT_W,
    });
    rightY = doc.y + 3;
    doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica');
    const clientLines = hideEmployer
      ? []
      : [
          employer?.taxId ? `CIF/NIF: ${employer.taxId}` : null,
          [employer?.address, employer?.floorDoor].filter(Boolean).join(' ') || null,
          [employer?.postalCode, employer?.city].filter(Boolean).join(' ') || null,
          employer?.province || null,
          employer?.country || null,
        ];
    for (const lineText of clientLines) {
      if (!lineText) continue;
      doc.text(lineText, RIGHT_X, rightY, { width: RIGHT_W });
      rightY = doc.y;
    }

    let y = Math.max(leftY, rightY) + 24;

    // ============================================================
    // LINE ITEMS TABLE
    // ============================================================
    const colDescX = MARGIN + 6;
    const colQtyX = MARGIN + 290;
    const colQtyW = 50;
    const colPriceX = MARGIN + 350;
    const colPriceW = 70;
    const colAmountX = MARGIN + 425;
    const colAmountW = 68;

    // Header band
    doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(PURPLE);
    const headerTextY = y + 7;
    doc.fontSize(10).fillColor('white').font('Helvetica-Bold');
    doc.text('Descripción', colDescX, headerTextY);
    doc.text('Cant.', colQtyX, headerTextY, { width: colQtyW, align: 'right' });
    doc.text('Precio', colPriceX, headerTextY, { width: colPriceW, align: 'right' });
    doc.text('Importe', colAmountX, headerTextY, { width: colAmountW, align: 'right' });
    y += 22;

    const writeRow = (
      desc: string,
      qty: number,
      price: number | string,
      amount: number | string,
    ) => {
      const rowTop = y;
      const rowH = 22;
      const rowTextY = rowTop + 7;
      doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica');
      doc.text(desc, colDescX, rowTextY);
      doc.text(String(qty), colQtyX, rowTextY, { width: colQtyW, align: 'right' });
      doc.text(fmtEur(price), colPriceX, rowTextY, {
        width: colPriceW,
        align: 'right',
      });
      doc.text(fmtEur(amount), colAmountX, rowTextY, {
        width: colAmountW,
        align: 'right',
      });
      y += rowH;
      // bottom border
      doc
        .moveTo(MARGIN, y)
        .lineTo(RIGHT_EDGE, y)
        .lineWidth(0.5)
        .strokeColor(BORDER)
        .stroke();
    };

    const lineRows = (invoice as any).lines as
      | Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number; sortOrder: number }>
      | undefined;
    if (invoice.isManual && lineRows?.length) {
      for (const l of [...lineRows].sort((a, b) => a.sortOrder - b.sortOrder)) {
        writeRow(l.description, Number(l.quantity), l.unitPrice, l.lineTotal);
      }
    } else {
      writeRow('Cuota fija', 1, invoice.monthlyFixedRate, invoice.fixedAmount);
      writeRow(
        'Centros de trabajo',
        invoice.workcenterCount,
        invoice.perWorkCenterRate,
        invoice.workcenterAmount,
      );
      writeRow(
        'Trabajadores',
        invoice.workerCount,
        invoice.perWorkerRate,
        invoice.workerAmount,
      );
    }

    // ============================================================
    // TOTALS — Subtotal / discount, then the "Desglose fiscal" box
    // (Base imponible + I.V.A.) and the final "Total a Pagar" bar.
    // ============================================================
    y += 16;
    const boxW = 240;
    const boxX = RIGHT_EDGE - boxW;
    const padX = 10;
    const labelW = boxW / 2 - padX;
    const valW = boxW / 2 - padX;
    const pct = (n: number | string) => {
      const v = Number(n) || 0;
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
    };

    const sumRow = (label: string, value: string) => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK);
      doc.text(label, boxX + padX, y, { width: labelW });
      doc.font('Helvetica').text(value, boxX + boxW / 2, y, { width: valW, align: 'right' });
      y += 18;
    };

    sumRow('Subtotal', fmtEur(invoice.subtotal));
    sumRow(`Dto. (${pct(invoice.discountPct)}%)`, `-${fmtEur(invoice.discountAmount)}`);

    y += 6;
    const boxTop = y;
    doc.rect(boxX, y, boxW, 18).fill('#f1e9f8');
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK);
    doc.text('Desglose Fiscal', boxX, y + 5, { width: boxW, align: 'center' });
    y += 18 + 8;

    const base = (Number(invoice.subtotal) || 0) - (Number(invoice.discountAmount) || 0);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK);
    doc.text('Base Imponible', boxX + padX, y, { width: labelW });
    doc.font('Helvetica').text(fmtEur(base), boxX + boxW / 2, y, { width: valW, align: 'right' });
    y += 18;
    doc.font('Helvetica-Bold').text(`I.V.A. ${pct(invoice.vatPct)}%`, boxX + padX, y, { width: labelW });
    doc.font('Helvetica').text(fmtEur(invoice.vatAmount), boxX + boxW / 2, y, { width: valW, align: 'right' });
    y += 18 + 4;

    doc.rect(boxX, boxTop, boxW, y - boxTop).lineWidth(0.5).strokeColor(BORDER).stroke();

    doc.rect(boxX, y, boxW, 24).fill(PURPLE);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('white');
    doc.text('Total a Pagar', boxX + padX, y + 7, { width: labelW });
    doc.text(fmtEur(invoice.total), boxX + boxW / 2, y + 7, { width: valW, align: 'right' });
    y += 24;

    // Diagonal status stamp in the empty lower-left band (matches the UI).
    this.drawStatusStamp(doc, invoice.status, MARGIN + 160, boxTop + 24);

    // ============================================================
    // FOOTER — remarks + payment details, bottom of page
    // ============================================================
    const footerY = Math.max(y + 30, doc.page.height - 110);
    doc
      .moveTo(MARGIN, footerY)
      .lineTo(RIGHT_EDGE, footerY)
      .lineWidth(0.5)
      .strokeColor(BORDER)
      .stroke();

    let fy = footerY + 10;

    if (invoice.remarks) {
      doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica-Bold');
      doc.text('Observaciones:', MARGIN, fy);
      fy += 12;
      doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica');
      doc.text(invoice.remarks, MARGIN, fy, { width: CONTENT_WIDTH });
      fy = doc.y + 4;
    }

    if (config?.paymentDetails) {
      doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica-Bold');
      doc.text('Forma de pago:', MARGIN, fy);
      fy += 12;
      doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica');
      doc.text(config.paymentDetails, MARGIN, fy, {
        width: CONTENT_WIDTH,
      });
    }

    // ============================================================
    // PAGE 2 — worksites + workers detail (Gold/Silver/Admin/Employer only).
    // Skipped entirely for level === 'page1Only' (Bronze partners).
    // ============================================================
    const wcRows = (invoice as any).workCenters as Array<{ name: string }> | undefined;
    const wkRows = (invoice as any).workers as Array<{ name: string }> | undefined;
    const hasDetail =
      level === 'full' && ((wcRows?.length ?? 0) > 0 || (wkRows?.length ?? 0) > 0);

    if (hasDetail) {
      doc.addPage();
      let py = MARGIN;

      doc.fontSize(14).fillColor(PURPLE).font('Helvetica-Bold');
      doc.text('Detalle de facturación', MARGIN, py);
      py += 22;

      doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica');
      doc.text(
        'Centros de trabajo y trabajadores incluidos en el cálculo de esta factura.',
        MARGIN,
        py,
        { width: CONTENT_WIDTH },
      );
      py += 24;

      // --- Centros de trabajo ---
      if (wcRows && wcRows.length) {
        doc.fontSize(11).fillColor(TEXT_DARK).font('Helvetica-Bold');
        doc.text(`Centros de trabajo (${wcRows.length})`, MARGIN, py);
        py += 16;

        doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica');
        for (const row of wcRows) {
          if (py > doc.page.height - MARGIN - 20) {
            doc.addPage();
            py = MARGIN;
          }
          doc.text(`• ${row.name}`, MARGIN + 8, py, { width: CONTENT_WIDTH - 8 });
          py += 14;
        }
        py += 12;
      }

      // --- Trabajadores ---
      if (wkRows && wkRows.length) {
        if (py > doc.page.height - MARGIN - 60) {
          doc.addPage();
          py = MARGIN;
        }
        doc.fontSize(11).fillColor(TEXT_DARK).font('Helvetica-Bold');
        doc.text(`Trabajadores (${wkRows.length})`, MARGIN, py);
        py += 16;

        doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica');
        for (const row of wkRows) {
          if (py > doc.page.height - MARGIN - 20) {
            doc.addPage();
            py = MARGIN;
          }
          doc.text(`• ${row.name}`, MARGIN + 8, py, { width: CONTENT_WIDTH - 8 });
          py += 14;
        }
      }
    }

  }
}
