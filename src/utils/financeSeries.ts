import type { ExpenseSelect, OrderItemSelect, OrderSelect, ShiftSelect } from '../db/schema';

// Pure aggregation for the admin finance dashboard. Every record is keyed by its
// café-local calendar day ("YYYY-MM-DD") so ranges match the reconciliation screen.

export type RangePreset = '7d' | '30d' | '90d' | '12m' | 'all';

export const RANGE_PRESETS: Array<{ id: RangePreset; label: string; prior: string | null }> = [
  { id: '7d', label: '7 days', prior: 'prior 7 days' },
  { id: '30d', label: '30 days', prior: 'prior 30 days' },
  { id: '90d', label: '90 days', prior: 'prior 90 days' },
  { id: '12m', label: '12 months', prior: 'prior 12 months' },
  { id: 'all', label: 'All time', prior: null }
];

export type PaymentChannel = 'cash' | 'card' | 'google_pay' | 'online' | 'other';

// Fixed order = fixed colour slot; a channel keeps its colour whatever the filter shows.
export const PAYMENT_CHANNELS: Array<{ id: PaymentChannel; label: string }> = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'google_pay', label: 'Google Pay' },
  { id: 'online', label: 'Swiggy / Zomato' },
  { id: 'other', label: 'Other' }
];

export interface Totals {
  revenue: number;
  manualExpenses: number;
  labor: number;
  expenses: number;
  net: number;
  margin: number | null;
  orders: number;
  avgTicket: number;
}

export interface Bucket extends Totals {
  start: string;
  end: string;
  label: string;
  longLabel: string;
}

export interface DashboardData {
  buckets: Bucket[];
  granularity: 'day' | 'week' | 'month';
  totals: Totals;
  previous: Totals | null;
  payments: Array<{ id: PaymentChannel; label: string; amount: number; orders: number }>;
  products: Array<{ name: string; revenue: number; qty: number }>;
  productCount: number;
  productRevenue: number;
  categories: Array<{ name: string; amount: number }>;
}

const DAY_MS = 86_400_000;
const LABOR_CATEGORY = 'Labor Wages (Staff)';

const keyToUtc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const utcToKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (key: string, days: number) => utcToKey(keyToUtc(key) + days * DAY_MS);
const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
const monthStart = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
const monthEnd = (index: number) => addDays(monthStart(index + 1), -1);

const formatKey = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Date(keyToUtc(key)).toLocaleDateString('en-GB', { timeZone: 'UTC', ...options });

export function makeDayKeyer(timeZone?: string) {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    format = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  return (value: string | null | undefined): string | null => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : format.format(date);
  };
}

type Slot = Pick<Bucket, 'start' | 'end' | 'label' | 'longLabel'>;

function buildSlots(preset: RangePreset, today: string, earliest: string): { slots: Slot[]; granularity: DashboardData['granularity'] } {
  if (preset === '7d' || preset === '30d') {
    const count = preset === '7d' ? 7 : 30;
    const slots = Array.from({ length: count }, (_, i) => {
      const day = addDays(today, i - count + 1);
      return {
        start: day,
        end: day,
        label: preset === '7d' ? formatKey(day, { weekday: 'short' }) : formatKey(day, { day: 'numeric', month: 'short' }),
        longLabel: formatKey(day, { weekday: 'short', day: 'numeric', month: 'short' })
      };
    });
    return { slots, granularity: 'day' };
  }
  if (preset === '90d') {
    // 13 whole weeks ending today: 91 days, close enough to "90 days" to read honestly.
    const slots = Array.from({ length: 13 }, (_, i) => {
      const end = addDays(today, (i - 12) * 7);
      const start = addDays(end, -6);
      return {
        start,
        end,
        label: formatKey(start, { day: 'numeric', month: 'short' }),
        longLabel: `${formatKey(start, { day: 'numeric', month: 'short' })} – ${formatKey(end, { day: 'numeric', month: 'short' })}`
      };
    });
    return { slots, granularity: 'week' };
  }
  const last = monthIndex(today);
  const first = preset === '12m' ? last - 11 : Math.min(monthIndex(earliest), last - 1);
  const slots = Array.from({ length: last - first + 1 }, (_, i) => {
    const index = first + i;
    const start = monthStart(index);
    const end = index === last ? today : monthEnd(index);
    const january = index % 12 === 0;
    return {
      start,
      end,
      label: formatKey(start, i === 0 || january ? { month: 'short', year: '2-digit' } : { month: 'short' }),
      longLabel: formatKey(start, { month: 'long', year: 'numeric' })
    };
  });
  return { slots, granularity: 'month' };
}

function previousRange(preset: RangePreset, start: string, end: string): [string, string] | null {
  if (preset === 'all') return null;
  if (preset === '12m') {
    const first = monthIndex(start) - 12;
    return [monthStart(first), addDays(monthStart(first + 12), -1)];
  }
  const length = Math.round((keyToUtc(end) - keyToUtc(start)) / DAY_MS) + 1;
  return [addDays(start, -length), addDays(start, -1)];
}

const emptyTotals = (): Totals => ({ revenue: 0, manualExpenses: 0, labor: 0, expenses: 0, net: 0, margin: null, orders: 0, avgTicket: 0 });

