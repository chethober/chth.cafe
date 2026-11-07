// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export type Theme = 'dark' | 'light';
export type ToastKind = 'success' | 'danger' | 'warning' | 'info' | 'accent';
export interface ToastOptions { type?: ToastKind | 'error'; duration?: number; action?: { label: string; onClick?: () => void }; onClose?: () => void }
export interface ToastFn {
  (message: string, opts?: ToastOptions): string | null;
  success(message: string, opts?: ToastOptions): string | null;
  danger(message: string, opts?: ToastOptions): string | null;
  error(message: string, opts?: ToastOptions): string | null;
  warning(message: string, opts?: ToastOptions): string | null;
  info(message: string, opts?: ToastOptions): string | null;
  accent(message: string, opts?: ToastOptions): string | null;
  close(id: string | null | undefined): void;
}
export const THEME_KEY: 'chth_theme';
export const THEME_INIT_JS: string;
export const SUN_SVG: string;
export const MOON_SVG: string;
export const SHELL_STRINGS: Record<'theme', Text>;
export function themeToggleModel(locale: Locale): { label: string; iconsSvg: string };
export function themeToggleHtml(locale: Locale, opts?: { className?: string }): string;
export const toast: ToastFn;
export function setTheme(theme: Theme, origin?: Element | null): void;
export function toggleTheme(origin?: Element | null): void;
export function currentTheme(): Theme;
declare global {
  interface Window {
    chthShell?: { theme(): Theme; setTheme(theme: Theme, origin?: Element | null): void; toggleTheme(origin?: Element | null): void; toast: ToastFn; applyDismissed(scope?: ParentNode): void };
    chthToast?: ToastFn;
    chthApplyTheme?: (theme: Theme) => void;
  }
}
