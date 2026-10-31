// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The language picker every CHTH site puts in its navbar: a globe icon that opens a list of the
// five languages. It's a <details> element, so it opens without JavaScript (the café control
// plane allows no scripts). Server-rendered sites use languageMenuHtml(); React sites map
// languageMenuModel() to their own control and can reuse GLOBE_SVG.

import { LOCALES, translator } from './locales.js';

/** Lucide's "globe" icon, in currentColor. */
export const GLOBE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';

export const LANGUAGE_STRINGS = {
  language: { en: 'Language', fa: 'زبان', ar: 'اللغة', ru: 'Язык', es: 'Idioma' },
};

/** The menu's label and the languages, the current one marked. */
export function languageMenuModel(locale) {
  const t = translator(LANGUAGE_STRINGS, locale);
  return {
    label: t('language'),
    globeSvg: GLOBE_SVG,
    locales: LOCALES.map((l) => ({ code: l.code, label: l.native, current: l.code === locale })),
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The menu as HTML. Each language links to `langHref(code)`; by default `?lang=<code>`, which each
 * server-rendered site turns into the chth_lang cookie. `className` is added to the <details>.
 */
export function languageMenuHtml(locale, opts = {}) {
  const m = languageMenuModel(locale);
  const langHref = opts.langHref ?? ((code) => `?lang=${code}`);
  const current = m.locales.find((l) => l.current);
  const items = m.locales.map((l) =>
    `<a href="${esc(langHref(l.code))}" hreflang="${l.code}" lang="${l.code}"${l.current ? ' aria-current="true"' : ''}>${esc(l.label)}</a>`).join('');
  return `<details class="chth-lang-menu${opts.className ? ` ${esc(opts.className)}` : ''}">`
    + `<summary aria-label="${esc(m.label)}: ${esc(current?.label)}" title="${esc(m.label)}">${m.globeSvg}</summary>`
    + `<nav class="chth-lang-menu__list" aria-label="${esc(m.label)}">${items}</nav></details>`;
}
