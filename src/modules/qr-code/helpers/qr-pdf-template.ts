/**
 * HTML template for QR-code A5 portrait PDFs rendered by Puppeteer.
 *
 * The markup, CSS, and the font-fitter JavaScript are a direct port of the
 * client-side print template in
 * `control-jobs-frontend/components/work-center-tabs/methods/dialogs/qr-code-dialog.tsx`.
 * Keep them in sync — if you tweak layout in one place (padding, box sizes,
 * fitter min/max pts), mirror the change in the other.
 *
 * Puppeteer calls `page.evaluate(() => window.__qrPdfReady)` to know the
 * fitter has finished and all images are loaded before producing the PDF.
 */

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
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ControlJobs logo inlined as a base64 SVG data-URL so the template has no
// external dependencies at render time — Puppeteer never has to hit the
// network for this asset.
const CONTROLJOBS_LOGO_DATA_URL =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAyMi4xLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCINCgkgdmlld0JveD0iMCAwIDI5MC4xIDU1LjMiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI5MC4xIDU1LjM7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiMzMzMzMzM7fQ0KCS5zdDF7ZmlsbDojNjYyRDkxO30NCgkuc3Qye2ZpbGw6IzMzMzMzMztzdHJva2U6IzMzMzMzMztzdHJva2Utd2lkdGg6MS41O3N0cm9rZS1taXRlcmxpbWl0OjEwO30NCjwvc3R5bGU+DQo8Zz4NCgk8Zz4NCgkJPGc+DQoJCQk8Zz4NCgkJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMzUuNCwzMy4xYzEuNCwwLDEuOSwxLjEsMSwyLjNjLTMuNyw1LjItOS41LDguNS0xNS45LDguNUM5LjIsNDMuOSwwLDM0LDAsMjEuN0MwLDEwLDkuMiwwLDIwLjQsMA0KCQkJCQljNi40LDAsMTIsMy4yLDE1LjgsOC4yYzAuOSwxLjMsMC4zLDIuMy0xLjEsMi4zaC0xYy0wLjksMC0xLjUtMC4zLTIuMi0xYy0yLjktMy4yLTctNS4yLTExLjQtNS4yYy05LDAtMTYuMyw3LjktMTYuMywxNy4zDQoJCQkJCWMwLDkuOSw3LjIsMTcuOCwxNi4zLDE3LjhjNC41LDAsOC43LTIsMTEuNi01LjNjMC43LTAuOCwxLjMtMS4xLDIuMi0xLjFIMzUuNHoiLz4NCgkJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDIuNCwzMC4yYzAtNy41LDYuMi0xMy43LDEzLjctMTMuN2M3LjUsMCwxMy43LDYuMiwxMy43LDEzLjdjMCw3LjQtNi4yLDEzLjgtMTMuNywxMy44DQoJCQkJCUM0OC42LDQ0LDQyLjQsMzcuNiw0Mi40LDMwLjJ6IE00Ni42LDMwLjJjMCw1LjIsNC4xLDkuOCw5LjUsOS44czkuNS00LjYsOS41LTkuOGMwLTUuMy00LjEtOS43LTkuNS05LjdTNDYuNiwyNC44LDQ2LjYsMzAuMnoiDQoJCQkJCS8+DQoJCQkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTc4LDQzLjNjLTEuMywwLTEuOS0wLjctMS45LTEuOVYxOC44YzAtMS4zLDAuNy0xLjksMS45LTEuOWgwLjJjMS4zLDAsMS45LDAuNywxLjksMS45djEuMw0KCQkJCQljMi4xLTIuMyw1LTMuNiw4LjYtMy42YzcuNiwwLDEwLjgsMy40LDEwLjgsMTEuOHYxMy4xYzAsMS4zLTAuNywxLjktMS45LDEuOWgtMC4yYy0xLjMsMC0xLjktMC43LTEuOS0xLjlWMjguMw0KCQkJCQljMC01LjItMi40LTcuOC02LjgtNy44Yy01LjMtMC4xLTguNiwyLjktOC42LDguOHYxMi4xYzAsMS4zLTAuNywxLjktMS45LDEuOUg3OHoiLz4NCgkJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTE3LDIwLjZoLTR2MjAuOGMwLDEuMy0wLjcsMS45LTEuOSwxLjloLTAuMmMtMS4zLDAtMS45LTAuNy0xLjktMS45VjIwLjZoLTJjLTEuMywwLTEuOS0wLjctMS45LTEuOQ0KCQkJCQljMC0xLjEsMC43LTEuNywxLjktMS43aDJWOC41YzAtMS4zLDAuNy0xLjksMS45LTEuOWgwLjJjMS4zLDAsMS45LDAuNywxLjksMS45djguNWg0YzEuMywwLDEuOSwwLjYsMS45LDEuOA0KCQkJCQlTMTE4LjIsMjAuNiwxMTcsMjAuNnoiLz4NCgkJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTI4LjMsMjAuNWMxLjctMiw0LjEtMy40LDctMy44YzEuMy0wLjIsMiwwLjUsMiwxLjh2MC4xYzAsMS4zLTAuNywxLjgtMS45LDJjLTMuOSwwLjYtNy4xLDMuNC03LjEsOC4xDQoJCQkJCXYxMi43YzAsMS4zLTAuNywxLjktMS45LDEuOWgtMC4yYy0xLjMsMC0xLjktMC43LTEuOS0xLjlWMTguOGMwLTEuMywwLjctMS45LDEuOS0xLjloMC4yYzEuMywwLDEuOSwwLjcsMS45LDEuOVYyMC41eiIvPg0KCQkJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xNzUuOCw0My4zYy0xLjMsMC0xLjktMC43LTEuOS0xLjl2LTM5YzAtMS4zLDAuNy0xLjksMS45LTEuOWgwLjJjMS4zLDAsMS45LDAuNywxLjksMS45djM5DQoJCQkJCWMwLDEuMy0wLjcsMS45LTEuOSwxLjlIMTc1Ljh6Ii8+DQoJCQk8L2c+DQoJCTwvZz4NCgkJPGc+DQoJCQk8cGF0aCBjbGFzcz0ic3QxIiBkPSJNMTgwLjcsNTIuOGMwLTEuMiwwLjctMS44LDEuOS0yYzYuNC0wLjcsMTAuMS01LDEwLjEtMTEuOVYyLjRjMC0xLjMsMC43LTEuOSwxLjktMS45aDAuNQ0KCQkJCWMxLjMsMCwxLjksMC43LDEuOSwxLjl2MzYuNWMwLDkuNy01LjMsMTUuNi0xNC40LDE2LjRjLTEuMywwLjEtMi0wLjctMi0xLjlWNTIuOHoiLz4NCgkJCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0yMDQsMzAuMmMwLTcuNSw2LjItMTMuNywxMy43LTEzLjdjNy41LDAsMTMuNyw2LjIsMTMuNywxMy43YzAsNy40LTYuMiwxMy44LTEzLjcsMTMuOA0KCQkJCUMyMTAuMSw0NCwyMDQsMzcuNiwyMDQsMzAuMnogTTIwOC4yLDMwLjJjMCw1LjIsNC4xLDkuOCw5LjUsOS44czkuNS00LjYsOS41LTkuOGMwLTUuMy00LjEtOS43LTkuNS05LjdTMjA4LjIsMjQuOCwyMDguMiwzMC4yeiINCgkJCQkvPg0KCQkJPHBhdGggY2xhc3M9InN0MSIgZD0iTTIzOS41LDQzLjNjLTEuMywwLTEuOS0wLjctMS45LTEuOXYtMzljMC0xLjMsMC43LTEuOSwxLjktMS45aDAuMmMxLjMsMCwxLjksMC43LDEuOSwxLjl2MTguOA0KCQkJCWMyLjQtMi45LDUuOS00LjcsMTAtNC43YzcuNSwwLDEzLjcsNi4yLDEzLjcsMTMuN2MwLDcuNC02LjIsMTMuOC0xMy43LDEzLjhjLTQsMC03LjYtMS45LTEwLTQuOXYyLjNjMCwxLjMtMC43LDEuOS0xLjksMS45DQoJCQkJSDIzOS41eiBNMjYxLjEsMzAuMmMwLTUuMy00LTkuNy05LjQtOS43Yy01LjIsMC05LjgsNC40LTkuOCw5LjdjMCw1LjIsNC42LDkuOCw5LjgsOS44QzI1Ny4xLDQwLDI2MS4xLDM1LjQsMjYxLjEsMzAuMnoiLz4NCgkJCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0yODQuNywyMmMtMC45LTEuMS0yLjYtMS43LTQuOC0xLjdjLTMuMiwwLTUuNCwxLjUtNS40LDMuNWMwLDIsMS43LDMuMSw2LjEsNGM2LjgsMS40LDkuNSwzLjcsOS41LDguMQ0KCQkJCWMwLDQuNi0zLjUsNy45LTEwLjEsNy45Yy01LDAtOC42LTIuMy05LjgtNS45Yy0wLjQtMS4zLDAuNC0yLDEuNy0yYzEuMSwwLDEuNiwwLjUsMi4yLDEuNGMxLDEuNiwzLjIsMi43LDUuOSwyLjcNCgkJCQljMy45LDAsNi41LTEuNyw2LjUtNC4xYzAtMi41LTEuNy0zLjQtNi41LTQuM2MtNi4zLTEuMy05LjEtMy41LTkuMS03LjdjMC00LDMuMS03LjMsOS4xLTcuM2M0LjMsMCw3LjMsMS45LDguNiw0LjgNCgkJCQljMC41LDEuMy0wLjIsMi4xLTEuNiwyLjFDMjg1LjksMjMuNCwyODUuNCwyMi45LDI4NC43LDIyeiIvPg0KCQk8L2c+DQoJPC9nPg0KCTxnPg0KCQk8cGF0aCBjbGFzcz0ic3QyIiBkPSJNMTY0LjMsMjIuNGMtMi4xLTIuNy01LjEtNC41LTguNC01Yy0zLjMtMC40LTYuNiwwLjQtOS4zLDIuNWwtMS0xYy0wLjMtMC4zLTAuNS0wLjItMC42LDAuMmwtMC4zLDMuNQ0KCQkJYzAsMC40LDAuMywwLjcsMC42LDAuN2wzLjUtMC4zYzAuNCwwLDAuNS0wLjMsMC4yLTAuNmwtMS0xYzIuMi0xLjYsNC45LTIuMyw3LjYtMS45YzIuOCwwLjQsNS4zLDEuOSw3LjEsNC4yDQoJCQljMS43LDIuMywyLjUsNS4yLDIuMSw4Yy0wLjMsMi0xLjEsMy45LTIuMyw1LjVjLTAuNSwwLjYtMS4xLDEuMi0xLjgsMS43Yy0yLjMsMS44LTUuMSwyLjUtNy45LDIuMmMtMi44LTAuNC01LjMtMS45LTcuMS00LjINCgkJCWMtMS43LTIuMi0yLjUtNS0yLjEtNy44YzAuMS0wLjYtMC4zLTEuMS0wLjktMS4yYy0wLjYtMC4xLTEuMSwwLjMtMS4xLDAuOWMtMC40LDMuNCwwLjUsNi43LDIuNiw5LjRjMi4xLDIuNyw1LjEsNC41LDguNCw1DQoJCQljMy40LDAuNCw2LjctMC41LDkuNC0yLjZjMC44LTAuNiwxLjUtMS4zLDIuMS0yLjFjMS41LTEuOSwyLjUtNC4xLDIuOC02LjVDMTY3LjMsMjguNiwxNjYuNCwyNS4yLDE2NC4zLDIyLjR6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xNTMuNywyMS45Yy0wLjUsMC0wLjgsMC40LTAuOCwwLjh2OC40bDcuNSw0YzAuMSwwLjEsMC4zLDAuMSwwLjQsMC4xYzAuMywwLDAuNi0wLjIsMC43LTAuNQ0KCQkJYzAuMi0wLjQsMC4xLTAuOS0wLjQtMS4xbC02LjctMy41di03LjRDMTU0LjUsMjIuMywxNTQuMiwyMS45LDE1My43LDIxLjl6Ii8+DQoJPC9nPg0KPC9nPg0KPC9zdmc+DQo=';

