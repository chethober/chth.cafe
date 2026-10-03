import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, FileCode, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { Dialog } from './Dialog';
import { Button, Column, DataTable, Field, Input, Segmented } from './primitives';
import { DATE_PRESETS, DatePreset } from './format';

export interface ExportSummaryItem { label: string; value: React.ReactNode; tone?: 'positive' | 'danger' | 'warning' }

interface ExportDialogProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Filter controls for this dataset. */
  filters: React.ReactNode;
  summary: ExportSummaryItem[];
  records: T[];
  previewColumns: Column<T>[];
  rowKey: (row: T) => string;
  onReset: () => void;
  onCopy: () => Promise<boolean>;
  onJSON: () => void;
  onCSV: () => void;
  onExcel: () => void;
}

/** The one export flow: filter → see what you'll get → download in the format you need. */
export function ExportDialog<T>({ open, onClose, title, description, filters, summary, records, previewColumns, rowKey, onReset, onCopy, onJSON, onCSV, onExcel }: ExportDialogProps<T>) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const empty = records.length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      description={description}
      footer={
        <>
          <span className="ws-spacer"><Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={onReset}>Reset filters</Button></span>
          <Button size="sm" disabled={empty} icon={copied ? <Check /> : <Copy />} onClick={async () => setCopied(await onCopy())}>{copied ? 'Copied' : 'Copy CSV'}</Button>
          <Button size="sm" disabled={empty} icon={<FileCode />} onClick={onJSON}>JSON</Button>
          <Button size="sm" disabled={empty} icon={<Download />} onClick={onCSV}>CSV</Button>
          <Button size="sm" variant="primary" disabled={empty} icon={<FileSpreadsheet />} onClick={onExcel}>Excel ({records.length})</Button>
        </>
      }
    >
      <div className="ws-form">
        {filters}
        <div className="ws-stats" style={{ '--cols': summary.length } as React.CSSProperties} aria-live="polite">
          {summary.map(item => (
            <div key={item.label} className="ws-stat" data-tone={item.tone}>
              <span className="ws-stat-label">{item.label}</span>
              <span className="ws-stat-value" style={{ fontSize: 20 }}>{item.value}</span>
            </div>
          ))}
        </div>
        <div className="ws-card" style={{ overflow: 'hidden' }}>
          <DataTable
            caption="Export preview"
            columns={previewColumns}
            rows={records.slice(0, 6)}
            rowKey={rowKey}
            empty={<p className="ws-hint" style={{ padding: 20, textAlign: 'center', margin: 0 }}>No records match these filters.</p>}
            note={records.length > 6 ? `Showing 6 of ${records.length} records. All of them will be exported.` : undefined}
          />
        </div>
      </div>
    </Dialog>
  );
}

/** Date preset picker + custom range, shared by the dated exports. */
export function DateRangeFilter({ preset, onPreset, start, end, onStart, onEnd }: {
  preset: DatePreset; onPreset: (p: DatePreset) => void; start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void;
}) {
  return (
    <div className="ws-field">
      <span className="ws-label">Period</span>
      <Segmented label="Period" value={preset} onChange={onPreset} options={DATE_PRESETS.map(p => ({ value: p.id, label: p.label }))} />
      {preset === 'custom' && (
        <div className="ws-form-row cols-2">
          <Field label="From">{id => <Input id={id} type="date" value={start} onChange={e => onStart(e.target.value)} />}</Field>
          <Field label="To">{id => <Input id={id} type="date" value={end} onChange={e => onEnd(e.target.value)} />}</Field>
        </div>
      )}
    </div>
  );
}

/** Sort field + direction pair. */
export function SortFilter<T extends string>({ value, onChange, order, onOrder, options }: {
  value: T; onChange: (v: T) => void; order: 'asc' | 'desc'; onOrder: (v: 'asc' | 'desc') => void; options: { value: T; label: string }[];
}) {
  return (
    <div className="ws-form-row cols-2">
      <Field label="Sort by">{id => (
        <select id={id} className="ws-input" value={value} onChange={e => onChange(e.target.value as T)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}</Field>
      <Field label="Order">{id => (
        <select id={id} className="ws-input" value={order} onChange={e => onOrder(e.target.value as 'asc' | 'desc')}>
          <option value="desc">Highest / newest first</option>
          <option value="asc">Lowest / oldest first</option>
        </select>
      )}</Field>
    </div>
  );
}
