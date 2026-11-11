// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale, Text } from './locales.js';
export const UI_STRINGS: Record<string, Text>;
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
export interface StepperOptions { value?: number | string; min?: number; max?: number; step?: number; name?: string; id?: string; label?: string; unit?: string; size?: 'sm' | 'md'; disabled?: boolean; className?: string }
export interface StepperModel {
  className: string;
  input: { type: 'number'; inputMode: 'numeric' | 'decimal'; value: string; min: number | null; max: number | null; step: number; name: string | null; id: string | null; disabled: boolean; label: string | null };
  label: string | null; unit: string | null;
  decrease: { label: string; disabled: boolean; svg: string };
  increase: { label: string; disabled: boolean; svg: string };
}
export function stepperModel(locale: Locale, opts?: StepperOptions): StepperModel;
export function stepperHtml(locale: Locale, opts?: StepperOptions): string;
export function formatBytes(bytes: number, locale?: Locale | string): string;
export interface DropzoneOptions { name?: string; id?: string; accept?: string; multiple?: boolean; maxSize?: number; maxFiles?: number; title?: string; hint?: string; icon?: string; disabled?: boolean; className?: string }
export interface DropzoneModel {
  className: string;
  input: { type: 'file'; name: string | null; id: string | null; accept: string | null; multiple: boolean; disabled: boolean };
  maxSize: number | null; maxFiles: number | null;
  title: { before: string; browse: string; after: string };
  hint: string; icon: string;
  strings: { remove: string; tooBig: string; wrongType: string; tooMany: string };
}
export function dropzoneModel(locale: Locale, opts?: DropzoneOptions): DropzoneModel;
export function dropzoneHtml(locale: Locale, opts?: DropzoneOptions): string;
declare global {
  interface HTMLElementEventMap { 'chth:files': CustomEvent<{ files: File[] }> }
}
export * from './controls.js';
export * from './overlays.js';
export * from './display.js';
export * from './datepicker.js';
