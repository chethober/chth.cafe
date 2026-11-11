// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The CHTH shell: what every site puts around its own pages, so they feel like one family.
// Server-rendered pages use the *Html() functions and inline SHELL_JS from shell-script.js
// (and THEME_INIT_JS in <head>); React sites map the *Model() functions to their own markup with the same classes,
// import this module once (it loads the browser side) and call toast() / setTheme().
// Styles are in brand.css. Behaviour is in shell-runtime.js, wired by data-chth-* attributes.

import './shell-runtime.js';
import { translator } from './locales.js';
import { languageMenuHtml, languageMenuModel } from './language-menu.js';
import { FOOTER_LOGO_SVG } from './footer.js';

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

/** Lucide's sun and moon, in currentColor. Each ray is drawn from absolute coordinates (one path). */
export const SUN_SVG = '<svg class="chth-theme__sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
export const MOON_SVG = '<svg class="chth-theme__moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

export const SHELL_STRINGS = {
  theme: { en: 'Dark appearance', fa: 'حالت تیره', ar: 'المظهر الداكن', ru: 'Тёмная тема', es: 'Apariencia oscura' },
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
  home: { en: 'CHTH home', fa: 'خانهٔ CHTH', ar: 'الرئيسية CHTH', ru: 'Главная CHTH', es: 'Inicio de CHTH' },
  account: { en: 'Account', fa: 'حساب', ar: 'الحساب', ru: 'Аккаунт', es: 'Cuenta' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The theme toggle's label and icons. It's a switch: pressed means dark. */
export function themeToggleModel(locale) {
  const t = translator(SHELL_STRINGS, locale);
  return { label: t('theme'), iconsSvg: SUN_SVG + MOON_SVG };
}

/**
 * The theme toggle as HTML: a round button in the navbar showing the sun in dark mode, the moon in
 * light. With `formAction`, it's a form posting theme=toggle there, so it works without scripts.
 */
export function themeToggleHtml(locale, opts = {}) {
  const m = themeToggleModel(locale);
  const cls = `chth-theme${opts.className ? ` ${esc(opts.className)}` : ''}`;
  if (opts.formAction) {
    return `<form class="chth-theme-form" method="post" action="${esc(opts.formAction)}"><button type="submit" name="theme" value="toggle" class="${cls}" data-chth-theme-toggle aria-label="${esc(m.label)}" title="${esc(m.label)}">${m.iconsSvg}</button></form>`;
  }
  return `<button type="button" class="${cls}" data-chth-theme-toggle aria-pressed="false" aria-label="${esc(m.label)}" title="${esc(m.label)}">${m.iconsSvg}</button>`;
}

// ---- The navbar: the shop's floating pill, on every CHTH site ----
// On the left the language menu and theme toggle, then text that types itself (a link); the CHTH
// mark in the middle; on the right the site's own icons, then the profile. It shrinks a little once the page
// scrolls. The left text is per product, in every language.

/** What each product's navbar types on the left: the product first, then what it invites to. */
export const NAV_LEADS = {
  gym: {
    en: ['CHTH Gym', 'Get stronger?', 'Track every set'],
    fa: ['باشگاه CHTH', 'قوی‌تر شو؟', 'هر ست را ثبت کن'],
    ar: ['نادي CHTH', 'أقوى؟', 'سجّل كل مجموعة'],
    ru: ['CHTH Gym', 'Стать сильнее?', 'Каждый подход'],
    es: ['CHTH Gym', '¿Más fuerte?', 'Cada serie cuenta'],
  },
  cafe: {
    en: ['CHTH Café', 'Run a café?', 'Own your data'],
    fa: ['کافه CHTH', 'کافه داری؟', 'داده‌ات مال خودت'],
    ar: ['مقهى CHTH', 'تدير مقهى؟', 'بياناتك لك'],
    ru: ['CHTH Café', 'Своё кафе?', 'Данные — ваши'],
    es: ['CHTH Café', '¿Tienes un café?', 'Tus datos, tuyos'],
  },
  shop: {
    en: ['Artists?', 'Merchants?', 'Sell with us?'],
    fa: ['هنرمندی؟', 'فروشنده‌ای؟', 'با ما بفروش؟'],
    ar: ['فنان؟', 'تاجر؟', 'بِع معنا؟'],
    ru: ['Художник?', 'Продавец?', 'Продавай с нами?'],
    es: ['¿Artista?', '¿Comerciante?', '¿Vendes con nosotros?'],
  },
  wtf: {
    en: ['Cheth Ober', 'DevOps & software', 'Hire me?'],
    fa: ['Cheth Ober', 'DevOps و نرم‌افزار', 'استخدامم می‌کنی؟'],
    ar: ['Cheth Ober', 'DevOps والبرمجيات', 'توظفني؟'],
    ru: ['Cheth Ober', 'DevOps и софт', 'Наймёте?'],
    es: ['Cheth Ober', 'DevOps y software', '¿Me contratas?'],
  },
};

/** Lucide's "user", for the profile link. */
export const USER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

/**
 * Everything the navbar shows, translated.
 * @param {string} self  the product ('gym', 'cafe', 'shop', 'wtf')
 * @param {{ home?: string, leadHref?: string, words?: string[], account?: { href: string, label?: string } | null }} [opts]
 */
export function navbarModel(locale, self, opts = {}) {
  const t = translator(SHELL_STRINGS, locale);
  const leads = NAV_LEADS[self];
  return {
    home: opts.home ?? '/',
    homeLabel: t('home'),
    logoSvg: FOOTER_LOGO_SVG,
    words: opts.words ?? (leads ? leads[locale] ?? leads.en : ['CHTH']),
    leadHref: opts.leadHref ?? opts.home ?? '/',
    account: opts.account === null ? null : { href: opts.account?.href ?? '/account', label: opts.account?.label ?? t('account') },
    userSvg: USER_SVG,
  };
}

/**
 * The navbar as HTML: language and theme on the left, then the words; `extra` (the site's own
 * icon links, HTML) and the profile on the right. `language: false` / `theme: false` leave those out; `account: null` leaves out the
 * profile. `overlay` floats it over the page (the page leaves room at the top); otherwise it
 * takes its own space and sticks to the top as the page scrolls.
 */
export function navbarHtml(locale, self, opts = {}) {
  const m = navbarModel(locale, self, opts);
  const first = m.words[0] ?? '';
  const account = m.account
    ? `<a class="chth-nav__icon" href="${esc(m.account.href)}" aria-label="${esc(m.account.label)}" title="${esc(m.account.label)}">${m.userSvg}</a>` : '';
  const prefs = (opts.language === false ? '' : languageMenuHtml(locale, { langHref: opts.langHref, className: 'chth-nav__lang' }))
    + (opts.theme === false ? '' : themeToggleHtml(locale, { className: 'chth-nav__icon', formAction: opts.themeFormAction }));
  return `<header class="chth-nav${opts.overlay ? ' chth-nav--overlay' : ''}${opts.className ? ` ${esc(opts.className)}` : ''}" data-chth-nav>`
    + `<div class="chth-nav__pill">`
    + `<div class="chth-nav__start">${prefs}<a class="chth-nav__lead" href="${esc(m.leadHref)}" data-chth-type="${esc(JSON.stringify(m.words))}">`
    + `<span class="chth-nav__type">${esc(first)}</span><span class="chth-nav__caret" aria-hidden="true"></span></a></div>`
    + `<a class="chth-nav__logo" href="${esc(m.home)}" aria-label="${esc(m.homeLabel)}">${m.logoSvg}</a>`
    + `<div class="chth-nav__end">${opts.extra ?? ''}${account}</div></div></header>`;
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
 * accent pick the kind; toast.close(id) closes one. toast.milestone(title, { detail }) celebrates
 * (a first workout, a streak, a first order): a taller toast with a medal and a line under it.
 * @param {string} message
 * @param {{ type?: string, duration?: number, detail?: string, action?: { label: string, onClick?: () => void }, onClose?: () => void }} [opts]
 */
export function toast(message, opts) { return shell()?.toast(message, opts) ?? null; }
for (const kind of ['success', 'danger', 'warning', 'info', 'accent', 'milestone', 'error']) {
  toast[kind] = (message, opts) => shell()?.toast[kind](message, opts) ?? null;
}
toast.close = (id) => shell()?.toast.close(id);

/** Sets the theme ('dark' | 'light'); with `origin`, it spreads out from that element. */
export const setTheme = (theme, origin) => shell()?.setTheme(theme, origin);
export const toggleTheme = (origin) => shell()?.toggleTheme(origin);
/** The theme on the page now. */
export const currentTheme = () => shell()?.theme() ?? 'dark';
