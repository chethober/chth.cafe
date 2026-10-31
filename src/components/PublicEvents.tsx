import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronRight, Clock, Link2, MapPin, Minus, Plus, Ticket, X } from 'lucide-react';
import { SettingsSelect } from '../db/schema';
import { eventsApi, seatKey, seatMap, type SeatCount } from '../services/eventsApi';
import {
  addDays, bookingClosesAt, bookingState, cafeToday, calendarOf, calendarParts, describeOccurrence, describeRecurrence, expandOccurrences,
  formatDateKey, formatTimeRange, isCalendarSystem, occurrenceEnd, type CafeEvent, type Occurrence
} from '../utils/events';
import { EventCalendar } from './EventCalendar';
import { Modal } from './Modal';
import { useT } from '../i18n';

const STORAGE_KEY = 'chth_event_bookings';
const UPCOMING_DAYS = 120;
const STRIP_LIMIT = 6;

/** A booking this device made, kept so the guest can see and cancel it later. */
interface SavedBooking { id: string; token: string; code: string; eventId: string; date: string; title: string; seats: number; status?: string }

function readSaved(): SavedBooking[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((b): b is SavedBooking => !!b && typeof b.id === 'string' && typeof b.token === 'string') : [];
  } catch { return []; }
}
function writeSaved(list: SavedBooking[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

const hueFor = (text: string) => [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 17);

function DateTile({ date, calendar }: { date: string; calendar: ReturnType<typeof calendarOf> }) {
  return <span className="pm-ev-date" aria-hidden="true">
    <b>{calendarParts(date, calendar).day}</b>
    <small>{formatDateKey(date, calendar, 'short').replace(/[\d\s,]+/g, ' ').trim().slice(0, 6)}</small>
  </span>;
}

export function PublicEvents({ settings }: { settings: SettingsSelect }) {
  const t = useT();
  const timeZone = settings.timeZone || 'Asia/Tehran';
  const calendar = calendarOf(settings.calendarSystem);
  const secondary = isCalendarSystem(settings.secondaryCalendar) && settings.secondaryCalendar !== calendar ? settings.secondaryCalendar : '';
  const [events, setEvents] = useState<CafeEvent[]>([]);
  const [seatList, setSeatList] = useState<SeatCount[]>([]);
  const [now, setNow] = useState(() => new Date());
  const today = cafeToday(timeZone, now);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [month, setMonth] = useState(today);
  const [day, setDay] = useState(today);
  const [active, setActive] = useState<{ id: string; date: string } | null>(null);
  const [mine, setMine] = useState<SavedBooking[]>(readSaved);
  const [mineOpen, setMineOpen] = useState(false);
  const linkedId = () => /^#event-([\w-]+)$/.exec(window.location.hash)?.[1] || null;
  const [pendingLink, setPendingLink] = useState(linkedId);

  const load = useCallback(() => eventsApi.listPublic().then(result => { setEvents(result.data); setSeatList(result.seats); setNow(new Date()); }).catch(() => { /* The menu still works without events. */ }), []);
  useEffect(() => {
    void load();
    const poll = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(poll, 60000);
    document.addEventListener('visibilitychange', poll);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [load]);

  const seats = useMemo(() => seatMap(seatList), [seatList]);
  const upcoming = useMemo(() => events.flatMap(e => expandOccurrences(e, today, addDays(today, UPCOMING_DAYS)))
    .filter(o => occurrenceEnd(o.event, o.date, timeZone) > now)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.event.allDay ? '' : a.event.startTime).localeCompare(b.event.allDay ? '' : b.event.startTime)), [events, today, timeZone, now]);
  const nextOf = useCallback((id: string) => upcoming.find(o => o.event.id === id)?.date, [upcoming]);

  // Deep links (#event-<id>) open the event, also when the link is followed while the menu is open.
  useEffect(() => {
    const onHash = () => setPendingLink(linkedId());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!pendingLink || !events.length) return;
    const event = events.find(e => e.id === pendingLink);
    setPendingLink(null);
    if (event) setActive({ id: event.id, date: nextOf(event.id) || event.startDate });
  }, [events, nextOf, pendingLink]);
  const openEvent = (o: Occurrence) => {
    setActive({ id: o.event.id, date: o.date });
    try { window.history.replaceState(null, '', `#event-${o.event.id}`); } catch { /* sandboxed */ }
  };
  const closeEvent = () => {
    setActive(null);
    if (/^#event-/.test(window.location.hash)) try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* sandboxed */ }
  };

  const saveBooking = (booking: SavedBooking) => setMine(list => { const next = [booking, ...list.filter(b => b.id !== booking.id)].slice(0, 30); writeSaved(next); return next; });
  const activeMine = mine.filter(b => b.status !== 'cancelled' && b.date >= addDays(today, -1));

  if (!upcoming.length && !activeMine.length && !active) return null;
  const activeEvent = active ? events.find(e => e.id === active.id) || null : null;

  return (
    <section className="pm-events" aria-labelledby="pm-events-title">
      <header className="pm-events-head">
        <h2 id="pm-events-title"><CalendarDays size={20} aria-hidden="true" />{t('What’s on')}</h2>
        <div className="pm-events-actions">
          {activeMine.length > 0 && <button type="button" className="pm-chip" onClick={() => setMineOpen(true)}><Ticket size={15} />{t('Your bookings')}<b>{activeMine.length}</b></button>}
          <button type="button" className="pm-chip" onClick={() => { setMonth(today); setDay(today); setCalendarOpen(true); }}><CalendarDays size={15} />{t('Calendar')}</button>
        </div>
      </header>

      {upcoming.length > 0 ? <ul className="pm-events-strip">
        {upcoming.slice(0, STRIP_LIMIT).map(o => <li key={o.event.id + o.date}>
          <EventCard occurrence={o} calendar={calendar} seats={seats.get(seatKey(o.event.id, o.date))?.seats || 0} timeZone={timeZone} now={now} today={today} onOpen={() => openEvent(o)} />
        </li>)}
        {upcoming.length > STRIP_LIMIT && <li><button type="button" className="pm-ev-more" onClick={() => setCalendarOpen(true)}>+{upcoming.length - STRIP_LIMIT} more<ChevronRight size={16} /></button></li>}
      </ul> : <p className="pm-events-none">{t('No events coming up right now. Check back soon.')}</p>}

      <Modal isOpen={calendarOpen && !active} onClose={() => setCalendarOpen(false)} maxWidth="max-w-lg" title={<span className="text-lg font-semibold flex items-center gap-2"><CalendarDays size={20} />{t('Café calendar')}</span>}>
        <div className="public-menu pm-ev-sheet">
          <EventCalendar events={events} calendar={calendar} secondary={secondary} today={today} month={month} onMonth={setMonth} selected={day} onSelect={setDay} />
          <h3 className="pm-ev-day">{formatDateKey(day, calendar, 'long')}{secondary && <small>{formatDateKey(day, secondary)}</small>}</h3>
          {(() => {
            const list = events.flatMap(e => expandOccurrences(e, day, day));
            return list.length ? <ul className="pm-ev-daylist">{list.map(o => <li key={o.event.id + o.date}>
              <EventCard occurrence={o} calendar={calendar} seats={seats.get(seatKey(o.event.id, o.date))?.seats || 0} timeZone={timeZone} now={now} today={today} onOpen={() => openEvent(o)} compact />
            </li>)}</ul> : <p className="pm-events-none">{t('Nothing on this day.')}</p>;
          })()}
        </div>
      </Modal>

      <EventSheet event={activeEvent} date={active?.date || today} onDate={date => setActive(prev => prev && { ...prev, date })} onClose={closeEvent}
        calendar={calendar} secondary={secondary} timeZone={timeZone} today={today} seatsTaken={activeEvent ? seats.get(seatKey(activeEvent.id, active!.date))?.seats || 0 : 0}
        upcomingDates={activeEvent ? upcoming.filter(o => o.event.id === activeEvent.id).map(o => o.date) : []}
        onBooked={booking => { saveBooking(booking); void load(); }} />

      <MyBookings open={mineOpen} onClose={() => setMineOpen(false)} bookings={activeMine} events={events} calendar={calendar} timeZone={timeZone}
        onUpdate={(id, patch) => setMine(list => { const next = list.map(b => b.id === id ? { ...b, ...patch } : b); writeSaved(next); return next; })}
        onChanged={() => void load()} />
    </section>
  );
}

function EventCard({ occurrence: o, calendar, seats, timeZone, now, today, onOpen, compact }: {
  occurrence: Occurrence; calendar: ReturnType<typeof calendarOf>; seats: number; timeZone: string; now: Date; today: string; onOpen: () => void; compact?: boolean;
}) {
  const t = useT();
  const { event } = o;
  const state = event.bookingEnabled ? bookingState(event, o.date, seats, timeZone, now) : null;
  const status = event.status === 'cancelled' ? t('Cancelled')
    : state ? (state.open ? (state.seatsLeft !== null && state.seatsLeft <= 5 ? t('{count} left', { count: state.seatsLeft }) : t('Book')) : state.reason === 'Fully booked.' ? t('Fully booked') : t('Closed'))
    : event.priceNote || '';
  const when = o.date === today ? t('Today') : o.date === addDays(today, 1) ? t('Tomorrow') : formatDateKey(o.date, calendar, 'medium').split(',')[0];
  return (
    <button type="button" className={`pm-ev-card${event.status === 'cancelled' ? ' is-cancelled' : ''}${compact ? ' is-compact' : ''}`} onClick={onOpen}
      aria-label={`${event.title}, ${describeOccurrence(event, o.date, calendar)}${event.status === 'cancelled' ? t(', cancelled') : ''}`}>
      {!compact && <span className="pm-ev-art" style={{ '--pm-hue': hueFor(event.title) } as React.CSSProperties}>
        {event.imageUrl ? <img src={event.imageUrl} alt="" loading="lazy" decoding="async" /> : <CalendarDays size={28} aria-hidden="true" />}
        {event.tag && <span className="pm-badge">{event.tag}</span>}
      </span>}
      <span className="pm-ev-body">
        <DateTile date={o.date} calendar={calendar} />
        <span className="pm-ev-text">
          <strong>{event.title}</strong>
          <span className="pm-ev-meta"><Clock size={13} aria-hidden="true" />{when} · {formatTimeRange(event)}</span>
          {event.location && <span className="pm-ev-meta"><MapPin size={13} aria-hidden="true" />{event.location}</span>}
        </span>
        {status && <span className={`pm-ev-status${state?.open ? ' is-open' : ''}`}>{status}</span>}
      </span>
    </button>
  );
}

function EventSheet({ event, date, onDate, onClose, calendar, secondary, timeZone, today, seatsTaken, upcomingDates, onBooked }: {
  event: CafeEvent | null; date: string; onDate: (date: string) => void; onClose: () => void;
  calendar: ReturnType<typeof calendarOf>; secondary: ReturnType<typeof calendarOf> | ''; timeZone: string; today: string; seatsTaken: number;
  upcomingDates: string[]; onBooked: (booking: SavedBooking) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<SavedBooking | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setError(''); setDone(null); setSeats(1); setCopied(false); }, [event?.id, date]);
  if (!event) return null;
  const state = bookingState(event, date, seatsTaken, timeZone);
  const recurrence = describeRecurrence(event, calendar);
  const past = date < today;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await eventsApi.book(event.id, { date, name: name.trim(), phone, seats, note: note.trim(), website });
      const saved: SavedBooking = { id: result.data.id, token: result.token || '', code: result.data.code, eventId: event.id, date, title: event.title, seats: result.data.seats, status: 'confirmed' };
      setDone(saved);
      onBooked(saved);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('We couldn’t make your booking. Please try again.'));
    } finally { setBusy(false); }
  };
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#event-${event.id}`;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); }
    } catch { /* dismissed */ }
  };

  return (
    <Modal isOpen onClose={onClose} closeDisabled={busy} maxWidth="max-w-lg" title={<span className="text-lg font-semibold">{event.title}</span>}>
      <div className="public-menu pm-ev-sheet">
        {event.imageUrl && <img className="pm-ev-hero" src={event.imageUrl} alt="" />}
        {event.status === 'cancelled' && <p className="pm-ev-cancelled" role="status">{t('This event is cancelled. We’re sorry, and hope to see you soon.')}</p>}
        <dl className="pm-detail-facts">
          <div><dt>{t('When')}</dt><dd>{describeOccurrence(event, date, calendar, secondary)}{recurrence && <><br /><small>{recurrence}</small></>}</dd></div>
          {event.location && <div><dt>{t('Where')}</dt><dd>{event.location}</dd></div>}
          {event.priceNote && <div><dt>{t('Price')}</dt><dd>{event.priceNote}</dd></div>}
          {event.bookingEnabled && event.capacity > 0 && event.status === 'published' && !past && <div><dt>{t('Seats')}</dt><dd>{state.open && state.seatsLeft !== null ? t('{left} of {capacity} left', { left: state.seatsLeft, capacity: event.capacity }) : state.open ? t('Available') : state.reason.replace(/\.$/, '')}</dd></div>}
        </dl>
        {event.description && <p className="pm-ev-description">{event.description}</p>}
        {upcomingDates.length > 1 && <label className="pm-ev-field">Date
          <select value={date} onChange={e => onDate(e.target.value)}>
            {upcomingDates.slice(0, 20).map(d => <option key={d} value={d}>{formatDateKey(d, calendar)}</option>)}
          </select>
        </label>}

        {done ? <div className="pm-ev-done" role="status">
          <CheckCircle2 size={28} aria-hidden="true" />
          <p><strong>{t('You’re booked.')}</strong> {t('{seats} for {date}. Show this code at the door and pay at the café.', { seats: done.seats === 1 ? t('One seat') : t('{count} seats', { count: done.seats }), date: formatDateKey(done.date, calendar) })}</p>
          <span className="pm-ev-code">{done.code}</span>
          <small>Saved on this device under “Your bookings”, where you can cancel until {formatDateKey(cafeToday(timeZone, bookingClosesAt(event, date, timeZone)), calendar, 'short')}.</small>
        </div> : event.bookingEnabled && event.status === 'published' && !past ? (state.open ? <form className="pm-ev-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend>{t('Book your seat')}</legend>
            <label className="pm-ev-field">{t('Your name')}<input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="pm-ev-field">{t('Phone')}<input required type="tel" inputMode="tel" maxLength={30} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
            {/* Hidden from people; bots fill it in. */}
            <label className="pm-ev-trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
            <div className="pm-ev-seats"><span>{t('Seats')}</span>
              <div className="pm-stepper">
                <button type="button" aria-label={t('One fewer seat')} disabled={seats <= 1} onClick={() => setSeats(s => Math.max(1, s - 1))}><Minus size={16} /></button>
                <span aria-live="polite">{seats}</span>
                <button type="button" aria-label={t('One more seat')} disabled={seats >= Math.min(event.maxParty, state.seatsLeft ?? event.maxParty)} onClick={() => setSeats(s => s + 1)}><Plus size={16} /></button>
              </div>
            </div>
            <label className="pm-ev-field">{t('Note')} <small>{t('(optional)')}</small><textarea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t('Accessibility needs, a birthday…')} /></label>
          </fieldset>
          {error && <p role="alert" className="pm-ev-error">{error}</p>}
          <button type="submit" className="pm-button pm-ev-submit" disabled={busy || !name.trim() || !phone.trim()} aria-busy={busy}>{busy ? t('Booking…') : seats === 1 ? t('Book a seat') : t('Book {count} seats', { count: seats })}</button>
          <p className="pm-ev-fine">{t('Free to book.')} {event.priceNote ? t('{price}, paid at the café.', { price: event.priceNote }) : t('Pay at the café if there’s a charge.')}</p>
        </form> : <p className="pm-ev-closed">{state.reason}</p>) : null}

        <button type="button" className="pm-link-button" onClick={share}><Link2 size={16} />{t(copied ? 'Link copied' : 'Share this event')}</button>
      </div>
    </Modal>
  );
}

