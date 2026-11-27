import { cafeInstant, cafeToday } from './events';

/** Pickup orders can name a "ready at" time; each slot takes at most `capacity` orders. */
export interface PickupSlotSettings {
  enabled: boolean;
  /** Minutes between slots. */
  intervalMinutes: number;
  /** Orders per slot. */
  capacity: number;
  /** The earliest slot is at least this many minutes away, so the bar has time to make it. */
  leadMinutes: number;
}

export const DEFAULT_PICKUP_SLOTS: PickupSlotSettings = { enabled: false, intervalMinutes: 15, capacity: 4, leadMinutes: 15 };
export const PICKUP_INTERVALS = [5, 10, 15, 20, 30, 60];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parsePickupSlots(raw: unknown): PickupSlotSettings {
  let value: Record<string, unknown> = {};
  if (typeof raw === 'string') { try { value = JSON.parse(raw) || {}; } catch { value = {}; } }
  else if (raw && typeof raw === 'object') value = raw as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const interval = Number(value.intervalMinutes);
  return {
    enabled: value.enabled === true,
    intervalMinutes: PICKUP_INTERVALS.includes(interval) ? interval : DEFAULT_PICKUP_SLOTS.intervalMinutes,
    capacity: int(value.capacity ?? DEFAULT_PICKUP_SLOTS.capacity, 1, 100, DEFAULT_PICKUP_SLOTS.capacity),
    leadMinutes: int(value.leadMinutes ?? DEFAULT_PICKUP_SLOTS.leadMinutes, 0, 240, DEFAULT_PICKUP_SLOTS.leadMinutes)
  };
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The slots still ahead in the café's current opening (today's, or last night's when it runs past midnight),
 * as ISO instants with their wall-clock label. Empty when slots are off or the café is closed today.
 */
export function pickupSlotTimes(openHours: string, timeZone: string, settings: PickupSlotSettings, now = new Date()): Array<{ at: string; label: string }> {
  if (!settings.enabled) return [];
  let hours: Record<string, { open?: string; close?: string; closed?: boolean }>;
  try { hours = JSON.parse(openHours); } catch { return []; }
  const today = cafeToday(timeZone, now);
  const earliest = now.getTime() + settings.leadMinutes * 60_000;
  const slots: Array<{ at: string; label: string }> = [];
  for (const date of [addDays(today, -1), today]) {
    const entry = hours?.[DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]];
    if (!entry || entry.closed || !TIME.test(entry.open || '') || !TIME.test(entry.close || '')) continue;
    const open = minutesOf(entry.open!);
    let close = minutesOf(entry.close!);
    if (close <= open) close += 24 * 60;
    for (let minute = open + settings.intervalMinutes; minute <= close; minute += settings.intervalMinutes) {
      const at = cafeInstant(addDays(date, Math.floor(minute / 1440)), hhmm(minute % 1440), timeZone);
      if (at.getTime() >= earliest && at.getTime() - now.getTime() < 86_400_000) slots.push({ at: at.toISOString(), label: hhmm(minute % 1440) });
    }
  }
  return slots.sort((a, b) => a.at.localeCompare(b.at)).filter((slot, index, all) => index === 0 || all[index - 1].at !== slot.at);
}

/** "08:30" in the café's time zone. */
export function pickupLabel(at: string, timeZone: string) {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at)); }
  catch { return at.slice(11, 16); }
}
