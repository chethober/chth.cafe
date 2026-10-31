// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export const FOOTER_STRINGS: Record<'partOf' | 'sites' | 'bots' | 'language' | 'source' | 'openSource', Text>;
export interface FooterItem { id: string; ico: string; name: string; tagline: string; href: string }
export interface FooterModel {
  partOf: string; openSource: string; sitesTitle: string; botsTitle: string; languageLabel: string; sourceLabel: string;
  sourceUrl: string | null; sites: FooterItem[]; bots: FooterItem[];
  locales: { code: Locale; label: string; current: boolean }[];
}
export function footerModel(locale: Locale, self: string, opts?: { sourceUrl?: string }): FooterModel;
export function footerHtml(locale: Locale, self: string, opts?: { sourceUrl?: string; logoSvg?: string; langHref?: (code: Locale) => string }): string;
