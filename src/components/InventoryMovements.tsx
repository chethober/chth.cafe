import React, { useEffect, useState } from 'react';
import { StockItemSelect } from '../db/schema';
import { api } from '../services/api';
import { store } from '../db/store';
import { Badge, Button, Card, DataTable, Field, Input, Notice, Segmented, Select, formatDateTime } from '../ui';
import { tr } from '../i18n';
import { WASTE_REASONS, type WasteReason } from '../utils/purchasing';

interface Movement { id: string; name: string; kind: string; quantity: number; unit: string; notes: string; reason?: string; created_at: string }
const reasonLabel = (id?: string) => { const found = WASTE_REASONS.find(r => r.id === id); return found ? tr(found.label) : ''; };
type Kind = 'purchase' | 'waste' | 'adjustment';
const KIND_HINT: Record<Kind, string> = {
  purchase: 'Positive amount added to stock',
  waste: 'Amount thrown away; it is taken off stock',
  adjustment: 'Positive or negative correction'
};

/** Purchases, waste and corrections, with the latest 200 movements below. */
export function InventoryMovements({ items }: { items: StockItemSelect[] }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stockId, setStockId] = useState('');
  const [kind, setKind] = useState<Kind>('purchase');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState<WasteReason>('expired');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => { const result = await api<{ data: Movement[] }>('/api/inventory-movements'); setMovements(result.data); };
  // Refetch only when stock levels move, not whenever a sync hands over a fresh array.
  const stockKey = items.map(item => `${item.id}:${item.quantity}`).join('|');
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, [stockKey]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      // Waste is always recorded as stock leaving, whichever sign was typed.
      const amount = kind === 'waste' ? -Math.abs(Number(quantity)) : Number(quantity);
      await api('/api/inventory-movements', { stockItemId: stockId, kind, quantity: amount, notes, ...(kind === 'waste' && { reason }) });
      setQuantity(''); setNotes('');
      await store.syncFromAPI();
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : tr('Save failed.')); }
    finally { setBusy(false); }
  };
  const unit = items.find(i => i.id === stockId)?.unit;

  return (
    <Card title={tr('Stock movements')} description={tr('Record deliveries, waste, and corrections. Quantities use each material\'s unit.')}>
      <form className="ws-form" onSubmit={save} aria-busy={busy}>
        <fieldset className="ws-fieldset ws-form" disabled={busy}>
          <Segmented label={tr('Movement type')} value={kind} onChange={setKind} options={[
            { value: 'purchase', label: tr('Delivery') }, { value: 'waste', label: tr('Waste') }, { value: 'adjustment', label: tr('Correction') }
          ]} />
          <div className="ws-form-row cols-3">
            <Field label={tr('Material')}>{id => (
              <Select id={id} required value={stockId} onChange={e => setStockId(e.target.value)}>
                <option value="">{tr('Choose a material')}</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </Select>
            )}</Field>
            <Field label={`Quantity${unit ? ` (${unit})` : ''}`} hint={tr(KIND_HINT[kind])}>{(id, hint) => (
              <Input id={id} aria-describedby={hint} required type="number" inputMode="decimal" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} />
            )}</Field>
            {kind === 'waste' ? (
              <Field label={tr('Why')}>{id => (
                <Select id={id} value={reason} onChange={e => setReason(e.target.value as WasteReason)}>
                  {WASTE_REASONS.map(r => <option key={r.id} value={r.id}>{tr(r.label)}</option>)}
                </Select>
              )}</Field>
            ) : (
              <Field label={tr('Reason')}>{id => <Input id={id} required maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder={tr('e.g. Weekly supplier delivery')} />}</Field>
            )}
          </div>
          {kind === 'waste' && <Field label={tr('Note')} optional>{id => <Input id={id} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder={tr('e.g. Milk past its date after the weekend')} />}</Field>}
        </fieldset>
        {error && <Notice tone="danger">{error}</Notice>}
        <div><Button type="submit" variant="primary" loading={busy} disabled={!items.length}>{busy ? tr('Saving…') : tr('Record movement')}</Button></div>
      </form>
      <div className="ws-card" style={{ marginTop: 20, overflow: 'hidden' }}>
        <DataTable
          caption={tr('Latest 200 stock movements')}
          maxHeight={360}
          rows={movements}
          rowKey={m => m.id}
          empty={<p className="ws-hint" style={{ padding: 20, margin: 0, textAlign: 'center' }}>{tr('No movements recorded yet.')}</p>}
          columns={[
            { key: 'when', header: tr('When'), render: m => <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(m.created_at)}</span> },
            { key: 'name', header: tr('Material'), render: m => m.name },
            { key: 'kind', header: tr('Type'), render: m => <Badge tone={m.kind === 'purchase' ? 'positive' : m.kind === 'waste' ? 'danger' : 'neutral'}>{m.kind === 'purchase' ? tr('Delivery') : m.kind === 'waste' ? tr('Waste') : m.kind === 'adjustment' ? tr('Correction') : m.kind}</Badge> },
            { key: 'qty', header: tr('Quantity'), align: 'right', render: m => <span style={{ whiteSpace: 'nowrap' }}>{m.quantity > 0 ? '+' : ''}{m.quantity} {m.unit}</span> },
            { key: 'notes', header: tr('Reason'), render: m => [reasonLabel(m.reason), m.notes].filter(Boolean).join(' · ') }
          ]}
        />
      </div>
    </Card>
  );
}
