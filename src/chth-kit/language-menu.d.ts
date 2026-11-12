// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export const GLOBE_SVG: string;
export const CHECK_SVG: string;
export const LANGUAGE_STRINGS: Record<'language', Text>;
export interface LanguageMenuItem { code: Locale; label: string; short: string; dir: 'ltr' | 'rtl'; flagSrc: string; current: boolean }
export interface LanguageMenuModel { label: string; globeSvg: string; checkSvg: string; current: LanguageMenuItem | null; badge: string; locales: LanguageMenuItem[] }
export function languageMenuModel(locale: Locale, opts?: { flagBase?: string }): LanguageMenuModel;
export function languageMenuHtml(locale: Locale, opts?: { langHref?: (code: Locale) => string; className?: string; flagBase?: string }): string;
