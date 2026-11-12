// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The language picker every CHTH site puts in its navbar: a globe with the current language's
// code on a small badge, which opens the five languages, each with its flag (when the site
// serves kit/flags and passes `flagBase`), its own name and its code, the current one checked. It's a <details> element, so it opens without JavaScript
// (the café control plane allows no scripts). Server-rendered sites use languageMenuHtml();
// React sites map languageMenuModel() to their own control and reuse its SVG strings.

import { LOCALES, translator } from './locales.js';
import { flagSrc } from './flags.js';

/** Lucide's "globe" icon, in currentColor. */
export const GLOBE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';

/** Lucide's "check", marking the current language in the list. */
export const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

export const LANGUAGE_STRINGS = {
  language: { en: 'Language', fa: 'زبان', ar: 'اللغة', ru: 'Язык', es: 'Idioma' },
};

/**
 * The menu's label, the current language's badge, and the languages, the current one marked.
 * `short` is the code as shown (FA). `flagSrc` is the flag's image under `opts.flagBase` (where the
 * site serves kit/flags), '' without one; it is decorative, the name is always beside it.
 */
export function languageMenuModel(locale, opts = {}) {
  const t = translator(LANGUAGE_STRINGS, locale);
  const locales = LOCALES.map((l) => ({
    code: l.code, label: l.native, short: l.code.toUpperCase(), dir: l.dir, flagSrc: flagSrc(l.code, opts.flagBase), current: l.code === locale,
  }));
  const current = locales.find((l) => l.current) ?? null;
  return { label: t('language'), globeSvg: GLOBE_SVG, checkSvg: CHECK_SVG, current, badge: current?.short ?? '', locales };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The menu as HTML. Each language links to `langHref(code)`; by default `?lang=<code>`, which each
 * server-rendered site turns into the chth_lang cookie. `className` is added to the <details>;
 * `flagBase` is where the site serves kit/flags (e.g. '/chth-flags'): without it, no flags.
 */
export function languageMenuHtml(locale, opts = {}) {
  const m = languageMenuModel(locale, { flagBase: opts.flagBase });
  const langHref = opts.langHref ?? ((code) => `?lang=${code}`);
  const flags = Boolean(opts.flagBase);
  // A lazy <img> inside the closed <details> isn't fetched until the menu opens; a language
  // with no flag file keeps the column with an empty box
  const flag = (l) => (l.flagSrc
    ? `<img class="chth-flag" src="${esc(l.flagSrc)}" alt="" width="20" height="15" loading="lazy" decoding="async">`
    : '<span class="chth-flag chth-flag--none" aria-hidden="true"></span>');
  const items = m.locales.map((l) =>
    `<a href="${esc(langHref(l.code))}" hreflang="${l.code}" lang="${l.code}"${l.current ? ' aria-current="true"' : ''}>`
    + `<span class="chth-lang-menu__check">${l.current ? m.checkSvg : ''}</span>`
    + (flags ? flag(l) : '')
    + `<span class="chth-lang-menu__name">${esc(l.label)}</span>`
    + `<span class="chth-lang-menu__code" aria-hidden="true">${l.short}</span></a>`).join('');
  return `<details class="chth-lang-menu${opts.className ? ` ${esc(opts.className)}` : ''}">`
    + `<summary aria-label="${esc(m.label)}: ${esc(m.current?.label)}" title="${esc(m.label)}">${m.globeSvg}`
    + (m.badge ? `<span class="chth-lang-menu__badge" aria-hidden="true">${m.badge}</span>` : '')
    + `</summary><nav class="chth-lang-menu__list" aria-label="${esc(m.label)}">${items}</nav></details>`;
}
