import { Reconciliation } from './Reconciliation';
import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, PenLine, Percent, Plus, Receipt, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { CategorySelect, OrderSelect, ExpenseSelect, SettingsSelect, MenuItemSelect } from '../db/schema';
import { store } from '../db/store';
import {
  Amount, Button, Card, ConfirmDialog, EmptyState, IconButton, LineChart, List, ListItem, Page, PageHeader, Segmented, Stat, StatGrid,
  formatDate, localDateKey, money, paymentLabel, plural
} from '../ui';
import { ManualLogModal } from './ManualLogModal';
import { QuickPOSModal } from './QuickPOSModal';
import { OrderDetailsDialog } from './shared';
import { FinanceExportDialog } from './exports/FinanceExport';

interface FinancialTrackerProps {
  settings: SettingsSelect;
  orders: OrderSelect[];
  expenses: ExpenseSelect[];
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  onFinancialsUpdated: () => void;
}

type TrendRange = '7d' | '30d' | '12m';
const PAYMENT_ORDER = ['cash', 'card', 'google_pay', 'online'];
const PAYMENT_COLORS: Record<string, string> = {
  cash: 'var(--ws-series-1)', card: 'var(--ws-series-2)', google_pay: 'var(--ws-series-3)', online: 'var(--ws-series-4)'
};

