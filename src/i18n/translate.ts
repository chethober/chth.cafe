// The language customers see the public menu in. Plain module state (no React), so utilities
// shared with the Worker (opening hours, event dates) can read it; it stays English there.

import { dirOf, isLocale, LOCALE_KEY, localeCookie, localeFromCookie, pickLocale, type Locale } from '../chth-kit/locales.js';
import { PUBLIC_STRINGS } from './public';

export type { Locale };

let current: Locale = 'en';
const listeners = new Set<() => void>();

/** Intl tags for dates, times and numbers in each language. */
export const INTL_TAG: Record<Locale, string> = { en: 'en-GB', fa: 'fa-IR', ar: 'ar', ru: 'ru-RU', es: 'es-ES' };

export const getLocale = () => current;
export const intlTag = (locale: Locale = current) => INTL_TAG[locale];

/** Translates a customer-facing English string; `{name}` placeholders are filled from vars. */
export function tr(key: string, vars?: Record<string, string | number>, locale: Locale = current): string {
  const text = locale === 'en' ? key : PUBLIC_STRINGS[key]?.[locale] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : text;
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
  listeners.forEach(fn => fn());
}

export function subscribeLocale(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Sets <html lang dir> for the public menu. */
export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
}
