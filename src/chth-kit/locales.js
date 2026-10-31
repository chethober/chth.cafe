// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The five languages every CHTH site and bot speaks, and the small helpers they share:
// picking a language, its text direction, and a translate function over a string table.

/** @type {readonly {code: 'en'|'fa'|'ar'|'ru'|'es', name: string, native: string, dir: 'ltr'|'rtl', flag: string}[]} */
export const LOCALES = Object.freeze([
  { code: 'en', name: 'English', native: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'fa', name: 'Persian', native: 'فارسی', dir: 'rtl', flag: '🇮🇷' },
  { code: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', native: 'Русский', dir: 'ltr', flag: '🇷🇺' },
  { code: 'es', name: 'Spanish', native: 'Español', dir: 'ltr', flag: '🇪🇸' },
]);

export const LOCALE_CODES = Object.freeze(LOCALES.map((l) => l.code));
export const DEFAULT_LOCALE = 'en';

/** The cookie and localStorage key a visitor's choice is kept under, the same on every site. */
export const LOCALE_KEY = 'chth_lang';

/** True for a supported locale code. */
export const isLocale = (code) => LOCALE_CODES.includes(code);

/** 'rtl' for Persian and Arabic, 'ltr' otherwise. */
export const dirOf = (code) => (code === 'fa' || code === 'ar' ? 'rtl' : 'ltr');

/**
 * The best supported locale for a list of preferences, in order: an explicit choice, then each
 * entry of an Accept-Language header or navigator.languages. Region tags fall back to the base
 * language (fa-IR → fa). Unknown input gives `fallback`.
 * @param {(string|null|undefined|string[])[]} prefs
 */
export function pickLocale(prefs, fallback = DEFAULT_LOCALE) {
  for (const pref of prefs.flat()) {
    if (!pref) continue;
    for (const part of String(pref).split(',')) {
      const base = part.split(';')[0].trim().toLowerCase().split(/[-_]/)[0];
      if (isLocale(base)) return base;
    }
  }
  return fallback;
}

/** Reads `chth_lang` from a Cookie header. */
export function localeFromCookie(cookieHeader) {
  const m = /(?:^|;\s*)chth_lang=([a-z]{2})/.exec(cookieHeader || '');
  return m && isLocale(m[1]) ? m[1] : null;
}

/** A Set-Cookie value that remembers the choice for a year on this site. */
export const localeCookie = (code) => `${LOCALE_KEY}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;

/**
 * A translate function over a table shaped `{ key: { en, fa, ar, ru, es } }`. Missing
 * languages fall back to English, missing keys to the key itself. `{name}` placeholders are
 * filled from `vars`.
 */
export function translator(table, locale) {
  return (key, vars) => {
    const entry = table[key];
    const text = entry ? entry[locale] ?? entry.en ?? key : key;
    return vars ? text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString()) : text;
  };
}

const DIGITS = { fa: '۰۱۲۳۴۵۶۷۸۹', ar: '٠١٢٣٤٥٦٧٨٩' };

/** Formats a number with the locale's own digits and grouping. */
export function formatNumber(value, locale, options) {
  const tag = { en: 'en-US', fa: 'fa-IR', ar: 'ar-EG', ru: 'ru-RU', es: 'es-ES' }[locale] ?? 'en-US';
  try {
    return new Intl.NumberFormat(tag, options).format(value);
  } catch {
    const s = String(value);
    return DIGITS[locale] ? s.replace(/\d/g, (d) => DIGITS[locale][d]) : s;
  }
}
