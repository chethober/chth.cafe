import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
export interface OrderReceipt { id: string; token: string; number: string }
export function OrderTracking({ receipt, onDismiss }: { receipt: OrderReceipt; onDismiss: () => void }) {
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
  const labels: Record<string,string> = { pending: 'Received by the café', preparing: 'Your order is being prepared', ready: 'Ready to collect', completed: 'Collected — enjoy!', cancelled: 'Order cancelled. Please speak to staff.' };
  const steps = ['pending', 'preparing', 'ready', 'completed'];
  const currentStep = steps.indexOf(status);
  return <section aria-label="Order status" className="pm-receipt">
    <div className="pm-receipt-head"><h2>Your order {receipt.number}</h2><button type="button" className="pm-link-button" onClick={onDismiss}>Dismiss receipt</button></div>
    <p role="status" aria-live="polite" className="pm-receipt-status" data-status={status}>{labels[status] || status}</p>
    {status !== 'cancelled' && <ol className="order-steps" aria-label="Order progress">{steps.map((step, index) => <li key={step} aria-current={status === step ? 'step' : undefined} data-done={index <= currentStep || undefined}>{step === 'pending' ? 'Received' : step === 'completed' ? 'Collected' : step === 'ready' ? 'Ready' : 'Preparing'}</li>)}</ol>}
    <p className="pm-receipt-fine">Payment is collected at the café. Keep this receipt until collection.</p>
    {error && <p role="alert" className="pm-receipt-error">{error}</p>}
  </section>;
}
