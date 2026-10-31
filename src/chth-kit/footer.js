// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The shared CHTH footer: the minimal CHTH logo and "Part of CHTH", linking to chth.wtf, which
// lists the other CHTH sites and bots. footerHtml() is for the server-rendered sites; React
// sites map footerModel() to the same markup and reuse the .chth-footer styles from brand.css.
// Language choice lives in the navbar (language-menu.js), not here.

import { translator } from './locales.js';

/** Where "Part of CHTH" goes. */
export const CHTH_INFO_URL = 'https://chth.wtf';

/** The minimal CHTH logo (from chth.shop/chth-logo-minimal.svg), drawn in currentColor. */
export const FOOTER_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="870 425 840 380" role="img" aria-label="CHTH">'
  + '<g fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M 893 612 C 893 720, 980 780, 1075 780 C 1170 780, 1230 710, 1290 615 C 1350 520, 1410 447, 1520 447 C 1620 447, 1690 520, 1690 635"/>'
  + '<path d="M 1037 452 C 1140 452, 1220 520, 1290 615 C 1350 700, 1420 780, 1525 780"/></g>'
  + '<g fill="currentColor"><circle cx="988" cy="464" r="22"/><circle cx="937" cy="503" r="20"/><circle cx="904" cy="558" r="19"/>'
  + '<circle cx="1668" cy="684" r="20"/><circle cx="1633" cy="731" r="19"/><circle cx="1593" cy="768" r="18"/></g></svg>';

export const FOOTER_STRINGS = {
  partOf: { en: 'Part of CHTH', fa: 'بخشی از CHTH', ar: 'جزء من CHTH', ru: 'Часть CHTH', es: 'Parte de CHTH' },
};

/**
 * Everything a footer shows, already translated.
 * @param {string} locale
 * @param {string} self   this product's id, sent to chth.wtf as the link ref
 */
export function footerModel(locale, self) {
  const t = translator(FOOTER_STRINGS, locale);
  return {
    partOf: t('partOf'),
    infoUrl: `${CHTH_INFO_URL}/?ref=${encodeURIComponent(self)}`,
    logoSvg: FOOTER_LOGO_SVG,
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The footer as HTML. */
export function footerHtml(locale, self) {
  const m = footerModel(locale, self);
  return `<footer class="chth-footer" data-chth-footer>
  <a class="chth-footer__brand" href="${esc(m.infoUrl)}">
    <span class="chth-footer__mark" aria-hidden="true">${m.logoSvg}</span>
    <span>${esc(m.partOf)}</span>
  </a>
</footer>`;
}
