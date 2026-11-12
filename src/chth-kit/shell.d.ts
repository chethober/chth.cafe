// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export type Theme = 'dark' | 'light';
export type ToastKind = 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'milestone';
export interface ToastOptions { type?: ToastKind | 'error'; duration?: number; detail?: string; action?: { label: string; onClick?: () => void }; onClose?: () => void }
export interface ToastFn {
  (message: string, opts?: ToastOptions): string | null;
  success(message: string, opts?: ToastOptions): string | null;
  danger(message: string, opts?: ToastOptions): string | null;
  error(message: string, opts?: ToastOptions): string | null;
  warning(message: string, opts?: ToastOptions): string | null;
  info(message: string, opts?: ToastOptions): string | null;
  accent(message: string, opts?: ToastOptions): string | null;
  /** A celebration: `message` is the title, `opts.detail` the line under it. */
  milestone(message: string, opts?: ToastOptions): string | null;
  close(id: string | null | undefined): void;
}
export const THEME_KEY: 'chth_theme';
export const THEME_INIT_JS: string;
export const SUN_SVG: string;
export const MOON_SVG: string;
export const SHELL_STRINGS: Record<'theme' | 'home' | 'account' | 'close' | 'announcement' | 'cookies' | 'gotIt' | 'privacy', Text>;
export const NAV_LEADS: Record<string, Record<Locale, string[]>>;
export const USER_SVG: string;
export interface NavbarOptions { home?: string; leadHref?: string; words?: string[]; account?: { href: string; label?: string } | null }
export interface NavbarModel { home: string; homeLabel: string; logoSvg: string; words: string[]; leadHref: string; account: { href: string; label: string } | null; userSvg: string }
export function navbarModel(locale: Locale, self: string, opts?: NavbarOptions): NavbarModel;
export function navbarHtml(locale: Locale, self: string, opts?: NavbarOptions & { extra?: string; theme?: boolean; themeFormAction?: string; language?: boolean; overlay?: boolean; className?: string; langHref?: (code: Locale) => string }): string;
export function themeToggleModel(locale: Locale): { label: string; iconsSvg: string };
export function themeToggleHtml(locale: Locale, opts?: { className?: string; formAction?: string }): string;
export interface Announcement { text: string; url: string | null }
export function parseAnnouncement(body: unknown): { ok: true; announcement: Announcement | null } | { ok: false; error: string };
export function bannerId(a: Announcement): string;
export function bannerHtml(a: Announcement | null | undefined, locale?: Locale): string;
export function cookieNoticeModel(locale: Locale): { text: string; gotIt: string; privacy: string };
export function cookieNoticeHtml(locale: Locale, opts?: { privacyHref?: string; version?: string }): string;
export const toast: ToastFn;
export function openDialog(id: string): void;
export function closeDialog(id: string, value?: string): void;
export function completeStep(listId: string, stepId: string): void;
export function setTheme(theme: Theme, origin?: Element | null): void;
export function toggleTheme(origin?: Element | null): void;
export function currentTheme(): Theme;
declare global {
  interface Window {
    chthShell?: { theme(): Theme; setTheme(theme: Theme, origin?: Element | null): void; toggleTheme(origin?: Element | null): void; toast: ToastFn; applyDismissed(scope?: ParentNode): void; startNav(scope?: ParentNode): void; float<T extends HTMLElement>(el: T): T; refloat(opened?: HTMLDialogElement): void };
    chthToast?: ToastFn;
    chthApplyTheme?: (theme: Theme) => void;
    chthUi?: { openDialog(id: string | HTMLDialogElement): void; closeDialog(id: string | HTMLDialogElement, value?: string): void; completeStep(listId: string | Element, stepId: string): void; scan(scope?: Element | Document): void };
  }
}
