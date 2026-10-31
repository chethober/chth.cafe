import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useT } from '../i18n';
export interface OrderReceipt { id: string; token: string; number: string }
export function OrderTracking({ receipt, onDismiss }: { receipt: OrderReceipt; onDismiss: () => void }) {
  const t = useT();
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const result = await api<{ data: { status: string } }>(`/api/orders/${encodeURIComponent(receipt.id)}/tracking?token=${encodeURIComponent(receipt.token)}`);
        if (active) { setStatus(result.data.status); setError(''); }
        // A collected or cancelled order never changes again.
        if (['completed', 'cancelled'].includes(result.data.status)) clearInterval(timer);
      } catch { if (active) setError('Status unavailable. Your order receipt is saved; we’ll retry shortly.'); }
    };
    const timer = window.setInterval(refresh, 10000); void refresh();
    return () => { active = false; clearInterval(timer); };
  }, [receipt.id, receipt.token]);
  const labels: Record<string,string> = { pending: t('Received by the café'), preparing: t('Your order is being prepared'), ready: t('Ready to collect'), completed: t('Collected — enjoy!'), cancelled: t('Order cancelled. Please speak to staff.') };
  const steps = ['pending', 'preparing', 'ready', 'completed'];
  const currentStep = steps.indexOf(status);
  return <section aria-label={t('Order status')} className="pm-receipt">
    <div className="pm-receipt-head"><h2>{t('Your order {number}', { number: receipt.number })}</h2><button type="button" className="pm-link-button" onClick={onDismiss}>{t('Dismiss receipt')}</button></div>
    <p role="status" aria-live="polite" className="pm-receipt-status" data-status={status}>{labels[status] || status}</p>
    {status !== 'cancelled' && <ol className="order-steps" aria-label={t('Order progress')}>{steps.map((step, index) => <li key={step} aria-current={status === step ? 'step' : undefined} data-done={index <= currentStep || undefined}>{t(step === 'pending' ? 'Received' : step === 'completed' ? 'Collected' : step === 'ready' ? 'Ready' : 'Preparing')}</li>)}</ol>}
    <p className="pm-receipt-fine">{t('Payment is collected at the café. Keep this receipt until collection.')}</p>
    {error && <p role="alert" className="pm-receipt-error">{t(error)}</p>}
  </section>;
}
