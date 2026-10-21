/**
 * Café events: occurrence expansion, booking windows and calendar formatting.
 * Pure and shared by the Worker and the browser. Dates are café wall-clock "YYYY-MM-DD" keys,
 * so date arithmetic runs in UTC and never shifts with the device's own time zone.
 */

export type EventVisibility = 'public' | 'internal';
export type EventStatus = 'draft' | 'published' | 'cancelled';
export type EventRecurrence = 'none' | 'weekly' | 'monthly';
export type BookingStatus = 'confirmed' | 'cancelled' | 'checked_in';

export interface CafeEvent {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  location: string;
  tag: string;
  priceNote: string;
  visibility: EventVisibility;
  status: EventStatus;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  recurrence: EventRecurrence;
  recurrenceUntil: string;
  skippedDates: string[];
  bookingEnabled: boolean;
  /** 0 means unlimited. */
  capacity: number;
  maxParty: number;
  cutoffHours: number;
  telegramPostedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventBooking {
  id: string;
  eventId: string;
  occurrenceDate: string;
  name: string;
  phone: string;
  customerId: string | null;
  seats: number;
  note: string;
  code: string;
  status: BookingStatus;
  paid: boolean;
  source: 'public' | 'staff';
  createdAt: string;
  updatedAt: string;
}

export interface Occurrence {
  event: CafeEvent;
  /** Identifies the occurrence; bookings and skips refer to it. */
  date: string;
  endDate: string;
}

const DAY = 86_400_000;
export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_KEY = /^([01]\d|2[0-3]):[0-5]\d$/;

const keyToUTC = (key: string) => Date.parse(`${key}T00:00:00Z`);
const utcToKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (key: string, days: number) => utcToKey(keyToUTC(key) + days * DAY);
export const daysBetween = (from: string, to: string) => Math.round((keyToUTC(to) - keyToUTC(from)) / DAY);
export const isDateKey = (value: unknown): value is string => typeof value === 'string' && DATE_KEY.test(value) && utcToKey(keyToUTC(value)) === value;

/** The same day of the month, `months` later; null when that month is too short (a 31st in April). */
function addMonths(key: string, months: number): string | null {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.getUTCDate() === d ? utcToKey(date.getTime()) : null;
}

/**
 * Every occurrence overlapping [from, to] (inclusive date keys), in order.
 * Multi-day events keep their length on each repeat; skipped dates are left out.
 */
export function expandOccurrences(event: CafeEvent, from: string, to: string): Occurrence[] {
  const span = Math.max(0, daysBetween(event.startDate, event.endDate || event.startDate));
  const skipped = new Set(event.skippedDates);
  const result: Occurrence[] = [];
  const consider = (date: string) => {
    const endDate = addDays(date, span);
    if (endDate >= from && date <= to && !skipped.has(date)) result.push({ event, date, endDate });
  };
  if (event.recurrence === 'none') { consider(event.startDate); return result; }
  const until = event.recurrenceUntil && event.recurrenceUntil < to ? event.recurrenceUntil : to;
  if (event.recurrence === 'weekly') {
    // Jump straight to the first repeat that can still overlap the window.
    const first = Math.max(0, Math.floor((daysBetween(event.startDate, from) - span) / 7));
    for (let n = first; ; n++) {
      const date = addDays(event.startDate, n * 7);
      if (date > until) break;
      consider(date);
    }
  } else {
    const [sy, sm] = event.startDate.split('-').map(Number);
    const [fy, fm] = from.split('-').map(Number);
    // Monthly events span at most a few days, so starting two months early never misses an overlap.
    const first = Math.max(0, (fy - sy) * 12 + (fm - sm) - 2);
    for (let n = first; n < first + 1200; n++) {
      const date = addMonths(event.startDate, n);
      if (date === null) continue;
      if (date > until) break;
      consider(date);
    }
  }
  return result;
}

/** Whether `date` is a real (not skipped) occurrence start of the event. */
export function isOccurrence(event: CafeEvent, date: string) {
  return isDateKey(date) && expandOccurrences(event, date, date).some(o => o.date === date);
}

/* ------------------------------------------------------------ Time zones */

function wallClock(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
}

/** The instant a café wall-clock date and time happens. */
export function cafeInstant(date: string, time: string, timeZone: string): Date {
  const wall = Date.parse(`${date}T${time || '00:00'}:00Z`);
  try {
    const first = wall - (wallClock(wall, timeZone) - wall);
    const second = wall - (wallClock(first, timeZone) - first);
    // A time skipped by a clock change resolves to just after the jump, as clocks read it.
    return new Date(wallClock(second, timeZone) === wall ? second : Math.max(first, second));
  } catch { return new Date(wall); /* Invalid zone: treat as UTC. */ }
}

export function cafeToday(timeZone: string, now = new Date()): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  catch { return now.toISOString().slice(0, 10); }
}

