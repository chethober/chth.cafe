// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The shared CHTH footer: a small call to CHTH (the mark, "Part of CHTH", a button to chth.wtf),
// then one row of links: the site's source code and documentation, its API docs where it has
// them, and the privacy policy and terms. footerHtml() is for the server-rendered sites; React
// sites map footerModel() to the same markup and reuse the .chth-footer styles from brand.css.

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

/**
 * Each site's footer links. Privacy and terms default to the CHTH-wide pages on chth.wtf; a site
 * with its own (the shop's marketplace terms) says so here. Leave a link out to hide it.
 */
export const SITE_LINKS = {
  gym: { source: 'https://github.com/chethober/chth.gym', docs: 'https://github.com/chethober/chth.gym#readme' },
  cafe: { source: 'https://github.com/chethober/chth.cafe', docs: 'https://github.com/chethober/chth.cafe#readme' },
  shop: {
    source: 'https://github.com/chethober/chth.shop', docs: 'https://github.com/chethober/chth.shop#readme',
    api: 'https://chth.shop/api-docs', terms: 'https://chth.shop/terms',
  },
  wtf: { source: 'https://github.com/chethober' },
};
export const PRIVACY_URL = `${CHTH_INFO_URL}/privacy/`;
export const TERMS_URL = `${CHTH_INFO_URL}/terms/`;

export const FOOTER_STRINGS = {
  partOf: { en: 'Part of CHTH', fa: 'بخشی از CHTH', ar: 'جزء من CHTH', ru: 'Часть CHTH', es: 'Parte de CHTH' },
  pitch: {
    en: 'Small, free and open-source tools. Read the code, run your own, or help build the next one.',
    fa: 'ابزارهای کوچک، رایگان و متن‌باز. کد را بخوان، نسخهٔ خودت را اجرا کن یا در ساختن بعدی کمک کن.',
    ar: 'أدوات صغيرة ومجانية ومفتوحة المصدر. اقرأ الكود، شغّل نسختك، أو ساعد في بناء الأداة التالية.',
    ru: 'Небольшие бесплатные инструменты с открытым кодом. Читайте код, запускайте у себя или помогите сделать следующий.',
    es: 'Herramientas pequeñas, gratuitas y de código abierto. Lee el código, monta el tuyo o ayuda a crear el siguiente.',
  },
  explore: { en: 'Explore CHTH', fa: 'CHTH را ببین', ar: 'استكشف CHTH', ru: 'Всё о CHTH', es: 'Descubre CHTH' },
  source: { en: 'Source code', fa: 'کد منبع', ar: 'الكود المصدري', ru: 'Исходный код', es: 'Código fuente' },
  docs: { en: 'Docs', fa: 'مستندات', ar: 'التوثيق', ru: 'Документация', es: 'Documentación' },
  api: { en: 'API docs', fa: 'مستندات API', ar: 'توثيق API', ru: 'API', es: 'Docs de la API' },
  privacy: { en: 'Privacy', fa: 'حریم خصوصی', ar: 'الخصوصية', ru: 'Конфиденциальность', es: 'Privacidad' },
  terms: { en: 'Terms', fa: 'شرایط استفاده', ar: 'الشروط', ru: 'Условия', es: 'Términos' },
};

/**
 * Everything a footer shows, already translated.
 * @param {string} locale
 * @param {string} self   this product's id, sent to chth.wtf as the link ref
 * @param {{ links?: Partial<Record<'source'|'docs'|'api'|'privacy'|'terms', string | null>>, legal?: boolean }} [opts]
 *   `links` overrides SITE_LINKS (null hides one); `legal: false` leaves out privacy and terms
 *   (a café's own menu, whose policies are the café's).
 */
export function footerModel(locale, self, opts = {}) {
  const t = translator(FOOTER_STRINGS, locale);
  const urls = { privacy: PRIVACY_URL, terms: TERMS_URL, ...SITE_LINKS[self], ...opts.links };
  if (opts.legal === false) { urls.privacy = null; urls.terms = null; }
  const order = ['source', 'docs', 'api', 'privacy', 'terms'];
  return {
    partOf: t('partOf'),
    pitch: t('pitch'),
    explore: t('explore'),
    infoUrl: `${CHTH_INFO_URL}/?ref=${encodeURIComponent(self)}`,
    logoSvg: FOOTER_LOGO_SVG,
    links: order.filter((k) => urls[k]).map((k) => ({ id: k, label: t(k), href: urls[k], external: /^https?:/.test(urls[k]) })),
    year: new Date().getFullYear(),
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The footer as HTML. */
export function footerHtml(locale, self, opts = {}) {
  const m = footerModel(locale, self, opts);
  const links = m.links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  return `<footer class="chth-footer" data-chth-footer>
  <div class="chth-footer__cta">
    <span class="chth-footer__mark" aria-hidden="true">${m.logoSvg}</span>
    <p class="chth-footer__pitch"><strong>${esc(m.partOf)}</strong><span>${esc(m.pitch)}</span></p>
    <a class="chth-footer__btn" href="${esc(m.infoUrl)}">${esc(m.explore)} <span aria-hidden="true">→</span></a>
  </div>
  <nav class="chth-footer__links" aria-label="${esc(m.partOf)}">${links}<span class="chth-footer__year">© ${m.year} CHTH</span></nav>
</footer>`;
}