export const FinancialTracker: React.FC<FinancialTrackerProps> = ({ settings, orders, expenses, categories, menuItems, onFinancialsUpdated }) => {
  const currency = settings.currency;
  const fmt = (v: number) => money(v, currency);
  const [manualLogOpen, setManualLogOpen] = useState(false);
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [trendRange, setTrendRange] = useState<TrendRange>('7d');
  const [viewOrder, setViewOrder] = useState<OrderSelect | null>(null);
  const [salesLimit, setSalesLimit] = useState(10);
  const [expenseLimit, setExpenseLimit] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'order' | 'expense'; id: string; label: string } | null>(null);

  const analytics = store.getFinancialAnalytics();
  const completed = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  /* Revenue, expenses and profit bucketed by local calendar date. */
  const trend = useMemo(() => {
    const revenueByDay = new Map<string, number>();
    completed.forEach(o => { const k = localDateKey(new Date(o.createdAt)); revenueByDay.set(k, (revenueByDay.get(k) || 0) + o.totalAmount); });
    const expenseByDay = new Map<string, number>();
    expenses.forEach(e => { const k = (e.date || '').slice(0, 10); expenseByDay.set(k, (expenseByDay.get(k) || 0) + e.amount); });
    const sumDays = (from: Date, days: number) => {
      let revenue = 0; let expense = 0;
      for (let i = 0; i < days; i++) {
        const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
        const k = localDateKey(d);
        revenue += revenueByDay.get(k) || 0;
        expense += expenseByDay.get(k) || 0;
      }
      return { revenue, expense, profit: revenue - expense };
    };
    const today = new Date();
    const points: { label: string; values: Record<string, number> }[] = [];
    if (trendRange === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        points.push({ label: d.toLocaleDateString([], { weekday: 'short' }), values: sumDays(d, 1) });
      }
    } else if (trendRange === '30d') {
      for (let i = 4; i >= 0; i--) {
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i + 1) * 6 + 1);
        points.push({ label: start.toLocaleDateString([], { month: 'short', day: 'numeric' }), values: sumDays(start, 6) });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        points.push({ label: start.toLocaleDateString([], { month: 'short' }), values: sumDays(start, days) });
      }
    }
    return points;
  }, [completed, expenses, trendRange]);

  const paymentMix = useMemo(() => {
    const totals = new Map<string, number>();
    completed.forEach(o => totals.set(o.paymentMethod, (totals.get(o.paymentMethod) || 0) + o.totalAmount));
    const keys = [...PAYMENT_ORDER, ...[...totals.keys()].filter(k => !PAYMENT_ORDER.includes(k))];
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return { sum, rows: keys.map((k, i) => ({ key: k, amount: totals.get(k) || 0, color: PAYMENT_COLORS[k] || `var(--ws-series-${(i % 5) + 1})` })) };
  }, [completed]);

  const topProducts = useMemo(() => {
    const completedIds = new Set(completed.map(o => o.id));
    const map = new Map<string, { name: string; revenue: number; qty: number }>();
    store.getOrderItems().filter(i => completedIds.has(i.orderId)).forEach(i => {
      const row = map.get(i.itemName) || { name: i.itemName, revenue: 0, qty: 0 };
      row.revenue += i.quantity * i.unitPrice;
      row.qty += i.quantity;
      map.set(i.itemName, row);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [completed, orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedSales = useMemo(() => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders]);
  const sortedExpenses = useMemo(() => [...expenses].sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt)), [expenses]);
  const topRevenue = topProducts[0]?.revenue || 1;

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'order') store.deleteOrder(deleteTarget.id);
    else store.deleteExpense(deleteTarget.id);
    onFinancialsUpdated();
  };

  return (
    <Page>
      <PageHeader
        title="Finances"
        description="Sales, costs, and profit for the café. Revenue counts completed orders only."
        actions={<>
          <Button icon={<Download />} onClick={() => setExportOpen(true)}>Export</Button>
          <Button icon={<PenLine />} onClick={() => setManualLogOpen(true)}>Log income or expense</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => setQuickSaleOpen(true)}>Record sale</Button>
        </>}
      />

      <StatGrid>
        <Stat label="Revenue" icon={<ArrowUpRight />} value={fmt(analytics.totalSalesRevenue)} hint={plural(analytics.totalOrdersCount, 'completed sale')} />
        <Stat label="Expenses" icon={<ArrowDownRight />} value={fmt(analytics.combinedExpenses)} hint={`Includes ${fmt(analytics.totalLaborWages)} in wages`} />
        <Stat label="Net profit" icon={<Wallet />} value={fmt(analytics.netProfit)} tone={analytics.netProfit >= 0 ? 'positive' : 'danger'} hint="After costs and wages" />
        <Stat label="Profit margin" icon={<Percent />} value={`${analytics.profitMargin}%`} hint={`Average sale ${fmt(analytics.averageOrderValue)}`} />
      </StatGrid>

      <div className="ws-grid ws-grid-main">
        <Card
          title="Revenue and expenses"
          description={trendRange === '7d' ? 'Last 7 days' : trendRange === '30d' ? 'Last 30 days, in 6-day periods' : 'Last 12 months'}
          actions={<Segmented label="Trend range" value={trendRange} onChange={setTrendRange} options={[
            { value: '7d', label: '7D' }, { value: '30d', label: '30D' }, { value: '12m', label: '12M' }
          ]} />}
        >
          <LineChart
            format={fmt}
            points={trend}
            series={[
              { key: 'revenue', label: 'Revenue', color: 'var(--ws-series-1)' },
              { key: 'expense', label: 'Expenses', color: 'var(--ws-series-2)' },
              { key: 'profit', label: 'Profit', color: 'var(--ws-series-3)', dashed: true }
            ]}
          />
        </Card>

        <Card title="How customers pay" description="Share of completed sales">
          {paymentMix.sum === 0 ? (
            <EmptyState title="No completed sales yet" />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 2, height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 20 }} role="img" aria-label="Payment method share">
                {paymentMix.rows.filter(r => r.amount > 0).map(r => (
                  <span key={r.key} title={paymentLabel(r.key)} style={{ width: `${(r.amount / paymentMix.sum) * 100}%`, background: r.color, borderRadius: 4 }} />
                ))}
              </div>
              <List>
                {paymentMix.rows.map(r => (
                  <li key={r.key} className="ws-list-item" style={{ padding: '10px 0', minHeight: 0 }}>
                    <span className="ws-swatch" style={{ background: r.color }} aria-hidden="true" />
                    <span style={{ flex: 1 }}>{paymentLabel(r.key)}</span>
                    <span className="ws-hint tabular" style={{ width: 44, textAlign: 'right' }}>{Math.round((r.amount / paymentMix.sum) * 100)}%</span>
                    <Amount>{fmt(r.amount)}</Amount>
                  </li>
                ))}
              </List>
            </>
          )}
        </Card>
      </div>

      <div className="ws-grid ws-grid-2">
        <Card title="Best sellers" description="By revenue from completed orders">
          {topProducts.length === 0 ? (
            <EmptyState icon={<ShoppingBag />} title="No sales yet" description="Best sellers appear once orders are completed." />
          ) : topProducts.map(p => (
            <div key={p.name} className="ws-bar-row">
              <span className="ws-truncate" style={{ fontWeight: 600 }}>{p.name}</span>
              <span className="ws-hint tabular">{p.qty} sold · <strong style={{ color: 'var(--ws-ink)' }}>{fmt(p.revenue)}</strong></span>
              <div className="ws-meter"><span style={{ width: `${(p.revenue / topRevenue) * 100}%`, background: 'var(--ws-series-1)' }} /></div>
            </div>
          ))}
        </Card>
        <Reconciliation settings={settings} />
      </div>

      <div className="ws-grid ws-grid-2">
        <Card flush title="Sales" description={plural(orders.length, 'order')}>
          {sortedSales.length === 0 ? (
            <EmptyState icon={<ShoppingBag />} title="No sales recorded" action={<Button size="sm" onClick={() => setQuickSaleOpen(true)}>Record a sale</Button>} />
          ) : (
            <>
              <List label="Sales">
                {sortedSales.slice(0, salesLimit).map(o => (
                  <ListItem
                    key={o.id}
                    onClick={() => setViewOrder(o)}
                    dim={o.status === 'cancelled'}
                    title={<><span className="mono">{o.orderNumber}</span><span className="ws-truncate muted" style={{ fontWeight: 400 }}>{o.customerName || 'Walk-in'}</span></>}
                    subtitle={<><span>{formatDate(o.createdAt)}</span><span>{paymentLabel(o.paymentMethod)}</span>{o.status !== 'completed' && <span>{o.status}</span>}</>}
                    trail={<Amount tone={o.status === 'completed' ? 'positive' : undefined}>{fmt(o.totalAmount)}</Amount>}
                    actions={<IconButton label={`Delete order ${o.orderNumber}`} variant="danger-ghost" onClick={() => setDeleteTarget({ type: 'order', id: o.id, label: o.orderNumber })}><Trash2 /></IconButton>}
                  />
                ))}
              </List>
              {sortedSales.length > salesLimit && <div style={{ padding: 12, textAlign: 'center' }}><Button size="sm" variant="ghost" onClick={() => setSalesLimit(l => l + 20)}>Show more</Button></div>}
            </>
          )}
        </Card>

        <Card flush title="Expenses" description={plural(expenses.length, 'entry', 'entries')}>
          {sortedExpenses.length === 0 ? (
            <EmptyState icon={<Receipt />} title="No expenses logged" action={<Button size="sm" onClick={() => setManualLogOpen(true)}>Log an expense</Button>} />
          ) : (
            <>
              <List label="Expenses">
                {sortedExpenses.slice(0, expenseLimit).map(e => (
                  <ListItem
                    key={e.id}
                    title={<span className="ws-truncate">{e.description}</span>}
                    subtitle={<><span>{e.category}</span><span>{formatDate(e.date)}</span><span>{paymentLabel(e.paymentMethod)}</span></>}
                    trail={<Amount tone="danger">−{fmt(e.amount)}</Amount>}
                    actions={<IconButton label={`Delete expense ${e.description}`} variant="danger-ghost" onClick={() => setDeleteTarget({ type: 'expense', id: e.id, label: e.description })}><Trash2 /></IconButton>}
                  />
                ))}
              </List>
              {sortedExpenses.length > expenseLimit && <div style={{ padding: 12, textAlign: 'center' }}><Button size="sm" variant="ghost" onClick={() => setExpenseLimit(l => l + 20)}>Show more</Button></div>}
            </>
          )}
        </Card>
      </div>

      <OrderDetailsDialog order={viewOrder} items={viewOrder ? store.getOrderItems(viewOrder.id) : []} currency={currency} taxRate={settings.taxRate} onClose={() => setViewOrder(null)} />
      <ManualLogModal isOpen={manualLogOpen} onClose={() => setManualLogOpen(false)} settings={settings} onFinancialsUpdated={onFinancialsUpdated} />
      <QuickPOSModal isOpen={quickSaleOpen} onClose={() => setQuickSaleOpen(false)} categories={categories} menuItems={menuItems} settings={settings} onOrderCreated={onFinancialsUpdated} />
      <FinanceExportDialog open={exportOpen} onClose={() => setExportOpen(false)} orders={orders} expenses={expenses} currency={currency} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget?.type === 'order' ? `Delete order ${deleteTarget.label}?` : 'Delete this expense?'}
        description={deleteTarget?.type === 'order'
          ? 'The sale is removed from your revenue and reports. This cannot be undone.'
          : <>“{deleteTarget?.label}” is removed from your expenses. This cannot be undone.</>}
      />
    </Page>
  );
};
