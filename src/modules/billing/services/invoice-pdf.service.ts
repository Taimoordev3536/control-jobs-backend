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
  return `${clean.slice(0, 4)} **** **** **** ${clean.slice(-4)}`;
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
    opts?: { level?: 'full' | 'page1Only' },
  ): Promise<Buffer> {
    const level = opts?.level ?? 'full';
    const invoice = await this.loadInvoice(publicId);
    const employer = await this.employerRepo.findOne({
      where: { id: invoice.employerId },
      relations: ['paymentMethod'],
    });
    const config = (await this.adminConfigRepo.find({ take: 1 }))[0];
    const extras = await this.buildExtras(invoice, employer);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const done = this.collect(doc);
    this.drawInvoice(doc, invoice, employer, config, level, extras);
    doc.end();
    return done;
  }

  /** Merge several invoices into one multi-page PDF (accounting ledger). */
  async renderMany(
    items: Array<{ publicId: string; level?: 'full' | 'page1Only' }>,
  ): Promise<Buffer> {
    const config = (await this.adminConfigRepo.find({ take: 1 }))[0];
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
      this.drawInvoice(doc, invoice, employer, config, item.level ?? 'full', extras);
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
      this.drawReceipt(doc, row.invoice, row.employer, config, row.methodName);
    }
    doc.end();
    return done;
  }

  private drawReceipt(
    doc: any,
    invoice: Invoice,
    employer: Employer | null,
    config: AdminConfig | undefined,
    methodName: string,
  ): void {
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
        doc.text(config?.companyName || 'ControlJobs', MARGIN, leftY);
        leftY += 24;
      }
    } else {
      doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold');
      doc.text(config?.companyName || 'ControlJobs', MARGIN, leftY);
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
    level: 'full' | 'page1Only',
    extras?: { paymentText: string | null; tariffText: string | null },
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
    // HEADER — left: company / right: FACTURA + metadata
    // ============================================================
    let leftY = MARGIN;
    let rightY = MARGIN;

    // Left side — render the SVG logo if available, otherwise fall back to
    // the company name as text.
    const svg = this.getLogoSvg();
    if (svg) {
      try {
        SVGtoPDF(doc, svg, MARGIN, leftY, {
          width: 150,
          preserveAspectRatio: 'xMinYMin meet',
        });
        leftY += 56; // visual height of the logo block
      } catch {
        // fallback to text on render error
        doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold');
        doc.text(config?.companyName || 'ControlJobs', MARGIN, leftY);
        leftY += 24;
      }
    } else {
      doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold');
      doc.text(config?.companyName || 'ControlJobs', MARGIN, leftY);
      leftY += 24;
    }

    if (config?.companyName) {
      doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica-Bold');
      doc.text(config.companyName, MARGIN, leftY, { width: 240 });
      leftY = doc.y + 2;
    }
    doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica');
    if (config?.address) {
      doc.text(config.address, MARGIN, leftY, { width: 240 });
      leftY = doc.y;
    }

    // Right side
    doc.fontSize(24).fillColor(TEXT_DARK).font('Helvetica-Bold');
    const docTitle = Number(invoice.total) < 0 ? 'ABONO' : 'FACTURA';
    doc.text(docTitle, MARGIN, rightY, { width: CONTENT_WIDTH, align: 'right' });
    rightY += 30;

    doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica');
    const metaRow = (label: string, value: string) => {
      doc.text(`${label}: ${value}`, MARGIN, rightY, {
        width: CONTENT_WIDTH,
        align: 'right',
      });
      rightY += 12;
    };
    metaRow('Nº', invoice.invoiceNumber);
    metaRow('Fecha', fmtDateEs(invoice.issueDate));
    if (invoice.chargeDate) metaRow('Fecha de cargo', fmtDateEs(invoice.chargeDate));
    // Per spec §8: always show calendar-day count in parens, prorated or not.
    // Use the persisted `proratedDays` when available, fall back to a
    // computed inclusive day count from the period boundaries.
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
    // The standalone "Prorrateado: N/M dias" line was retired now that the
    // calendar-day count lives directly in the Periodo line — same info,
    // one less row, no clash with the rest of the header's neutral colors.

    let y = Math.max(leftY, rightY) + 24;

    // ============================================================
    // BILL-TO
    // ============================================================
    doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica-Bold');
    doc.text('EMPLEADOR', MARGIN, y);
    y += 14;
    doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica-Bold');
    doc.text(employer?.name || `Empleador #${invoice.employerId}`, MARGIN, y);
    y += 14;
    doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica');
    if (employer?.taxId) {
      doc.text(`CIF/NIF: ${employer.taxId}`, MARGIN, y);
      y += 12;
    }
    if (employer?.address) {
      doc.text(employer.address, MARGIN, y);
      y += 12;
    }
    const cityLine = [employer?.postalCode, employer?.city, employer?.province]
      .filter(Boolean)
      .join(' ');
    if (cityLine) {
      doc.text(cityLine, MARGIN, y);
      y += 12;
    }
    if (employer?.country) {
      doc.text(employer.country, MARGIN, y);
      y += 12;
    }

    y += 18;

    // ============================================================
    // LINE ITEMS TABLE
    // ============================================================
    const colDescX = MARGIN + 6;
    const colQtyX = MARGIN + 290;
    const colQtyW = 50;
    const colPriceX = MARGIN + 350;
    const colPriceW = 70;
    const colAmountX = MARGIN + 425;
    const colAmountW = 75;

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
    // TOTALS — right-aligned, two columns (label / value)
    // ============================================================
    y += 16;
    const labelX = MARGIN + 280;
    const labelW = 140;
    const valueX = MARGIN + 425;
    const valueW = 75;

    const totalLine = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 12 : 10);
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      doc.fillColor(bold ? TEXT_DARK : '#444');
      doc.text(label, labelX, y, { width: labelW, align: 'right' });
      doc.text(value, valueX, y, { width: valueW, align: 'right' });
      y += bold ? 20 : 16;
    };

    totalLine('Subtotal', fmtEur(invoice.subtotal));
    if (Number(invoice.discountPct) > 0) {
      totalLine(
        `Descuento (${Number(invoice.discountPct).toFixed(2)}%)`,
        `-${fmtEur(invoice.discountAmount)}`,
      );
    }
    totalLine(
      `IVA (${Number(invoice.vatPct).toFixed(2)}%)`,
      fmtEur(invoice.vatAmount),
    );

    // Separator above TOTAL
    y += 4;
    doc
      .moveTo(labelX, y)
      .lineTo(RIGHT_EDGE, y)
      .lineWidth(1.2)
      .strokeColor(PURPLE)
      .stroke();
    y += 8;

    totalLine('TOTAL', fmtEur(invoice.total), true);

    // Diagonal status stamp in the empty lower-left band (matches the UI).
    this.drawStatusStamp(doc, invoice.status, MARGIN + 175, y + 70);

    // ============================================================
    // FOOTER — status + payment details, bottom of page
    // ============================================================
    const footerY = Math.max(y + 30, doc.page.height - 110);
    doc
      .moveTo(MARGIN, footerY)
      .lineTo(RIGHT_EDGE, footerY)
      .lineWidth(0.5)
      .strokeColor(BORDER)
      .stroke();

    let fy = footerY + 10;
    doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica-Bold');
    doc.text(
      `Estado: ${STATUS_LABELS[invoice.status] || invoice.status}`,
      MARGIN,
      fy,
    );
    fy += 14;

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
