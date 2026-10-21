import type { Context, Hono } from 'hono';
import type { Env } from '../server';
import { normalizePhone } from './customers';
import { trackingToken } from './operations';
import { callTelegram, callTelegramForm, escapeHtml, formatBookingMessage, formatEventPost, getTelegramConfig, sendTelegramNotification } from './telegram';
import {
  addDays, bookingClosesAt, bookingState, cafeToday, calendarOf, daysBetween, describeOccurrence, isDateKey, isOccurrence, TIME_KEY,
  type BookingStatus, type CafeEvent, type EventBooking
} from '../utils/events';

type Row = Record<string, unknown>;
type StoredEvent = CafeEvent & { telegramChatId: string; telegramMessageId: number | null; telegramHasPhoto: boolean };

const EVENT_COLUMNS = `id, title, description, image_url AS imageUrl, location, tag, price_note AS priceNote, visibility, status,
  start_date AS startDate, end_date AS endDate, all_day AS allDay, start_time AS startTime, end_time AS endTime,
  recurrence, recurrence_until AS recurrenceUntil, skipped_dates AS skippedDates, booking_enabled AS bookingEnabled,
  capacity, max_party AS maxParty, cutoff_hours AS cutoffHours, telegram_chat_id AS telegramChatId, telegram_message_id AS telegramMessageId,
  telegram_has_photo AS telegramHasPhoto, telegram_posted_at AS telegramPostedAt, created_at AS createdAt, updated_at AS updatedAt`;
const BOOKING_COLUMNS = `id, event_id AS eventId, occurrence_date AS occurrenceDate, name, phone, customer_id AS customerId, seats, note, code,
  status, paid, source, created_at AS createdAt, updated_at AS updatedAt`;
const ACTIVE = "status != 'cancelled'";
/** Per phone, per occurrence, so one guest cannot hold every seat. */
const MAX_BOOKINGS_PER_PHONE = 3;
const BOOKING_ATTEMPTS_PER_HOUR = 20;

function toEvent(row: Row): StoredEvent {
  let skipped: unknown = [];
  try { skipped = JSON.parse(String(row.skippedDates || '[]')); } catch { /* Corrupt list: nothing skipped. */ }
  return {
    ...(row as unknown as StoredEvent),
    allDay: !!row.allDay, bookingEnabled: !!row.bookingEnabled, telegramHasPhoto: !!row.telegramHasPhoto,
    skippedDates: Array.isArray(skipped) ? skipped.filter(isDateKey) : [],
    capacity: Number(row.capacity) || 0, maxParty: Number(row.maxParty) || 1, cutoffHours: Number(row.cutoffHours) || 0
  };
}
/** What the browser sees; the Telegram message ids stay on the server. */
function publicEvent({ telegramChatId, telegramMessageId, telegramHasPhoto, ...event }: StoredEvent): CafeEvent {
  return event;
}
const toBooking = (row: Row): EventBooking => ({ ...(row as unknown as EventBooking), paid: !!row.paid, seats: Number(row.seats) });

const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length <= max ? value.trim() : null;

