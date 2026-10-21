import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from 'miniflare';

// The Bot API is mocked: every outbound call is recorded and answered with a message id.
const calls = [];
let nextMessageId = 500;
const outboundService = async request => {
  const url = new URL(request.url);
  if (url.hostname !== 'api.telegram.org') return new Response('blocked', { status: 502 });
  const method = url.pathname.split('/').pop();
  const body = (request.headers.get('content-type') || '').includes('multipart')
    ? Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, typeof v === 'string' ? v : `<file ${v.type}>`]))
    : await request.json();
  calls.push({ method, body });
  return Response.json({ ok: true, result: { message_id: nextMessageId++ } });
};

const bundle = await build({ entryPoints: ['src/server.ts'], bundle: true, format: 'esm', platform: 'browser', write: false });
const mf = new Miniflare(convertV4MiniflareOptions({
  log: new Log(LogLevel.NONE), modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2025-01-01',
  d1Databases: { DB: 'events-cafe' }, kvNamespaces: ['KV'], outboundService,
  bindings: { ADMIN_PASSWORD: 'test-admin-password', PANEL_PASSWORD: 'test-panel-password', SESSION_SECRET: 'test-session-secret-with-at-least-32-characters', CAFE_DEV_PROXY: 'true' },
}));
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const ok = value => { assert.ok(value); checks++; };
const settle = () => new Promise(resolve => setTimeout(resolve, 100));
const take = () => calls.splice(0);

