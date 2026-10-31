// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
export type Locale = 'en' | 'fa' | 'ar' | 'ru' | 'es';
export type Text = Record<Locale, string>;
export interface LocaleInfo { code: Locale; name: string; native: string; dir: 'ltr' | 'rtl'; flag: string }
export const LOCALES: readonly LocaleInfo[];
export const LOCALE_CODES: readonly Locale[];
export const DEFAULT_LOCALE: 'en';
export const LOCALE_KEY: 'chth_lang';
export function isLocale(code: unknown): code is Locale;
export function dirOf(code: string): 'ltr' | 'rtl';
export function pickLocale(prefs: (string | null | undefined | readonly string[])[], fallback?: Locale): Locale;
export function localeFromCookie(cookieHeader: string | null | undefined): Locale | null;
export function localeCookie(code: Locale): string;
export function translator<K extends string>(table: Record<K, Partial<Text> & { en: string }>, locale: Locale):
  (key: K, vars?: Record<string, string | number>) => string;
export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string;
