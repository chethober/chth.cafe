// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The CHTH shell: what every site puts around its own pages, so they feel like one family.
// Server-rendered pages use the *Html() functions and inline SHELL_JS from shell-script.js
// (and THEME_INIT_JS in <head>); React sites map the *Model() functions to their own markup with the same classes,
// import this module once (it loads the browser side) and call toast() / setTheme().
// Styles are in brand.css. Behaviour is in shell-runtime.js, wired by data-chth-* attributes.

import './shell-runtime.js';
import { translator } from './locales.js';
import { PRODUCTS, productLink, productName, productTagline } from './products.js';
import { languageMenuHtml, languageMenuModel } from './language-menu.js';
import { FOOTER_LOGO_SVG, CHTH_INFO_URL } from './footer.js';

/** The localStorage key and cookie a visitor's theme is kept under, the same on every site. */
export const THEME_KEY = 'chth_theme';

/**
 * Runs in <head> before the first paint, so the page never flashes the wrong theme: the saved
 * choice, else <html data-chth-theme-default="dark|light">, else the system's.
 */
export const THEME_INIT_JS = `(function(){try{var r=document.documentElement,k='${THEME_KEY}',t=null;`
  + `try{t=localStorage.getItem(k)}catch(e){}`
  + `if(t!=='dark'&&t!=='light'){var m=document.cookie.match(/(?:^|; )${THEME_KEY}=(dark|light)/);t=m?m[1]:r.getAttribute('data-chth-theme-default')}`
  + `if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';`
  + `r.setAttribute('data-theme',t);r.classList.toggle('dark',t==='dark');r.classList.toggle('light',t==='light');r.style.colorScheme=t}catch(e){}})();`;

/** Lucide's sun and moon, in currentColor. */
export const SUN_SVG = '<svg class="chth-theme__sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
export const MOON_SVG = '<svg class="chth-theme__moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

export const SHELL_STRINGS = {
  theme: { en: 'Dark appearance', fa: 'حالت تیره', ar: 'المظهر الداكن', ru: 'Тёмная тема', es: 'Apariencia oscura' },
  apps: { en: 'CHTH apps', fa: 'برنامه‌های CHTH', ar: 'تطبيقات CHTH', ru: 'Приложения CHTH', es: 'Apps de CHTH' },
  sites: { en: 'Sites', fa: 'سایت‌ها', ar: 'المواقع', ru: 'Сайты', es: 'Sitios' },
  bots: { en: 'Telegram bots', fa: 'ربات‌های تلگرام', ar: 'بوتات تيليجرام', ru: 'Боты в Telegram', es: 'Bots de Telegram' },
  here: { en: 'You’re here', fa: 'همین‌جایی', ar: 'أنت هنا', ru: 'Вы здесь', es: 'Estás aquí' },
  about: { en: 'About CHTH', fa: 'دربارهٔ CHTH', ar: 'عن CHTH', ru: 'О CHTH', es: 'Sobre CHTH' },
  close: { en: 'Close', fa: 'بستن', ar: 'إغلاق', ru: 'Закрыть', es: 'Cerrar' },
  announcement: { en: 'Announcement', fa: 'اطلاعیه', ar: 'إعلان', ru: 'Объявление', es: 'Aviso' },
  cookies: {
    en: 'This site only uses essential cookies: your sign-in, language and theme. No tracking, nothing to accept.',
    fa: 'این سایت فقط کوکی‌های ضروری دارد: ورود، زبان و پوسته. بدون ردیابی، چیزی برای پذیرفتن نیست.',
    ar: 'يستخدم هذا الموقع ملفات تعريف الارتباط الضرورية فقط: تسجيل الدخول واللغة والمظهر. بلا تتبّع، ولا شيء لتقبله.',
    ru: 'Сайт использует только необходимые cookie: вход, язык и тема. Без слежки, соглашаться не на что.',
    es: 'Este sitio solo usa cookies esenciales: tu sesión, idioma y tema. Sin rastreo, nada que aceptar.',
  },
  gotIt: { en: 'Got it', fa: 'فهمیدم', ar: 'حسنًا', ru: 'Понятно', es: 'Entendido' },
  privacy: { en: 'Privacy', fa: 'حریم خصوصی', ar: 'الخصوصية', ru: 'Конфиденциальность', es: 'Privacidad' },
  tagline: {
    en: 'Small, free and open-source tools',
    fa: 'ابزارهای کوچک، رایگان و متن‌باز',
    ar: 'أدوات صغيرة ومجانية ومفتوحة المصدر',
    ru: 'Небольшие бесплатные инструменты с открытым кодом',
    es: 'Herramientas pequeñas, gratuitas y de código abierto',
  },
};

