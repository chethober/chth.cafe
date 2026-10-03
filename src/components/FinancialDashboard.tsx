import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ExpenseSelect, OrderItemSelect, OrderSelect, SettingsSelect, ShiftSelect } from '../db/schema';
import { computeDashboard, RANGE_PRESETS, type RangePreset, type Totals } from '../utils/financeSeries';
import { ChartCard, count, LegendKey, money, moneyShort } from './charts/ChartKit';
import { SERIES, TrendChart } from './charts/TrendChart';
import { BarList, ShareBar, Sparkline } from './charts/Bars';

interface FinancialDashboardProps {
  settings: SettingsSelect;
  orders: OrderSelect[];
  orderItems: OrderItemSelect[];
  expenses: ExpenseSelect[];
  shifts: ShiftSelect[];
}

const RANGE_STORAGE_KEY = 'chth_finance_range';
const CHANNEL_COLORS = ['var(--viz-s1)', 'var(--viz-s2)', 'var(--viz-s3)', 'var(--viz-s4)', 'var(--viz-quiet)'];

const readRange = (): RangePreset => {
  try {
    const saved = localStorage.getItem(RANGE_STORAGE_KEY);
    if (RANGE_PRESETS.some((p) => p.id === saved)) return saved as RangePreset;
  } catch { /* storage unavailable: fall back to the default range */ }
  return '30d';
};

function Delta({ now, before, upIsGood, prior }: { now: number; before: number | undefined; upIsGood: boolean; prior: string | null }) {
  if (before === undefined || prior === null) return <span className="viz-delta">All recorded history</span>;
  if (before === 0) {
    return <span className="viz-delta">{now === 0 ? 'No change' : 'Nothing in'} {now === 0 ? `vs ${prior}` : prior}</span>;
  }
  const change = ((now - before) / Math.abs(before)) * 100;
  if (Math.abs(change) < 0.05) {
    return <span className="viz-delta"><Minus className="w-3.5 h-3.5" aria-hidden /> Flat vs {prior}</span>;
  }
  const up = change > 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="viz-delta" data-tone={good ? 'good' : 'bad'}>
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {up ? '+' : '−'}{Math.abs(change).toFixed(Math.abs(change) < 10 ? 1 : 0)}% vs {prior}
    </span>
  );
}

