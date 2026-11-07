// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The CHTH shell: what every site puts around its own pages, so they feel like one family.
// Server-rendered pages use the *Html() functions and inline SHELL_JS from shell-script.js
// (and THEME_INIT_JS in <head>); React sites map the *Model() functions to their own markup with the same classes,
// import this module once (it loads the browser side) and call toast() / setTheme().
// Styles are in brand.css. Behaviour is in shell-runtime.js, wired by data-chth-* attributes.

import './shell-runtime.js';
import { translator } from './locales.js';

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
};

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
