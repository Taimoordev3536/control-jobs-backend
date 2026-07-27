import * as PDFDocument from 'pdfkit';

export interface DocParty {
  name: string;
  taxId?: string | null;
  lines?: (string | null | undefined)[];
}

export interface DocLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ServiceDetailRow {
  concept: string;
  detail?: string | null;
  quantity: string;
  unitPrice: number;
  amount: number;
}

export interface ServiceDetail {
  title?: string;
  periodStart: string;
  periodEnd: string;
  rows: ServiceDetailRow[];
  subtotal?: number;
  vatPct?: number;
  vatAmount?: number;
  total: number;
  showVat: boolean;
  notes?: string | null;
}

/** PENDING is the default state and is not stamped. */
const STATUS_STAMP: Record<string, { label: string; color: string }> = {
  PAID: { label: 'PAGADA', color: '#16a34a' },
  CANCELLED: { label: 'ANULADA', color: '#9ca3af' },
  OVERDUE: { label: 'VENCIDA', color: '#ef4444' },
};

export interface LineDocParams {
  docType: string;
  number: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  issuer: DocParty;
  recipient: DocParty;
  recipientHeading: string;
  lines: DocLine[];
  subtotal?: number;
  vatPct?: number;
  vatAmount?: number;
  total: number;
  showVat: boolean;
  serviceDetail?: ServiceDetail;
  status?: string | null;
  paymentMethod?: string | null;
}

const fmtEur = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return `${(num || 0).toFixed(2).replace('.', ',')} €`;
};

