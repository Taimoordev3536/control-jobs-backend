/**
 * A5 portrait QR-code PDF renderer using `pdfkit` (pure JS).
 *
 * This replaces the previous HTML + Puppeteer + @sparticuz/chromium pipeline
 * so the backend has no native/Chromium dependency and runs on any Node host
 * (Render, Vercel, Railway, Fly, bare metal, AWS Lambda) without
 * platform-specific setup.
 *
 * Layout mirrors the client-side print design: stacked white panels on a
 * #737373 page for work-center name, QR image, and client name, with an
 * employer info block + ControlJobs brand on the bottom row.
 */
import PDFDocument = require('pdfkit');
// svg-to-pdfkit ships as CJS with no types; keep the require form consistent.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SVGtoPDF = require('svg-to-pdfkit');

export interface QrPdfEmployer {
  name?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  logoUrl?: string;
}

export interface QrPdfTemplateData {
  qrImage: string; // data-URL PNG of the QR code
  workCenterName: string;
  clientName: string;
  employer?: QrPdfEmployer;
  // Pre-fetched logo bytes. When present, the bottom-left footer slot
  // renders the logo at 35% of A5 page width instead of the employer text.
  // The renderer is pure and doesn't fetch from the network itself.
  logoBuffer?: Buffer;
}

const MM_TO_PT = 2.8346456693;
const mm = (v: number) => v * MM_TO_PT;