/** Validates a full event, given the saved one merged with the request. */
function validateEvent(input: Row): { error: string } | { event: Omit<CafeEvent, 'id' | 'telegramPostedAt' | 'createdAt' | 'updatedAt'> } {
  const title = text(input.title, 120);
  if (!title) return { error: 'Enter a title up to 120 characters.' };
  const description = text(input.description ?? '', 4000);
  if (description === null) return { error: 'The description can be up to 4,000 characters.' };
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
  if (imageUrl && !(/^https?:\/\/\S{1,2000}$/.test(imageUrl) || (/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(imageUrl) && imageUrl.length <= 1_000_000))) {
    return { error: 'Use an uploaded image or an http(s) image link.' };
  }
  const location = text(input.location ?? '', 120), tag = text(input.tag ?? '', 40), priceNote = text(input.priceNote ?? '', 80);
  if (location === null || tag === null || priceNote === null) return { error: 'Location, tag or price note is too long.' };
  const visibility = input.visibility === 'internal' ? 'internal' : input.visibility === 'public' ? 'public' : null;
  const status = ['draft', 'published', 'cancelled'].includes(String(input.status)) ? input.status as CafeEvent['status'] : null;
  if (!visibility || !status) return { error: 'Choose who sees the event and its status.' };

  const startDate = input.startDate, endDate = input.endDate || input.startDate;
  if (!isDateKey(startDate) || !isDateKey(endDate)) return { error: 'Choose valid dates.' };
  const span = daysBetween(startDate, endDate);
  if (span < 0) return { error: 'The event cannot end before it starts.' };
  if (span > 31) return { error: 'An event can span up to 31 days.' };
  const allDay = !!input.allDay;
  const startTime = allDay ? '' : String(input.startTime || '');
  const endTime = allDay ? '' : String(input.endTime || '');
  if (!allDay && !TIME_KEY.test(startTime)) return { error: 'Enter a start time, or mark the event all day.' };
  if (endTime && !TIME_KEY.test(endTime)) return { error: 'Enter a valid end time.' };
  if (!allDay && endTime && span === 0 && endTime <= startTime) return { error: 'The end time must be after the start time.' };

  const recurrence = ['none', 'weekly', 'monthly'].includes(String(input.recurrence)) ? input.recurrence as CafeEvent['recurrence'] : 'none';
  const recurrenceUntil = recurrence === 'none' ? '' : String(input.recurrenceUntil || '');
  if (recurrenceUntil && (!isDateKey(recurrenceUntil) || recurrenceUntil < startDate)) return { error: 'The repeat end date must be on or after the first date.' };
  if ((recurrence === 'weekly' && span >= 7) || (recurrence === 'monthly' && span >= 28)) return { error: 'A repeating event must end before its next repeat starts.' };
  const skipped = Array.isArray(input.skippedDates) ? input.skippedDates : [];
  if (skipped.length > 500 || !skipped.every(isDateKey)) return { error: 'Invalid skipped dates.' };

  const bookingEnabled = visibility === 'public' && !!input.bookingEnabled;
  const capacity = Number(input.capacity ?? 0), maxParty = Number(input.maxParty ?? 6), cutoffHours = Number(input.cutoffHours ?? 0);
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 10000) return { error: 'Capacity must be a whole number from 0 (unlimited) to 10,000.' };
  if (!Number.isInteger(maxParty) || maxParty < 1 || maxParty > 100) return { error: 'Seats per booking must be from 1 to 100.' };
  if (!Number.isFinite(cutoffHours) || cutoffHours < 0 || cutoffHours > 720) return { error: 'The booking cutoff must be from 0 to 720 hours.' };

  return { event: {
    title, description, imageUrl, location, tag, priceNote, visibility, status, startDate, endDate, allDay, startTime, endTime,
    recurrence, recurrenceUntil, skippedDates: [...new Set(skipped as string[])].sort(), bookingEnabled, capacity, maxParty, cutoffHours
  } };
}

async function cafeConfig(db: D1Database) {
  const row = await db.prepare('SELECT time_zone, calendar_system FROM settings WHERE id = ?').bind('cafe_config').first<Row>();
  return { timeZone: String(row?.time_zone || 'Asia/Tehran'), calendar: calendarOf(row?.calendar_system) };
}

async function loadEvent(db: D1Database, id: string) {
  const row = await db.prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ?`).bind(id).first<Row>();
  return row ? toEvent(row) : null;
}

async function seatsTaken(db: D1Database, eventId: string, date: string) {
  const row = await db.prepare(`SELECT COALESCE(SUM(seats), 0) AS seats FROM event_bookings WHERE event_id = ? AND occurrence_date = ? AND ${ACTIVE}`).bind(eventId, date).first<{ seats: number }>();
  return Number(row?.seats || 0);
}

/** The public menu's address, also when the request came from the admin or panel subdomain. */
function publicOrigin(c: Context<Env>) {
  const url = new URL(c.req.url);
  const devHost = c.env.CAFE_DEV_PROXY === 'true' && url.protocol === 'http:' ? c.req.header('X-Cafe-Dev-Host') : undefined;
  return `${url.protocol}//${(devHost || url.host).replace(/^(admin|panel)\./, '')}`;
}
const eventLink = (c: Context<Env>, id: string) => `${publicOrigin(c)}/#event-${id}`;

