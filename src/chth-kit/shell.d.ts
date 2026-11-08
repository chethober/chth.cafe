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
export const SHELL_STRINGS: Record<'theme' | 'apps' | 'sites' | 'bots' | 'here' | 'about' | 'tagline' | 'close' | 'announcement' | 'cookies' | 'gotIt' | 'privacy', Text>;
export const APPS_SVG: string;
export interface AppItem { id: string; ico: string; name: string; tagline: string; href: string; current: boolean }
export interface AppSwitcherModel {
  label: string; sitesLabel: string; botsLabel: string; hereLabel: string; title: string; tagline: string;
  iconSvg: string; logoSvg: string; sites: AppItem[]; bots: AppItem[]; about: { label: string; href: string; current: boolean };
}
export function appSwitcherModel(locale: Locale, self: string): AppSwitcherModel;
export function appSwitcherHtml(locale: Locale, self: string, opts?: { className?: string; prefs?: boolean; langHref?: (code: Locale) => string }): string;
export function shellToolsHtml(locale: Locale, self: string, opts?: { className?: string; language?: boolean; theme?: boolean; compact?: boolean; langHref?: (code: Locale) => string }): string;
export function themeToggleModel(locale: Locale): { label: string; iconsSvg: string };
export function themeToggleHtml(locale: Locale, opts?: { className?: string }): string;
export interface Announcement { text: string; url: string | null }
export function parseAnnouncement(body: unknown): { ok: true; announcement: Announcement | null } | { ok: false; error: string };
export function bannerId(a: Announcement): string;
export function bannerHtml(a: Announcement | null | undefined, locale?: Locale): string;
export function cookieNoticeModel(locale: Locale): { text: string; gotIt: string; privacy: string };
export function cookieNoticeHtml(locale: Locale, opts?: { privacyHref?: string; version?: string }): string;
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