// ControlJobs logo as inline SVG — no network fetch at render time.
const CONTROLJOBS_LOGO_SVG = Buffer.from(
  'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAyMi4xLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCINCgkgdmlld0JveD0iMCAwIDI5MC4xIDU1LjMiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI5MC4xIDU1LjM7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiMzMzMzMzM7fQ0KCS5zdDF7ZmlsbDojNjYyRDkxO30NCgkuc3Qye2ZpbGw6IzMzMzMzMztzdHJva2U6IzMzMzMzMztzdHJva2Utd2lkdGg6MS41O3N0cm9rZS1taXRlcmxpbWl0OjEwO30NCjwvc3R5bGU+DQo8Zz4NCgk8Zz4NCgkJPGc+DQoJCQk8Zz4NCgkJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMzUuNCwzMy4xYzEuNCwwLDEuOSwxLjEsMSwyLjNjLTMuNyw1LjItOS41LDguNS0xNS45LDguNUM5LjIsNDMuOSwwLDM0LDAsMjEuN0MwLDEwLDkuMiwwLDIwLjQsMA0KCQkJCQljNi40LDAsMTIsMy4yLDE1LjgsOC4yYzAuOSwxLjMsMC4zLDIuMy0xLjEsMi4zaC0xYy0wLjksMC0xLjUtMC4zLTIuMi0xYy0yLjktMy4yLTctNS4yLTExLjQtNS4yYy05LDAtMTYuMyw3LjktMTYuMywxNy4zDQoJCQkJCWMwLDkuOSw3LjIsMTcuOCwxNi4zLDE3LjhjNC41LDAsOC43LTIsMTEuNi01LjNjMC43LTAuOCwxLjMtMS4xLDIuMi0xLjFIMzUuNHoiLz4NCgkJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDIuNCwzMC4yYzAtNy41LDYuMi0xMy43LDEzLjctMTMuN2M3LjUsMCwxMy43LDYuMiwxMy43LDEzLjdjMCw3LjQtNi4yLDEzLjgtMTMuNywxMy44DQoJCQkJCUM0OC42LDQ0LDQyLjQsMzcuNiw0Mi40LDMwLjJ6IE00Ni42LDMwLjJjMCw1LjIsNC4xLDkuOCw5LjUsOS44czkuNS00LjYsOS41LTkuOGMwLTUuMy00LjEtOS43LTkuNS05LjdTNDYuNiwyNC44LDQ2LjYsMzAuMnoiDQoJCQkJCS8+DQoJCQkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTc4LDQzLjNjLTEuMywwLTEuOS0wLjctMS45LTEuOVYxOC44YzAtMS4zLDAuNy0xLjksMS45LTEuOWgwLjJjMS4zLDAsMS45LDAuNywxLjksMS45djEuMw0KCQkJCQljMi4xLTIuMyw1LTMuNiw4LjYtMy42YzcuNiwwLDEwLjgsMy40LDEwLjgsMTEuOHYxMy4xYzAsMS4zLTAuNywxLjktMS45LDEuOWgtMC4yYy0xLjMsMC0xLjktMC43LTEuOS0xLjlWMjguMw0KCQkJCQljMC01LjItMi40LTcuOC02LjgtNy44Yy01LjMtMC4xLTguNiwyLjktOC42LDguOHYxMi4xYzAsMS4zLTAuNywxLjktMS45LDEuOUg3OHoiLz4NCgkJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTE3LDIwLjZoLTR2MjAuOGMwLDEuMy0wLjcsMS45LTEuOSwxLjloLTAuMmMtMS4zLDAtMS45LTAuNy0xLjktMS45VjIwLjZoLTJjLTEuMywwLTEuOS0wLjctMS45LTEuOQ0KCQkJCQljMC0xLjEsMC43LTEuNywxLjktMS43aDJWOC41YzAtMS4zLDAuNy0xLjksMS45LTEuOWgwLjJjMS4zLDAsMS45LDAuNywxLjksMS45djguNWg0YzEuMywwLDEuOSwwLjYsMS45LDEuOA0KCQkJCQlTMTE4LjIsMjAuNiwxMTcsMjAuNnoiLz4NCgkJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTI4LjMsMjAuNWMxLjctMiw0LjEtMy40LDctMy44YzEuMy0wLjIsMiwwLjUsMiwxLjh2MC4xYzAsMS4zLTAuNywxLjgtMS45LDJjLTMuOSwwLjYtNy4xLDMuNC03LjEsOC4xDQoJCQkJCXYxMi43YzAsMS4zLTAuNywxLjktMS45LDEuOWgtMC4yYy0xLjMsMC0xLjktMC43LTEuOS0xLjlWMTguOGMwLTEuMywwLjctMS45LDEuOS0xLjloMC4yYzEuMywwLDEuOSwwLjcsMS45LDEuOVYyMC41eiIvPg0KCQkJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xNzUuOCw0My4zYy0xLjMsMC0xLjktMC43LTEuOS0xLjl2LTM5YzAtMS4zLDAuNy0xLjksMS45LTEuOWgwLjJjMS4zLDAsMS45LDAuNywxLjksMS45djM5DQoJCQkJCWMwLDEuMy0wLjcsMS45LTEuOSwxLjlIMTc1Ljh6Ii8+DQoJCQk8L2c+DQoJCTwvZz4NCgkJPGc+DQoJCQk8cGF0aCBjbGFzcz0ic3QxIiBkPSJNMTgwLjcsNTIuOGMwLTEuMiwwLjctMS44LDEuOS0yYzYuNC0wLjcsMTAuMS01LDEwLjEtMTEuOVYyLjRjMC0xLjMsMC43LTEuOSwxLjktMS45aDAuNQ0KCQkJCWMxLjMsMCwxLjksMC43LDEuOSwxLjl2MzYuNWMwLDkuNy01LjMsMTUuNi0xNC40LDE2LjRjLTEuMywwLjEtMi0wLjctMi0xLjlWNTIuOHoiLz4NCgkJCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0yMDQsMzAuMmMwLTcuNSw2LjItMTMuNywxMy43LTEzLjdjNy41LDAsMTMuNyw2LjIsMTMuNywxMy43YzAsNy40LTYuMiwxMy44LTEzLjcsMTMuOA0KCQkJCUMyMTAuMSw0NCwyMDQsMzcuNiwyMDQsMzAuMnogTTIwOC4yLDMwLjJjMCw1LjIsNC4xLDkuOCw5LjUsOS44czkuNS00LjYsOS41LTkuOGMwLTUuMy00LjEtOS43LTkuNS05LjdTMjA4LjIsMjQuOCwyMDguMiwzMC4yeiINCgkJCQkvPg0KCQkJPHBhdGggY2xhc3M9InN0MSIgZD0iTTIzOS41LDQzLjNjLTEuMywwLTEuOS0wLjctMS45LTEuOXYtMzljMC0xLjMsMC43LTEuOSwxLjktMS45aDAuMmMxLjMsMCwxLjksMC43LDEuOSwxLjl2MTguOA0KCQkJCWMyLjQtMi45LDUuOS00LjcsMTAtNC43YzcuNSwwLDEzLjcsNi4yLDEzLjcsMTMuN2MwLDcuNC02LjIsMTMuOC0xMy43LDEzLjhjLTQsMC03LjYtMS45LTEwLTQuOXYyLjNjMCwxLjMtMC43LDEuOS0xLjksMS45DQoJCQkJSDIzOS41eiBNMjYxLjEsMzAuMmMwLTUuMy00LTkuNy05LjQtOS43Yy01LjIsMC05LjgsNC40LTkuOCw5LjdjMCw1LjIsNC42LDkuOCw5LjgsOS44QzI1Ny4xLDQwLDI2MS4xLDM1LjQsMjYxLjEsMzAuMnoiLz4NCgkJCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0yODQuNywyMmMtMC45LTEuMS0yLjYtMS43LTQuOC0xLjdjLTMuMiwwLTUuNCwxLjUtNS40LDMuNWMwLDIsMS43LDMuMSw2LjEsNGM2LjgsMS40LDkuNSwzLjcsOS41LDguMQ0KCQkJCWMwLDQuNi0zLjUsNy45LTEwLjEsNy45Yy01LDAtOC42LTIuMy05LjgtNS45Yy0wLjQtMS4zLDAuNC0yLDEuNy0yYzEuMSwwLDEuNiwwLjUsMi4yLDEuNGMxLDEuNiwzLjIsMi43LDUuOSwyLjcNCgkJCQljMy45LDAsNi41LTEuNyw2LjUtNC4xYzAtMi41LTEuNy0zLjQtNi41LTQuM2MtNi4zLTEuMy05LjEtMy41LTkuMS03LjdjMC00LDMuMS03LjMsOS4xLTcuM2M0LjMsMCw3LjMsMS45LDguNiw0LjgNCgkJCQljMC41LDEuMy0wLjIsMi4xLTEuNiwyLjFDMjg1LjksMjMuNCwyODUuNCwyMi45LDI4NC43LDIyeiIvPg0KCQk8L2c+DQoJPC9nPg0KCTxnPg0KCQk8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMTY0LjMsMjIuNGMtMi4xLTIuNy01LjEtNC41LTguNC01Yy0zLjMtMC40LTYuNiwwLjQtOS4zLDIuNWwtMS0xYy0wLjMtMC4zLTAuNS0wLjItMC42LDAuMmwtMC4zLDMuNQ0KCQkJYzAsMC40LDAuMywwLjcsMC42LDAuN2wzLjUtMC4zYzAuNCwwLDAuNS0wLjMsMC4yLTAuNmwtMS0xYzIuMi0xLjYsNC45LTIuMyw3LjYtMS45YzIuOCwwLjQsNS4zLDEuOSw3LjEsNC4yDQoJCQljMS43LDIuMywyLjUsNS4yLDIuMSw4Yy0wLjMsMi0xLjEsMy45LTIuMyw1LjVjLTAuNSwwLjYtMS4xLDEuMi0xLjgsMS43Yy0yLjMsMS44LTUuMSwyLjUtNy45LDIuMmMtMi44LTAuNC01LjMtMS45LTcuMS00LjINCgkJCWMtMS43LTIuMi0yLjUtNS0yLjEtNy44YzAuMS0wLjYtMC4zLTEuMS0wLjktMS4yYy0wLjYtMC4xLTEuMSwwLjMtMS4xLDAuOWMtMC40LDMuNCwwLjUsNi43LDIuNiw5LjRjMi4xLDIuNyw1LjEsNC41LDguNCw1DQoJCQljMy40LDAuNCw2LjctMC41LDkuNC0yLjZjMC44LTAuNiwxLjUtMS4zLDIuMS0yLjFjMS41LTEuOSwyLjUtNC4xLDIuOC02LjVDMTY3LjMsMjguNiwxNjYuNCwyNS4yLDE2NC4zLDIyLjR6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xNTMuNywyMS45Yy0wLjUsMC0wLjgsMC40LTAuOCwwLjh2OC40bDcuNSw0YzAuMSwwLjEsMC4zLDAuMSwwLjQsMC4xYzAuMywwLDAuNi0wLjIsMC43LTAuNQ0KCQkJYzAuMi0wLjQsMC4xLTAuOS0wLjQtMS4xbC02LjctMy41di03LjRDMTU0LjUsMjIuMywxNTQuMiwyMS45LDE1My43LDIxLjl6Ii8+DQoJPC9nPg0KPC9nPg0KPC9zdmc+DQo=',
  'base64',
).toString('utf8');

