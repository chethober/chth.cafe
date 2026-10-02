const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface OpeningStatus {
  isOpen: boolean;
  label: 'Open' | 'Closed' | 'Hours unavailable';
  detail: string;
  nextOpening: Date | null;
}

/** Evaluate the café schedule in its IANA timezone, regardless of device location. */
export function getOpeningStatus(rawHours: string, now = new Date(), timeZone = 'Asia/Tehran'): OpeningStatus {
  const unavailable: OpeningStatus = {
    isOpen: false, label: 'Hours unavailable',
    detail: 'Please contact the café to check opening hours.', nextOpening: null
  };
  try {
    const wallDate = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
      const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
      return new Date(Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')));
    };
    const instant = (wall: Date) => {
      let result = new Date(wall);
      for (let i = 0; i < 3; i++) result = new Date(result.getTime() + wall.getTime() - wallDate(result).getTime());
      return result;
    };
    now = wallDate(now);
    const hours = JSON.parse(rawHours);
    const minutes = (value: unknown): number => {
      if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        throw new Error('Invalid opening time');
      }
      const [hour, minute] = value.split(':').map(Number);
      return hour * 60 + minute;
    };
    const schedule = DAYS.map(day => {
      const entry = hours?.[day];
      if (!entry || typeof entry.closed !== 'boolean') throw new Error('Invalid day');
      if (entry.closed) return null;
      const open = minutes(entry.open);
      const close = minutes(entry.close);
      if (open === close) throw new Error('Ambiguous opening hours');
      return { open, close };
    });
    const intervals: Array<{ start: Date; end: Date }> = [];
    for (let offset = -1; offset <= 7; offset++) {
      const day = new Date(now);
      day.setUTCHours(0, 0, 0, 0);
      day.setUTCDate(day.getUTCDate() + offset);
      const entry = schedule[day.getUTCDay()];
      if (!entry) continue;
      const start = new Date(day);
      start.setUTCHours(Math.floor(entry.open / 60), entry.open % 60);
      const end = new Date(day);
      if (entry.close < entry.open) end.setUTCDate(end.getUTCDate() + 1);
      end.setUTCHours(Math.floor(entry.close / 60), entry.close % 60);
      intervals.push({ start, end });
    }
    const time = (date: Date) => date.toLocaleTimeString([], { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
    const current = intervals.find(({ start, end }) => now >= start && now < end);
    if (current) return { isOpen: true, label: 'Open', detail: `Until ${time(current.end)} · ${timeZone}`, nextOpening: null };
    const nextOpening = intervals.find(({ start }) => start > now)?.start ?? null;
    return {
      isOpen: false, label: 'Closed', nextOpening: nextOpening ? instant(nextOpening) : null,
      detail: nextOpening
        ? `Opens ${nextOpening.toLocaleDateString([], { weekday: 'long', timeZone: 'UTC' })} at ${time(nextOpening)} · ${timeZone}`
        : 'No opening hours scheduled. Please contact the café.'
    };
  } catch {
    return unavailable;
  }
}
