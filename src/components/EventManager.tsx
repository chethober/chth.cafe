import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban, CalendarDays, CalendarOff, CalendarPlus, Copy, Download, Pencil, Phone, RotateCcw, Send, Trash2, UserCheck, UserPlus, Wallet
} from 'lucide-react';
import { SettingsSelect } from '../db/schema';
import { eventsApi, seatKey, seatMap, type EventInput, type SeatCount } from '../services/eventsApi';
import { normalizePhone } from '../services/customers';
import { downloadCSV } from '../utils/exportUtils';
import {
  addDays, bookingClosesAt, cafeToday, calendarOf, describeOccurrence, describeRecurrence, expandOccurrences, formatDateKey, formatTimeRange,
  isCalendarSystem, type CafeEvent, type CalendarSystem, type EventBooking, type Occurrence
} from '../utils/events';
import {
  Badge, Button, Card, Chips, ConfirmDialog, Dialog, EmptyState, Field, FormDialog, IconButton, Input, KeyValue, List, ListItem, Notice, Page, PageHeader,
  SearchInput, Segmented, Select, Stat, StatGrid, Textarea, ToggleRow, formatDateTime, plural
} from '../ui';
import { ImageUpload } from './ImageUpload';
import { EventCalendar, occurrenceTone } from './EventCalendar';

type Mode = 'admin' | 'panel';
type View = 'agenda' | 'month' | 'all';
type Filter = 'all' | 'public' | 'internal' | 'draft' | 'cancelled';
interface Cal { calendar: CalendarSystem; secondary: CalendarSystem | ''; timeZone: string; today: string }

const AGENDA_DAYS = 60;

function useCalendarSettings(settings: SettingsSelect): Cal {
  const timeZone = settings.timeZone || 'Asia/Tehran';
  const calendar = calendarOf(settings.calendarSystem);
  const secondary = isCalendarSystem(settings.secondaryCalendar) && settings.secondaryCalendar !== calendar ? settings.secondaryCalendar : '';
  return { calendar, secondary, timeZone, today: cafeToday(timeZone) };
}

