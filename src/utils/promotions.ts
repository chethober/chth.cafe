import { tr } from '../i18n/translate';

/**
 * A promotion or happy hour: a percentage or fixed amount off each unit of the items it covers, while it runs.
 * Empty lists mean "every": no categories and no items covers the whole menu, no days means every day.
 * Times and dates are the café's own wall clock, in its time zone.
 */
export interface Promotion {
  id: string;
  name: string;
  kind: 'percent' | 'fixed';
  value: number;
  categoryIds: string[];
  itemIds: string[];
  /** Weekdays it runs, 0 = Sunday. */
  days: number[];
  /** HH:MM, or '' for all day. An end before the start runs past midnight. */
  startTime: string;
  endTime: string;
  /** YYYY-MM-DD, inclusive, or '' for open-ended. */
  startsOn: string;
  endsOn: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (value: number) => Number(value.toFixed(2));

const list = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
};

/** A promotion from a database row (snake or camel case) or a request body, with every field checked. */
export function normalizePromotion(row: Record<string, unknown>): Promotion {
  const get = (camel: string, snake: string) => row[camel] ?? row[snake];
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? '').trim().slice(0, 100),
    kind: get('kind', 'kind') === 'fixed' ? 'fixed' : 'percent',
    value: Number(row.value) || 0,
    categoryIds: list(get('categoryIds', 'category_ids')).filter((v): v is string => typeof v === 'string'),
    itemIds: list(get('itemIds', 'item_ids')).filter((v): v is string => typeof v === 'string'),
    days: [...new Set(list(row.days).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort(),
    startTime: TIME.test(String(get('startTime', 'start_time') ?? '')) ? String(get('startTime', 'start_time')) : '',
    endTime: TIME.test(String(get('endTime', 'end_time') ?? '')) ? String(get('endTime', 'end_time')) : '',
    startsOn: DATE.test(String(get('startsOn', 'starts_on') ?? '')) ? String(get('startsOn', 'starts_on')) : '',
    endsOn: DATE.test(String(get('endsOn', 'ends_on') ?? '')) ? String(get('endsOn', 'ends_on')) : '',
    active: row.active === true || row.active === 1,
    createdAt: String(get('createdAt', 'created_at') ?? ''),
    updatedAt: String(get('updatedAt', 'updated_at') ?? '')
  };
}

/** Why a promotion cannot be saved, or '' when it can. */
export function promotionError(p: Promotion): string {
  if (!p.name) return 'Give the promotion a name.';
  if (!Number.isFinite(p.value) || p.value <= 0) return 'Enter an amount above zero.';
  if (p.kind === 'percent' && p.value > 100) return 'A percentage can be at most 100.';
  if (!!p.startTime !== !!p.endTime) return 'Set both a start and an end time, or neither.';
  if (p.startTime && p.startTime === p.endTime) return 'The start and end times must differ.';
  if (p.startsOn && p.endsOn && p.endsOn < p.startsOn) return 'The last day must be on or after the first.';
  return '';
}

/** The café's wall clock: its date, weekday and minutes since midnight. */
export function cafeClock(now: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const part = (type: string) => parts.find(p => p.type === type)?.value || '00';
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return { date, weekday: new Date(`${date}T00:00:00Z`).getUTCDay(), minutes: Number(part('hour')) * 60 + Number(part('minute')) };
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const previousDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Whether the promotion is running at this instant. */
export function promotionLive(p: Promotion, now: Date, timeZone: string): boolean {
  if (!p.active || promotionError(p)) return false;
  const clock = cafeClock(now, timeZone);
  // Past midnight, an overnight window still belongs to the day it started.
  let day = clock.date, weekday = clock.weekday;
  if (p.startTime) {
    const start = toMinutes(p.startTime), end = toMinutes(p.endTime);
    if (start < end) { if (clock.minutes < start || clock.minutes >= end) return false; }
    else if (clock.minutes < end) { day = previousDay(clock.date); weekday = (weekday + 6) % 7; }
    else if (clock.minutes < start) return false;
  }
  if (p.days.length && !p.days.includes(weekday)) return false;
  if (p.startsOn && day < p.startsOn) return false;
  if (p.endsOn && day > p.endsOn) return false;
  return true;
}

export function promotionCovers(p: Promotion, item: { id: string; categoryId: string }): boolean {
  if (!p.categoryIds.length && !p.itemIds.length) return true;
  return p.itemIds.includes(item.id) || p.categoryIds.includes(item.categoryId);
}

/** How much the promotion takes off one unit at this price. */
export function promotionUnitDiscount(p: Promotion, unitPrice: number): number {
  if (unitPrice <= 0) return 0;
  return round2(Math.min(unitPrice, p.kind === 'percent' ? unitPrice * p.value / 100 : p.value));
}

/** The running promotion that saves the most on this item, if any. Promotions never stack. */
export function bestPromotion(promotions: Promotion[], item: { id: string; categoryId: string }, unitPrice: number, now: Date, timeZone: string) {
  let best: { promotion: Promotion; unitDiscount: number } | null = null;
  for (const promotion of promotions) {
    if (!promotionCovers(promotion, item) || !promotionLive(promotion, now, timeZone)) continue;
    const unitDiscount = promotionUnitDiscount(promotion, unitPrice);
    if (unitDiscount > 0 && (!best || unitDiscount > best.unitDiscount)) best = { promotion, unitDiscount };
  }
  return best;
}

/** The promotion's discount for a whole line, as stored on the order line. */
export const promotionLineDiscount = (unitDiscount: number, quantity: number) => round2(unitDiscount * quantity);

/** "20% off" or "₹30 off". */
export function describePromotion(p: Pick<Promotion, 'kind' | 'value'>, formatMoney: (value: number) => string) {
  return p.kind === 'percent' ? tr('{value}% off', { value: Number(p.value.toFixed(2)) }) : tr('{amount} off', { amount: formatMoney(p.value) });
}

/** When it runs, e.g. "15:00–17:00", or '' when it runs all day. */
export const promotionHours = (p: Pick<Promotion, 'startTime' | 'endTime'>) => p.startTime ? `${p.startTime}–${p.endTime}` : '';
