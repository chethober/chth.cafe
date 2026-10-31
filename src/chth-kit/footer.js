// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The shared "Part of CHTH" footer: the data every site renders, and a plain-HTML version for
// the server-rendered sites. React sites map footerModel() to their own markup and reuse the
// .chth-footer styles from brand.css, so every footer looks the same.

import { LOCALES, translator } from './locales.js';
import { otherProducts, productLink, productName, productTagline } from './products.js';

export const FOOTER_STRINGS = {
  partOf: { en: 'Part of CHTH', fa: 'بخشی از CHTH', ar: 'جزء من CHTH', ru: 'Часть CHTH', es: 'Parte de CHTH' },
  sites: { en: 'Websites', fa: 'وب‌سایت‌ها', ar: 'المواقع', ru: 'Сайты', es: 'Sitios web' },
  bots: { en: 'Telegram bots', fa: 'بات‌های تلگرام', ar: 'بوتات تيليجرام', ru: 'Боты в Telegram', es: 'Bots de Telegram' },
  language: { en: 'Language', fa: 'زبان', ar: 'اللغة', ru: 'Язык', es: 'Idioma' },
  source: { en: 'Source code', fa: 'کد منبع', ar: 'الكود المصدري', ru: 'Исходный код', es: 'Código fuente' },
  openSource: {
    en: 'Free and open source',
    fa: 'رایگان و متن‌باز',
    ar: 'مجاني ومفتوح المصدر',
    ru: 'Бесплатно и с открытым кодом',
    es: 'Gratis y de código abierto',
  },
};

/**
 * Everything a footer shows, already translated.
 * @param {string} locale
 * @param {string} self   this product's id, left out of the lists and used as the link ref
 * @param {{ sourceUrl?: string }} [opts]
 */
export function footerModel(locale, self, opts = {}) {
  const t = translator(FOOTER_STRINGS, locale);
  const item = (p) => ({ id: p.id, ico: p.ico, name: productName(p, locale), tagline: productTagline(p, locale), href: productLink(p, self) });
  return {
    partOf: t('partOf'),
    openSource: t('openSource'),
    sitesTitle: t('sites'),
    botsTitle: t('bots'),
    languageLabel: t('language'),
    sourceLabel: t('source'),
    sourceUrl: opts.sourceUrl ?? null,
    sites: otherProducts(self, 'site').map(item),
    bots: otherProducts(self, 'bot').map(item),
    locales: LOCALES.map((l) => ({ code: l.code, label: l.native, current: l.code === locale })),
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The footer as HTML. Language links go to `langHref(code)`; by default `?lang=<code>`, which
 * each server-rendered site turns into the chth_lang cookie.
 */
export function footerHtml(locale, self, opts = {}) {
  const m = footerModel(locale, self, opts);
  const langHref = opts.langHref ?? ((code) => `?lang=${code}`);
  const list = (items) => items.map((p) =>
    `<li><a href="${esc(p.href)}" title="${esc(p.tagline)}"><span aria-hidden="true">${p.ico}</span> ${esc(p.name)}</a></li>`).join('');
  const langs = m.locales.map((l) =>
    `<a href="${esc(langHref(l.code))}" hreflang="${l.code}" lang="${l.code}"${l.current ? ' aria-current="true"' : ''}>${esc(l.label)}</a>`).join('');
  return `<footer class="chth-footer" data-chth-footer>
  <div class="chth-footer__inner">
    <div class="chth-footer__brand">
      <span class="chth-footer__mark" aria-hidden="true">${opts.logoSvg ?? ''}</span>
      <span><strong>${esc(m.partOf)}</strong><br><small>${esc(m.openSource)}</small></span>
    </div>
    <nav class="chth-footer__col" aria-label="${esc(m.sitesTitle)}"><h2>${esc(m.sitesTitle)}</h2><ul>${list(m.sites)}</ul></nav>
    <nav class="chth-footer__col" aria-label="${esc(m.botsTitle)}"><h2>${esc(m.botsTitle)}</h2><ul>${list(m.bots)}</ul></nav>
    <div class="chth-footer__col">
      <h2>${esc(m.languageLabel)}</h2>
      <div class="chth-footer__langs">${langs}</div>
      ${m.sourceUrl ? `<p><a href="${esc(m.sourceUrl)}">${esc(m.sourceLabel)} ↗</a></p>` : ''}
    </div>
  </div>
</footer>`;
}