const call = (host, path, body, cookie = '', method) => mf.dispatchFetch(`http://${host}${path}`, {
  method: method || (body === undefined ? 'GET' : 'POST'),
  headers: { 'Content-Type': 'application/json', Cookie: cookie, 'CF-Connecting-IP': '203.0.113.9' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
const login = async (host, password) => (await call(host, '/api/auth/login', { password })).headers.get('set-cookie').split(';')[0];
const json = async response => ({ status: response.status, body: await response.json() });

const iso = date => date.toISOString().slice(0, 10);
const inDays = n => iso(new Date(Date.now() + n * 86_400_000));

try {
  const db = await mf.getD1Database('DB');
  // Start from a database without the event settings columns, so the Worker adds them.
  const schema = (await readFile('schema.sql', 'utf8')).replace(/^--.*$/gm, '').replace(/  (calendar_system|secondary_calendar|telegram_events_chat_id|notify_bookings) [^\n]*\n/g, '');
  for (const sql of schema.match(/CREATE TRIGGER[\s\S]*?\nEND;|CREATE TABLE[\s\S]*?;|INSERT[\s\S]*?;/g)) if (!/CREATE TABLE IF NOT EXISTS (events|event_bookings)/.test(sql)) await db.prepare(sql).run();
  await db.prepare("UPDATE settings SET telegram_bot_token = '1:t', telegram_chat_id = 'staff-chat', time_zone = 'UTC', cafe_name = 'Test Café', notify_sales = 0").run();

  const admin = await login('admin.localhost', 'test-admin-password');
  const panel = await login('panel.localhost', 'test-panel-password');
  const A = (path, body, method) => call('admin.localhost', path, body, admin, method);
  const P = (path, body, method) => call('panel.localhost', path, body, panel, method);
  const pub = (path, body, method) => call('localhost', path, body, '', method);

  // Settings: calendars are validated, the events chat stays private.
  check((await A('/api/settings', { calendarSystem: 'mayan' }, 'PUT')).status, 400);
  check((await A('/api/settings', { calendarSystem: 'persian', secondaryCalendar: 'gregory', telegramEventsChatId: '@cafe_events', notifyBookings: true }, 'PUT')).status, 200);
  let settings = (await json(await pub('/api/settings'))).body.data;
  check([settings.calendarSystem, settings.secondaryCalendar, settings.telegramEventsChatId], ['persian', 'gregory', undefined]);
  check((await json(await A('/api/admin/settings'))).body.data.telegramEventsChatId, '@cafe_events');

  // Only the admin manages events.
  const base = { title: 'Open mic', description: 'Bring a song.', visibility: 'public', status: 'published', startDate: inDays(3), startTime: '19:00', endTime: '21:00', bookingEnabled: true, capacity: 5, maxParty: 4, cutoffHours: 2 };
  check((await pub('/api/events', base)).status, 401);
  check((await P('/api/events', base)).status, 403);
  check((await A('/api/events', { ...base, startTime: '' })).status, 400);
  check((await A('/api/events', { ...base, endTime: '18:00' })).status, 400);
  check((await A('/api/events', { ...base, recurrence: 'weekly', endDate: inDays(12) })).status, 400);
  let res = await json(await A('/api/events', base));
  check(res.status, 200);
  const mic = res.body.data;
  check([mic.endDate, mic.allDay, mic.bookingEnabled, mic.skippedDates], [base.startDate, false, true, []]);
  ok(!('telegramMessageId' in mic));
  const internal = (await json(await A('/api/events', { ...base, title: 'Stocktake', visibility: 'internal', bookingEnabled: true }))).body.data;
  check(internal.bookingEnabled, false);
  const draft = (await json(await A('/api/events', { ...base, title: 'Secret draft', status: 'draft' }))).body.data;
  const weekly = (await json(await A('/api/events', { ...base, title: 'Tasting', recurrence: 'weekly', startDate: inDays(1), recurrenceUntil: inDays(30), capacity: 0, cutoffHours: 0 }))).body.data;

  // The public sees published public events only; the panel sees everything.
  let list = (await json(await pub('/api/events/public'))).body;
  check(list.data.map(e => e.title).sort(), ['Open mic', 'Tasting']);
  check((await json(await P('/api/events'))).body.data.length, 4);

  // Booking: validation, honeypot, capacity, per-phone limit, club linking.
  await db.prepare("INSERT INTO customers (id, name, phone, notes, created_at, updated_at) VALUES ('cus-1', 'Sara', '09121112233', '', '2026-01-01', '2026-01-01')").run();
  const book = (event, body) => pub(`/api/events/${event.id}/bookings`, { date: event.startDate, name: 'Sara', phone: '+98 912 111 2233', seats: 2, ...body });
  check((await book(mic, { seats: 5 })).status, 400);
  check((await book(mic, { name: '' })).status, 400);
  check((await book(mic, { website: 'spam' })).status, 400);
  check((await book(mic, { date: inDays(4) })).status, 409);
  check((await book(draft)).status, 404);
  check((await book(internal)).status, 404);
  take();
  res = await json(await book(mic));
  check(res.status, 200);
  const first = res.body.data;
  check([first.phone, first.customerId, first.seats, first.status, first.source], ['09121112233', 'cus-1', 2, 'confirmed', 'public']);
  ok(/^[A-Z2-9]{6}$/.test(first.code) && res.body.token);
  const firstToken = res.body.token;
  await settle();
  let [alert] = take();
  check([alert.method, alert.body.chat_id], ['sendMessage', 'staff-chat']);
  ok(alert.body.text.includes('NEW BOOKING') && alert.body.text.includes('Open mic') && alert.body.text.includes('AP'));
  res = await json(await book(mic, { seats: 4, phone: '0935 000 0000' }));
  check([res.status, res.body.message], [409, 'Only 3 seats are left.']);
  check((await book(mic, { seats: 3, phone: '0935 000 0000' })).status, 200);
  check((await json(await book(mic, { seats: 1, phone: '0935 000 0001' }))).body.message, 'Fully booked.');
  list = (await json(await pub('/api/events/public'))).body;
  check(list.seats.find(s => s.eventId === mic.id).seats, 5);
  for (let i = 0; i < 3; i++) check((await book(weekly, { seats: 1, phone: '0911 222 3333' })).status, 200);
  check((await json(await book(weekly, { seats: 1, phone: '0911 222 3333' }))).body.message, 'This phone number already has 3 bookings for this date.');
  check((await book(weekly, { seats: 1, phone: '0911 222 3333', date: addDaysKey(weekly.startDate, 7) })).status, 200);
  check((await book(weekly, { date: addDaysKey(weekly.startDate, 3) })).status, 409);

  // Guests check and cancel their own booking with its token.
  check((await pub(`/api/event-bookings/${first.id}/status?token=nope`)).status, 404);
  check((await json(await pub(`/api/event-bookings/${first.id}/status?token=${firstToken}`))).body.data.status, 'confirmed');
  take();
  check((await pub(`/api/event-bookings/${first.id}/cancel`, { token: firstToken })).status, 200);
  check((await json(await pub(`/api/event-bookings/${first.id}/status?token=${firstToken}`))).body.data.status, 'cancelled');
  await settle();
  ok(take().some(c => c.body.text?.includes('BOOKING CANCELLED')));
  check((await book(mic, { seats: 2, phone: '0935 000 0001' })).status, 200);

  // Past the cutoff, guests can neither book nor cancel online; staff still can add.
  const soon = (await json(await A('/api/events', { ...base, title: 'Soon', startDate: iso(new Date()), startTime: '23:59', endTime: '', cutoffHours: 48 }))).body.data;
  check((await json(await book(soon))).body.message, 'Bookings for this date have closed.');
  res = await json(await A(`/api/events/${soon.id}/bookings`, { date: soon.startDate, name: 'Walk-in', phone: '0912 000 0000', seats: 1 }));
  check([res.status, res.body.data.source, res.body.token], [200, 'staff', undefined]);

  // Panel checks guests in and records payment, but cannot cancel.
  const bookings = (await json(await P(`/api/event-bookings?eventId=${mic.id}`))).body.data;
  check(bookings.length, 3);
  const guest = bookings.find(b => b.status === 'confirmed');
  check((await P(`/api/event-bookings/${guest.id}`, { status: 'cancelled' }, 'PUT')).status, 403);
  res = await json(await P(`/api/event-bookings/${guest.id}`, { status: 'checked_in', paid: true }, 'PUT'));
  check([res.status, res.body.data.status, res.body.data.paid], [200, 'checked_in', true]);
  check((await P(`/api/events/${mic.id}`, { title: 'x' }, 'PUT')).status, 403);
  // Restoring a cancelled booking respects capacity.
  check((await A(`/api/event-bookings/${first.id}`, { status: 'confirmed' }, 'PUT')).status, 409);

  // Skipping an occurrence cancels its bookings.
  const skippedDate = weekly.startDate;
  check((await A(`/api/events/${weekly.id}`, { skippedDates: [skippedDate] }, 'PUT')).status, 200);
  const weeklyBookings = (await json(await A(`/api/event-bookings?eventId=${weekly.id}&date=${skippedDate}`))).body.data;
  check(weeklyBookings.map(b => b.status), ['cancelled', 'cancelled', 'cancelled']);
  check((await book(weekly, { date: skippedDate })).status, 409);

  // Telegram: posting requires the events chat and a published public event; edits follow the event.
  check((await A(`/api/events/${internal.id}/telegram`, {})).status, 400);
  take();
  res = await json(await A(`/api/events/${mic.id}/telegram`, {}));
  check(res.status, 200);
  let [post] = take();
  check([post.method, post.body.chat_id], ['sendMessage', '@cafe_events']);
  ok(post.body.text.includes('Open mic') && post.body.text.includes(`http://localhost/#event-${mic.id}`) && post.body.text.includes('Book your seat'));
  const posted = (await db.prepare('SELECT telegram_message_id FROM events WHERE id = ?').bind(mic.id).first()).telegram_message_id;
  check((await A(`/api/events/${mic.id}`, { title: 'Open mic night' }, 'PUT')).status, 200);
  await settle();
  [post] = take();
  check([post.method, post.body.message_id], ['editMessageText', posted]);
  ok(post.body.text.includes('Open mic night'));
  check((await A(`/api/events/${mic.id}`, { status: 'cancelled' }, 'PUT')).status, 200);
  await settle();
  const cancelCalls = take();
  check(cancelCalls.map(c => c.method), ['editMessageText', 'sendMessage']);
  ok(cancelCalls[0].body.text.includes('CANCELLED'));
  check(cancelCalls[1].body.reply_parameters.message_id, posted);
  check((await json(await book(mic, { phone: '0999 999 9999' }))).body.message, 'This event is cancelled.');

  // Photo posts upload data images and edit the caption.
  const photo = (await json(await A('/api/events', { ...base, title: 'Latte art', imageUrl: 'data:image/webp;base64,UklGRg==' }))).body.data;
  take();
  check((await A(`/api/events/${photo.id}/telegram`, {})).status, 200);
  [post] = take();
  check([post.method, post.body.photo], ['sendPhoto', '<file image/webp>']);
  ok(post.body.caption.length <= 1024);
  check((await A(`/api/events/${photo.id}`, { status: 'draft' }, 'PUT')).status, 200);
  await settle();
  check(take().map(c => c.method), ['deleteMessage']);
  check((await db.prepare('SELECT telegram_message_id FROM events WHERE id = ?').bind(photo.id).first()).telegram_message_id, null);

  // Events with bookings are cancelled, not deleted.
  check((await A(`/api/events/${mic.id}`, undefined, 'DELETE')).status, 409);
  check((await A(`/api/events/${draft.id}`, undefined, 'DELETE')).status, 200);
  check((await json(await A('/api/events'))).body.data.some(e => e.id === draft.id), false);

  // Public bookings are rate limited per connection.
  for (let i = 0; i < 25; i++) await book(weekly, { date: 'bad' });
  check((await book(weekly)).status, 429);
  console.log(`Passed ${checks} event and booking assertions.`);
} finally { await mf.dispose(); }

function addDaysKey(key, n) { return iso(new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000)); }

// Pure scheduling and calendar helpers.
const helpers = await build({ entryPoints: ['src/utils/events.ts'], bundle: true, format: 'esm', write: false });
const ev = await import(`data:text/javascript;base64,${Buffer.from(helpers.outputFiles[0].text).toString('base64')}`);
const event = over => ({ startDate: '2026-01-31', endDate: '2026-01-31', recurrence: 'none', recurrenceUntil: '', skippedDates: [], allDay: false, startTime: '19:00', endTime: '', ...over });
check(ev.expandOccurrences(event({ recurrence: 'monthly' }), '2026-01-01', '2026-06-30').map(o => o.date), ['2026-01-31', '2026-03-31', '2026-05-31']);
check(ev.expandOccurrences(event({ recurrence: 'weekly', startDate: '2026-10-02', endDate: '2026-10-03', recurrenceUntil: '2026-10-23', skippedDates: ['2026-10-09'] }), '2026-10-01', '2026-12-31').map(o => o.date), ['2026-10-02', '2026-10-16', '2026-10-23']);
// A multi-day occurrence that began before the window still shows inside it.
check(ev.expandOccurrences(event({ startDate: '2026-10-30', endDate: '2026-11-02' }), '2026-11-01', '2026-11-30').map(o => o.endDate), ['2026-11-02']);
check(ev.expandOccurrences(event({ recurrence: 'weekly', startDate: '2020-01-01', endDate: '2020-01-01' }), '2026-10-19', '2026-10-25').map(o => o.date), ['2026-10-21']);
check(ev.cafeInstant('2026-10-21', '19:00', 'Asia/Tehran').toISOString(), '2026-10-21T15:30:00.000Z');
check(ev.cafeInstant('2026-03-29', '02:30', 'Europe/Berlin').toISOString(), '2026-03-29T01:30:00.000Z');
check(ev.monthBounds('2026-10-21', 'persian'), { first: '2026-09-23', last: '2026-10-22' });
check(ev.monthBounds('2026-10-21', 'hebrew'), { first: '2026-10-12', last: '2026-11-10' });
check(ev.monthGrid('2026-10-21', 'persian')[0][0], '2026-09-19');
check(ev.weekdayLabels('persian')[0], 'Sat');
ok(ev.formatDateKey('2026-10-21', 'persian').includes('Mehr 29, 1405'));
check(ev.describeRecurrence(event({ recurrence: 'weekly', startDate: '2026-10-23' }), 'gregory'), 'Every Friday');
console.log(`Passed ${checks} total event assertions, including recurrence and calendars.`);