const later = (c: Context<Env>, work: Promise<unknown>) => {
  const guarded = work.catch(error => console.warn('[Events] Background task failed:', error));
  try { c.executionCtx.waitUntil(guarded); } catch { /* No execution context in tests. */ }
};

/* -------------------------------------------------------------- Telegram */

function photoPayload(imageUrl: string): Blob | string | null {
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(imageUrl);
  if (!match) return null;
  const bytes = Uint8Array.from(atob(match[2]), ch => ch.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

async function sendEventPost(env: Env['Bindings'], event: StoredEvent, link: string) {
  const config = await getTelegramConfig(env);
  if (!config.botToken || !config.eventsChatId) return { success: false, error: 'Add a bot token and an events chat ID in Settings first.' };
  const photo = photoPayload(event.imageUrl);
  let result;
  if (photo instanceof Blob) {
    const form = new FormData();
    form.append('chat_id', config.eventsChatId);
    form.append('caption', formatEventPost(event, config, link, 1024));
    form.append('parse_mode', 'HTML');
    form.append('photo', photo, 'event.webp');
    result = await callTelegramForm(config.botToken, 'sendPhoto', form);
  } else if (photo) {
    result = await callTelegram(config.botToken, 'sendPhoto', { chat_id: config.eventsChatId, photo, caption: formatEventPost(event, config, link, 1024), parse_mode: 'HTML' });
  } else {
    result = await callTelegram(config.botToken, 'sendMessage', { chat_id: config.eventsChatId, text: formatEventPost(event, config, link), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  }
  if (!result.success) return { success: false, error: result.error };
  return { success: true, chatId: config.eventsChatId, messageId: Number(result.result?.message_id), hasPhoto: !!photo };
}

/** Keeps a posted announcement in step with the event: edited, marked cancelled, or removed when it stops being public. */
async function syncEventPost(env: Env['Bindings'], before: StoredEvent, after: StoredEvent | null, link: string) {
  if (!before.telegramMessageId || !before.telegramChatId) return;
  const config = await getTelegramConfig(env);
  if (!config.botToken) return;
  const target = { chat_id: before.telegramChatId, message_id: before.telegramMessageId };
  if (!after || after.visibility !== 'public' || after.status === 'draft') {
    await callTelegram(config.botToken, 'deleteMessage', target);
    return;
  }
  const edit = before.telegramHasPhoto
    ? await callTelegram(config.botToken, 'editMessageCaption', { ...target, caption: formatEventPost(after, config, link, 1024), parse_mode: 'HTML' })
    : await callTelegram(config.botToken, 'editMessageText', { ...target, text: formatEventPost(after, config, link), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  if (!edit.success && !/not modified/i.test(edit.error || '')) console.warn('[Events] Telegram edit failed:', edit.error);
  if (after.status === 'cancelled' && before.status !== 'cancelled') {
    await callTelegram(config.botToken, 'sendMessage', {
      chat_id: before.telegramChatId, parse_mode: 'HTML', reply_parameters: { message_id: before.telegramMessageId, allow_sending_without_reply: true },
      text: `❌ <b>${escapeHtml(after.title)}</b> is cancelled. We’re sorry, and hope to see you soon.`
    });
  }
}

const notifyBooking = (c: Context<Env>, action: 'new' | 'cancelled', booking: EventBooking, event: CafeEvent) =>
  later(c, sendTelegramNotification(c.env, config => formatBookingMessage(action, booking, event, config), 'bookings'));

/* ---------------------------------------------------------------- Routes */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const bookingCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

export function registerEvents(app: Hono<Env>) {
  /** Published and cancelled public events, with the seats already taken on upcoming dates. */
  app.get('/api/events/public', async c => {
    const db = c.env.DB;
    const { timeZone } = await cafeConfig(db);
    const today = cafeToday(timeZone);
    const since = addDays(today, -400);
    const { results } = await db.prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE visibility = 'public' AND status != 'draft'
      AND (end_date >= ? OR (recurrence != 'none' AND (recurrence_until = '' OR recurrence_until >= ?))) ORDER BY start_date`).bind(since, since).all<Row>();
    const { results: seats } = await db.prepare(`SELECT b.event_id AS eventId, b.occurrence_date AS date, SUM(b.seats) AS seats FROM event_bookings b
      JOIN events e ON e.id = b.event_id WHERE e.visibility = 'public' AND b.${ACTIVE} AND b.occurrence_date >= ? GROUP BY b.event_id, b.occurrence_date`).bind(addDays(today, -1)).all<Row>();
    return c.json({ data: results.map(row => publicEvent(toEvent(row))), seats: seats.map(s => ({ eventId: s.eventId, date: s.date, seats: Number(s.seats) })) });
  });

  /** Everything, for the admin editor and the panel's read-only list. */
  app.get('/api/events', async c => {
    const { results } = await c.env.DB.prepare(`SELECT ${EVENT_COLUMNS} FROM events ORDER BY start_date DESC`).all<Row>();
    const { results: seats } = await c.env.DB.prepare(`SELECT event_id AS eventId, occurrence_date AS date, SUM(seats) AS seats, COUNT(*) AS bookings,
      SUM(CASE WHEN status = 'checked_in' THEN seats ELSE 0 END) AS checkedIn FROM event_bookings WHERE ${ACTIVE} GROUP BY event_id, occurrence_date`).all<Row>();
    return c.json({
      data: results.map(row => publicEvent(toEvent(row))),
      seats: seats.map(s => ({ eventId: s.eventId, date: s.date, seats: Number(s.seats), bookings: Number(s.bookings), checkedIn: Number(s.checkedIn) }))
    });
  });

  app.post('/api/events', async c => {
    const checked = validateEvent(await c.req.json());
    if ('error' in checked) return c.json({ success: false, message: checked.error }, 400);
    const e = checked.event;
    const now = new Date().toISOString();
    const id = `evt-${crypto.randomUUID()}`;
    await c.env.DB.prepare(`INSERT INTO events (id, title, description, image_url, location, tag, price_note, visibility, status, start_date, end_date, all_day,
      start_time, end_time, recurrence, recurrence_until, skipped_dates, booking_enabled, capacity, max_party, cutoff_hours, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      id, e.title, e.description, e.imageUrl, e.location, e.tag, e.priceNote, e.visibility, e.status, e.startDate, e.endDate, e.allDay ? 1 : 0,
      e.startTime, e.endTime, e.recurrence, e.recurrenceUntil, JSON.stringify(e.skippedDates), e.bookingEnabled ? 1 : 0, e.capacity, e.maxParty, e.cutoffHours, now, now
    ).run();
    return c.json({ success: true, data: publicEvent((await loadEvent(c.env.DB, id))!) });
  });

  app.put('/api/events/:id', async c => {
    const before = await loadEvent(c.env.DB, c.req.param('id'));
    if (!before) return c.json({ success: false, message: 'Event not found.' }, 404);
    const body = await c.req.json();
    const checked = validateEvent({ ...before, ...body });
    if ('error' in checked) return c.json({ success: false, message: checked.error }, 400);
    const e = checked.event;
    const updatedAt = new Date().toISOString();
    // Skipping a date closes its bookings; they stay in the list as cancelled.
    const newlySkipped = e.skippedDates.filter(date => !before.skippedDates.includes(date));
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE events SET title = ?, description = ?, image_url = ?, location = ?, tag = ?, price_note = ?, visibility = ?, status = ?, start_date = ?,
        end_date = ?, all_day = ?, start_time = ?, end_time = ?, recurrence = ?, recurrence_until = ?, skipped_dates = ?, booking_enabled = ?, capacity = ?,
        max_party = ?, cutoff_hours = ?, updated_at = ? WHERE id = ?`).bind(
        e.title, e.description, e.imageUrl, e.location, e.tag, e.priceNote, e.visibility, e.status, e.startDate, e.endDate, e.allDay ? 1 : 0, e.startTime,
        e.endTime, e.recurrence, e.recurrenceUntil, JSON.stringify(e.skippedDates), e.bookingEnabled ? 1 : 0, e.capacity, e.maxParty, e.cutoffHours, updatedAt, before.id),
      ...newlySkipped.map(date => c.env.DB.prepare(`UPDATE event_bookings SET status = 'cancelled', updated_at = ? WHERE event_id = ? AND occurrence_date = ? AND ${ACTIVE}`).bind(updatedAt, before.id, date))
    ]);
    const after = (await loadEvent(c.env.DB, before.id))!;
    // A post that is no longer public is deleted, so forget it and let a later publish post afresh.
    if (before.telegramMessageId && (after.visibility !== 'public' || after.status === 'draft')) {
      await c.env.DB.prepare("UPDATE events SET telegram_message_id = NULL, telegram_chat_id = '', telegram_posted_at = '' WHERE id = ?").bind(before.id).run();
      after.telegramPostedAt = '';
    }
    later(c, syncEventPost(c.env, before, after, eventLink(c, before.id)));
    return c.json({ success: true, data: publicEvent(after) });
  });

  // Bookings are history; an event that has any is cancelled instead.
  app.delete('/api/events/:id', async c => {
    const event = await loadEvent(c.env.DB, c.req.param('id'));
    if (!event) return c.json({ success: true });
    const booked = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM event_bookings WHERE event_id = ?').bind(event.id).first<{ n: number }>();
    if (Number(booked?.n)) return c.json({ success: false, message: 'This event has bookings. Cancel it instead, so the booking history is kept.' }, 409);
    await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(event.id).run();
    later(c, syncEventPost(c.env, event, null, ''));
    return c.json({ success: true });
  });

  app.post('/api/events/:id/telegram', async c => {
    const event = await loadEvent(c.env.DB, c.req.param('id'));
    if (!event) return c.json({ success: false, message: 'Event not found.' }, 404);
    if (event.visibility !== 'public' || event.status !== 'published') return c.json({ success: false, message: 'Only published public events can be posted.' }, 400);
    const sent = await sendEventPost(c.env, event, eventLink(c, event.id));
    if (!sent.success) return c.json({ success: false, message: sent.error || 'Telegram did not accept the post.' }, 502);
    const postedAt = new Date().toISOString();
    await c.env.DB.prepare('UPDATE events SET telegram_chat_id = ?, telegram_message_id = ?, telegram_has_photo = ?, telegram_posted_at = ? WHERE id = ?')
      .bind(sent.chatId, sent.messageId, sent.hasPhoto ? 1 : 0, postedAt, event.id).run();
    return c.json({ success: true, data: { telegramPostedAt: postedAt } });
  });

  /* ---------------------------------------------------------- Bookings */

  app.get('/api/event-bookings', async c => {
    const eventId = c.req.query('eventId') || '', date = c.req.query('date') || '';
    if (!eventId) return c.json({ success: false, message: 'Choose an event.' }, 400);
    const { results } = await c.env.DB.prepare(`SELECT ${BOOKING_COLUMNS} FROM event_bookings WHERE event_id = ? ${date ? 'AND occurrence_date = ?' : ''} ORDER BY occurrence_date, created_at`)
      .bind(...(date ? [eventId, date] : [eventId])).all<Row>();
    return c.json({ data: results.map(toBooking) });
  });

  /** Public sign-up, or a booking staff add from the admin, which may be past the cutoff. */
  app.post('/api/events/:id/bookings', async c => {
    const db = c.env.DB;
    const staff = c.get('authed') && c.get('workspace') === 'admin';
    const body = await c.req.json();
    if (!staff) {
      // Bots fill every field, including the one people never see.
      if (body.website) return c.json({ success: false, message: 'The booking could not be made.' }, 400);
      const key = `event-booking:${c.req.header('CF-Connecting-IP') || 'local'}`;
      const attempts = c.env.KV ? Number(await c.env.KV.get(key) || 0) : 0;
      if (attempts >= BOOKING_ATTEMPTS_PER_HOUR) return c.json({ success: false, message: 'Too many bookings from this connection. Please try again later or call the café.' }, 429);
      if (c.env.KV) await c.env.KV.put(key, String(attempts + 1), { expirationTtl: 3600 });
    }
    const event = await loadEvent(db, c.req.param('id'));
    if (!event || (!staff && (event.visibility !== 'public' || event.status === 'draft'))) return c.json({ success: false, message: 'Event not found.' }, 404);
    const date = String(body.date || '');
    const name = text(body.name, 100), note = text(body.note ?? '', 500), phone = normalizePhone(body.phone);
    const seats = Number(body.seats);
    if (!name) return c.json({ success: false, message: 'Enter your name.' }, 400);
    if (phone.replace('+', '').length < 5 || phone.length > 21) return c.json({ success: false, message: 'Enter a phone number with 5 to 20 digits.' }, 400);
    if (note === null) return c.json({ success: false, message: 'The note can be up to 500 characters.' }, 400);
    if (!Number.isInteger(seats) || seats < 1 || seats > event.maxParty) return c.json({ success: false, message: `Book 1 to ${event.maxParty} seats.` }, 400);

    const { timeZone } = await cafeConfig(db);
    if (staff) {
      if (!event.bookingEnabled) return c.json({ success: false, message: 'Turn on bookings for this event first.' }, 400);
      if (event.status === 'cancelled') return c.json({ success: false, message: 'This event is cancelled.' }, 400);
      if (!isOccurrence(event, date)) return c.json({ success: false, message: 'The event does not run on that date.' }, 400);
    } else {
      const state = bookingState(event, date, await seatsTaken(db, event.id, date), timeZone);
      if (!state.open) return c.json({ success: false, message: state.reason }, 409);
    }

    const member = await db.prepare('SELECT id FROM customers WHERE phone = ?').bind(phone).first<{ id: string }>();
    const now = new Date().toISOString();
    const id = `bkg-${crypto.randomUUID()}`;
    // Capacity and the per-phone limit are checked inside the insert, so two guests cannot take the last seat together.
    const insert = (code: string) => db.prepare(`INSERT INTO event_bookings (id, event_id, occurrence_date, name, phone, customer_id, seats, note, code, status, paid, source, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 0, ?, ?, ?
      WHERE (? = 0 OR (SELECT COALESCE(SUM(seats), 0) FROM event_bookings WHERE event_id = ? AND occurrence_date = ? AND ${ACTIVE}) + ? <= ?)
      AND (? OR (SELECT COUNT(*) FROM event_bookings WHERE event_id = ? AND occurrence_date = ? AND phone = ? AND ${ACTIVE}) < ?)`).bind(
      id, event.id, date, name, phone, member?.id ?? null, seats, note, code, staff ? 'staff' : 'public', now, now,
      event.capacity, event.id, date, seats, event.capacity,
      staff ? 1 : 0, event.id, date, phone, MAX_BOOKINGS_PER_PHONE
    ).run();
    // A clash on the short code is rare; draw another.
    const insertWithFreshCode = async (attempt = 0): Promise<D1Result> => {
      try { return await insert(bookingCode()); }
      catch (error) { if (attempt >= 4 || !String(error).includes('UNIQUE')) throw error; return insertWithFreshCode(attempt + 1); }
    };
    const result = await insertWithFreshCode();
    if (!result.meta.changes) {
      const taken = await seatsTaken(db, event.id, date);
      if (event.capacity && taken + seats > event.capacity) {
        const left = event.capacity - taken;
        return c.json({ success: false, message: left > 0 ? `Only ${left} ${left === 1 ? 'seat is' : 'seats are'} left.` : 'Fully booked.' }, 409);
      }
      return c.json({ success: false, message: `This phone number already has ${MAX_BOOKINGS_PER_PHONE} bookings for this date.` }, 409);
    }
    const booking = toBooking((await db.prepare(`SELECT ${BOOKING_COLUMNS} FROM event_bookings WHERE id = ?`).bind(id).first<Row>())!);
    notifyBooking(c, 'new', booking, event);
    return c.json({ success: true, data: booking, token: staff ? undefined : await trackingToken(id, c.env.SESSION_SECRET) });
  });

  /** Confirm, check in, mark paid, or cancel. The panel may only check guests in and record payment. */
  app.put('/api/event-bookings/:id', async c => {
    const db = c.env.DB;
    const row = await db.prepare(`SELECT ${BOOKING_COLUMNS} FROM event_bookings WHERE id = ?`).bind(c.req.param('id')).first<Row>();
    if (!row) return c.json({ success: false, message: 'Booking not found.' }, 404);
    const booking = toBooking(row);
    const body = await c.req.json();
    const status: BookingStatus = body.status ?? booking.status;
    if (!['confirmed', 'cancelled', 'checked_in'].includes(status)) return c.json({ success: false, message: 'Invalid booking status.' }, 400);
    if (c.get('workspace') === 'panel' && (status === 'cancelled') !== (booking.status === 'cancelled')) return c.json({ success: false, message: 'Only the admin can cancel or restore bookings.' }, 403);
    const event = (await loadEvent(db, booking.eventId))!;
    if (booking.status === 'cancelled' && status !== 'cancelled' && event.capacity && await seatsTaken(db, event.id, booking.occurrenceDate) + booking.seats > event.capacity) {
      return c.json({ success: false, message: 'There are not enough seats left to restore this booking.' }, 409);
    }
    const paid = body.paid === undefined ? booking.paid : !!body.paid;
    const updatedAt = new Date().toISOString();
    await db.prepare('UPDATE event_bookings SET status = ?, paid = ?, updated_at = ? WHERE id = ?').bind(status, paid ? 1 : 0, updatedAt, booking.id).run();
    const updated = { ...booking, status, paid, updatedAt };
    if (status === 'cancelled' && booking.status !== 'cancelled') notifyBooking(c, 'cancelled', updated, event);
    return c.json({ success: true, data: updated });
  });

  async function guestBooking(c: Context<Env>, token: unknown) {
    const id = c.req.param('id') || '';
    if (typeof token !== 'string' || token !== await trackingToken(id, c.env.SESSION_SECRET)) return null;
    const row = await c.env.DB.prepare(`SELECT ${BOOKING_COLUMNS} FROM event_bookings WHERE id = ?`).bind(id).first<Row>();
    return row ? toBooking(row) : null;
  }

  app.get('/api/event-bookings/:id/status', async c => {
    const booking = await guestBooking(c, c.req.query('token'));
    if (!booking) return c.json({ success: false, message: 'Booking not found.' }, 404);
    return c.json({ data: { id: booking.id, status: booking.status, seats: booking.seats, code: booking.code } });
  });

  app.post('/api/event-bookings/:id/cancel', async c => {
    const booking = await guestBooking(c, (await c.req.json()).token);
    if (!booking) return c.json({ success: false, message: 'Booking not found.' }, 404);
    if (booking.status === 'cancelled') return c.json({ success: true });
    if (booking.status === 'checked_in') return c.json({ success: false, message: 'You have already checked in.' }, 409);
    const event = (await loadEvent(c.env.DB, booking.eventId))!;
    const { timeZone, calendar } = await cafeConfig(c.env.DB);
    if (new Date() >= bookingClosesAt(event, booking.occurrenceDate, timeZone)) {
      return c.json({ success: false, message: `Bookings for ${describeOccurrence(event, booking.occurrenceDate, calendar)} can no longer be changed online. Please call the café.` }, 409);
    }
    const updatedAt = new Date().toISOString();
    await c.env.DB.prepare("UPDATE event_bookings SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(updatedAt, booking.id).run();
    notifyBooking(c, 'cancelled', { ...booking, status: 'cancelled', updatedAt }, event);
    return c.json({ success: true });
  });
}
