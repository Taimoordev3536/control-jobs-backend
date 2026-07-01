import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import { Autofactura } from '../entities/autofactura.entity';
import { AdminUser } from '../../users/entities/admin-user.entity';
import { resolveCompanyIdentity } from '../helpers/company-identity';

const fmtEur = (n: number | string) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`;
const fmtDateEs = (iso: string | Date | null | undefined) => {
  if (!iso) return '';
  const s = iso instanceof Date ? iso.toISOString() : String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};
const STATUS = { PENDING: 'PENDIENTE', PAID: 'PAGADA', CANCELLED: 'CANCELADA' } as Record<string, string>;
const GROUP = { INDIVIDUAL: 'Particulares', COMPANY: 'Empresas', FREELANCER: 'Autónomos' } as Record<string, string>;

@Injectable()
export class AutofacturaPdfService {
  constructor(@InjectRepository(AdminUser) private readonly adminUserRepo: Repository<AdminUser>) {}

  async render(af: Autofactura, opts?: { hideEmployerNames?: boolean }): Promise<Buffer> {
    const company = await resolveCompanyIdentity(this.adminUserRepo);
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    this.drawPage1(doc, af, company);
    if (!af.isManual && (af.sources || []).length) this.drawPage2(doc, af, !!opts?.hideEmployerNames);
    doc.end();
    return done;
  }

  async renderMany(list: Autofactura[]): Promise<Buffer> {
    const company = await resolveCompanyIdentity(this.adminUserRepo);
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    let first = true;
    for (const af of list) {
      if (!first) doc.addPage();
      first = false;
      this.drawPage1(doc, af, company);
      if (!af.isManual && (af.sources || []).length) this.drawPage2(doc, af, false);
    }
    doc.end();
    return done;
  }

  async renderBankBatch(list: Autofactura[]): Promise<Buffer> {
    const company = await resolveCompanyIdentity(this.adminUserRepo);
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    const MARGIN = 48;
    const CW = doc.page.width - 2 * MARGIN;
    const RIGHT = MARGIN + CW;
    const PURPLE = '#662D91';
    doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold').text('Órdenes de pago a partners', MARGIN, MARGIN);
    doc.fontSize(9).fillColor('#666').font('Helvetica').text(company?.name || 'ControlJobs', MARGIN, doc.y + 2);
    let y = doc.y + 20;
    const cols = [
      { l: 'Partner', w: 150 },
      { l: 'Nº Autofactura', w: 110 },
      { l: 'IBAN', w: 130 },
      { l: 'Fecha de pago', w: 90 },
      { l: 'Total', w: CW - 150 - 110 - 130 - 90 },
    ];
    doc.rect(MARGIN, y, CW, 20).fill(PURPLE);
    let x = MARGIN;
    for (const c of cols) { doc.fontSize(9).fillColor('white').font('Helvetica-Bold').text(c.l, x + 4, y + 6, { width: c.w - 8, align: c.l === 'Total' ? 'right' : 'left' }); x += c.w; }
    y += 20;
    let sum = 0;
    for (const af of list) {
      const p: any = af.partner || {};
      sum += Number(af.total) || 0;
      x = MARGIN;
      const vals = [p.name || '—', af.autofacturaNumber, p.accountIban || '—', fmtDateEs(af.paymentDate), fmtEur(af.total)];
      cols.forEach((c, i) => { doc.fontSize(9).fillColor('#222').font('Helvetica').text(vals[i], x + 4, y + 5, { width: c.w - 8, align: c.l === 'Total' ? 'right' : 'left' }); x += c.w; });
      y += 18;
      doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor('#ddd').stroke();
      if (y > doc.page.height - 80) { doc.addPage(); y = MARGIN; }
    }
    y += 8;
    doc.rect(RIGHT - 240, y, 240, 24).fill(PURPLE);
    doc.fontSize(11).fillColor('white').font('Helvetica-Bold').text('TOTAL', RIGHT - 236, y + 7);
    doc.text(fmtEur(sum), RIGHT - 240, y + 7, { width: 236, align: 'right' });
    doc.end();
    return done;
  }

  private drawPage1(doc: any, af: Autofactura, company: any) {
    const MARGIN = 48;
    const CW = doc.page.width - 2 * MARGIN;
    const RIGHT = MARGIN + CW;
    const PURPLE = '#662D91';
    const DARK = '#222222';
    const MUTED = '#666666';
    const BORDER = '#dddddd';
    const p: any = af.partner || {};

    let leftY = MARGIN;
    doc.fontSize(16).fillColor(PURPLE).font('Helvetica-Bold').text(p.name || 'Partner', MARGIN, leftY, { width: 290 });
    leftY = doc.y + 2;
    doc.fontSize(9).fillColor(MUTED).font('Helvetica');
    for (const l of [p.nif, p.address, [p.postalCode, p.city].filter(Boolean).join(' '), p.province, p.country]) {
      if (!l) continue;
      doc.text(l, MARGIN, leftY, { width: 290 });
      leftY = doc.y;
    }

    let rightY = MARGIN + 18;
    doc.fontSize(24).fillColor(DARK).font('Helvetica-Bold').text('FACTURA', MARGIN + 310, rightY, { width: RIGHT - (MARGIN + 310), align: 'right' });
    rightY += 36;
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text(company?.name || 'ControlJobs', MARGIN + 300, rightY, { width: RIGHT - (MARGIN + 300), align: 'right' });
    rightY = doc.y + 2;
    doc.fontSize(9).fillColor(DARK).font('Helvetica');
    for (const l of [company?.taxId, company?.address, [company?.postalCode, company?.city].filter(Boolean).join(' '), company?.province]) {
      if (!l) continue;
      doc.text(l, MARGIN + 300, rightY, { width: RIGHT - (MARGIN + 300), align: 'right' });
      rightY = doc.y;
    }

    leftY += 14;
    const meta = (label: string, val: string) => { doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold').text(`${label}: `, MARGIN, leftY, { continued: true }).font('Helvetica').text(val); leftY = doc.y + 3; };
    meta('Nº Factura', af.autofacturaNumber);
    meta('Fecha', fmtDateEs(af.issueDate));
    meta('Periodo', `${fmtDateEs(af.periodStart)} - ${fmtDateEs(af.periodEnd)}`);
    const iban = p.accountIban ? `${p.accountIban.replace(/\s+/g, '').slice(0, 4)} **** **** **** ${p.accountIban.replace(/\s+/g, '').slice(-4)}` : null;
    meta('Forma de pago', 'Transferencia' + (iban ? `   IBAN: ${iban}` : ''));
    if (af.paymentDate) meta('Fecha de pago', fmtDateEs(af.paymentDate));

    let y = leftY + 16;
    doc.rect(MARGIN, y, CW, 22).fill(PURPLE);
    doc.fontSize(10).fillColor('white').font('Helvetica-Bold').text('Concepto', MARGIN + 6, y + 7);
    doc.text('Total', RIGHT - 120, y + 7, { width: 114, align: 'right' });
    y += 22;
    for (const l of (af.lines || []).sort((a, b) => a.sortOrder - b.sortOrder)) {
      doc.fontSize(10).fillColor(DARK).font('Helvetica').text(l.description, MARGIN + 6, y + 7, { width: CW - 140 });
      doc.text(fmtEur(l.amount), RIGHT - 120, y + 7, { width: 114, align: 'right' });
      y += 22;
      doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    }

    y += 16;
    const boxW = 250;
    const boxX = RIGHT - boxW;
    const padX = 10;
    const labelW = boxW / 2 - padX;
    const valW = boxW / 2 - padX;
    doc.rect(boxX, y, boxW, 18).fill('#f1e9f8');
    doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK).text('Desglose fiscal', boxX, y + 5, { width: boxW, align: 'center' });
    y += 26;
    const row = (label: string, val: string) => { doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK).text(label, boxX + padX, y, { width: labelW }); doc.font('Helvetica').text(val, boxX + boxW / 2, y, { width: valW, align: 'right' }); y += 18; };
    row('Base imponible', fmtEur(af.subtotal));
    row(`% Retención ${Number(af.retentionPct)}%`, `-${fmtEur(af.retentionAmount)}`);
    row(`I.V.A. ${Number(af.vatPct)}%`, fmtEur(af.vatAmount));
    y += 4;
    doc.rect(boxX, y, boxW, 24).fill(PURPLE);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('white').text('TOTAL A PAGAR', boxX + padX, y + 7, { width: labelW + 20 });
    doc.text(fmtEur(af.total), boxX + boxW / 2, y + 7, { width: valW, align: 'right' });

    const label = (STATUS[af.status] || af.status).toUpperCase();
    const color = af.status === 'PAID' ? '#16a34a' : af.status === 'CANCELLED' ? '#9ca3af' : '#ef4444';
    const cx = MARGIN + 150;
    const cy = y - 10;
    doc.save();
    doc.fillOpacity(0.7).strokeOpacity(0.7).rotate(-18, { origin: [cx, cy] });
    doc.fontSize(26).font('Helvetica-Bold').fillColor(color);
    const tw = doc.widthOfString(label);
    doc.lineWidth(3).strokeColor(color).roundedRect(cx - tw / 2 - 14, cy - 21, tw + 28, 42, 4).stroke();
    doc.text(label, cx - tw / 2, cy - 13, { lineBreak: false });
    doc.restore();
    doc.fillOpacity(1).strokeOpacity(1);
  }

  private drawPage2(doc: any, af: Autofactura, hideNames: boolean) {
    const MARGIN = 48;
    const CW = doc.page.width - 2 * MARGIN;
    const RIGHT = MARGIN + CW;
    const PURPLE = '#662D91';
    const DARK = '#222222';
    doc.addPage();
    let y = MARGIN;
    doc.fontSize(14).fillColor(PURPLE).font('Helvetica-Bold').text('Detalle de comisiones', MARGIN, y);
    y += 26;

    const byType = new Map<string, any[]>();
    for (const s of af.sources) {
      const key = s.employerType || 'OTHER';
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(s);
    }
    const order = ['INDIVIDUAL', 'COMPANY', 'FREELANCER', 'OTHER'];
    const cols = hideNames
      ? [{ k: 'invoiceNumber', l: 'Nº Factura', w: 130 }, { k: 'subtotal', l: 'Subtotal', w: 100 }, { k: 'commission', l: 'Comisión', w: 100 }, { k: 'discount', l: 'Descuento', w: 100 }, { k: 'totalCommission', l: 'Total', w: 100 }]
      : [{ k: 'employerName', l: 'Empleador', w: 150 }, { k: 'invoiceNumber', l: 'Nº Factura', w: 100 }, { k: 'subtotal', l: 'Subtotal', w: 75 }, { k: 'commission', l: 'Comisión', w: 75 }, { k: 'discount', l: 'Descuento', w: 75 }, { k: 'totalCommission', l: 'Total', w: 75 }];

    for (const type of [...byType.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b))) {
      if (y > doc.page.height - 120) { doc.addPage(); y = MARGIN; }
      doc.rect(MARGIN, y, 200, 18).fill('#cccccc');
      doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text(GROUP[type] || 'Otros', MARGIN + 6, y + 4);
      y += 24;
      let x = MARGIN;
      doc.rect(MARGIN, y, CW, 18).fill('#f1e9f8');
      for (const c of cols) { doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold').text(c.l, x + 4, y + 5, { width: c.w - 8, align: c.k === 'employerName' || c.k === 'invoiceNumber' ? 'left' : 'right' }); x += c.w; }
      y += 20;
      for (const s of byType.get(type)!) {
        x = MARGIN;
        for (const c of cols) {
          const raw = (s as any)[c.k];
          const val = ['subtotal', 'commission', 'discount', 'totalCommission'].includes(c.k) ? fmtEur(raw) : String(raw ?? '');
          doc.fontSize(9).fillColor(DARK).font('Helvetica').text(val, x + 4, y, { width: c.w - 8, align: c.k === 'employerName' || c.k === 'invoiceNumber' ? 'left' : 'right' });
          x += c.w;
        }
        y += 16;
      }
      y += 12;
    }
  }
}
