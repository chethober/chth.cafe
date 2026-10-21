import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays, calendarParts, formatDateKey, expandOccurrences, monthBounds, monthGrid, monthTitle, weekdayLabels,
  type CafeEvent, type CalendarSystem, type Occurrence
} from '../utils/events';

/** Occurrences touching each day of [from, to], keyed by date; multi-day events appear on every day they span. */
export function occurrencesByDay(events: CafeEvent[], from: string, to: string) {
  const days = new Map<string, Occurrence[]>();
  for (const event of events) {
    for (const occurrence of expandOccurrences(event, from, to)) {
      for (let day = occurrence.date < from ? from : occurrence.date; day <= occurrence.endDate && day <= to; day = addDays(day, 1)) {
        const list = days.get(day) || [];
        list.push(occurrence);
        days.set(day, list);
      }
    }
  }
  for (const list of days.values()) list.sort((a, b) => (a.event.allDay ? '' : a.event.startTime).localeCompare(b.event.allDay ? '' : b.event.startTime));
  return days;
}

export const occurrenceTone = (o: Occurrence) =>
  o.event.status === 'cancelled' ? 'is-cancelled' : o.event.status === 'draft' ? 'is-draft' : o.event.visibility === 'internal' ? 'is-internal' : 'is-public';

/**
 * A month in any calendar system. Days are buttons; picking one is up to the parent, which shows that day's events.
 * Styled by --evcal-* tokens, so it fits both the public menu and the workspace.
 */
export function EventCalendar({ events, calendar, secondary, today, month, onMonth, selected, onSelect }: {
  events: CafeEvent[];
  calendar: CalendarSystem;
  secondary?: CalendarSystem | '';
  today: string;
  /** Any date inside the month on show. */
  month: string;
  onMonth: (date: string) => void;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const weeks = useMemo(() => monthGrid(month, calendar), [month, calendar]);
  const { first, last } = useMemo(() => monthBounds(month, calendar), [month, calendar]);
  const from = weeks[0][0], to = weeks[weeks.length - 1][6];
  const byDay = useMemo(() => occurrencesByDay(events, from, to), [events, from, to]);
  const labels = useMemo(() => weekdayLabels(calendar), [calendar]);
  const second = secondary && secondary !== calendar ? secondary : '';

  // Arrow keys move the selected day, as in a native date picker.
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key];
    if (!step) return;
    event.preventDefault();
    const grid = event.currentTarget as HTMLElement;
    const next = addDays(selected || today, step);
    onSelect(next);
    if (next < first || next > last) onMonth(next);
    requestAnimationFrame(() => grid.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus());
  };

  return (
    <div className="evcal">
      <div className="evcal-head">
        <button type="button" className="evcal-nav" aria-label="Previous month" onClick={() => onMonth(addDays(first, -1))}><ChevronLeft size={18} /></button>
        <div className="evcal-title" aria-live="polite">
          <strong>{monthTitle(month, calendar)}</strong>
          {second && <small>{monthTitle(first, second)}{monthTitle(first, second) !== monthTitle(last, second) ? ` – ${monthTitle(last, second)}` : ''}</small>}
        </div>
        <button type="button" className="evcal-nav" aria-label="Next month" onClick={() => onMonth(addDays(last, 1))}><ChevronRight size={18} /></button>
      </div>
      {(today < first || today > last) && <button type="button" className="evcal-today" onClick={() => { onMonth(today); onSelect(today); }}>Back to today</button>}
      <div className="evcal-grid" role="grid" aria-label={monthTitle(month, calendar)} onKeyDown={onKeyDown}>
        <div role="row" className="evcal-row">
          {labels.map(label => <span key={label} role="columnheader" className="evcal-weekday">{label}</span>)}
        </div>
        {weeks.map(week => (
          <div role="row" className="evcal-row" key={week[0]}>
            {week.map(day => {
              const list = byDay.get(day) || [];
              const outside = day < first || day > last;
              const isSelected = day === selected;
              return (
                <div role="gridcell" key={day} aria-selected={isSelected}>
                  <button
                    type="button"
                    data-day={day}
                    tabIndex={isSelected || (!selected && day === today) ? 0 : -1}
                    className={`evcal-day${outside ? ' is-outside' : ''}${day === today ? ' is-today' : ''}${day < today ? ' is-past' : ''}${isSelected ? ' is-selected' : ''}`}
                    aria-label={`${formatDateKey(day, calendar, 'long')}${list.length ? `, ${list.length} ${list.length === 1 ? 'event' : 'events'}` : ''}${day === today ? ', today' : ''}`}
                    onClick={() => { onSelect(day); if (outside) onMonth(day); }}
                  >
                    <span className="evcal-num">{calendarParts(day, calendar).day}</span>
                    {second && <span className="evcal-alt">{calendarParts(day, second).day}</span>}
                    {list.length > 0 && (
                      <span className="evcal-marks" aria-hidden="true">
                        {list.slice(0, 3).map(o => <i key={o.event.id + o.date} className={occurrenceTone(o)} />)}
                        {list.length > 3 && <b>+{list.length - 3}</b>}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