const fmtDateEs = (iso: string | Date | null | undefined): string => {
  if (!iso) return '';
  const s = iso instanceof Date ? iso.toISOString() : String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

function drawStatusStamp(doc: any, status: string, cx: number, cy: number): void {
  const stamp = STATUS_STAMP[status];
  if (!stamp) return;
  doc.save();
  doc.fillOpacity(0.7).strokeOpacity(0.7);
  doc.rotate(-18, { origin: [cx, cy] });
  doc.fontSize(26).font('Helvetica-Bold').fillColor(stamp.color);
  const textW = doc.widthOfString(stamp.label);
  const boxW = textW + 28;
  doc.lineWidth(3).strokeColor(stamp.color);
  doc.roundedRect(cx - boxW / 2, cy - 21, boxW, 42, 4).stroke();
  doc.text(stamp.label, cx - textW / 2, cy - 13, { lineBreak: false });
  doc.restore();
  doc.fillOpacity(1).strokeOpacity(1);
}

const MARGIN = 48;

/** Draws one document onto an open PDF. Callers own the page break. */
function drawLineDoc(doc: any, params: LineDocParams): void {
  const PURPLE = '#662D91';
  const TEXT_DARK = '#222222';
  const TEXT_MUTED = '#666666';
  const BORDER = '#dddddd';

  const PAGE_WIDTH = doc.page.width;
  const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
  const RIGHT_EDGE = MARGIN + CONTENT_WIDTH;
  const LEFT_W = 290;
  const RIGHT_X = MARGIN + 310;
  const RIGHT_W = RIGHT_EDGE - RIGHT_X;

  let leftY = MARGIN;
  doc.fontSize(16).fillColor(PURPLE).font('Helvetica-Bold');
  doc.text(params.issuer.name, MARGIN, leftY, { width: LEFT_W });
  leftY = doc.y + 2;
  doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica');
  for (const l of [params.issuer.taxId, ...(params.issuer.lines || [])]) {
    if (!l) continue;
    doc.text(l, MARGIN, leftY, { width: LEFT_W });
    leftY = doc.y;
  }

  leftY += 14;
  doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica');
  const metaRow = (label: string, value: string) => {
    doc.text(`${label}: ${value}`, MARGIN, leftY, { width: LEFT_W });
    leftY = doc.y + 3;
  };
  metaRow('Nº', params.number);
  metaRow('Fecha', fmtDateEs(params.issueDate));
  metaRow('Periodo', `${fmtDateEs(params.periodStart)} - ${fmtDateEs(params.periodEnd)}`);
  if (params.paymentMethod) metaRow('Forma de pago', params.paymentMethod);

  let rightY = MARGIN + 18;
  doc.fontSize(22).fillColor(TEXT_DARK).font('Helvetica-Bold');
  doc.text(params.docType, RIGHT_X, rightY, { width: RIGHT_W, align: 'right' });
  rightY += 34;
  doc.fontSize(8).fillColor(TEXT_MUTED).font('Helvetica-Bold');
  doc.text(params.recipientHeading.toUpperCase(), RIGHT_X, rightY, { width: RIGHT_W, align: 'right' });
  rightY = doc.y + 2;
  doc.fontSize(11).fillColor(TEXT_DARK).font('Helvetica-Bold');
  doc.text(params.recipient.name, RIGHT_X, rightY, { width: RIGHT_W, align: 'right' });
  rightY = doc.y + 2;
  doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica');
  for (const l of [params.recipient.taxId ? `CIF/NIF: ${params.recipient.taxId}` : null, ...(params.recipient.lines || [])]) {
    if (!l) continue;
    doc.text(l, RIGHT_X, rightY, { width: RIGHT_W, align: 'right' });
    rightY = doc.y;
  }

  let y = Math.max(leftY, rightY) + 24;

  const colDescX = MARGIN + 6;
  const colQtyX = MARGIN + 290;
  const colQtyW = 50;
  const colPriceX = MARGIN + 350;
  const colPriceW = 70;
  const colAmountX = MARGIN + 425;
  const colAmountW = 68;

  doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(PURPLE);
  doc.fontSize(10).fillColor('white').font('Helvetica-Bold');
  doc.text('Descripción', colDescX, y + 7);
  doc.text('Cant.', colQtyX, y + 7, { width: colQtyW, align: 'right' });
  doc.text('Precio', colPriceX, y + 7, { width: colPriceW, align: 'right' });
  doc.text('Importe', colAmountX, y + 7, { width: colAmountW, align: 'right' });
  y += 22;

  for (const l of params.lines) {
    doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica');
    doc.text(l.description, colDescX, y + 7, { width: colQtyX - colDescX - 8 });
    doc.text(String(l.quantity), colQtyX, y + 7, { width: colQtyW, align: 'right' });
    doc.text(fmtEur(l.unitPrice), colPriceX, y + 7, { width: colPriceW, align: 'right' });
    doc.text(fmtEur(l.amount), colAmountX, y + 7, { width: colAmountW, align: 'right' });
    y += 22;
    doc.moveTo(MARGIN, y).lineTo(RIGHT_EDGE, y).lineWidth(0.5).strokeColor(BORDER).stroke();
  }

  y += 16;
  const boxW = 240;
  const boxX = RIGHT_EDGE - boxW;
  const padX = 10;
  const labelW = boxW / 2 - padX;
  const valW = boxW / 2 - padX;

  if (params.showVat) {
    const pct = (n?: number) => {
      const v = Number(n) || 0;
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
    };
    doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK);
    doc.text('Base imponible', boxX + padX, y, { width: labelW });
    doc.font('Helvetica').text(fmtEur(params.subtotal || 0), boxX + boxW / 2, y, { width: valW, align: 'right' });
    y += 18;
    doc.font('Helvetica-Bold').text(`I.V.A. ${pct(params.vatPct)}%`, boxX + padX, y, { width: labelW });
    doc.font('Helvetica').text(fmtEur(params.vatAmount || 0), boxX + boxW / 2, y, { width: valW, align: 'right' });
    y += 22;
  }

  doc.rect(boxX, y, boxW, 24).fill(PURPLE);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white');
  doc.text('Total', boxX + padX, y + 7, { width: labelW });
  doc.text(fmtEur(params.total), boxX + boxW / 2, y + 7, { width: valW, align: 'right' });

  if (params.status) {
    drawStatusStamp(doc, String(params.status).toUpperCase(), MARGIN + 120, y - 40);
  }

  if (params.serviceDetail) {
    const d = params.serviceDetail;
    doc.addPage();
    let dy = MARGIN;

    doc.fontSize(18).fillColor(PURPLE).font('Helvetica-Bold');
    doc.text(d.title || 'Detalle de los servicios', MARGIN, dy, { width: CONTENT_WIDTH });
    dy = doc.y + 6;

    doc.fontSize(9).fillColor(TEXT_MUTED).font('Helvetica');
    doc.text(`Factura Nº ${params.number}`, MARGIN, dy, { width: CONTENT_WIDTH });
    dy = doc.y + 2;
    doc.text(`Periodo: ${fmtDateEs(d.periodStart)} - ${fmtDateEs(d.periodEnd)}`, MARGIN, dy, { width: CONTENT_WIDTH });
    dy = doc.y + 18;

    doc.rect(MARGIN, dy, CONTENT_WIDTH, 22).fill(PURPLE);
    doc.fontSize(10).fillColor('white').font('Helvetica-Bold');
    doc.text('Concepto', colDescX, dy + 7);
    doc.text('Cant.', colQtyX, dy + 7, { width: colQtyW, align: 'right' });
    doc.text('Precio', colPriceX, dy + 7, { width: colPriceW, align: 'right' });
    doc.text('Importe', colAmountX, dy + 7, { width: colAmountW, align: 'right' });
    dy += 22;

    for (const r of d.rows) {
      const conceptW = colQtyX - colDescX - 8;
      doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica-Bold');
      doc.text(r.concept, colDescX, dy + 7, { width: conceptW });
      let conceptBottom = doc.y;
      if (r.detail) {
        doc.fontSize(8).fillColor(TEXT_MUTED).font('Helvetica');
        doc.text(r.detail, colDescX, doc.y + 1, { width: conceptW });
        conceptBottom = doc.y;
      }
      doc.fontSize(10).fillColor(TEXT_DARK).font('Helvetica');
      doc.text(r.quantity, colQtyX, dy + 7, { width: colQtyW, align: 'right' });
      doc.text(fmtEur(r.unitPrice), colPriceX, dy + 7, { width: colPriceW, align: 'right' });
      doc.text(fmtEur(r.amount), colAmountX, dy + 7, { width: colAmountW, align: 'right' });
      dy = Math.max(dy + 22, conceptBottom + 8);
      doc.moveTo(MARGIN, dy).lineTo(RIGHT_EDGE, dy).lineWidth(0.5).strokeColor(BORDER).stroke();
    }

    dy += 16;
    if (d.showVat) {
      const pct = (n?: number) => {
        const v = Number(n) || 0;
        return Number.isInteger(v) ? String(v) : v.toFixed(2);
      };
      doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK);
      doc.text('Base imponible', boxX + padX, dy, { width: labelW });
      doc.font('Helvetica').text(fmtEur(d.subtotal || 0), boxX + boxW / 2, dy, { width: valW, align: 'right' });
      dy += 18;
      doc.font('Helvetica-Bold').text(`I.V.A. ${pct(d.vatPct)}%`, boxX + padX, dy, { width: labelW });
      doc.font('Helvetica').text(fmtEur(d.vatAmount || 0), boxX + boxW / 2, dy, { width: valW, align: 'right' });
      dy += 22;
    }
    doc.rect(boxX, dy, boxW, 24).fill(PURPLE);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('white');
    doc.text('Total', boxX + padX, dy + 7, { width: labelW });
    doc.text(fmtEur(d.total), boxX + boxW / 2, dy + 7, { width: valW, align: 'right' });
    dy += 40;

    if (d.notes) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK);
      doc.text('Notas', MARGIN, dy, { width: CONTENT_WIDTH });
      dy = doc.y + 2;
      doc.fontSize(9).font('Helvetica').fillColor(TEXT_MUTED);
      doc.text(d.notes, MARGIN, dy, { width: CONTENT_WIDTH });
    }
  }
}

export function renderLineDocPdf(params: LineDocParams): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  const done = collect(doc);
  drawLineDoc(doc, params);
  doc.end();
  return done;
}

/** One PDF holding several documents, each starting on its own page. */
export function renderLineDocsPdf(list: LineDocParams[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  const done = collect(doc);
  list.forEach((params, i) => {
    if (i > 0) doc.addPage();
    drawLineDoc(doc, params);
  });
  doc.end();
  return done;
}

function collect(doc: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
