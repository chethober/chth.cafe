// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Text } from './locales.js';
export interface ProductTheme { accent: string; accentHover: string; onAccent: string }
export const BRAND: {
  name: string; tagline: Text;
  color: Record<'ink' | 'inkSoft' | 'paper' | 'paperSoft' | 'muted' | 'line' | 'accent' | 'accentHover' | 'onAccent' | 'success' | 'warning' | 'danger' | 'telegram', string>;
  products: Record<'cafe' | 'gym' | 'shop' | 'hub', ProductTheme>;
  font: Record<'sans' | 'display' | 'mono' | 'rtl', string>;
  fontCss: Record<'latin' | 'rtl', string>;
  radius: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string>;
};
export const LOGO_SVG: string;
export const BRAND_CSS: string;
export function productTheme(id: string): ProductTheme;