/** A 3×3 grid of dots: the app switcher's button. */
export const APPS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
  + [5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => `<circle cx="${x}" cy="${y}" r="2.1"/>`)).join('') + '</svg>';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The theme toggle's label and icons. It's a switch: pressed means dark. */
export function themeToggleModel(locale) {
  const t = translator(SHELL_STRINGS, locale);
  return { label: t('theme'), iconsSvg: SUN_SVG + MOON_SVG };
}

/** The theme toggle as HTML: a round button in the navbar showing the sun in dark mode, the moon in light. */
export function themeToggleHtml(locale, opts = {}) {
  const m = themeToggleModel(locale);
  return `<button type="button" class="chth-theme${opts.className ? ` ${esc(opts.className)}` : ''}" data-chth-theme-toggle aria-pressed="false" aria-label="${esc(m.label)}" title="${esc(m.label)}">${m.iconsSvg}</button>`;
}

/**
 * The app switcher's contents: the CHTH sites as tiles (the current one marked, not linked), the
 * bots as chips, and chth.wtf. Links carry where the visitor came from (?ref= / ?start=src_).
 * @param {string} self  this product's id ('cafe', 'gym', 'shop', 'wtf', …)
 */
export function appSwitcherModel(locale, self) {
  const t = translator(SHELL_STRINGS, locale);
  const item = (p) => ({
    id: p.id, ico: p.ico, name: productName(p, locale), tagline: productTagline(p, locale),
    href: productLink(p, self), current: p.id === self,
  });
  return {
    label: t('apps'), sitesLabel: t('sites'), botsLabel: t('bots'), hereLabel: t('here'),
    title: 'CHTH', tagline: t('tagline'), iconSvg: APPS_SVG, logoSvg: FOOTER_LOGO_SVG,
    sites: PRODUCTS.filter((p) => p.kind === 'site').map(item),
    bots: PRODUCTS.filter((p) => p.kind === 'bot').map(item),
    about: { label: t('about'), href: `${CHTH_INFO_URL}/?ref=${encodeURIComponent(self)}`, current: self === 'wtf' },
  };
}

/** The app switcher as HTML: a <details> (it opens without JavaScript), like the language menu. */
export function appSwitcherHtml(locale, self, opts = {}) {
  const m = appSwitcherModel(locale, self);
  const site = (p) => p.current
    ? `<span class="chth-apps__site" data-chth-product="${esc(p.id)}" aria-current="page"><span class="chth-apps__ico" aria-hidden="true">${esc(p.ico)}</span><span class="chth-apps__name">${esc(p.name)}</span><span class="chth-apps__here">${esc(m.hereLabel)}</span></span>`
    : `<a class="chth-apps__site" data-chth-product="${esc(p.id)}" href="${esc(p.href)}"><span class="chth-apps__ico" aria-hidden="true">${esc(p.ico)}</span><span class="chth-apps__name">${esc(p.name)}</span><span class="chth-apps__tag">${esc(p.tagline)}</span></a>`;
  const bot = (p) => `<a class="chth-apps__bot" href="${esc(p.href)}" title="${esc(p.tagline)}"><span aria-hidden="true">${esc(p.ico)}</span>${esc(p.name)}</a>`;
  return `<details class="chth-apps${opts.className ? ` ${esc(opts.className)}` : ''}">`
    + `<summary aria-label="${esc(m.label)}" title="${esc(m.label)}">${m.iconSvg}</summary>`
    + `<div class="chth-apps__panel" role="group" aria-label="${esc(m.label)}">`
    + `<div class="chth-apps__head"><span class="chth-apps__mark" aria-hidden="true">${m.logoSvg}</span><span><strong>${esc(m.title)}</strong><small>${esc(m.tagline)}</small></span></div>`
    + `<p class="chth-apps__label">${esc(m.sitesLabel)}</p><div class="chth-apps__sites">${m.sites.map(site).join('')}</div>`
    + `<p class="chth-apps__label">${esc(m.botsLabel)}</p><div class="chth-apps__bots">${m.bots.map(bot).join('')}</div>`
    + `<a class="chth-apps__about" href="${esc(m.about.href)}"${m.about.current ? ' aria-current="page"' : ''}>${esc(m.about.label)} · chth.wtf <span aria-hidden="true">↗</span></a>`
    + (opts.prefs ? prefsHtml(locale, opts) : '')
    + `</div></details>`;
}

/**
 * The language and theme again, inside the switcher: shown only on narrow screens in a
 * .chth-tools--compact header, which hides its own language menu and theme toggle there.
 */
function prefsHtml(locale, opts) {
  const lang = languageMenuModel(locale);
  const langHref = opts.langHref ?? ((code) => `?lang=${code}`);
  const links = lang.locales.map((l) =>
    `<a href="${esc(langHref(l.code))}" hreflang="${l.code}" lang="${l.code}"${l.current ? ' aria-current="true"' : ''}>${esc(l.label)}</a>`).join('');
  return `<div class="chth-apps__prefs"><nav class="chth-apps__langs" aria-label="${esc(lang.label)}">${lang.globeSvg}${links}</nav>${themeToggleHtml(locale)}</div>`;
}

