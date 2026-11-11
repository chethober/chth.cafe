// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale } from './locales.js';
type Size = 'sm' | 'md' | 'lg';
export interface ButtonOptions { label: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: Size; icon?: string; iconEnd?: boolean; iconOnly?: boolean; href?: string; type?: 'button' | 'submit' | 'reset'; loading?: boolean; disabled?: boolean; block?: boolean; id?: string; name?: string; value?: string; className?: string; attrs?: Record<string, string | boolean | null | undefined> }
export interface ButtonModel { tag: 'a' | 'button'; className: string; label: string; icon: string | null; iconEnd: boolean; iconOnly: boolean; href: string | null; type: string; disabled: boolean; loading: boolean; id: string | null; name: string | null; value: string | null; attrs: Record<string, string | boolean | null | undefined> }
export function buttonModel(opts: ButtonOptions): ButtonModel;
export function buttonHtml(opts: ButtonOptions): string;
export interface FieldOptions { label: string; name: string; id?: string; type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'search' | 'tel' | 'textarea' | 'select'; value?: string; placeholder?: string; hint?: string; error?: string; required?: boolean; showOptional?: boolean; maxLength?: number; rows?: number; options?: { value: string; label: string; disabled?: boolean }[]; autocomplete?: string; inputMode?: string; disabled?: boolean; readOnly?: boolean; className?: string }
export interface FieldModel {
  className: string; id: string; type: string; value: string; label: string; optional: string | null;
  hint: { id: string; text: string } | null; error: { id: string; text: string } | null; count: { id: string; max: number; text: string } | null;
  control: { name: string; placeholder: string | null; required: boolean; maxLength: number | null; rows: number; autocomplete: string | null; inputMode: string | null; disabled: boolean; readOnly: boolean; options: { value: string; label: string; disabled?: boolean }[] | null };
}
export function fieldModel(locale: Locale, opts: FieldOptions): FieldModel;
export function fieldHtml(locale: Locale, opts: FieldOptions): string;
export interface SegmentedOptions { name: string; label: string; options: { value: string; label: string; icon?: string }[]; value?: string; size?: 'sm' | 'md'; block?: boolean; className?: string }
export function segmentedModel(opts: SegmentedOptions): { className: string; name: string; label: string; options: { value: string; label: string; icon: string | null; checked: boolean }[] };
export function segmentedHtml(opts: SegmentedOptions): string;
export interface SwitchOptions { label: string; name?: string; id?: string; checked?: boolean; disabled?: boolean; hint?: string; value?: string; className?: string }
export function switchModel(opts: SwitchOptions): { className: string; id: string; label: string; hint: { id: string; text: string } | null; name: string | null; value: string | null; checked: boolean; disabled: boolean };
export function switchHtml(opts: SwitchOptions): string;
export interface RatingOptions { value?: number; max?: number; name?: string; readOnly?: boolean; label?: string; size?: Size; count?: number; required?: boolean; className?: string }
export interface RatingModel { className: string; readOnly: boolean; max: number; value: number; name: string | null; required: boolean; label: string | null; summary: string; fill: string; count: string | null; stars: { value: number; label: string; checked: boolean }[] }
export function ratingModel(locale: Locale, opts?: RatingOptions): RatingModel;
export function ratingHtml(locale: Locale, opts?: RatingOptions): string;
export function withRef(url: string, ref?: string): string;
export function copyButtonHtml(locale: Locale, opts?: { text?: string; from?: string; label?: string; iconOnly?: boolean; variant?: 'primary' | 'secondary' | 'ghost'; size?: Size; className?: string }): string;
export function shareButtonHtml(locale: Locale, opts: { url: string; title?: string; text?: string; ref?: string; label?: string; iconOnly?: boolean; variant?: 'primary' | 'secondary' | 'ghost'; size?: Size; className?: string }): string;
