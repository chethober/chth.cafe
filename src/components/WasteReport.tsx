import React, { useEffect, useState } from 'react';
import { Trash } from 'lucide-react';
import { SettingsSelect } from '../db/schema';
import { api } from '../services/api';
import { Badge, Card, DataTable, EmptyState, Notice, Segmented, money } from '../ui';
import { cafeToday } from '../utils/events';
import { WASTE_REASONS } from '../utils/purchasing';
import { tr } from '../i18n';

interface StockReport {
  from: string;
  to: string;
  wasteCost: number;
  shrinkageCost: number;
  byReason: Array<{ reason: string; cost: number; count: number }>;
  materials: Array<{
    stockItemId: string; name: string; unit: string; used: number; wasted: number; wasteCost: number;
    adjusted: number; adjustedCost: number; purchased: number; variancePercent: number | null;
  }>;
}

type Range = '7' | '30' | '90';
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const reasonLabel = (id: string) => tr(WASTE_REASONS.find(r => r.id === id)?.label || 'Other');

/**
 * What was thrown away, and what went missing: count corrections measured against what recipes say was used.
 * Costs use each material's current unit cost.
 */
export function WasteReport({ settings }: { settings: SettingsSelect }) {
  const fmt = (v: number) => money(v, settings.currency);
  const [range, setRange] = useState<Range>('30');
  const [report, setReport] = useState<StockReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const to = cafeToday(settings.timeZone || 'Asia/Tehran');
    const from = addDays(to, 1 - Number(range));
    let live = true;
    setError('');
    api<{ data: StockReport }>(`/api/stock-report?from=${from}&to=${to}`)
      .then(r => { if (live) setReport(r.data); })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : tr('The report could not load.')); });
    return () => { live = false; };
  }, [range, settings.timeZone]);

  const rows = (report?.materials || []).filter(m => m.wasted > 0 || m.adjusted < 0);
  const topReason = report?.byReason[0]?.cost || 1;
  return (
    <Card
      title={tr('Waste and shrinkage')}
      description={tr('Stock thrown away, and stock that counts found missing. At today\'s unit costs.')}
      actions={<Segmented label={tr('Report range')} value={range} onChange={setRange} options={[
        { value: '7', label: '7D' }, { value: '30', label: '30D' }, { value: '90', label: '90D' }
      ]} />}
    >
      {error ? <Notice tone="danger">{error}</Notice> : !report ? <p className="ws-hint">{tr('Loading…')}</p> : (
        <div className="ws-form">
          <div className="ws-waste-totals">
            <div><span className="ws-hint">{tr('Thrown away')}</span><strong className="tabular">{fmt(report.wasteCost)}</strong></div>
            <div><span className="ws-hint">{tr('Missing in counts')}</span><strong className="tabular">{fmt(report.shrinkageCost)}</strong></div>
          </div>
          {report.byReason.length > 0 && report.byReason.map(r => (
            <div key={r.reason} className="ws-bar-row">
              <span className="ws-truncate" style={{ fontWeight: 600 }}>{reasonLabel(r.reason)}</span>
              <span className="ws-hint tabular">{tr('{count} times', { count: r.count })} · <strong style={{ color: 'var(--ws-ink)' }}>{fmt(r.cost)}</strong></span>
              <div className="ws-meter"><span style={{ width: `${(r.cost / topReason) * 100}%`, background: 'var(--ws-series-2)' }} /></div>
            </div>
          ))}
          {rows.length === 0 ? (
            <EmptyState icon={<Trash />} title={tr('Nothing lost in this period')} description={tr('Record waste under Stock movements, and correct counts after a stocktake.')} />
          ) : (
            <DataTable
              caption={tr('Waste and shrinkage by material')}
              maxHeight={320}
              rows={rows}
              rowKey={m => m.stockItemId}
              columns={[
                { key: 'name', header: tr('Material'), render: m => m.name },
                { key: 'used', header: tr('Used in orders'), align: 'right', render: m => <span className="tabular">{m.used} {m.unit}</span> },
                { key: 'wasted', header: tr('Thrown away'), align: 'right', render: m => <span className="tabular">{m.wasted ? `${m.wasted} ${m.unit} · ${fmt(m.wasteCost)}` : '—'}</span> },
                { key: 'missing', header: tr('Missing'), align: 'right', render: m => m.adjusted < 0
                  ? <span className="tabular">{-m.adjusted} {m.unit} · {fmt(-m.adjustedCost)}</span> : '—' },
                { key: 'variance', header: tr('Of use'), align: 'right', render: m => m.variancePercent === null || m.adjusted >= 0 ? '—'
                  : <Badge tone={m.variancePercent <= -5 ? 'danger' : 'warning'}>{`${m.variancePercent}%`}</Badge> }
              ]}
            />
          )}
        </div>
      )}
    </Card>
  );
}