/**
 * The tools every CHTH header ends with, always in this order: the language menu, the theme
 * toggle and the app switcher. Each site keeps its own bar, logo and links before them.
 */
export function shellToolsHtml(locale, self, opts = {}) {
  return `<div class="chth-tools${opts.compact ? ' chth-tools--compact' : ''}${opts.className ? ` ${esc(opts.className)}` : ''}">`
    + (opts.language === false ? '' : languageMenuHtml(locale, { langHref: opts.langHref }))
    + (opts.theme === false ? '' : themeToggleHtml(locale))
    + appSwitcherHtml(locale, self, { prefs: opts.compact, langHref: opts.langHref })
    + `</div>`;
}

// ---- The banner, set from the hub's 📢 Banners ----

/**
 * Checks a POST /internal/announcement body: { text, url? }, text up to 200 characters, an
 * https:// link. Empty text clears the banner (announcement: null).
 */
export function parseAnnouncement(body) {
  const text = String(body?.text ?? '').trim();
  const url = String(body?.url ?? '').trim();
  if (!text) return { ok: true, announcement: null };
  if (text.length > 200) return { ok: false, error: 'The banner can be up to 200 characters.' };
  if (url && !/^https:\/\/[^\s"'<>]+$/.test(url)) return { ok: false, error: 'The link must start with https://' };
  return { ok: true, announcement: { text, url: url || null } };
}

/** A short id for a banner's text and link: a visitor's close lasts until it changes. */
export const bannerId = (a) => Array.from(a.text + (a.url ?? '')).reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7).toString(36);

/** The banner strip as HTML, for the top of <body>; '' without one. */
export function bannerHtml(a, locale = 'en') {
  if (!a || !a.text) return '';
  const t = translator(SHELL_STRINGS, locale);
  const body = a.url ? `<a href="${esc(a.url)}">${esc(a.text)} <span aria-hidden="true">→</span></a>` : `<span>${esc(a.text)}</span>`;
  return `<div class="chth-banner" role="region" aria-label="${esc(t('announcement'))}" data-chth-dismiss="banner" data-chth-dismiss-id="${bannerId(a)}">`
    + `<p class="chth-banner__text">${body}</p>`
    + `<button type="button" class="chth-banner__close" data-chth-dismiss-close aria-label="${esc(t('close'))}">`
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>';
}

// ---- The cookie notice ----

/** The cookie notice's text. Every CHTH site uses essential cookies only, so there's nothing to accept. */
export function cookieNoticeModel(locale) {
  const t = translator(SHELL_STRINGS, locale);
  return { text: t('cookies'), gotIt: t('gotIt'), privacy: t('privacy') };
}

/**
 * The cookie notice as HTML: a small card in the corner, shown until "Got it" (remembered per
 * site; bump `version` when the cookies change).
 */
export function cookieNoticeHtml(locale, opts = {}) {
  const m = cookieNoticeModel(locale);
  const privacy = opts.privacyHref ? ` <a href="${esc(opts.privacyHref)}">${esc(m.privacy)}</a>` : '';
  return `<aside class="chth-cookies" role="note" data-chth-dismiss="cookies" data-chth-dismiss-id="${esc(opts.version ?? '1')}">`
    + `<span class="chth-cookies__ico" aria-hidden="true">🍪</span><p>${esc(m.text)}${privacy}</p>`
    + `<button type="button" class="chth-cookies__ok" data-chth-dismiss-close>${esc(m.gotIt)}</button></aside>`;
}

const shell = () => (typeof window === 'undefined' ? null : window.chthShell);

/**
 * Shows a toast; returns its id (null on the server). toast.success / danger / warning / info /
 * accent pick the kind; toast.close(id) closes one.
 * @param {string} message
 * @param {{ type?: string, duration?: number, action?: { label: string, onClick?: () => void }, onClose?: () => void }} [opts]
 */
export function toast(message, opts) { return shell()?.toast(message, opts) ?? null; }
for (const kind of ['success', 'danger', 'warning', 'info', 'accent', 'error']) {
  toast[kind] = (message, opts) => shell()?.toast[kind](message, opts) ?? null;
}
toast.close = (id) => shell()?.toast.close(id);

/** Sets the theme ('dark' | 'light'); with `origin`, it spreads out from that element. */
export const setTheme = (theme, origin) => shell()?.setTheme(theme, origin);
export const toggleTheme = (origin) => shell()?.toggleTheme(origin);
/** The theme on the page now. */
export const currentTheme = () => shell()?.theme() ?? 'dark';