function MyBookings({ open, onClose, bookings, events, calendar, timeZone, onUpdate, onChanged }: {
  open: boolean; onClose: () => void; bookings: SavedBooking[]; events: CafeEvent[]; calendar: ReturnType<typeof calendarOf>; timeZone: string;
  onUpdate: (id: string, patch: Partial<SavedBooking>) => void; onChanged: () => void;
}) {
  const t = useT();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  // Staff may have checked a guest in or cancelled; refresh what this device remembers.
  useEffect(() => {
    if (!open) return;
    setError('');
    for (const b of bookings) eventsApi.bookingStatus(b.id, b.token).then(s => onUpdate(b.id, { status: s.status, seats: s.seats })).catch(() => { /* Offline: keep the saved copy. */ });
  }, [open]);
  const cancel = async (b: SavedBooking) => {
    setBusyId(b.id); setError('');
    try { await eventsApi.cancelOwnBooking(b.id, b.token); onUpdate(b.id, { status: 'cancelled' }); onChanged(); }
    catch (err) { setError(err instanceof Error ? err.message : t('We couldn’t cancel your booking.')); }
    finally { setBusyId(''); }
  };
  return (
    <Modal isOpen={open} onClose={onClose} maxWidth="max-w-lg" title={<span className="text-lg font-semibold flex items-center gap-2"><Ticket size={20} />{t('Your bookings')}</span>}>
      <div className="public-menu pm-ev-sheet">
        {error && <p role="alert" className="pm-ev-error">{error}</p>}
        {bookings.length === 0 ? <p className="pm-events-none">{t('No bookings on this device.')}</p> : <ul className="pm-ev-mine">
          {bookings.map(b => {
            const event = events.find(e => e.id === b.eventId);
            const canCancel = b.status !== 'checked_in' && event && new Date() < bookingClosesAt(event, b.date, timeZone);
            return <li key={b.id}>
              <DateTile date={b.date} calendar={calendar} />
              <div>
                <strong>{event?.title || b.title}</strong>
                <span>{event ? describeOccurrence(event, b.date, calendar) : formatDateKey(b.date, calendar)} · {b.seats === 1 ? '1 seat' : `${b.seats} seats`}</span>
                <span>{t('Code')} <b className="pm-ev-code is-small">{b.code}</b>{b.status === 'checked_in' && t(' · Checked in')}{event?.status === 'cancelled' && t(' · Event cancelled')}</span>
              </div>
              {canCancel && <button type="button" className="pm-icon-button" aria-label={t('Cancel booking for {title}', { title: b.title })} disabled={busyId === b.id} onClick={() => cancel(b)}><X size={18} /></button>}
            </li>;
          })}
        </ul>}
        <p className="pm-ev-fine">{t('Bookings are remembered on this device only. To change one after online changes close, call the café.')}</p>
      </div>
    </Modal>
  );
}
