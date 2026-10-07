import React, { useEffect, useState } from 'react';
import { StockItemSelect } from '../db/schema';
import { api } from '../services/api';
import { store } from '../db/store';
import { Badge, Button, Card, DataTable, Field, Input, Notice, Segmented, Select, formatDateTime } from '../ui';

interface Movement { id: string; name: string; kind: string; quantity: number; unit: string; notes: string; created_at: string }
type Kind = 'purchase' | 'waste' | 'adjustment';
const KIND_HINT: Record<Kind, string> = {
  purchase: 'Positive amount added to stock',
  waste: 'Negative amount removed from stock',
  adjustment: 'Positive or negative correction'
};

/** Purchases, waste and corrections, with the latest 200 movements below. */
export function InventoryMovements({ items }: { items: StockItemSelect[] }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stockId, setStockId] = useState('');
  const [kind, setKind] = useState<Kind>('purchase');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
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
      await api('/api/inventory-movements', { stockItemId: stockId, kind, quantity: Number(quantity), notes });
      setQuantity(''); setNotes('');
      await store.syncFromAPI();
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Save failed.'); }
    finally { setBusy(false); }
  };
  const unit = items.find(i => i.id === stockId)?.unit;

  return (
    <Card title="Stock movements" description="Record deliveries, waste, and corrections. Quantities use each material's unit.">
      <form className="ws-form" onSubmit={save} aria-busy={busy}>
        <fieldset className="ws-fieldset ws-form" disabled={busy}>
          <Segmented label="Movement type" value={kind} onChange={setKind} options={[
            { value: 'purchase', label: 'Delivery' }, { value: 'waste', label: 'Waste' }, { value: 'adjustment', label: 'Correction' }
          ]} />
          <div className="ws-form-row cols-3">
            <Field label="Material">{id => (
              <Select id={id} required value={stockId} onChange={e => setStockId(e.target.value)}>
                <option value="">Choose a material</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </Select>
            )}</Field>
            <Field label={`Quantity${unit ? ` (${unit})` : ''}`} hint={KIND_HINT[kind]}>{(id, hint) => (
              <Input id={id} aria-describedby={hint} required type="number" inputMode="decimal" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} />
            )}</Field>
            <Field label="Reason">{id => <Input id={id} required maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Weekly supplier delivery" />}</Field>
          </div>
        </fieldset>
        {error && <Notice tone="danger">{error}</Notice>}
        <div><Button type="submit" variant="primary" loading={busy} disabled={!items.length}>{busy ? 'Saving…' : 'Record movement'}</Button></div>
      </form>
      <div className="ws-card" style={{ marginTop: 20, overflow: 'hidden' }}>
        <DataTable
          caption="Latest 200 stock movements"
          maxHeight={360}
          rows={movements}
          rowKey={m => m.id}
          empty={<p className="ws-hint" style={{ padding: 20, margin: 0, textAlign: 'center' }}>No movements recorded yet.</p>}
          columns={[
            { key: 'when', header: 'When', render: m => <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(m.created_at)}</span> },
            { key: 'name', header: 'Material', render: m => m.name },
            { key: 'kind', header: 'Type', render: m => <Badge tone={m.kind === 'purchase' ? 'positive' : m.kind === 'waste' ? 'danger' : 'neutral'}>{m.kind === 'purchase' ? 'Delivery' : m.kind === 'waste' ? 'Waste' : m.kind === 'adjustment' ? 'Correction' : m.kind}</Badge> },
            { key: 'qty', header: 'Quantity', align: 'right', render: m => <span style={{ whiteSpace: 'nowrap' }}>{m.quantity > 0 ? '+' : ''}{m.quantity} {m.unit}</span> },
            { key: 'notes', header: 'Reason', render: m => m.notes }
          ]}
        />
      </div>
    </Card>
  );
}
