import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { useT } from '../i18n';

/** The QR modules as one SVG path, a unit square per dark module. */
function qrPath(text: string): { size: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
  }
  return { size, d };
}

/**
 * A QR code of the public menu's address, so a guest can pass the menu on or staff can print it.
 * Always dark on light, in both themes, so every camera reads it.
 */
export function MenuQR() {
  const t = useT();
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/`;
  const qr = useMemo(() => (url ? qrPath(url) : null), [url]);
  if (!qr) return null;
  const quiet = 2;
  const box = qr.size + quiet * 2;
  const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <figure className="menu-qr">
      <a href={url} className="menu-qr-code" aria-label={t('Menu QR code for {url}', { url: host })}>
        <svg viewBox={`${-quiet} ${-quiet} ${box} ${box}`} role="img" aria-hidden="true" shapeRendering="crispEdges">
          <rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
          <path d={qr.d} fill="#1b1611" />
        </svg>
      </a>
      <figcaption>
        <strong>{t('Scan to open the menu')}</strong>
        <bdi dir="ltr">{host}</bdi>
      </figcaption>
    </figure>
  );
}
