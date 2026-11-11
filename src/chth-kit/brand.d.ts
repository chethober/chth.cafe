// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Text } from './locales.js';
export interface ProductTheme { accent: string; accentHover: string; onAccent: string }
export const BRAND: {
  name: string; tagline: Text;
  color: Record<'ink' | 'inkSoft' | 'paper' | 'paperSoft' | 'muted' | 'line' | 'accent' | 'accentHover' | 'onAccent' | 'success' | 'warning' | 'danger' | 'telegram', string>;
  products: Record<'cafe' | 'gym' | 'shop' | 'hub', ProductTheme>;
  font: Record<'sans' | 'display' | 'mono' | 'rtl', string>;
  fontCss: Record<'latin' | 'rtl', string>;
  /** sm, md, lg, xl, full, and the numbered corners (2, 4, 6, 12, 16, 18, 22, 24, 26, 28, 32 px). */
  radius: Record<string, string>;
  /** Named by px at the default text size: '2' … '48' on a 2px grid, then 56, 64, 72, 80, 96. */
  space: Record<string, string>;
  /** Named by px: '10' … '18', then 20, 22, 24, 26, 28, 32, 36, 40. */
  text: Record<string, string>;
  shadow: Record<'sm' | 'md' | 'lg', string>;
  /** Named by ms: '100' … '3000'. */
  duration: Record<string, string>;
  motion: Record<'easeOut' | 'easeInOut' | 'easeGlass' | 'easeSpring' | 'durFast' | 'durBase' | 'durSlow' | 'durGlass', string>;
  z: Record<'menu' | 'nav' | 'banner' | 'cookies' | 'toast', string>;
};
export const LOGO_SVG: string;
export const BRAND_CSS: string;
export function productTheme(id: string): ProductTheme;
