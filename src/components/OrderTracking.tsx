import React, { useEffect, useState } from 'react';
import { Printer, ReceiptText, Send } from 'lucide-react';
import { api } from '../services/api';
import { useT } from '../i18n';
import { pickupLabel } from '../utils/pickupSlots';
import type { ReceiptData } from '../utils/receipt';
import { ReceiptView, printReceipt } from './Receipt';
export interface OrderReceipt { id: string; token: string; number: string }
export function OrderTracking({ receipt, timeZone = 'UTC', onDismiss }: { receipt: OrderReceipt; timeZone?: string; onDismiss: () => void }) {
  const t = useT();
  const [status, setStatus] = useState('pending');
  const [pickupAt, setPickupAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [details, setDetails] = useState<{ receipt: ReceiptData; telegramUrl: string | null } | null>(null);
  const trackingUrl = `/api/orders/${encodeURIComponent(receipt.id)}/tracking?token=${encodeURIComponent(receipt.token)}`;
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const result = await api<{ data: { status: string; pickup_at?: string | null } }>(trackingUrl);
        if (active) { setStatus(result.data.status); setPickupAt(result.data.pickup_at || null); setError(''); }
        // A collected or cancelled order never changes again.
        if (['completed', 'cancelled'].includes(result.data.status)) clearInterval(timer);
      } catch { if (active) setError('Status unavailable. Your order receipt is saved; we’ll retry shortly.'); }
    };
    const timer = window.setInterval(refresh, 10000); void refresh();
    return () => { active = false; clearInterval(timer); };
  }, [trackingUrl]);
  // The receipt is read when it is opened, and again once the order is collected, when club stamps are added.
  useEffect(() => {
    if (!showReceipt) return;
    let active = true;
    api<{ data: { receipt?: ReceiptData; telegramUrl?: string | null } }>(`${trackingUrl}&receipt=1`)
      .then(result => { if (active && result.data.receipt) setDetails({ receipt: result.data.receipt, telegramUrl: result.data.telegramUrl || null }); })
      .catch(() => { if (active) setError('The receipt is unavailable right now. Please try again.'); });
    return () => { active = false; };
  }, [showReceipt, status, trackingUrl]);
  const labels: Record<string,string> = { pending: t('Received by the café'), preparing: t('Your order is being prepared'), ready: t('Ready to collect'), completed: t('Collected — enjoy!'), cancelled: t('Order cancelled. Please speak to staff.') };
  const steps = ['pending', 'preparing', 'ready', 'completed'];
  const currentStep = steps.indexOf(status);
  return <section aria-label={t('Order status')} className="pm-receipt">
    <div className="pm-receipt-head"><h2>{t('Your order {number}', { number: receipt.number })}</h2><button type="button" className="pm-link-button" onClick={onDismiss}>{t('Dismiss receipt')}</button></div>
    <p role="status" aria-live="polite" className="pm-receipt-status" data-status={status}>{labels[status] || status}</p>
    {pickupAt && status !== 'cancelled' && status !== 'completed' && <p className="pm-receipt-pickup">{t('Pickup at {time}', { time: pickupLabel(pickupAt, timeZone) })}</p>}
    {status !== 'cancelled' && <ol className="order-steps" aria-label={t('Order progress')}>{steps.map((step, index) => <li key={step} aria-current={status === step ? 'step' : undefined} data-done={index <= currentStep || undefined}>{t(step === 'pending' ? 'Received' : step === 'completed' ? 'Collected' : step === 'ready' ? 'Ready' : 'Preparing')}</li>)}</ol>}
    <p className="pm-receipt-fine">{t('Payment is collected at the café. Keep this receipt until collection.')}</p>
    <div className="pm-receipt-actions">
      <button type="button" className="pm-chip" aria-expanded={showReceipt} onClick={() => setShowReceipt(open => !open)}><ReceiptText size={15} aria-hidden="true" />{t(showReceipt ? 'Hide receipt' : 'View receipt')}</button>
      {showReceipt && details && <>
        <button type="button" className="pm-chip" onClick={() => printReceipt(details.receipt)}><Printer size={15} aria-hidden="true" />{t('Print')}</button>
        {details.telegramUrl && <a className="pm-chip" href={details.telegramUrl} target="_blank" rel="noreferrer"><Send size={15} aria-hidden="true" />{t('Get it on Telegram')}</a>}
      </>}
    </div>
    {showReceipt && details && <ReceiptView receipt={details.receipt} className="pm-receipt-paper" />}
    {error && <p role="alert" className="pm-receipt-error">{t(error)}</p>}
  </section>;
}
