// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export type FooterLinkId = 'source' | 'docs' | 'api' | 'privacy' | 'terms';
export const CHTH_INFO_URL: string;
export const FOOTER_LOGO_SVG: string;
export const SITE_LINKS: Record<string, Partial<Record<FooterLinkId, string>>>;
export const PRIVACY_URL: string;
export const TERMS_URL: string;
export const FOOTER_STRINGS: Record<'partOf' | 'pitch' | 'explore' | FooterLinkId, Text>;
export interface FooterOptions { links?: Partial<Record<FooterLinkId, string | null>>; legal?: boolean }
export interface FooterModel {
  partOf: string; pitch: string; explore: string; infoUrl: string; logoSvg: string; year: number;
  links: { id: FooterLinkId; label: string; href: string; external: boolean }[];
}
export function footerModel(locale: Locale, self: string, opts?: FooterOptions): FooterModel;
export function footerHtml(locale: Locale, self: string, opts?: FooterOptions): string;
