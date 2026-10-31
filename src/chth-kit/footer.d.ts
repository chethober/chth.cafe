// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export const CHTH_INFO_URL: string;
export const FOOTER_LOGO_SVG: string;
export const FOOTER_STRINGS: Record<'partOf', Text>;
export interface FooterModel { partOf: string; infoUrl: string; logoSvg: string }
export function footerModel(locale: Locale, self: string): FooterModel;
export function footerHtml(locale: Locale, self: string): string;