function finish<T extends Totals>(totals: T): T {
  totals.expenses = totals.manualExpenses + totals.labor;
  totals.net = totals.revenue - totals.expenses;
  totals.margin = totals.revenue > 0 ? (totals.net / totals.revenue) * 100 : null;
  totals.avgTicket = totals.orders > 0 ? totals.revenue / totals.orders : 0;
  return totals;
}

const channelOf = (method: string | null | undefined): PaymentChannel =>
  method === 'cash' || method === 'card' || method === 'google_pay' || method === 'online' ? method : 'other';

export function computeDashboard(input: {
  orders: OrderSelect[];
  orderItems: OrderItemSelect[];
  expenses: ExpenseSelect[];
  shifts: ShiftSelect[];
  timeZone?: string;
  preset: RangePreset;
  now?: Date;
}): DashboardData {
  const dayKey = makeDayKeyer(input.timeZone);
  const today = dayKey((input.now ?? new Date()).toISOString())!;

  const sales = input.orders
    .filter((order) => order.status === 'completed')
    .map((order) => ({ order, key: dayKey(order.createdAt) }))
    .filter((row): row is { order: OrderSelect; key: string } => row.key !== null);
  const costs = input.expenses
    .map((expense) => ({ expense, key: dayKey(expense.date || expense.createdAt) }))
    .filter((row): row is { expense: ExpenseSelect; key: string } => row.key !== null);
  const wages = input.shifts
    .map((shift) => ({ pay: shift.totalPay || 0, key: dayKey(shift.clockIn) }))
    .filter((row): row is { pay: number; key: string } => row.key !== null && row.pay > 0);

  let earliest = today;
  for (const row of [...sales, ...costs, ...wages]) if (row.key < earliest) earliest = row.key;

  const { slots, granularity } = buildSlots(input.preset, today, earliest);
  const buckets: Bucket[] = slots.map((slot) => ({ ...slot, ...emptyTotals() }));
  const rangeStart = slots[0].start;
  const rangeEnd = slots[slots.length - 1].end;
  const prior = previousRange(input.preset, rangeStart, rangeEnd);

  const totals = emptyTotals();
  const previous = prior ? emptyTotals() : null;

  // Buckets are contiguous and sorted, so a binary search places each record.
  const bucketFor = (key: string): Bucket | null => {
    if (key < rangeStart || key > rangeEnd) return null;
    let lo = 0;
    let hi = buckets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (buckets[mid].start <= key) lo = mid;
      else hi = mid - 1;
    }
    return buckets[lo];
  };
  const inPrior = (key: string) => prior !== null && key >= prior[0] && key <= prior[1];

  const payments = new Map<PaymentChannel, { amount: number; orders: number }>();
  const inRangeOrders = new Map<string, true>();
  for (const { order, key } of sales) {
    const bucket = bucketFor(key);
    if (bucket) {
      bucket.revenue += order.totalAmount;
      bucket.orders += 1;
      totals.revenue += order.totalAmount;
      totals.orders += 1;
      inRangeOrders.set(order.id, true);
      const channel = payments.get(channelOf(order.paymentMethod)) ?? { amount: 0, orders: 0 };
      channel.amount += order.totalAmount;
      channel.orders += 1;
      payments.set(channelOf(order.paymentMethod), channel);
    } else if (previous && inPrior(key)) {
      previous.revenue += order.totalAmount;
      previous.orders += 1;
    }
  }

  const categories = new Map<string, number>();
  for (const { expense, key } of costs) {
    const bucket = bucketFor(key);
    if (bucket) {
      bucket.manualExpenses += expense.amount;
      totals.manualExpenses += expense.amount;
      categories.set(expense.category, (categories.get(expense.category) ?? 0) + expense.amount);
    } else if (previous && inPrior(key)) {
      previous.manualExpenses += expense.amount;
    }
  }
  for (const { pay, key } of wages) {
    const bucket = bucketFor(key);
    if (bucket) {
      bucket.labor += pay;
      totals.labor += pay;
      categories.set(LABOR_CATEGORY, (categories.get(LABOR_CATEGORY) ?? 0) + pay);
    } else if (previous && inPrior(key)) {
      previous.labor += pay;
    }
  }

  const products = new Map<string, { name: string; revenue: number; qty: number }>();
  for (const item of input.orderItems) {
    if (!inRangeOrders.has(item.orderId)) continue;
    const name = item.itemName || 'Item';
    const line = Number.isFinite(item.itemTotal) ? item.itemTotal : item.quantity * item.unitPrice;
    const product = products.get(name) ?? { name, revenue: 0, qty: 0 };
    product.revenue += line;
    product.qty += item.quantity;
    products.set(name, product);
  }
  const rankedProducts = [...products.values()].sort((a, b) => b.revenue - a.revenue);

  buckets.forEach(finish);
  return {
    buckets,
    granularity,
    totals: finish(totals),
    previous: previous ? finish(previous) : null,
    payments: PAYMENT_CHANNELS
      .map((channel) => ({ ...channel, ...(payments.get(channel.id) ?? { amount: 0, orders: 0 }) }))
      .filter((channel) => channel.id !== 'other' || channel.orders > 0),
    products: rankedProducts.slice(0, 6),
    productCount: rankedProducts.length,
    productRevenue: rankedProducts.reduce((sum, product) => sum + product.revenue, 0),
    categories: [...categories.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
  };
}
