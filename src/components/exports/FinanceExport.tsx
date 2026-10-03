import React, { useMemo, useState } from 'react';
import { ExpenseSelect, OrderSelect } from '../../db/schema';
import { copyCSVToClipboard, downloadCSV, downloadJSON, downloadStyledExcel } from '../../utils/exportUtils';
import {
  Badge, Checkbox, DatePreset, DateRangeFilter, ExportDialog, Field, Segmented, Select, SortFilter,
  dateRangeBounds, formatDate, inRange, localDateKey, money, orderTypeLabel, paymentLabel
} from '../../ui';
import { EXPENSE_CATEGORIES } from '../ManualLogModal';

interface Row { id: string; type: 'Order' | 'Expense'; refNumber: string; name: string; description: string; amount: number; paymentMethod: string; date: string }
type SortField = 'date' | 'amount' | 'type' | 'name';

export function FinanceExportDialog({ open, onClose, orders, expenses, currency }: {
  open: boolean; onClose: () => void; orders: OrderSelect[]; expenses: ExpenseSelect[]; currency: string;
}) {
  const [scope, setScope] = useState<'all' | 'orders' | 'expenses'>('all');
  const [preset, setPreset] = useState<DatePreset>('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [payment, setPayment] = useState('all');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [includePayment, setIncludePayment] = useState(true);

  const records = useMemo(() => {
    const bounds = dateRangeBounds(preset, start, end);
    const rows: Row[] = [];
    if (scope !== 'expenses') orders.forEach(o => {
      if (!inRange(o.createdAt, bounds)) return;
      if (payment !== 'all' && o.paymentMethod !== payment) return;
      if (category && o.orderType !== category) return;
      rows.push({ id: o.id, type: 'Order', refNumber: o.orderNumber, name: o.customerName || 'Walk-in', description: `${orderTypeLabel(o.orderType)} sale · ${o.status}`, amount: o.totalAmount, paymentMethod: o.paymentMethod, date: o.createdAt });
    });
    if (scope !== 'orders') expenses.forEach(e => {
      const date = e.date ? `${e.date}T12:00:00` : e.createdAt;
      if (!inRange(date, bounds)) return;
      if (payment !== 'all' && e.paymentMethod !== payment) return;
      if (category && e.category !== category) return;
      rows.push({ id: e.id, type: 'Expense', refNumber: e.id, name: e.category, description: e.description || e.category, amount: e.amount, paymentMethod: e.paymentMethod, date });
    });
    rows.sort((a, b) => {
      const cmp = sortBy === 'date' ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : sortBy === 'amount' ? a.amount - b.amount
        : sortBy === 'type' ? a.type.localeCompare(b.type)
        : a.name.localeCompare(b.name);
      return order === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [orders, expenses, scope, preset, start, end, payment, category, sortBy, order]);

  const revenue = records.filter(r => r.type === 'Order').reduce((s, r) => s + r.amount, 0);
  const costs = records.filter(r => r.type === 'Expense').reduce((s, r) => s + r.amount, 0);
  const net = revenue - costs;
  const fileBase = `financial_ledger_${scope}_${preset}_${localDateKey()}`;

  const build = () => {
    const headers = ['Type', 'ID / Ref', 'Name / Category', 'Description', `Amount (${currency})`];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['center', 'left', 'left', 'left', 'right'];
    if (includePayment) { headers.push('Payment Method'); columnAlignments.push('center'); }
    headers.push('Date & Time'); columnAlignments.push('center');
    const rows = records.map(r => {
      const row: (string | number)[] = [r.type, r.refNumber, r.name, r.description, Number((r.type === 'Order' ? r.amount : -r.amount).toFixed(2))];
      if (includePayment) row.push(paymentLabel(r.paymentMethod));
      row.push(new Date(r.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }));
      return row;
    });
    return { headers, rows, columnAlignments };
  };

  const reset = () => { setScope('all'); setPreset('all'); setStart(''); setEnd(''); setPayment('all'); setCategory(''); setSortBy('date'); setOrder('desc'); setIncludePayment(true); };

  return (
    <ExportDialog
      open={open}
      onClose={onClose}
      title="Export finances"
      description="Sales and expenses as a ledger with profit and loss totals."
      records={records}
      rowKey={r => `${r.type}-${r.id}`}
      summary={[
        { label: 'Revenue', value: money(revenue, currency), tone: 'positive' },
        { label: 'Expenses', value: money(costs, currency), tone: 'danger' },
        { label: 'Net', value: money(net, currency), tone: net >= 0 ? 'positive' : 'danger' },
        { label: 'Entries', value: records.length }
      ]}
      previewColumns={[
        { key: 'type', header: 'Type', render: r => <Badge tone={r.type === 'Order' ? 'positive' : 'danger'}>{r.type}</Badge> },
        { key: 'name', header: 'Name', render: r => r.name },
        { key: 'method', header: 'Payment', render: r => paymentLabel(r.paymentMethod) },
        { key: 'date', header: 'Date', render: r => formatDate(r.date) },
        { key: 'amount', header: 'Amount', align: 'right', render: r => `${r.type === 'Order' ? '+' : '−'}${money(r.amount, currency)}` }
      ]}
      onReset={reset}
      onCopy={() => { const d = build(); return copyCSVToClipboard(d.headers, d.rows); }}
      onCSV={() => { const d = build(); downloadCSV(`${fileBase}.csv`, d.headers, d.rows); }}
      onJSON={() => downloadJSON(`${fileBase}.json`, {
        metadata: { generatedAt: new Date().toISOString(), currency, totalRecords: records.length, filters: { scope, preset, start: start || null, end: end || null, payment, category: category || 'all', sortBy, order }, summary: { totalRevenue: revenue, totalExpenses: costs, netProfit: net } },
        transactions: records
      })}
      onExcel={() => {
        const d = build();
        const totalsRow: (string | number)[] = ['NET TOTALS', '', '', `${records.length} Transactions`, Number(net.toFixed(2))];
        if (includePayment) totalsRow.push('');
        totalsRow.push(net >= 0 ? 'NET PROFIT' : 'NET DEFICIT');
        downloadStyledExcel({
          filename: `${fileBase}.xls`,
          title: 'CHTH Cafe — Financial Ledger & P&L Statement',
          subtitle: `Generated: ${new Date().toLocaleDateString()} | Scope: ${scope.toUpperCase()} | Period: ${preset.replace('_', ' ').toUpperCase()}`,
          themeColor: net >= 0 ? 'emerald' : 'amber',
          metadata: {
            'Ledger Scope': scope === 'all' ? 'Sales & expenses' : scope === 'orders' ? 'Sales only' : 'Expenses only',
            'Time Period': preset.replace('_', ' ').toUpperCase(),
            'Payment Method': payment === 'all' ? 'All' : paymentLabel(payment),
            'Sort Order': `${sortBy.toUpperCase()} (${order.toUpperCase()})`,
            'Store Currency': currency
          },
          summaryCards: [
            { label: 'Total Revenue', value: money(revenue, currency) },
            { label: 'Operating Expenses', value: money(costs, currency) },
            { label: 'Net Profit / Loss', value: money(net, currency) },
            { label: 'Total Records', value: records.length }
          ],
          ...d,
          totalsRow
        });
      }}
      filters={<>
        <div className="ws-field">
          <span className="ws-label">Include</span>
          <Segmented block label="Records to include" value={scope} onChange={setScope} options={[
            { value: 'all', label: 'Everything' }, { value: 'orders', label: 'Sales' }, { value: 'expenses', label: 'Expenses' }
          ]} />
        </div>
        <DateRangeFilter preset={preset} onPreset={setPreset} start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <div className="ws-form-row cols-2">
          <Field label="Payment method">{id => (
            <Select id={id} value={payment} onChange={e => setPayment(e.target.value)}>
              <option value="all">All methods</option>
              {['cash', 'card', 'google_pay', 'online', 'bank_transfer'].map(m => <option key={m} value={m}>{paymentLabel(m)}</option>)}
            </Select>
          )}</Field>
          <Field label="Category">{id => (
            <Select id={id} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All categories</option>
              <optgroup label="Sales by order type">
                {['dine_in', 'takeout', 'pickup'].map(t => <option key={t} value={t}>{orderTypeLabel(t)}</option>)}
              </optgroup>
              <optgroup label="Expense category">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            </Select>
          )}</Field>
        </div>
        <SortFilter value={sortBy} onChange={setSortBy} order={order} onOrder={setOrder} options={[
          { value: 'date', label: 'Date' }, { value: 'amount', label: 'Amount' }, { value: 'type', label: 'Type' }, { value: 'name', label: 'Customer / category' }
        ]} />
        <Checkbox checked={includePayment} onChange={setIncludePayment}>Include payment method column</Checkbox>
      </>}
    />
  );
}
