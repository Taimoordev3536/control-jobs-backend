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
  ) {}

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
    const invoice = await this.invoiceRepo.findOne({
      where: { publicId },
      relations: ['workCenters', 'workers'],
    });
    if (!invoice) throw new Error('Invoice not found');
    const employer = await this.employerRepo.findOne({ where: { id: invoice.employerId } });
    const config = (await this.adminConfigRepo.find({ take: 1 }))[0];

    const MARGIN = 48;
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const PAGE_WIDTH = doc.page.width;
    const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
    const RIGHT_EDGE = MARGIN + CONTENT_WIDTH;

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

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

    doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica');
    if (config?.address) {
      doc.text(config.address, MARGIN, leftY, { width: 240 });
      leftY = doc.y;
    }

    // Right side
    doc.fontSize(24).fillColor(TEXT_DARK).font('Helvetica-Bold');
    doc.text('FACTURA', MARGIN, rightY, { width: CONTENT_WIDTH, align: 'right' });
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
    metaRow('Vencimiento', fmtDateEs(invoice.dueDate));
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
    // The standalone "Prorrateado: N/M dias" line was retired now that the
    // calendar-day count lives directly in the Periodo line — same info,
    // one less row, no clash with the rest of the header's neutral colors.

    let y = Math.max(leftY, rightY) + 24;

    // ============================================================
    // BILL-TO
    // ============================================================
    doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica-Bold');
    doc.text('CLIENTE', MARGIN, y);
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
      doc.text('Detalle de servicios', MARGIN, py);
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

    doc.end();
    return done;
  }
}
