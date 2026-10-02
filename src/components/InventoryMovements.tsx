import React, { useEffect, useState } from 'react';
import { StockItemSelect } from '../db/schema';
import { api } from '../services/api';
import { store } from '../db/store';
interface Movement { id: string; name: string; kind: string; quantity: number; unit: string; notes: string; created_at: string }
export function InventoryMovements({ items }: { items: StockItemSelect[] }) {
  const [movements,setMovements] = useState<Movement[]>([]); const [stockId,setStockId] = useState('');
  const [kind,setKind] = useState('purchase'); const [quantity,setQuantity] = useState(''); const [notes,setNotes] = useState('');
  const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const refresh = async () => { const result = await api<{ data: Movement[] }>('/api/inventory-movements'); setMovements(result.data); };
  useEffect(() => { void refresh().catch(e=>setError(e.message)); }, [items]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api('/api/inventory-movements', { stockItemId: stockId, kind, quantity: Number(quantity), notes }); setQuantity(''); setNotes(''); await store.syncFromAPI(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed.'); } finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
    <h2 className="text-lg font-semibold">Inventory movements</h2><p className="text-sm text-zinc-400">Purchases add stock; waste removes it. Adjustments use a signed quantity. Orders deduct their recipes automatically. Quantities use the stock item’s unit.</p>
    <form onSubmit={save}><fieldset disabled={busy} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
      <label>Ingredient<select aria-label="Ingredient" required value={stockId} onChange={e=>setStockId(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"><option value="">Choose an ingredient</option>{items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></label>
      <label>Movement<select aria-label="Movement" value={kind} onChange={e=>setKind(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3">{['purchase','waste','adjustment'].map(k=><option key={k}>{k}</option>)}</select></label>
      <label>Quantity {kind === 'waste' ? '(negative)' : kind === 'purchase' ? '(positive)' : '(+ / −)'}<input required type="number" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
      <label>Reason<input required maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
      <button disabled={!items.length} className="min-h-11 rounded-xl btn-brand px-5 text-zinc-950 font-semibold">{busy ? 'Saving…' : 'Record movement'}</button>
    </fieldset></form>{error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    <div className="overflow-x-auto max-h-80"><table className="w-full text-sm text-left"><caption className="sr-only">Latest 200 inventory movements</caption><thead><tr>{['When','Ingredient','Type','Quantity','Reason'].map(h=><th key={h} className="p-2 text-zinc-400">{h}</th>)}</tr></thead><tbody>{movements.map(m=><tr key={m.id} className="border-t border-zinc-800"><td className="p-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td><td className="p-2">{m.name}</td><td className="p-2">{m.kind}</td><td className="p-2 whitespace-nowrap">{m.quantity > 0 ? '+' : ''}{m.quantity} {m.unit}</td><td className="p-2">{m.notes}</td></tr>)}</tbody></table>{!movements.length && <p className="p-3 text-zinc-400">No movements recorded yet.</p>}</div>
  </section>;
}
