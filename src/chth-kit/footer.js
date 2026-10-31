// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The shared "Part of CHTH" footer: the data every site renders, and a plain-HTML version for
// the server-rendered sites. React sites map footerModel() to their own markup and reuse the
// .chth-footer styles from brand.css, so every footer looks the same. The footer doesn't list the
// other CHTH sites and bots; it points to chth.wtf, which does.

import { LOCALES, translator } from './locales.js';

/** Where "more about CHTH" goes. */
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
  moreInfo: {
    en: 'More about CHTH',
    fa: 'دربارهٔ CHTH بیشتر بدانید',
    ar: 'المزيد عن CHTH',
    ru: 'Подробнее о CHTH',
    es: 'Más sobre CHTH',
  },
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
 * @param {string} self   this product's id, sent to chth.wtf as the link ref
 * @param {{ sourceUrl?: string }} [opts]
 */
export function footerModel(locale, self, opts = {}) {
  const t = translator(FOOTER_STRINGS, locale);
  return {
    partOf: t('partOf'),
    openSource: t('openSource'),
    moreInfoLabel: t('moreInfo'),
    infoUrl: `${CHTH_INFO_URL}/?ref=${encodeURIComponent(self)}`,
    logoSvg: FOOTER_LOGO_SVG,
    languageLabel: t('language'),
    sourceLabel: t('source'),
    sourceUrl: opts.sourceUrl ?? null,
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
  const langs = m.locales.map((l) =>
    `<a href="${esc(langHref(l.code))}" hreflang="${l.code}" lang="${l.code}"${l.current ? ' aria-current="true"' : ''}>${esc(l.label)}</a>`).join('');
  return `<footer class="chth-footer" data-chth-footer>
  <div class="chth-footer__inner">
    <a class="chth-footer__brand" href="${esc(m.infoUrl)}">
      <span class="chth-footer__mark" aria-hidden="true">${m.logoSvg}</span>
      <span><strong>${esc(m.partOf)}</strong><br><small>${esc(m.openSource)}</small></span>
    </a>
    <div class="chth-footer__col">
      <p class="chth-footer__more"><a href="${esc(m.infoUrl)}">${esc(m.moreInfoLabel)} · chth.wtf ↗</a></p>
      ${m.sourceUrl ? `<p><a href="${esc(m.sourceUrl)}">${esc(m.sourceLabel)} ↗</a></p>` : ''}
    </div>
    <div class="chth-footer__col">
      <h2>${esc(m.languageLabel)}</h2>
      <div class="chth-footer__langs">${langs}</div>
    </div>
  </div>
</footer>`;
}
