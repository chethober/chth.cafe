import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { Download, Printer } from 'lucide-react';
import { Button, Card } from '../ui';
import { getLocale, tr } from '../i18n';
import { dirOf } from '../chth-kit/locales.js';
import { publicMenuUrl } from '../utils/workspace';

/**
 * The QR code as standalone SVG markup: dark modules on white with the standard quiet zone, so it
 * scans on screen, on paper and in any theme.
 */
export function menuQrSvg(text: string, label = ''): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const quiet = 4;
  const box = size + quiet * 2;
  let d = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) if (qr.isDark(row, col)) d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
  }
  const escape = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" shape-rendering="crispEdges" role="img" aria-label="${escape(label)}">`
    + `<rect width="${box}" height="${box}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Prints a single card (café name, QR, how to use it) from a hidden frame, leaving the admin page as it is. */
function printCard(cafeName: string, url: string, svg: string) {
  const locale = getLocale();
  const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const html = `<!doctype html><html lang="${locale}" dir="${dirOf(locale)}"><head><meta charset="utf-8"><title>${escapeHtml(cafeName)}</title>
<style>
  @page { size: A5 portrait; margin: 12mm; }
  html, body { margin: 0; background: #fff; color: #111; }
  body { font-family: 'Vazirmatn', system-ui, -apple-system, 'Segoe UI', sans-serif; display: grid; place-items: center; min-height: 100vh; text-align: center; }
  main { display: grid; justify-items: center; gap: 6mm; }
  h1 { margin: 0; font-size: 26pt; font-weight: 700; }
  .qr { width: 80mm; height: 80mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  p { margin: 0; font-size: 15pt; }
  .url { font-size: 11pt; color: #555; direction: ltr; unicode-bidi: isolate; }
</style></head><body><main>
  <h1>${escapeHtml(cafeName)}</h1>
  <div class="qr">${svg}</div>
  <p>${escapeHtml(tr('Scan to see our menu and order'))}</p>
  <span class="url">${escapeHtml(host)}</span>
</main></body></html>`;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;inset-inline-start:-9999px';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  const win = frame.contentWindow!;
  const done = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', done);
  // Let the frame lay out (and load its font, if it is cached) before printing.
  setTimeout(() => { win.focus(); win.print(); }, 250);
  setTimeout(() => frame.remove(), 60_000);
}

/** Settings card: the public menu's QR code, to print for tables and the counter or download as SVG. */
export function MenuQRCard({ cafeName }: { cafeName: string }) {
  const url = publicMenuUrl();
  const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const label = tr('Menu QR code for {url}', { url: host });
  const svg = useMemo(() => menuQrSvg(url, label), [url, label]);
  const download = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    link.download = `${(cafeName || 'menu').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'menu'}-menu-qr.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  return (
    <Card title={tr('Menu QR code')} description={tr('Print it for tables and the counter. Guests scan it to open the menu and order.')}>
      <div className="menu-qr">
        <div className="menu-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="menu-qr-side">
          <a className="mono" href={url} target="_blank" rel="noreferrer"><bdi dir="ltr">{host}</bdi></a>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" icon={<Printer />} onClick={() => printCard(cafeName, url, svg)}>{tr('Print')}</Button>
            <Button icon={<Download />} onClick={download}>{tr('Download SVG')}</Button>
          </div>
          <p className="ws-hint">{tr('The card prints on A5 with the café name. The SVG stays sharp at any size, for your own designs.')}</p>
        </div>
      </div>
    </Card>
  );
}
