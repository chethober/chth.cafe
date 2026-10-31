// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export interface Product { id: string; kind: 'site' | 'bot'; ico: string; url: string; name: Text; tagline: Text }
export const PRODUCTS: readonly Product[];
export function otherProducts(self?: string | null, kind?: 'site' | 'bot'): Product[];
export function productLink(product: Product, from?: string): string;
export function productName(product: Product, locale: Locale): string;
export function productTagline(product: Product, locale: Locale): string;