export function occurrenceStart(event: CafeEvent, date: string, timeZone: string) {
  return cafeInstant(date, event.allDay ? '00:00' : event.startTime, timeZone);
}

export function occurrenceEnd(event: CafeEvent, date: string, timeZone: string) {
  const endDate = addDays(date, Math.max(0, daysBetween(event.startDate, event.endDate || event.startDate)));
  return event.allDay || !event.endTime ? cafeInstant(addDays(endDate, 1), '00:00', timeZone) : cafeInstant(endDate, event.endTime, timeZone);
}

/** Bookings and customer cancellations close `cutoffHours` before the start. */
export function bookingClosesAt(event: CafeEvent, date: string, timeZone: string) {
  return new Date(occurrenceStart(event, date, timeZone).getTime() - Math.max(0, event.cutoffHours) * 3_600_000);
}

export type BookingState = { open: true; seatsLeft: number | null } | { open: false; reason: string };

export function bookingState(event: CafeEvent, date: string, seatsTaken: number, timeZone: string, now = new Date()): BookingState {
  if (!event.bookingEnabled || event.visibility !== 'public') return { open: false, reason: 'This event does not take bookings.' };
  if (event.status !== 'published') return { open: false, reason: event.status === 'cancelled' ? 'This event is cancelled.' : 'This event is not published.' };
  if (!isOccurrence(event, date)) return { open: false, reason: 'The event does not run on that date.' };
  if (now >= bookingClosesAt(event, date, timeZone)) return { open: false, reason: 'Bookings for this date have closed.' };
  if (!event.capacity) return { open: true, seatsLeft: null };
  const seatsLeft = Math.max(0, event.capacity - seatsTaken);
  return seatsLeft > 0 ? { open: true, seatsLeft } : { open: false, reason: 'Fully booked.' };
}

/* ------------------------------------------------------------- Calendars */

export const CALENDAR_SYSTEMS = [
  { id: 'gregory', label: 'Gregorian' },
  { id: 'persian', label: 'Persian (Solar Hijri)' },
  { id: 'islamic-umalqura', label: 'Islamic (Hijri)' },
  { id: 'hebrew', label: 'Hebrew' },
  { id: 'indian', label: 'Indian national' },
  { id: 'buddhist', label: 'Buddhist' }
] as const;
export type CalendarSystem = (typeof CALENDAR_SYSTEMS)[number]['id'];
export const isCalendarSystem = (value: unknown): value is CalendarSystem => CALENDAR_SYSTEMS.some(c => c.id === value);
export const calendarOf = (value: unknown): CalendarSystem => isCalendarSystem(value) ? value : 'gregory';

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(calendar: CalendarSystem, options: Intl.DateTimeFormatOptions) {
  const key = calendar + JSON.stringify(options);
  let f = formatters.get(key);
  if (!f) {
    try { f = new Intl.DateTimeFormat(`en-u-ca-${calendar}`, { ...options, timeZone: 'UTC' }); }
    catch { f = new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }); }
    formatters.set(key, f);
  }
  return f;
}

