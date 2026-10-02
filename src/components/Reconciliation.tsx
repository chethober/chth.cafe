import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { SettingsSelect } from '../db/schema';
interface Totals { expectedCash: number; expectedCard: number; saved?: { opening_cash: number; actual_cash: number; actual_card: number; notes: string; updated_at: string } | null }
export function Reconciliation({ settings }: { settings: SettingsSelect }) {
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: settings.timeZone || 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [opening, setOpening] = useState('0');
  const [cash, setCash] = useState(''); const [card, setCard] = useState(''); const [notes, setNotes] = useState('');
  const [totals, setTotals] = useState<Totals | null>(null); const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
  useEffect(() => {
    let active = true; setTotals(null); setMessage(''); setCash(''); setCard(''); setNotes(''); setOpening('0');
    api<{data: Totals}>(`/api/reconciliation?date=${date}`).then(result => {
      if (!active) return; setTotals(result.data);
      const saved = result.data.saved;
      if (saved) { setOpening(String(saved.opening_cash)); setCash(String(saved.actual_cash)); setCard(String(saved.actual_card)); setNotes(saved.notes); }
    }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, [date]);
  const expectedCash = (totals?.expectedCash || 0) + Number(opening || 0);
  const money = (v: number) => `${settings.currency}${v.toFixed(2)}`;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try {
      const result = await api<{data: Totals}>('/api/reconciliation', { date, openingCash: Number(opening), actualCash: Number(cash), actualCard: Number(card), notes });
      setTotals({ ...result.data, expectedCash: result.data.expectedCash - Number(opening) }); setMessage('Reconciliation saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed.'); } finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
    <h2 className="text-lg font-semibold">End-of-day reconciliation</h2><p className="text-sm text-zinc-400">Completed orders only. Expected cash includes opening float and subtracts cash expenses. Dates use {settings.timeZone || 'Asia/Tehran'}.</p>
    <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <label className="text-sm">Business date<input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
      <label className="text-sm">Opening cash float<input required type="number" min="0" step="0.01" value={opening} onChange={e=>setOpening(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
      <label className="text-sm">Counted cash<input required type="number" min="0" step="0.01" value={cash} onChange={e=>setCash(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
      <label className="text-sm">Card terminal total<input required type="number" min="0" step="0.01" value={card} onChange={e=>setCard(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
    </fieldset>
    {totals && <div className="grid sm:grid-cols-2 gap-3 text-sm"><p>Expected cash: <strong>{money(expectedCash)}</strong>{cash !== '' && <> · Difference: <strong className={Number(cash) === expectedCash ? 'text-emerald-400' : 'text-amber-400'}>{money(Number(cash)-expectedCash)}</strong></>}</p><p>Expected card: <strong>{money(totals.expectedCard)}</strong>{card !== '' && <> · Difference: <strong>{money(Number(card)-totals.expectedCard)}</strong></>}</p></div>}
    <label className="block text-sm">Notes<textarea disabled={busy} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
    <button disabled={busy || !totals} className="min-h-11 rounded-xl btn-brand px-5 font-semibold text-zinc-950">{busy ? 'Saving…' : 'Save reconciliation'}</button>
    </form>{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
