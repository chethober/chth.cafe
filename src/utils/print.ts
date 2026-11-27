export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Prints a standalone HTML document from a hidden frame, leaving the page as it is. */
export function printDocument(html: string) {
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