/** A date key written in a calendar, e.g. "Tue, Mehr 29, 1405 AP". */
export function formatDateKey(key: string, calendar: CalendarSystem, style: 'long' | 'medium' | 'short' = 'medium') {
  const options: Intl.DateTimeFormatOptions = style === 'short' ? { day: 'numeric', month: 'short' }
    : style === 'medium' ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  return formatter(calendar, options).format(new Date(keyToUTC(key)));
}

/** Day and month numbers of a date key in a calendar, for building that calendar's month grid. */
export function calendarParts(key: string, calendar: CalendarSystem) {
  const parts = formatter(calendar, { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(keyToUTC(key)));
  const part = (type: string) => parts.find(p => p.type === type)?.value || '';
  // Some calendars (Hebrew) name months even when asked for numbers, so the month is compared as text.
  return { year: part('year') || part('relatedYear'), month: part('month'), day: Number(part('day').replace(/\D/g, '')) || 0 };
}

export function monthTitle(key: string, calendar: CalendarSystem) {
  return formatter(calendar, { month: 'long', year: 'numeric' }).format(new Date(keyToUTC(key)));
}

/** First and last date keys of the calendar month containing `key`, in any calendar. */
export function monthBounds(key: string, calendar: CalendarSystem): { first: string; last: string } {
  let first = key;
  for (let i = 0; i < 40 && calendarParts(first, calendar).day !== 1; i++) first = addDays(first, -1);
  const month = calendarParts(first, calendar).month;
  let last = first;
  for (let i = 0; i < 40 && calendarParts(addDays(last, 1), calendar).month === month; i++) last = addDays(last, 1);
  return { first, last };
}

/** Persian and Islamic weeks start on Saturday, Hebrew on Sunday, the rest on Monday. 0 is Sunday. */
export const weekStart = (calendar: CalendarSystem) => calendar === 'persian' || calendar.startsWith('islamic') ? 6 : calendar === 'hebrew' ? 0 : 1;

/** The weeks of a month as rows of seven date keys, padded with neighbouring days. */
export function monthGrid(key: string, calendar: CalendarSystem): string[][] {
  const { first, last } = monthBounds(key, calendar);
  const lead = (new Date(keyToUTC(first)).getUTCDay() - weekStart(calendar) + 7) % 7;
  let day = addDays(first, -lead);
  const weeks: string[][] = [];
  while (day <= last) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
    weeks.push(week);
  }
  return weeks;
}

export function weekdayLabels(calendar: CalendarSystem) {
  const start = weekStart(calendar);
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + (start + i) % 7))));
}

export function formatTimeRange(event: Pick<CafeEvent, 'allDay' | 'startTime' | 'endTime'>) {
  if (event.allDay) return 'All day';
  return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
}

/** "Fri, 29 Mehr 1405 AP · 19:00–21:00", with the secondary calendar in brackets when one is set. */
export function describeOccurrence(event: CafeEvent, date: string, calendar: CalendarSystem, secondary?: CalendarSystem | '') {
  const endDate = addDays(date, Math.max(0, daysBetween(event.startDate, event.endDate || event.startDate)));
  const range = (cal: CalendarSystem) => endDate === date ? formatDateKey(date, cal) : `${formatDateKey(date, cal)} – ${formatDateKey(endDate, cal)}`;
  const second = secondary && secondary !== calendar ? ` (${range(secondary)})` : '';
  return `${range(calendar)}${second} · ${formatTimeRange(event)}`;
}

export function describeRecurrence(event: CafeEvent, calendar: CalendarSystem) {
  if (event.recurrence === 'none') return '';
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(new Date(keyToUTC(event.startDate)));
  const base = event.recurrence === 'weekly' ? `Every ${weekday}` : `Monthly on day ${Number(event.startDate.slice(8))}`;
  return event.recurrenceUntil ? `${base} until ${formatDateKey(event.recurrenceUntil, calendar, 'short')}` : base;
}
