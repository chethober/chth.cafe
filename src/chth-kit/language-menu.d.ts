// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export const GLOBE_SVG: string;
export const LANGUAGE_STRINGS: Record<'language', Text>;
export interface LanguageMenuModel { label: string; globeSvg: string; locales: { code: Locale; label: string; current: boolean }[] }
export function languageMenuModel(locale: Locale): LanguageMenuModel;
export function languageMenuHtml(locale: Locale, opts?: { langHref?: (code: Locale) => string; className?: string }): string;
