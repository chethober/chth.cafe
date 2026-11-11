// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
import type { Locale } from './locales.js';
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export function badgeHtml(opts: { label: string | number; tone?: Tone; dot?: boolean; solid?: boolean; className?: string }): string;
export interface ChipOptions { label: string; value?: string; name?: string; selected?: boolean; removable?: boolean; icon?: string; count?: number; className?: string }
export function chipModel(locale: Locale, opts: ChipOptions): { className: string; label: string; value: string; name: string | null; selected: boolean; removable: boolean; icon: string | null; count: number | null; removeLabel: string; removeSvg: string };
export function chipHtml(locale: Locale, opts: ChipOptions): string;
export function initials(name: string): string;
export function nameHue(name: string): number;
export interface AvatarOptions { name: string; src?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; status?: 'online' | 'away' | 'busy' | 'offline'; className?: string }
export function avatarModel(opts: AvatarOptions): { className: string; name: string; initials: string; hue: number; src: string | null; status: string | null };
export function avatarHtml(opts: AvatarOptions): string;
export function avatarGroupHtml(locale: Locale, opts: { people: { name: string; src?: string }[]; max?: number; size?: 'xs' | 'sm' | 'md' | 'lg'; label?: string; className?: string }): string;
export interface TabsOptions { id: string; label: string; tabs: { id: string; label: string; panel: string; count?: number }[]; selected?: string; className?: string }
export function tabsModel(opts: TabsOptions): { id: string; label: string; className: string; tabs: { id: string; label: string; panel: string; tabId: string; panelId: string; selected: boolean; count: number | null }[] };
export function tabsHtml(opts: TabsOptions): string;
export interface ChecklistOptions { id: string; title: string; steps: { id: string; label: string; hint?: string; href?: string; done?: boolean }[]; dismissible?: boolean; className?: string }
export interface ChecklistModel {
  id: string; className: string; title: string; done: number; total: number; status: string; dismissible: boolean; version: string;
  strings: { ofDone: string; allSet: string }; close: string; closeSvg: string; checkSvg: string;
  steps: { id: string; label: string; hint: string | null; href: string | null; done: boolean }[];
}
export function checklistModel(locale: Locale, opts: ChecklistOptions): ChecklistModel;
export function checklistHtml(locale: Locale, opts: ChecklistOptions): string;
declare global {
  interface HTMLElementEventMap { 'chth:tab': CustomEvent<{ id: string }>; 'chth:chip-remove': CustomEvent<{ value: string }> }
}
