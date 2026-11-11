// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export const UI_STRINGS: Record<'loading' | 'progress', Text>;
export interface EmptyStateOptions { icon?: string; title: string; text?: string; action?: { label: string; href?: string; id?: string } | null; compact?: boolean; className?: string }
export interface EmptyStateModel { className: string; icon: string; title: string; text: string; action: { label: string; href: string | null; id: string | null } | null }
export function emptyStateModel(opts: EmptyStateOptions): EmptyStateModel;
export function emptyStateHtml(opts: EmptyStateOptions): string;
export function skeletonHtml(locale: Locale, opts?: { lines?: number; shape?: 'text' | 'circle' | 'block'; width?: string; height?: string; className?: string }): string;
export function ringStyle(value: number, max?: number): string;
export interface RingOptions { value: number; max?: number; label?: string; title?: string; size?: 'sm' | 'md' | 'lg'; done?: boolean; className?: string }
export interface RingModel { className: string; style: string; value: number; max: number; label: string; title: string; svg: string }
export function ringModel(locale: Locale, opts: RingOptions): RingModel;
export function ringHtml(locale: Locale, opts: RingOptions): string;