function parseDataUrl(url: string): Buffer {
  const match = url.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error('QR image is not a base64 data URL');
  return Buffer.from(match[1], 'base64');
}

// Binary-search the largest integer font size that fits `text` in a box of
// (maxWidth × maxHeight) points. Mirrors the CSS JS fitter in the old HTML
// template so the visual output stays close to the Puppeteer version.
function fitFontSize(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  maxWidth: number,
  maxHeight: number,
  minPt: number,
  maxPt: number,
): number {
  if (!text) return minPt;
  doc.font(font);
  let lo = minPt;
  let hi = maxPt;
  let best = minPt;
  for (let i = 0; i < 20 && lo <= hi; i++) {
    const mid = Math.floor((lo + hi) / 2);
    doc.fontSize(mid);
    const w = doc.widthOfString(text);
    const h = doc.currentLineHeight();
    if (w <= maxWidth && h <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function drawCenteredText(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  fontSize: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  color = '#000000',
) {
  if (!text) return;
  doc.font(font).fontSize(fontSize).fillColor(color);
  const textW = doc.widthOfString(text);
  const capHeight = fontSize * 0.718;
  const y = boxY + (boxH - capHeight) / 2;
  doc.text(text, boxX + (boxW - textW) / 2, y, {
    lineBreak: false,
    width: boxW,
  });
}

export function generateQrPdfBuffer(data: QrPdfTemplateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A5',
        margin: 0,
        info: { Title: 'QR Code' },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const pad = mm(7.4);
      const gap = mm(7.4);

      // Gray page background
      doc.rect(0, 0, pageW, pageH).fill('#737373');

      const innerX = pad;
      const innerY = pad;
      const innerW = pageW - 2 * pad;
      const innerH = pageH - 2 * pad;

      const wcH = innerH * 0.12;
      const clientH = innerH * 0.06;
      const footerH = innerH * 0.12;
      const qrH = innerH - wcH - clientH - footerH - 3 * gap;

      let y = innerY;

      // --- Work center name (white panel, auto-fit uppercase bold) ---
      doc.rect(innerX, y, innerW, wcH).fill('#ffffff');
      const wcText = (data.workCenterName || '').toUpperCase();
      if (wcText) {
        const wcPadV = wcH * 0.03;
        const wcPadH = innerW * 0.04;
        const fs = fitFontSize(
          doc,
          wcText,
          'Helvetica-Bold',
          innerW - 2 * wcPadH,
          wcH - 2 * wcPadV,
          10,
          32,
        );
        drawCenteredText(
          doc,
          wcText,
          'Helvetica-Bold',
          fs,
          innerX,
          y,
          innerW,
          wcH,
        );
      }
      y += wcH + gap;

      // --- QR image (white panel, centered, ~80% width) ---
      doc.rect(innerX, y, innerW, qrH).fill('#ffffff');
      if (data.qrImage) {
        try {
          const qrBuf = parseDataUrl(data.qrImage);
          const qrMaxW = innerW * 0.8;
          const qrMaxH = qrH * 0.95;
          const qrSize = Math.min(qrMaxW, qrMaxH);
          doc.image(
            qrBuf,
            innerX + (innerW - qrSize) / 2,
            y + (qrH - qrSize) / 2,
            { width: qrSize, height: qrSize },
          );
        } catch (err) {
          // Swallow image errors — the rest of the page still renders usefully.
        }
      }
      y += qrH + gap;

      // --- Client name (white panel, auto-fit uppercase bold) ---
      doc.rect(innerX, y, innerW, clientH).fill('#ffffff');
      const clText = (data.clientName || '').toUpperCase();
      if (clText) {
        const clPadV = clientH * 0.1;
        const clPadH = innerW * 0.03;
        const fs = fitFontSize(
          doc,
          clText,
          'Helvetica-Bold',
          innerW - 2 * clPadH,
          clientH - 2 * clPadV,
          6,
          20,
        );
        drawCenteredText(
          doc,
          clText,
          'Helvetica-Bold',
          fs,
          innerX,
          y,
          innerW,
          clientH,
        );
      }
      y += clientH + gap;

      // --- Footer: employer info (left, italic white) + ControlJobs brand (right) ---
      const footerY = y;
      const footerBottom = footerY + footerH;
      const emp = data.employer;

      // Bottom-left slot: employer LOGO when uploaded (35% of A5 page width,
      // bottom-aligned, vertically aligned with the ControlJobs brand block on
      // the right). Falls back to the italic employer text block when no logo
      // is set; renders nothing if neither is present.
      const logoSlotW = pageW * 0.35;
      const logoSlotX = innerX + innerW * 0.005;
      if (data.logoBuffer) {
        try {
          // pdfkit's `align` only supports center/right; left is the default
          // (the image is drawn at the given x,y), so we pin x at logoSlotX.
          doc.image(data.logoBuffer, logoSlotX, footerY, {
            fit: [logoSlotW, footerH],
            valign: 'bottom',
          });
        } catch (err) {
          // Decode failure shouldn't break the rest of the PDF.
        }
      } else if (emp) {
        const empFs = 10;
        const empLineH = empFs * 1.3;
        const empLines: Array<{ text: string; font: string }> = [
          { text: emp.name || '', font: 'Helvetica-BoldOblique' },
          { text: emp.address || '', font: 'Helvetica-Oblique' },
          {
            text: [emp.postalCode, emp.city].filter(Boolean).join(' '),
            font: 'Helvetica-Oblique',
          },
          { text: emp.province || '', font: 'Helvetica-Oblique' },
        ].filter((l) => l.text);

        const empMaxW = innerW * 0.4;
        const totalH = empLines.length * empLineH;
        const startY = footerBottom - totalH;
        doc.fillColor('#ffffff');
        empLines.forEach((line, i) => {
          doc.font(line.font).fontSize(empFs);
          doc.text(line.text, logoSlotX, startY + i * empLineH, {
            width: empMaxW,
            lineBreak: false,
            ellipsis: true,
          });
        });
      }

      // ControlJobs brand block (right side, bottom-aligned). Width is pinned
      // to 35% of the A5 page width per spec; height follows the original SVG
      // aspect ratio (290.1 × 55.3) so the wordmark never distorts. The result
      // is then clamped to the footer height so it can never overflow into
      // the QR panel above on tighter layouts.
      const SVG_ASPECT = 290.1 / 55.3;
      let cjLogoW = pageW * 0.35;
      let cjLogoH = cjLogoW / SVG_ASPECT;
      if (cjLogoH > footerH) {
        cjLogoH = footerH;
        cjLogoW = cjLogoH * SVG_ASPECT;
      }
      const brandRight = innerX + innerW - innerW * 0.005;
      const cjLogoX = brandRight - cjLogoW;
      const cjLogoY = footerBottom - cjLogoH;

      // "Powered by" text above logo (italic black). pwGap is the breathing
      // room between the bottom of the text and the top of the logo — kept
      // generous so the line doesn't visually merge with the wordmark.
      const pwFs = 14;
      const pwGap = 22;
      doc.font('Helvetica-Oblique').fontSize(pwFs).fillColor('#000000');
      const pwW = doc.widthOfString('Powered by');
      const pwH = doc.currentLineHeight();
      doc.text('Powered by', brandRight - pwW, cjLogoY - pwGap - pwH, {
        lineBreak: false,
      });

      // Render the inline SVG logo via svg-to-pdfkit.
      try {
        SVGtoPDF(doc, CONTROLJOBS_LOGO_SVG, cjLogoX, cjLogoY, {
          width: cjLogoW,
          height: cjLogoH,
          preserveAspectRatio: 'xMaxYMax meet',
        });
      } catch (err) {
        // SVG render failure shouldn't block the whole PDF.
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
