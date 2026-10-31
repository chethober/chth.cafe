// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export const CHTH_INFO_URL: string;
export const FOOTER_LOGO_SVG: string;
export const FOOTER_STRINGS: Record<'partOf' | 'moreInfo' | 'language' | 'source' | 'openSource', Text>;
export interface FooterModel {
  partOf: string; openSource: string; moreInfoLabel: string; infoUrl: string; logoSvg: string;
  languageLabel: string; sourceLabel: string; sourceUrl: string | null;
  locales: { code: Locale; label: string; current: boolean }[];
}
export function footerModel(locale: Locale, self: string, opts?: { sourceUrl?: string }): FooterModel;
export function footerHtml(locale: Locale, self: string, opts?: { sourceUrl?: string; langHref?: (code: Locale) => string }): string;
