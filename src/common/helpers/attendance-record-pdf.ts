import * as PDFDocument from 'pdfkit';
import { createHash } from 'crypto';

export interface RecordDay {
  date: string;
  workerName: string;
  workerNif?: string | null;
  jobName?: string | null;
  workCenter?: string | null;
  checkIn: string;
  checkOut: string;
  minutes: number;
  overtimeMinutes?: number | null;
  corrected?: boolean;
}

export interface AttendanceRecordParams {
  company: { name: string; taxId?: string | null; address?: string | null };
  workerName?: string | null;
  periodStart: string;
  periodEnd: string;
  days: RecordDay[];
  generatedBy?: string | null;
  generatedAt: string;
}

const fmtDateEs = (iso: string | Date | null | undefined): string => {
  if (!iso) return '';
  const s = iso instanceof Date ? iso.toISOString() : String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

const hhmm = (mins: number) => `${Math.floor((mins || 0) / 60)}h ${String((mins || 0) % 60).padStart(2, '0')}m`;

/**
 * Registro diario de jornada — the document an employer has to produce for a
 * labour inspection under art. 34.9 ET.
 *
 * The list exports were a screenshot of whatever the table happened to hold:
 * no company, no worker identity, no period, nothing to show the figures had
 * not been edited afterwards. This is that document instead — one row per
 * session, totalled, and sealed.
 */
export function renderAttendanceRecordPdf(params: AttendanceRecordParams): Promise<Buffer> {
  const MARGIN = 40;
  const PURPLE = '#662D91';
  const TEXT = '#222222';
  const MUTED = '#666666';
  const BORDER = '#dddddd';

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, layout: 'landscape' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const WIDTH = doc.page.width - 2 * MARGIN;
  const RIGHT = MARGIN + WIDTH;

  // The seal covers the figures, so an edited export cannot pass as the original.
  const seal = createHash('sha256')
    .update(
      JSON.stringify({
        company: params.company.taxId ?? params.company.name,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        days: params.days.map((d) => [d.date, d.workerName, d.checkIn, d.checkOut, d.minutes]),
      }),
    )
    .digest('hex');

  doc.fontSize(15).fillColor(PURPLE).font('Helvetica-Bold');
  doc.text('REGISTRO DIARIO DE JORNADA', MARGIN, MARGIN, { width: WIDTH });
  doc.fontSize(8).fillColor(MUTED).font('Helvetica');
  doc.text('Artículo 34.9 del Estatuto de los Trabajadores', MARGIN, doc.y + 1, { width: WIDTH });

  let y = doc.y + 10;
  doc.fontSize(9).fillColor(TEXT).font('Helvetica-Bold');
  doc.text(params.company.name, MARGIN, y, { width: WIDTH / 2 });
  y = doc.y;
  doc.font('Helvetica').fillColor(MUTED);
  for (const line of [params.company.taxId ? `CIF/NIF: ${params.company.taxId}` : null, params.company.address]) {
    if (!line) continue;
    doc.text(line, MARGIN, y, { width: WIDTH / 2 });
    y = doc.y;
  }

  let ry = MARGIN + 42;
  doc.fontSize(9).fillColor(TEXT).font('Helvetica');
  const meta = (label: string, value: string) => {
    doc.font('Helvetica-Bold').text(`${label}: `, MARGIN + WIDTH / 2, ry, { continued: true, width: WIDTH / 2 });
    doc.font('Helvetica').text(value);
    ry = doc.y + 2;
  };
  meta('Periodo', `${fmtDateEs(params.periodStart)} - ${fmtDateEs(params.periodEnd)}`);
  meta('Trabajador', params.workerName || 'Todos');
  meta('Expedido', fmtDateEs(params.generatedAt) + (params.generatedBy ? ` por ${params.generatedBy}` : ''));

  y = Math.max(y, ry) + 12;

  const cols: Array<[string, number, 'left' | 'right' | 'center']> = [
    ['Fecha', 62, 'left'],
    ['Trabajador', 120, 'left'],
    ['NIF', 62, 'left'],
    ['Puesto / centro', 150, 'left'],
    ['Entrada', 52, 'center'],
    ['Salida', 52, 'center'],
    ['Total', 58, 'right'],
    ['H. extra', 55, 'right'],
    ['Obs.', 50, 'left'],
  ];
  const xs: number[] = [];
  let x = MARGIN;
  for (const [, w] of cols) { xs.push(x); x += w; }

  const header = () => {
    doc.rect(MARGIN, y, WIDTH, 18).fill(PURPLE);
    doc.fontSize(8).fillColor('white').font('Helvetica-Bold');
    cols.forEach(([label, w, align], i) => {
      doc.text(label, xs[i] + 3, y + 5.5, { width: w - 6, align });
    });
    y += 18;
  };
  header();

  doc.fontSize(8).font('Helvetica');
  let totalMinutes = 0;
  let totalOvertime = 0;

  for (const d of params.days) {
    if (y > doc.page.height - MARGIN - 60) {
      doc.addPage();
      y = MARGIN;
      header();
      doc.fontSize(8).font('Helvetica');
    }
    totalMinutes += d.minutes || 0;
    totalOvertime += d.overtimeMinutes || 0;

    const cells = [
      fmtDateEs(d.date),
      d.workerName,
      d.workerNif || '—',
      [d.jobName, d.workCenter].filter(Boolean).join(' / ') || '—',
      d.checkIn,
      d.checkOut,
      hhmm(d.minutes),
      d.overtimeMinutes ? hhmm(d.overtimeMinutes) : '—',
      d.corrected ? 'Corregido' : '',
    ];
    doc.fillColor(TEXT);
    cells.forEach((c, i) => {
      doc.text(String(c), xs[i] + 3, y + 4, { width: cols[i][1] - 6, align: cols[i][2], lineBreak: false });
    });
    y += 15;
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.4).strokeColor(BORDER).stroke();
  }

  y += 6;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT);
  doc.text(`${params.days.length} registros`, MARGIN + 3, y, { width: 200 });
  doc.text(`Total: ${hhmm(totalMinutes)}`, xs[6] - 60, y, { width: cols[6][1] + 60, align: 'right' });
  doc.text(totalOvertime ? hhmm(totalOvertime) : '—', xs[7] + 3, y, { width: cols[7][1] - 6, align: 'right' });

  y += 22;
  doc.fontSize(7).font('Helvetica').fillColor(MUTED);
  doc.text(`Sello de integridad (SHA-256): ${seal}`, MARGIN, y, { width: WIDTH });
  doc.text(
    'Este documento refleja el registro horario conservado por la empresa. Cualquier modificación posterior de los datos altera el sello.',
    MARGIN,
    doc.y + 2,
    { width: WIDTH },
  );

  doc.end();
  return done;
}
