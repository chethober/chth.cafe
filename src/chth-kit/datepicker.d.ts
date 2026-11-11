// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale } from './locales.js';
export type Calendar = 'gregory' | 'persian';
export function calendarFor(locale: Locale): Calendar;
export function formatDate(iso: string, locale?: Locale, calendar?: Calendar, style?: 'full' | 'long' | 'medium' | 'short'): string;
export interface DatePickerOptions { name: string; id?: string; value?: string; min?: string; max?: string; calendar?: 'auto' | Calendar; label?: string; placeholder?: string; required?: boolean; disabled?: boolean; time?: { name: string; value?: string; step?: number }; className?: string }
export interface DatePickerModel {
  className: string; calendar: Calendar;
  input: { name: string; id: string | null; value: string; min: string | null; max: string | null; required: boolean; disabled: boolean; label: string };
  text: string; empty: boolean; time: { name: string; value: string; step: number | null; label: string } | null;
  strings: { choose: string; prev: string; next: string; today: string; clear: string }; icon: string; chevron: string;
}
export function datePickerModel(locale: Locale, opts: DatePickerOptions): DatePickerModel;
export function datePickerHtml(locale: Locale, opts: DatePickerOptions): string;
