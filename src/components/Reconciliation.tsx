import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { SettingsSelect } from '../db/schema';
import { AffixInput, Button, Card, Field, Input, KeyValue, Notice, Textarea, money } from '../ui';

interface Totals { expectedCash: number; expectedCard: number; saved?: { opening_cash: number; actual_cash: number; actual_card: number; notes: string; updated_at: string } | null }

/** End-of-day cash and card count against what the orders say should be there. */
export function Reconciliation({ settings }: { settings: SettingsSelect }) {
  const timeZone = settings.timeZone || 'Asia/Tehran';
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [opening, setOpening] = useState('0');
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const [notes, setNotes] = useState('');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'positive' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setTotals(null); setMessage(null); setCash(''); setCard(''); setNotes(''); setOpening('0');
    api<{ data: Totals }>(`/api/reconciliation?date=${date}`).then(result => {
      if (!active) return;
      setTotals(result.data);
      const saved = result.data.saved;
      if (saved) { setOpening(String(saved.opening_cash)); setCash(String(saved.actual_cash)); setCard(String(saved.actual_card)); setNotes(saved.notes); }
    }).catch(e => { if (active) setMessage({ tone: 'danger', text: e.message }); });
    return () => { active = false; };
  }, [date]);

  const fmt = (v: number) => money(v, settings.currency);
  const expectedCash = (totals?.expectedCash || 0) + Number(opening || 0);
  const cashDiff = cash === '' ? null : Number(cash) - expectedCash;
  const cardDiff = cash === '' && card === '' ? null : card === '' ? null : Number(card) - (totals?.expectedCard || 0);
  const diffText = (d: number) => d === 0 ? 'Balanced' : `${d > 0 ? 'Over' : 'Short'} by ${fmt(Math.abs(d))}`;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      const result = await api<{ data: Totals }>('/api/reconciliation', { date, openingCash: Number(opening), actualCash: Number(cash), actualCard: Number(card), notes });
      setTotals({ ...result.data, expectedCash: result.data.expectedCash - Number(opening) });
      setMessage({ tone: 'positive', text: 'Day closed and saved.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Save failed.' });
    } finally { setBusy(false); }
  };

  return (
    <Card title="Close the day" description={`Count the drawer and card terminal. Completed orders only, dates in ${timeZone}.`}>
      <form className="ws-form" onSubmit={save} aria-busy={busy}>
        <fieldset className="ws-fieldset ws-form" disabled={busy}>
          <div className="ws-form-row cols-2">
            <Field label="Business date">{id => <Input id={id} type="date" required value={date} onChange={e => setDate(e.target.value)} />}</Field>
            <Field label="Opening float">{id => <AffixInput id={id} affix={settings.currency} type="number" inputMode="decimal" min="0" step="0.01" required value={opening} onChange={e => setOpening(e.target.value)} />}</Field>
            <Field label="Counted cash">{id => <AffixInput id={id} affix={settings.currency} type="number" inputMode="decimal" min="0" step="0.01" required value={cash} onChange={e => setCash(e.target.value)} />}</Field>
            <Field label="Card terminal total">{id => <AffixInput id={id} affix={settings.currency} type="number" inputMode="decimal" min="0" step="0.01" required value={card} onChange={e => setCard(e.target.value)} />}</Field>
          </div>
          {totals && (
            <KeyValue items={[
              { label: 'Expected cash (incl. float, less cash expenses)', value: fmt(expectedCash) },
              ...(cashDiff !== null ? [{ label: 'Cash', value: diffText(cashDiff), tone: cashDiff === 0 ? 'positive' as const : 'danger' as const }] : []),
              { label: 'Expected card', value: fmt(totals.expectedCard) },
              ...(cardDiff !== null ? [{ label: 'Card', value: diffText(cardDiff), tone: cardDiff === 0 ? 'positive' as const : 'danger' as const }] : [])
            ]} />
          )}
          <Field label="Notes" optional>{id => <Textarea id={id} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} rows={2} placeholder="Anything that explains a difference" />}</Field>
        </fieldset>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <div><Button type="submit" variant="primary" loading={busy} disabled={!totals}>{busy ? 'Saving…' : 'Save day'}</Button></div>
      </form>
    </Card>
  );
}