function EventBadges({ event }: { event: CafeEvent }) {
  return <>
    {event.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
    {event.status === 'draft' && <Badge tone="warning">Draft</Badge>}
    {event.visibility === 'internal' && <Badge tone="info">Internal</Badge>}
    {event.recurrence !== 'none' && <Badge>Repeats</Badge>}
  </>;
}

function seatsLabel(event: CafeEvent, seats?: SeatCount) {
  if (!event.bookingEnabled) return '';
  const taken = seats?.seats || 0;
  return event.capacity ? `${taken}/${event.capacity} seats` : plural(taken, 'seat');
}

/* ------------------------------------------------------------------ Form */

const blankEvent = (today: string): EventInput => ({
  title: '', description: '', imageUrl: '', location: '', tag: '', priceNote: '', visibility: 'public', status: 'draft',
  startDate: today, endDate: today, allDay: false, startTime: '19:00', endTime: '21:00', recurrence: 'none', recurrenceUntil: '',
  skippedDates: [], bookingEnabled: false, capacity: 0, maxParty: 6, cutoffHours: 2
});

function EventFormDialog({ open, onClose, initial, editingId, tags, cal, onSaved }: {
  open: boolean; onClose: () => void; initial: EventInput; editingId: string | null; tags: string[]; cal: Cal; onSaved: (event: CafeEvent) => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setForm(initial); setError(''); } }, [open, initial]);
  const edit = (patch: Partial<EventInput>) => setForm(prev => ({ ...prev, ...patch }));
  // Date inputs are Gregorian; show the café's own calendar beside them.
  const inCalendar = (key: string) => key && cal.calendar !== 'gregory' ? formatDateKey(key, cal.calendar, 'long') : undefined;
  const multiDay = form.endDate > form.startDate;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const input = { ...form, endDate: form.endDate < form.startDate ? form.startDate : form.endDate };
      const saved = editingId ? await eventsApi.update(editingId, input) : await eventsApi.create(input);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The event could not be saved.');
    } finally { setSaving(false); }
  };

  return (
    <FormDialog open={open} onClose={onClose} busy={saving} size="lg" onSubmit={submit}
      title={editingId ? `Edit ${initial.title}` : initial.title ? `Copy of ${initial.title}` : 'New event'}
      description={editingId && initial.recurrence !== 'none' ? 'Changes apply to every date in the series.' : undefined}
      submitLabel={editingId ? 'Save changes' : form.status === 'published' ? 'Publish event' : 'Save draft'}
      submitDisabled={!form.title.trim()}>
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
      <Field label="Title">{id => <Input id={id} required maxLength={120} autoFocus value={form.title} onChange={e => edit({ title: e.target.value })} placeholder="Open mic night" />}</Field>
      <Field label="Description" optional>{id => <Textarea id={id} rows={4} maxLength={4000} value={form.description} onChange={e => edit({ description: e.target.value })} placeholder="What to expect, who it’s for, what to bring…" />}</Field>
      <ImageUpload label="Image" value={form.imageUrl} disabled={saving} onChange={imageUrl => edit({ imageUrl })} />

      <div className="ws-form-row cols-2">
        <Field label="Who sees it" hint={form.visibility === 'internal' ? 'Only staff, in the admin and panel.' : 'Shown on the public menu once published.'}>{() => (
          <Segmented label="Who sees it" block value={form.visibility} onChange={visibility => edit({ visibility, bookingEnabled: visibility === 'public' && form.bookingEnabled })} options={[
            { value: 'public', label: 'Public' }, { value: 'internal', label: 'Internal' }
          ]} />
        )}</Field>
        <Field label="Status">{id => (
          <Select id={id} value={form.status} onChange={e => edit({ status: e.target.value as EventInput['status'] })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            {editingId && <option value="cancelled">Cancelled</option>}
          </Select>
        )}</Field>
      </div>
      <div className="ws-form-row cols-3">
        <Field label="Tag" optional>{id => <>
          <Input id={id} list={`${id}-tags`} maxLength={40} value={form.tag} onChange={e => edit({ tag: e.target.value })} placeholder="Music" />
          <datalist id={`${id}-tags`}>{tags.map(tag => <option key={tag} value={tag} />)}</datalist>
        </>}</Field>
        <Field label="Location" optional>{id => <Input id={id} maxLength={120} value={form.location} onChange={e => edit({ location: e.target.value })} placeholder="Garden" />}</Field>
        <Field label="Price" optional>{id => <Input id={id} maxLength={80} value={form.priceNote} onChange={e => edit({ priceNote: e.target.value })} placeholder="Free, or 200k at the door" />}</Field>
      </div>

      <div className="ws-form-row cols-2">
        <Field label="Starts" hint={inCalendar(form.startDate)}>{(id, hint) => <Input id={id} aria-describedby={hint} type="date" required value={form.startDate} onChange={e => edit({ startDate: e.target.value, endDate: form.endDate < e.target.value || !multiDay ? e.target.value : form.endDate })} />}</Field>
        <Field label="Ends" optional hint={multiDay ? inCalendar(form.endDate) : 'Same day'}>{(id, hint) => <Input id={id} aria-describedby={hint} type="date" min={form.startDate} value={form.endDate} onChange={e => edit({ endDate: e.target.value || form.startDate })} />}</Field>
      </div>
      <ToggleRow title="All day" description="No start or end time" checked={form.allDay} onChange={allDay => edit({ allDay })} />
      {!form.allDay && <div className="ws-form-row cols-2">
        <Field label="Start time">{id => <Input id={id} type="time" required value={form.startTime} onChange={e => edit({ startTime: e.target.value })} />}</Field>
        <Field label="End time" optional>{id => <Input id={id} type="time" value={form.endTime} onChange={e => edit({ endTime: e.target.value })} />}</Field>
      </div>}

      <Field label="Repeats">{() => (
        <Segmented label="Repeats" block value={form.recurrence} onChange={recurrence => edit({ recurrence })} options={[
          { value: 'none', label: 'Once' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }
        ]} />
      )}</Field>
      {form.recurrence !== 'none' && (
        <Field label="Repeat until" optional hint={form.recurrenceUntil ? inCalendar(form.recurrenceUntil) : `${describeRecurrence({ ...form, id: '', telegramPostedAt: '', createdAt: '', updatedAt: '' }, cal.calendar)}, with no end date. Monthly repeats skip months without that day.`}>{(id, hint) => (
          <Input id={id} aria-describedby={hint} type="date" min={form.startDate} value={form.recurrenceUntil} onChange={e => edit({ recurrenceUntil: e.target.value })} />
        )}</Field>
      )}

      {form.visibility === 'public' && <>
        <ToggleRow title="Take bookings" description="Guests reserve seats from the public menu and pay at the café" checked={form.bookingEnabled} onChange={bookingEnabled => edit({ bookingEnabled })} />
        {form.bookingEnabled && <div className="ws-form-row cols-3">
          <Field label="Capacity" hint={form.recurrence !== 'none' ? 'Seats per date. 0 is unlimited.' : '0 is unlimited.'}>{(id, hint) => <Input id={id} aria-describedby={hint} type="number" inputMode="numeric" min={0} max={10000} step={1} value={form.capacity} onChange={e => edit({ capacity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />}</Field>
          <Field label="Seats per booking">{id => <Input id={id} type="number" inputMode="numeric" min={1} max={100} step={1} value={form.maxParty} onChange={e => edit({ maxParty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />}</Field>
          <Field label="Close bookings" hint="Hours before the start">{(id, hint) => <Input id={id} aria-describedby={hint} type="number" inputMode="decimal" min={0} max={720} step={0.5} value={form.cutoffHours} onChange={e => edit({ cutoffHours: Math.max(0, Number(e.target.value) || 0) })} />}</Field>
        </div>}
      </>}
    </FormDialog>
  );
}

/* -------------------------------------------------------------- Bookings */

function AddBookingDialog({ open, onClose, event, date, onSaved }: { open: boolean; onClose: () => void; event: CafeEvent; date: string; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(1);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(''); setPhone(''); setSeats(1); setNote(''); setError(''); } }, [open]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try { await eventsApi.book(event.id, { date, name, phone, seats, note }); onSaved(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'The booking could not be added.'); }
    finally { setSaving(false); }
  };
  return (
    <FormDialog open={open} onClose={onClose} busy={saving} onSubmit={submit} title="Add booking" description="Staff bookings skip the online cutoff, but still respect capacity."
      submitLabel="Add booking" submitDisabled={!name.trim() || normalizePhone(phone).replace('+', '').length < 5}>
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
      <Field label="Name">{id => <Input id={id} autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />}</Field>
      <div className="ws-form-row cols-2">
        <Field label="Phone" hint="Linked to a club member with the same number.">{(id, hint) => <Input id={id} aria-describedby={hint} type="tel" inputMode="tel" required maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="off" />}</Field>
        <Field label="Seats">{id => <Input id={id} type="number" inputMode="numeric" min={1} max={event.maxParty} value={seats} onChange={e => setSeats(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />}</Field>
      </div>
      <Field label="Note" optional>{id => <Textarea id={id} rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} />}</Field>
    </FormDialog>
  );
}

const BOOKING_LABEL: Record<EventBooking['status'], string> = { confirmed: 'Booked', checked_in: 'Checked in', cancelled: 'Cancelled' };
const BOOKING_TONE: Record<EventBooking['status'], 'info' | 'positive' | 'danger'> = { confirmed: 'info', checked_in: 'positive', cancelled: 'danger' };

function BookingList({ event, date, mode, cal, onChanged }: { event: CafeEvent; date: string; mode: Mode; cal: Cal; onChanged: () => void }) {
  const [bookings, setBookings] = useState<EventBooking[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [adding, setAdding] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<EventBooking | null>(null);
  const load = useCallback(() => eventsApi.bookings(event.id, date).then(setBookings).catch(err => setError(err.message)), [event.id, date]);
  useEffect(() => { setBookings(null); setError(''); void load(); }, [load]);

  const update = async (booking: EventBooking, patch: { status?: EventBooking['status']; paid?: boolean }) => {
    setBusyId(booking.id); setError('');
    try { const saved = await eventsApi.updateBooking(booking.id, patch); setBookings(list => list?.map(b => b.id === saved.id ? saved : b) || null); onChanged(); }
    catch (err) { setError(err instanceof Error ? err.message : 'The booking could not be updated.'); }
    finally { setBusyId(''); }
  };
  const active = bookings?.filter(b => b.status !== 'cancelled') || [];
  const seats = active.reduce((sum, b) => sum + b.seats, 0);
  const checkedIn = active.filter(b => b.status === 'checked_in').reduce((sum, b) => sum + b.seats, 0);
  const exportCSV = () => downloadCSV(`bookings_${event.title.replace(/\W+/g, '_').toLowerCase()}_${date}.csv`,
    ['Code', 'Name', 'Phone', 'Seats', 'Status', 'Paid', 'Note', 'Source', 'Booked at'],
    (bookings || []).map(b => [b.code, b.name, b.phone, b.seats, BOOKING_LABEL[b.status], b.paid ? 'Yes' : 'No', b.note, b.source, b.createdAt]));

  return (
    <div className="ws-form">
      <div className="ws-toolbar">
        <strong className="ws-grow">{event.capacity ? `${seats} of ${event.capacity} seats booked` : `${plural(seats, 'seat')} booked`}{checkedIn > 0 && ` · ${checkedIn} checked in`}</strong>
        {mode === 'admin' && event.status !== 'cancelled' && <Button size="sm" icon={<UserPlus />} onClick={() => setAdding(true)}>Add</Button>}
        {mode === 'admin' && !!bookings?.length && <Button size="sm" variant="ghost" icon={<Download />} onClick={exportCSV}>CSV</Button>}
      </div>
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
      {bookings === null ? <p className="ws-hint">Loading bookings…</p> : bookings.length === 0 ? <p className="ws-hint">No bookings for this date yet.</p> : (
        <List label="Bookings" maxHeight={320}>
          {bookings.map(b => (
            <ListItem key={b.id} dim={b.status === 'cancelled'}
              title={<>{b.name} <span className="ws-hint">× {b.seats}</span></>}
              subtitle={<>
                <a className="tabular ev-admin-phone" href={`tel:${b.phone}`}><Phone width={12} height={12} aria-hidden="true" />{b.phone}</a>
                <span className="mono">{b.code}</span>
                <Badge tone={BOOKING_TONE[b.status]} dot>{BOOKING_LABEL[b.status]}</Badge>
                {b.paid && <Badge tone="positive">Paid</Badge>}
                {b.customerId && <Badge>Member</Badge>}
                {b.note && <span>{b.note}</span>}
              </>}
              actions={b.status === 'cancelled' ? (mode === 'admin' && <Button size="sm" variant="ghost" icon={<RotateCcw />} loading={busyId === b.id} onClick={() => update(b, { status: 'confirmed' })}>Restore</Button>) : <>
                <Button size="sm" variant={b.status === 'checked_in' ? 'tonal' : 'secondary'} icon={<UserCheck />} loading={busyId === b.id} aria-pressed={b.status === 'checked_in'}
                  onClick={() => update(b, { status: b.status === 'checked_in' ? 'confirmed' : 'checked_in' })}>{b.status === 'checked_in' ? 'Checked in' : 'Check in'}</Button>
                <Button size="sm" variant={b.paid ? 'tonal' : 'ghost'} icon={<Wallet />} disabled={busyId === b.id} aria-pressed={b.paid} onClick={() => update(b, { paid: !b.paid })}>{b.paid ? 'Paid' : 'Mark paid'}</Button>
                {mode === 'admin' && <IconButton variant="danger-ghost" label={`Cancel booking for ${b.name}`} disabled={busyId === b.id} onClick={() => setCancelTarget(b)}><Ban /></IconButton>}
              </>}
            />
          ))}
        </List>
      )}
      <AddBookingDialog open={adding} onClose={() => setAdding(false)} event={event} date={date} onSaved={() => { void load(); onChanged(); }} />
      <ConfirmDialog open={!!cancelTarget} onClose={() => setCancelTarget(null)} confirmLabel="Cancel booking"
        onConfirm={() => { if (cancelTarget) void update(cancelTarget, { status: 'cancelled' }); }}
        title={`Cancel ${cancelTarget?.name || 'this'}’s booking?`}
        description={`Their ${plural(cancelTarget?.seats || 0, 'seat')} for ${describeOccurrence(event, date, cal.calendar)} are released. You can restore it while seats are left.`} />
    </div>
  );
}

/* -------------------------------------------------------- Event details */

function OccurrenceDialog({ event, date, onDate, mode, cal, seats, eventsChatReady, hidden, onClose, onEdit, onDuplicate, onChanged }: {
  event: CafeEvent | null; date: string; hidden: boolean; onDate: (date: string) => void; mode: Mode; cal: Cal; seats: Map<string, SeatCount>; eventsChatReady: boolean;
  onClose: () => void; onEdit: (event: CafeEvent) => void; onDuplicate: (event: CafeEvent) => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | 'skip' | 'repost' | null>(null);
  useEffect(() => { setError(''); setNotice(''); }, [event?.id, date]);
  // Recent and upcoming dates of a series, to switch between their bookings.
  const dates = useMemo(() => event ? expandOccurrences(event, addDays(cal.today, -60), addDays(cal.today, 365)).slice(0, 60).map(o => o.date) : [], [event, cal.today]);
  if (!event) return <Dialog open={false} onClose={onClose} title="" />;
  const seatCount = seats.get(seatKey(event.id, date));
  const skipped = event.skippedDates.includes(date);

  const run = async (key: string, work: () => Promise<unknown>, done?: string) => {
    setBusy(key); setError(''); setNotice('');
    try { await work(); if (done) setNotice(done); onChanged(); }
    catch (err) { setError(err instanceof Error ? err.message : 'That did not work. Please try again.'); }
    finally { setBusy(''); }
  };
  const postToTelegram = () => run('telegram', () => eventsApi.postToTelegram(event.id), 'Posted to the events chat.');
  const toggleSkip = () => run('skip', () => eventsApi.update(event.id, { skippedDates: skipped ? event.skippedDates.filter(d => d !== date) : [...event.skippedDates, date] }), skipped ? 'This date is back on.' : 'This date is skipped.');
  const canPost = event.visibility === 'public' && event.status === 'published';

  return (
    <>
      <Dialog open={!confirm && !hidden} onClose={onClose} size="lg" busy={!!busy}
        title={<>{event.title} <EventBadges event={event} /></>}
        description={describeOccurrence(event, date, cal.calendar, cal.secondary)}
        footer={mode === 'admin' ? <>
          <span className="ws-spacer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="danger-ghost" icon={<Trash2 />} disabled={!!busy} onClick={() => setConfirm('delete')}>Delete</Button>
            {event.status !== 'cancelled' && <Button variant="danger-ghost" icon={<Ban />} disabled={!!busy} onClick={() => setConfirm('cancel')}>Cancel event</Button>}
          </span>
          <Button icon={<Copy />} disabled={!!busy} onClick={() => onDuplicate(event)}>Duplicate</Button>
          <Button variant="primary" icon={<Pencil />} disabled={!!busy} onClick={() => onEdit(event)}>Edit</Button>
        </> : <Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="ws-form">
          {error && <Notice tone="danger" role="alert">{error}</Notice>}
          {notice && <Notice tone="positive" role="status">{notice}</Notice>}
          {event.imageUrl && <img src={event.imageUrl} alt="" className="ev-admin-image" />}
          {event.description && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{event.description}</p>}
          <KeyValue items={[
            ...(event.recurrence !== 'none' ? [{ label: 'Repeats', value: describeRecurrence(event, cal.calendar) }] : []),
            ...(event.location ? [{ label: 'Location', value: event.location }] : []),
            ...(event.tag ? [{ label: 'Tag', value: event.tag }] : []),
            ...(event.priceNote ? [{ label: 'Price', value: event.priceNote }] : []),
            ...(event.bookingEnabled ? [{ label: 'Bookings close', value: formatDateTime(bookingClosesAt(event, date, cal.timeZone).toISOString()) }] : [])
          ]} />

          {event.recurrence !== 'none' && dates.length > 0 && (
            <div className="ws-toolbar">
              <Field label="Date" className="ws-grow">{id => (
                <Select id={id} value={date} onChange={e => onDate(e.target.value)}>
                  {!dates.includes(date) && <option value={date}>{formatDateKey(date, cal.calendar)}</option>}
                  {dates.map(d => <option key={d} value={d}>{formatDateKey(d, cal.calendar)}{d === cal.today ? ' · today' : ''}</option>)}
                </Select>
              )}</Field>
              {mode === 'admin' && <Button size="sm" variant={skipped ? 'secondary' : 'ghost'} icon={skipped ? <RotateCcw /> : <CalendarOff />} loading={busy === 'skip'}
                onClick={() => !skipped && seatCount?.bookings ? setConfirm('skip') : void toggleSkip()} style={{ alignSelf: 'flex-end' }}>
                {skipped ? 'Restore date' : 'Skip this date'}</Button>}
            </div>
          )}
          {skipped && <Notice tone="warning">This date is skipped. It is hidden from the public menu.</Notice>}

          {mode === 'admin' && event.visibility === 'public' && (
            <Card title="Telegram" description={event.telegramPostedAt ? `Posted ${formatDateTime(event.telegramPostedAt)}. Edits and cancellation update the post.` : 'Announce the event in your customer group or channel.'}>
              <div className="ws-toolbar">
                <Button size="sm" icon={<Send />} loading={busy === 'telegram'} disabled={!canPost || !eventsChatReady}
                  onClick={() => event.telegramPostedAt ? setConfirm('repost') : void postToTelegram()}>
                  {event.telegramPostedAt ? 'Post again' : 'Post to Telegram'}
                </Button>
                {!eventsChatReady ? <span className="ws-hint">Add an events chat in Settings › Notifications.</span>
                  : !canPost && <span className="ws-hint">Publish the event to post it.</span>}
              </div>
            </Card>
          )}

          {event.bookingEnabled && !skipped && <BookingList event={event} date={date} mode={mode} cal={cal} onChanged={onChanged} />}
          {!event.bookingEnabled && seatCount?.bookings ? <Notice tone="neutral">{plural(seatCount.bookings, 'booking')} from before bookings were turned off.</Notice> : null}
        </div>
      </Dialog>
      <ConfirmDialog open={confirm === 'cancel'} onClose={() => setConfirm(null)} confirmLabel="Cancel event"
        onConfirm={() => void run('cancel', () => eventsApi.update(event.id, { status: 'cancelled' }), 'The event is cancelled.')}
        title={`Cancel ${event.title}?`}
        description={<>It stays on the public calendar marked “Cancelled” and stops taking bookings.{event.recurrence !== 'none' && ' Every date in the series is cancelled; to drop one date, skip it instead.'}{event.telegramPostedAt && ' The Telegram post is updated and a cancellation notice is sent.'} Existing bookings are kept so you can contact guests.</>} />
      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)}
        onConfirm={() => void run('delete', async () => { await eventsApi.remove(event.id); onClose(); })}
        title={`Delete ${event.title}?`}
        description={`It is removed everywhere${event.telegramPostedAt ? ', including its Telegram post' : ''}. Events with bookings cannot be deleted; cancel them instead.`} />
      <ConfirmDialog open={confirm === 'skip'} onClose={() => setConfirm(null)} confirmLabel="Skip and cancel bookings"
        onConfirm={() => void toggleSkip()}
        title={`Skip ${formatDateKey(date, cal.calendar)}?`}
        description={`${plural(seatCount?.bookings || 0, 'booking')} on this date will be cancelled. Let those guests know.`} />
      <ConfirmDialog open={confirm === 'repost'} onClose={() => setConfirm(null)} tone="neutral" confirmLabel="Post again"
        onConfirm={() => void postToTelegram()}
        title="Post this event again?"
        description={`It was posted ${event.telegramPostedAt ? formatDateTime(event.telegramPostedAt) : 'before'}. A new message is sent and the old one stays; later edits update the new one.`} />
    </>
  );
}

/* ---------------------------------------------------------------- Screen */

/** Admin: plan, publish and announce events and take bookings. Panel: the same calendar, read-only, with door check-in. */
export function EventManager({ settings, mode }: { settings: SettingsSelect; mode: Mode }) {
  const cal = useCalendarSettings(settings);
  const [events, setEvents] = useState<CafeEvent[]>([]);
  const [seatList, setSeatList] = useState<SeatCount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('agenda');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(cal.today);
  const [day, setDay] = useState(cal.today);
  const [open, setOpen] = useState<{ id: string; date: string } | null>(null);
  const [form, setForm] = useState<{ initial: EventInput; editingId: string | null } | null>(null);

  const load = useCallback(async () => {
    try { const result = await eventsApi.list(); setEvents(result.data); setSeatList(result.seats); setLoadError(''); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Events could not be loaded.'); }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => {
    void load();
    const poll = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(poll, 30000);
    document.addEventListener('visibilitychange', poll);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [load]);

  // The panel never sees drafts.
  const visibleEvents = useMemo(() => mode === 'panel' ? events.filter(e => e.status !== 'draft') : events, [events, mode]);
  const seats = useMemo(() => seatMap(seatList), [seatList]);
  const tags = useMemo(() => [...new Set(events.map(e => e.tag).filter(Boolean))].sort(), [events]);
  const agenda = useMemo(() => visibleEvents.flatMap(e => expandOccurrences(e, cal.today, addDays(cal.today, AGENDA_DAYS)))
    .filter(o => o.endDate >= cal.today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.event.allDay ? '' : a.event.startTime).localeCompare(b.event.allDay ? '' : b.event.startTime)), [visibleEvents, cal.today]);
  const weekEnd = addDays(cal.today, 6);
  const bookedThisWeek = agenda.filter(o => o.date <= weekEnd).reduce((sum, o) => sum + (seats.get(seatKey(o.event.id, o.date))?.seats || 0), 0);
  const openEvent = open ? events.find(e => e.id === open.id) || null : null;

  const nextDate = (event: CafeEvent) => expandOccurrences(event, cal.today, addDays(cal.today, 3650))[0]?.date
    || expandOccurrences(event, event.startDate, cal.today).pop()?.date || event.startDate;
  const filtered = visibleEvents.filter(e => (filter === 'all' || (filter === 'draft' || filter === 'cancelled' ? e.status === filter : e.visibility === filter && e.status !== 'cancelled'))
    && (!search.trim() || `${e.title} ${e.tag} ${e.location}`.toLowerCase().includes(search.trim().toLowerCase())));
  const startNew = () => setForm({ initial: { ...blankEvent(day >= cal.today ? day : cal.today) }, editingId: null });
  const toInput = ({ id, telegramPostedAt, createdAt, updatedAt, ...rest }: CafeEvent): EventInput => rest;

  const row = (o: Occurrence, showDate: boolean) => {
    const count = seats.get(seatKey(o.event.id, o.date));
    return (
      <ListItem key={o.event.id + o.date} dim={o.event.status === 'cancelled'}
        lead={<span className={`ev-admin-mark ${occurrenceTone(o)}`} aria-hidden="true" />}
        title={<>{o.event.title} <EventBadges event={o.event} /></>}
        subtitle={<>
          <span>{showDate ? describeOccurrence(o.event, o.date, cal.calendar, cal.secondary) : formatTimeRange(o.event)}</span>
          {o.event.location && <span>{o.event.location}</span>}
          {o.event.tag && <span>{o.event.tag}</span>}
        </>}
        trail={o.event.bookingEnabled ? <span className="ws-amount">{seatsLabel(o.event, count)}</span> : undefined}
        onClick={() => setOpen({ id: o.event.id, date: o.date })}
        label={`${o.event.title}, ${describeOccurrence(o.event, o.date, cal.calendar)}`} />
    );
  };
  const agendaDays = [...new Set(agenda.map(o => o.date))];
  const dayOccurrences = visibleEvents.flatMap(e => expandOccurrences(e, day, day));

  return (
    <Page>
      <PageHeader title="Events"
        description={mode === 'admin' ? 'Plan café events, publish them to the public calendar, announce them on Telegram, and take bookings.' : 'What’s on at the café. Check guests in at the door.'}
        actions={mode === 'admin' && <Button variant="primary" icon={<CalendarPlus />} onClick={startNew}>New event</Button>} />
      {loadError && <Notice tone="danger" role="alert" action={<Button size="sm" onClick={() => void load()}>Retry</Button>}>{loadError}</Notice>}
      <StatGrid>
        <Stat label="Coming up" value={agenda.length} hint={`Next ${AGENDA_DAYS} days`} />
        <Stat label="Today" value={agenda.filter(o => o.date <= cal.today).length} />
        <Stat label="Seats booked" value={bookedThisWeek} hint="Next 7 days" />
        {mode === 'admin' ? <Stat label="Drafts" value={events.filter(e => e.status === 'draft').length} tone={events.some(e => e.status === 'draft') ? 'warning' : 'neutral'} />
          : <Stat label="Internal" value={agenda.filter(o => o.event.visibility === 'internal').length} hint="Staff only" />}
      </StatGrid>

      <Card flush>
        <div className="ws-toolbar" style={{ padding: 'var(--ws-pad) var(--ws-pad) 12px' }}>
          <Segmented label="Events view" value={view} onChange={setView} options={[
            { value: 'agenda', label: 'Agenda' }, { value: 'month', label: 'Month' }, ...(mode === 'admin' ? [{ value: 'all' as const, label: 'All events' }] : [])
          ]} />
          {view === 'all' && <SearchInput className="ws-grow" value={search} onChange={setSearch} placeholder="Search title, tag or location" label="Search events" />}
        </div>

        {!loaded ? <p className="ws-hint" style={{ padding: '0 var(--ws-pad) var(--ws-pad)' }}>Loading events…</p>
          : view === 'agenda' ? (agenda.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="Nothing coming up" description={mode === 'admin' ? 'Create an event to fill the café calendar.' : 'No events in the next two months.'}
              action={mode === 'admin' && <Button variant="primary" icon={<CalendarPlus />} onClick={startNew}>New event</Button>} />
          ) : (
            <div className="ev-admin-agenda">
              {agendaDays.map(date => (
                <section key={date} aria-label={formatDateKey(date, cal.calendar, 'long')}>
                  <h3 className="ev-admin-day">{date === cal.today ? 'Today · ' : date === addDays(cal.today, 1) ? 'Tomorrow · ' : ''}{formatDateKey(date, cal.calendar, 'long')}
                    {cal.secondary && <small>{formatDateKey(date, cal.secondary)}</small>}</h3>
                  <List>{agenda.filter(o => o.date === date).map(o => row(o, false))}</List>
                </section>
              ))}
            </div>
          )) : view === 'month' ? (
            <div className="ev-admin-month">
              <EventCalendar events={visibleEvents} calendar={cal.calendar} secondary={cal.secondary} today={cal.today} month={month} onMonth={setMonth} selected={day} onSelect={setDay} />
              <div>
                <h3 className="ev-admin-day">{formatDateKey(day, cal.calendar, 'long')}{cal.secondary && <small>{formatDateKey(day, cal.secondary)}</small>}</h3>
                {dayOccurrences.length ? <List>{dayOccurrences.map(o => row(o, o.date !== day))}</List> : <p className="ws-hint">Nothing on this day.</p>}
                {mode === 'admin' && <Button size="sm" variant="ghost" icon={<CalendarPlus />} onClick={startNew} style={{ marginTop: 12 }}>New event on this day</Button>}
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: '0 var(--ws-pad) 12px' }}>
                <Chips label="Filter events" value={filter} onChange={setFilter} options={[
                  { value: 'all', label: 'All', count: events.length },
                  { value: 'public', label: 'Public', count: events.filter(e => e.visibility === 'public' && e.status !== 'cancelled').length },
                  { value: 'internal', label: 'Internal', count: events.filter(e => e.visibility === 'internal' && e.status !== 'cancelled').length },
                  { value: 'draft', label: 'Drafts', count: events.filter(e => e.status === 'draft').length },
                  { value: 'cancelled', label: 'Cancelled', count: events.filter(e => e.status === 'cancelled').length }
                ]} />
              </div>
              {filtered.length === 0 ? <EmptyState icon={<CalendarDays />} title={events.length ? 'No events match' : 'No events yet'} />
                : <List label="All events">{filtered.map(e => {
                  const date = nextDate(e);
                  return row({ event: e, date, endDate: date }, true);
                })}</List>}
            </>
          )}
      </Card>

      <OccurrenceDialog event={openEvent} date={open?.date || cal.today} onDate={date => setOpen(prev => prev && { ...prev, date })} mode={mode} cal={cal} seats={seats}
        eventsChatReady={!!settings.telegramBotToken && !!settings.telegramEventsChatId} hidden={!!form}
        onClose={() => setOpen(null)} onChanged={() => void load()}
        onEdit={event => setForm({ initial: toInput(event), editingId: event.id })}
        onDuplicate={event => setForm({ initial: { ...toInput(event), status: 'draft', skippedDates: [] }, editingId: null })} />
      {form && <EventFormDialog open onClose={() => setForm(null)} initial={form.initial} editingId={form.editingId} tags={tags} cal={cal}
        onSaved={saved => { void load(); setOpen({ id: saved.id, date: open?.id === saved.id ? open.date : saved.startDate }); }} />}
    </Page>
  );
}