function StatTile({ label, value, children, spark, sparkLabel }: { label: string; value: string; children: React.ReactNode; spark: number[]; sparkLabel: string }) {
  return (
    <div className="glass-panel viz viz-stat">
      <span className="viz-stat-label">{label}</span>
      <span className="viz-stat-value">{value}</span>
      {children}
      <Sparkline values={spark} label={sparkLabel} />
    </div>
  );
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ settings, orders, orderItems, expenses, shifts }) => {
  const [range, setRange] = useState<RangePreset>(readRange);
  const currency = settings.currency;
  const preset = RANGE_PRESETS.find((p) => p.id === range)!;

  const data = useMemo(
    () => computeDashboard({ orders, orderItems, expenses, shifts, timeZone: settings.timeZone, preset: range }),
    [orders, orderItems, expenses, shifts, settings.timeZone, range]
  );

  const chooseRange = (next: RangePreset) => {
    setRange(next);
    try { localStorage.setItem(RANGE_STORAGE_KEY, next); } catch { /* per-viewer convenience only */ }
  };

  const { totals, previous, buckets } = data;
  const prev = (key: keyof Totals) => (previous ? (previous[key] as number) : undefined);
  const series = (key: keyof Totals) => buckets.map((b) => b[key] as number);
  const periodName = data.granularity === 'day' ? 'Day' : data.granularity === 'week' ? 'Week' : 'Month';
  const totalPayments = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalCategories = data.categories.reduce((sum, c) => sum + c.amount, 0);

  return (
    <section className="space-y-6" aria-label="Financial overview">
      {/* One filter row scopes every number below it. */}
      <div className="viz viz-filters">
        <div role="radiogroup" aria-label="Date range" className="viz-segmented">
          {RANGE_PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={range === p.id} onClick={() => chooseRange(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="viz-filter-note">
          {buckets[0].longLabel.split(' – ')[0]} – {buckets[buckets.length - 1].longLabel.split(' – ').pop()}
          {preset.prior ? ` · compared with the ${preset.prior}` : ''}
        </p>
      </div>

      <div className="viz-kpis">
        <div className="glass-panel viz viz-hero">
          <span className="viz-stat-label">{totals.net >= 0 ? 'Net profit' : 'Net loss'}</span>
          <span className="viz-hero-value">{money(currency, totals.net)}</span>
          <Delta now={totals.net} before={prev('net')} upIsGood prior={preset.prior} />
          <dl className="viz-hero-facts">
            <div><dt>Margin</dt><dd>{totals.margin === null ? '—' : `${totals.margin.toFixed(1)}%`}</dd></div>
            <div><dt>Staff wages</dt><dd>{moneyShort(currency, totals.labor)}</dd></div>
            <div><dt>Avg net per {data.granularity}</dt><dd>{moneyShort(currency, totals.net / buckets.length)}</dd></div>
          </dl>
        </div>
        <div className="viz-stat-grid">
          <StatTile label="Revenue" value={moneyShort(currency, totals.revenue)} spark={series('revenue')} sparkLabel="Revenue trend">
            <Delta now={totals.revenue} before={prev('revenue')} upIsGood prior={preset.prior} />
          </StatTile>
          <StatTile label="Costs incl. wages" value={moneyShort(currency, totals.expenses)} spark={series('expenses')} sparkLabel="Costs trend">
            <Delta now={totals.expenses} before={prev('expenses')} upIsGood={false} prior={preset.prior} />
          </StatTile>
          <StatTile label="Completed orders" value={count(totals.orders)} spark={series('orders')} sparkLabel="Orders trend">
            <Delta now={totals.orders} before={prev('orders')} upIsGood prior={preset.prior} />
          </StatTile>
          <StatTile label="Average ticket" value={moneyShort(currency, totals.avgTicket)} spark={series('avgTicket')} sparkLabel="Average ticket trend">
            <Delta now={totals.avgTicket} before={prev('avgTicket')} upIsGood prior={preset.prior} />
          </StatTile>
        </div>
      </div>

      <ChartCard
        title="Revenue and costs"
        subtitle={`Completed sales against expenses and staff wages, by ${data.granularity}`}
        legend={
          <>
            {SERIES.map((s) => (
              <span key={s.key} className="viz-legend-item">
                <LegendKey color={s.color} /> {s.label} <strong>{moneyShort(currency, totals[s.key])}</strong>
              </span>
            ))}
            <span className="viz-legend-item"><LegendKey color="var(--viz-pos)" shape="rect" /> Profit</span>
            <span className="viz-legend-item"><LegendKey color="var(--viz-neg)" shape="rect" /> Loss</span>
          </>
        }
        table={
          <table className="viz-table">
            <thead><tr><th scope="col">{periodName}</th><th scope="col">Revenue</th><th scope="col">Expenses</th><th scope="col">Wages</th><th scope="col">Net</th><th scope="col">Orders</th></tr></thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.start}>
                  <th scope="row">{b.longLabel}</th>
                  <td>{money(currency, b.revenue)}</td><td>{money(currency, b.manualExpenses)}</td><td>{money(currency, b.labor)}</td>
                  <td>{money(currency, b.net)}</td><td>{b.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <TrendChart buckets={buckets} granularity={data.granularity} currency={currency} />
      </ChartCard>

      <div className="viz-card-grid">
        <ChartCard
          title="Payment mix"
          subtitle="Share of completed sales by how customers paid"
          table={
            <table className="viz-table">
              <thead><tr><th scope="col">Channel</th><th scope="col">Sales</th><th scope="col">Orders</th><th scope="col">Share</th></tr></thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}><th scope="row">{p.label}</th><td>{money(currency, p.amount)}</td><td>{p.orders}</td><td>{totalPayments ? `${((p.amount / totalPayments) * 100).toFixed(1)}%` : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ShareBar
            format={(v) => moneyShort(currency, v)}
            parts={data.payments.map((p) => ({
              label: p.label,
              value: p.amount,
              note: `${count(p.orders)} ${p.orders === 1 ? 'order' : 'orders'}`,
              color: CHANNEL_COLORS[['cash', 'card', 'google_pay', 'online', 'other'].indexOf(p.id)]
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Top products"
          subtitle={data.productCount > data.products.length ? `Item sales before tax and discounts · top ${data.products.length} of ${data.productCount}` : 'Item sales before tax and discounts'}
          table={
            <table className="viz-table">
              <thead><tr><th scope="col">Product</th><th scope="col">Sales</th><th scope="col">Qty</th><th scope="col">Share</th></tr></thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.name}><th scope="row">{p.name}</th><td>{money(currency, p.revenue)}</td><td>{p.qty}</td><td>{((p.revenue / (data.productRevenue || 1)) * 100).toFixed(1)}%</td></tr>
                ))}
                {data.productCount > data.products.length && (
                  <tr>
                    <th scope="row">{data.productCount - data.products.length} other products</th>
                    <td>{money(currency, data.productRevenue - data.products.reduce((s, p) => s + p.revenue, 0))}</td><td>—</td><td>—</td>
                  </tr>
                )}
              </tbody>
            </table>
          }
        >
          <BarList
            rows={data.products.map((p) => ({ label: p.name, value: p.revenue }))}
            color="var(--viz-s1)"
            format={(v) => moneyShort(currency, v)}
            empty="No items sold in this range."
            detail={(i) => [
              { label: 'sales', value: money(currency, data.products[i].revenue) },
              { label: 'sold', value: count(data.products[i].qty) },
              { label: 'of item sales', value: `${((data.products[i].revenue / (data.productRevenue || 1)) * 100).toFixed(1)}%` }
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Where the money goes"
          subtitle="Logged expenses and shift wages by category"
          table={
            <table className="viz-table">
              <thead><tr><th scope="col">Category</th><th scope="col">Amount</th><th scope="col">Share</th></tr></thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.name}><th scope="row">{c.name}</th><td>{money(currency, c.amount)}</td><td>{((c.amount / (totalCategories || 1)) * 100).toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
          }
        >
          <BarList
            rows={data.categories.map((c) => ({ label: c.name, value: c.amount }))}
            color="var(--viz-s2)"
            format={(v) => moneyShort(currency, v)}
            empty="No costs logged in this range."
            detail={(i) => [
              { label: 'spent', value: money(currency, data.categories[i].amount) },
              { label: 'of costs', value: `${((data.categories[i].amount / (totalCategories || 1)) * 100).toFixed(1)}%` }
            ]}
          />
        </ChartCard>
      </div>
    </section>
  );
};
