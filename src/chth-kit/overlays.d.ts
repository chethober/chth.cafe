// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale } from './locales.js';
export interface DialogOptions { id: string; title: string; description?: string; body?: string; actions?: string; sheet?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }
export interface DialogModel { id: string; className: string; title: string; titleId: string; description: string | null; descriptionId: string | null; body: string; actions: string; sheet: boolean; close: string; closeSvg: string }
export function dialogModel(locale: Locale, opts: DialogOptions): DialogModel;
export function dialogHtml(locale: Locale, opts: DialogOptions): string;
export function opensDialog(id: string): string;
export function tooltipAttr(text: string): string;
export interface PopoverOptions { id: string; trigger?: string; triggerHtml?: string; triggerClass?: string; content: string; label?: string; align?: 'start' | 'end'; className?: string }
export function popoverModel(opts: PopoverOptions): { id: string; className: string; trigger: string; triggerHtml: string | null; triggerClass: string; label: string | null; content: string };
export function popoverHtml(opts: PopoverOptions): string;