export function buildQrPdfHtml(data: QrPdfTemplateData): string {
  const wcName = (data.workCenterName || '').toUpperCase();
  const cName = (data.clientName || '').toUpperCase();
  const employer = data.employer;
  const empPcCity = [employer?.postalCode, employer?.city]
    .filter(Boolean)
    .join(' ');

  const empLogoHtml = employer?.logoUrl
    ? `<img id="emp-logo" class="emp-logo" src="${escapeHtml(employer.logoUrl)}" alt="" />`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>QR</title>
<style>
  @page {
    size: A5 portrait;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    margin: 0; padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
  html, body {
    margin: 0; padding: 0;
    width: 148mm; height: 210mm;
    font-family: Arial, Helvetica, sans-serif;
    background: #737373;
    overflow: hidden;
  }
  .page {
    width: 100%; height: 100%;
    padding: 7.4mm;
    display: flex; flex-direction: column;
    gap: 7.4mm;
    overflow: hidden;
  }
  .wc, .client {
    background: #fff;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .wc { flex: 0 0 12%; padding: 3% 4%; }
  .wc-inner {
    width: 100%;
    height: 100%;
    text-align: center;
    line-height: 1.15;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .wc-inner .line,
  .client .line {
    display: block;
    min-width: 0;
    max-width: 100%;
    font-weight: 700;
    line-height: 1.15;
    color: #000;
  }
  .wc-inner .line,
  .client .line {
    white-space: nowrap;
  }
  .wc-inner .line + .line { margin-top: 0.5%; }
  .qr {
    flex: 1 1 auto;
    background: #fff;
    padding: 2% 1%;
    display: flex; align-items: center; justify-content: center;
    min-height: 0;
    overflow: hidden;
  }
  .qr img { width: 80%; height: auto; max-height: 95%; object-fit: contain; }
  .client { flex: 0 0 6%; padding: 0.5% 3%; }
  .client .line { width: 100%; text-align: center; }
  .footer {
    flex: 0 0 12%;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 0 0.5%;
    color: #fff;
    flex-shrink: 0;
  }
  .emp-section {
    display: flex;
    align-items: flex-end;
    gap: 2%;
    max-width: 40%;
  }
  .emp-logo {
    height: 80%;
    width: auto;
    max-width: 15%;
    object-fit: contain;
    flex-shrink: 0;
    filter: brightness(0) invert(1);
  }
  .emp {
    display: flex; flex-direction: column;
    gap: 3px;
    font-style: italic;
    font-size: 14pt;
    line-height: 1.3;
  }
  .emp span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #fff;
  }
  .emp .n { font-weight: 700; }
  .brand {
    display: flex; flex-direction: column;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 10px;
    height: 100%;
  }
  .brand .pw {
    color: #000;
    font-size: 18pt;
    font-style: italic;
    font-weight: 500;
  }
  .brand img { height: 50%; width: auto; max-width: 100%; }
</style>
</head>
<body>
  <div class="page">
    <div class="wc">
      <div class="wc-inner">
        <span class="line">${escapeHtml(wcName)}</span>
      </div>
    </div>
    <div class="qr"><img id="qr-img" src="${escapeHtml(data.qrImage)}" alt="QR" /></div>
    <div class="client">
      <span class="line">${escapeHtml(cName)}</span>
    </div>
    <div class="footer">
      <div class="emp-section">
        ${empLogoHtml}
        <div class="emp">
          <span class="n">${escapeHtml(employer?.name || '')}</span>
          <span>${escapeHtml(employer?.address || '')}</span>
          <span>${escapeHtml(empPcCity)}</span>
          <span>${escapeHtml(employer?.province || '')}</span>
        </div>
      </div>
      <div class="brand">
        <span class="pw">Powered by</span>
        <img id="cj-logo" src="${CONTROLJOBS_LOGO_DATA_URL}" alt="ControlJobs" />
      </div>
    </div>
  </div>
<script>
(function () {
  function fitLines(container, lines, maxPt, minPt) {
    if (!container || lines.length === 0) return;
    var usableH = container.clientHeight;
    function apply(s) { for (var i = 0; i < lines.length; i++) lines[i].style.fontSize = s + 'pt'; }
    function fits(s) {
      apply(s);
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].scrollWidth > lines[i].clientWidth) return false;
      }
      if (container.scrollHeight > usableH) return false;
      return true;
    }
    var lo = minPt, hi = maxPt, best = minPt;
    for (var iter = 0; iter < 16 && lo <= hi; iter++) {
      var mid = Math.floor((lo + hi) / 2);
      if (fits(mid)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    apply(best);
  }

  function fitAll() {
    var wc = document.querySelector('.wc-inner');
    var wcLines = wc ? Array.prototype.slice.call(wc.querySelectorAll('.line')) : [];
    fitLines(wc, wcLines, 200, 14);

    var cl = document.querySelector('.client');
    var clLines = cl ? Array.prototype.slice.call(cl.querySelectorAll('.line')) : [];
    fitLines(cl, clLines, 80, 6);
  }

  function waitForImg(img) {
    return new Promise(function (res) {
      if (!img || img.complete) return res();
      img.addEventListener('load', function () { res(); }, { once: true });
      img.addEventListener('error', function () { res(); }, { once: true });
    });
  }

  var imgs = [
    document.getElementById('qr-img'),
    document.getElementById('cj-logo'),
    document.getElementById('emp-logo')
  ].filter(Boolean);

  // Signal readiness via a global flag so Puppeteer's waitForFunction can
  // block until images are loaded AND the fitter has chosen its font sizes.
  // Without this, the PDF can snapshot the tiny default-font state.
  Promise.all(imgs.map(waitForImg)).then(function () {
    fitAll();
    window.__qrPdfReady = true;
  });
})();
</script>
</body>
</html>`;
}
