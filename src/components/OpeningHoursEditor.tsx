import React from 'react';
import { Card, Input, Switch } from '../ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
type Day = typeof DAYS[number];
type DayHours = { open: string; close: string; closed: boolean };
export type OpeningHours = Record<Day, DayHours>;

const FALLBACK: DayHours = { open: '08:00', close: '18:00', closed: false };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Read the stored JSON, filling any missing or malformed day so the editor always has seven rows. */
export function parseOpeningHours(raw: string | null | undefined): OpeningHours {
  let parsed: Record<string, Partial<DayHours>> = {};
  try { parsed = JSON.parse(raw || '{}') ?? {}; } catch { /* fall back below */ }
  return Object.fromEntries(DAYS.map(day => {
    const entry = parsed[day] || {};
    return [day, {
      open: typeof entry.open === 'string' ? entry.open : FALLBACK.open,
      close: typeof entry.close === 'string' ? entry.close : FALLBACK.close,
      closed: typeof entry.closed === 'boolean' ? entry.closed : FALLBACK.closed
    }];
  })) as OpeningHours;
}

/** Returns a message per day whose hours the public menu could not interpret. */
export function openingHoursErrors(hours: OpeningHours): Partial<Record<Day, string>> {
  const errors: Partial<Record<Day, string>> = {};
  for (const day of DAYS) {
    const { open, close, closed } = hours[day];
    if (closed) continue;
    if (!TIME.test(open) || !TIME.test(close)) errors[day] = 'Enter both times.';
    else if (open === close) errors[day] = 'Opening and closing can’t be the same time.';
  }
  return errors;
}

export const OpeningHoursEditor: React.FC<{
  hours: OpeningHours;
  disabled?: boolean;
  onChange: (hours: OpeningHours) => void;
}> = ({ hours, disabled, onChange }) => {
  const errors = openingHoursErrors(hours);
  const setDay = (day: Day, partial: Partial<DayHours>) => onChange({ ...hours, [day]: { ...hours[day], ...partial } });
  const copyToAll = (day: Day) => onChange(Object.fromEntries(DAYS.map(d => [d, { ...hours[day] }])) as OpeningHours);

  return (
    <Card title="Opening hours" description="The public menu shows open or closed from these, and only takes orders while open. Closing earlier than opening runs past midnight.">
      <div className="ws-hours">
        {DAYS.map(day => {
          const { open, close, closed } = hours[day];
          const error = errors[day];
          return (
            <div key={day} className="ws-hours-row" role="group" aria-label={day}>
              <span className="ws-hours-day">
                <Switch label={`Open on ${day}`} checked={!closed} disabled={disabled} onChange={isOpen => setDay(day, { closed: !isOpen })} />
                <strong>{day}</strong>
              </span>
              {closed ? (
                <span className="ws-hint ws-hours-times">Closed</span>
              ) : (
                <span className="ws-hours-times">
                  <Input type="time" aria-label={`${day} opening time`} aria-invalid={!!error} required value={open} onChange={e => setDay(day, { open: e.target.value })} />
                  <span aria-hidden="true" className="ws-hint">to</span>
                  <Input type="time" aria-label={`${day} closing time`} aria-invalid={!!error} required value={close} onChange={e => setDay(day, { close: e.target.value })} />
                  {!error && TIME.test(open) && TIME.test(close) && close < open && <span className="ws-hint">next day</span>}
                </span>
              )}
              <button type="button" className="ws-link ws-hours-copy" onClick={() => copyToAll(day)} disabled={disabled}>Copy to all</button>
              {error && <span className="ws-error-text ws-hours-error" role="alert">{error}</span>}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
