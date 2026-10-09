/** Shared formatting and date helpers for the admin and daily panel. */

export function money(value: number, currency: string): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${currency}${abs}`;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  google_pay: 'Google Pay',
  online: 'Online (Swiggy / Zomato)',
  bank_transfer: 'Bank transfer',
  qr_pay: 'QR pay'
};
export const paymentLabel = (method?: string | null) => PAYMENT_LABELS[method || ''] || method || 'Unknown';

export const ORDER_PAYMENT_METHODS = ['cash', 'card', 'google_pay', 'online'] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

const ORDER_TYPE_LABELS: Record<string, string> = { dine_in: 'Dine-in', takeout: 'Takeout', pickup: 'Pickup' };
export const orderTypeLabel = (type?: string | null) => ORDER_TYPE_LABELS[type || ''] || type || 'Order';

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled'
};
export const orderStatusTone = (status: string): 'warning' | 'info' | 'positive' | 'danger' | 'neutral' =>
  status === 'pending' ? 'warning' : status === 'preparing' ? 'info' : status === 'ready' ? 'positive' : status === 'cancelled' ? 'danger' : 'neutral';

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in the browser's local timezone (toISOString would give the UTC date). */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Value for <input type="datetime-local"> from an ISO timestamp, in local time. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO timestamp for a record dated `day`: now if today, otherwise midday on that day. */
export function timestampForDay(day: string): string {
  return day === localDateKey() ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
}

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Date(iso).toLocaleDateString([], opts);
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const formatDateTime = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function minutesSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
}
export function ageLabel(minutes: number): string {
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${h}h ${minutes % 60}m`;
}

export type DatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';
export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'custom', label: 'Custom' }
];

export function dateRangeBounds(preset: DatePreset, customStart = '', customEnd = ''): { start: Date | null; end: Date | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (preset) {
    case 'today':
      return { start: new Date(y, m, d), end: new Date(y, m, d, 23, 59, 59, 999) };
    case 'yesterday':
      return { start: new Date(y, m, d - 1), end: new Date(y, m, d - 1, 23, 59, 59, 999) };
    case 'this_week': {
      const day = now.getDay();
      const monday = d - day + (day === 0 ? -6 : 1);
      return { start: new Date(y, m, monday), end: new Date(y, m, monday + 6, 23, 59, 59, 999) };
    }
    case 'this_month':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0, 23, 59, 59, 999) };
    case 'last_month':
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
    case 'custom':
      return {
        start: customStart ? new Date(`${customStart}T00:00:00`) : null,
        end: customEnd ? new Date(`${customEnd}T23:59:59.999`) : null
      };
    default:
      return { start: null, end: null };
  }
}

export function inRange(iso: string, bounds: { start: Date | null; end: Date | null }): boolean {
  const t = new Date(iso).getTime();
  if (bounds.start && t < bounds.start.getTime()) return false;
  if (bounds.end && t > bounds.end.getTime()) return false;
  return true;
}

export const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?';
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
export const reducedMotion = () => document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
