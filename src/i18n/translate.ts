// The language the café's pages are shown in. Plain module state (no React), so utilities
// shared with the Worker (opening hours, event dates) can read it; it stays English there.
//
// Strings are keyed by their English text, so a missing translation shows English. The public
// menu reads PUBLIC_STRINGS; the admin and panel load STAFF_STRINGS on top of them (only when
// they open, so customers never download the staff table).

import { dirOf, isLocale, LOCALE_KEY, localeCookie, localeFromCookie, pickLocale, type Locale } from '../chth-kit/locales.js';
import { PUBLIC_STRINGS, type Row } from './public';

export type { Locale };
export type Vars = Record<string, string | number | null | undefined>;

let current: Locale = 'en';
let staff: Record<string, Row> | null = null;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => { version++; listeners.forEach(fn => fn()); };

/** Intl tags for dates, times and numbers in each language. */
export const INTL_TAG: Record<Locale, string> = { en: 'en-GB', fa: 'fa-IR', ar: 'ar', ru: 'ru-RU', es: 'es-ES' };

export const getLocale = () => current;
export const intlTag = (locale: Locale = current) => INTL_TAG[locale];
/** Changes whenever the language or the loaded strings change; React re-renders on it. */
export const getStringsVersion = () => `${current}:${version}`;

/**
 * Keeps a formatted amount such as "-₹3,047.11" in one left-to-right piece inside Persian or Arabic
 * text, where the bidi rules would otherwise move the sign and currency symbol. Only RTL languages
 * get the (invisible) isolate marks.
 */
export const isolateNumber = (text: string, locale: Locale = current) => dirOf(locale) === 'rtl' ? `\u2066${text}\u2069` : text;

/** Translates an English UI string; `{name}` placeholders are filled from vars. */
export function tr(key: string, vars?: Vars, locale: Locale = current): string {
  const text = locale === 'en' ? key : (staff?.[key] ?? PUBLIC_STRINGS[key])?.[locale] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : text;
}

/** Loads the admin and panel strings. Text shows in English until they arrive. */
export function loadStaffStrings(): Promise<void> {
  if (staff) return Promise.resolve();
  return import('./staff').then(({ STAFF_STRINGS }) => { staff = STAFF_STRINGS; notify(); });
}

/** The visitor's language: ?lang=, the chth_lang cookie shared by CHTH sites, saved choice, browser. */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const param = new URLSearchParams(window.location.search).get('lang');
  if (isLocale(param)) return param;
  const cookie = localeFromCookie(document.cookie);
  if (cookie) return cookie;
  let saved: string | null = null;
  try { saved = localStorage.getItem(LOCALE_KEY); } catch { /* storage blocked */ }
  if (isLocale(saved)) return saved;
  return pickLocale([navigator.languages as unknown as string[], navigator.language]);
}

export function setLocale(locale: Locale, remember = true) {
  current = locale;
  if (remember && typeof document !== 'undefined') {
    document.cookie = localeCookie(locale);
    try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* storage blocked */ }
  }
  notify();
}

export function subscribeLocale(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Sets <html lang dir>. */
export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
}
