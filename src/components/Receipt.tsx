import React from 'react';
import { OrderItemSelect, OrderSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { getLocale, intlTag, tr } from '../i18n';
import { dirOf } from '../chth-kit/locales.js';
import { formatMoney } from '../utils/money';
import { parseLoyalty } from '../utils/loyalty';
import { pickupLabel } from '../utils/pickupSlots';
import { escapeHtml, printDocument } from '../utils/print';
import { optionNames, type ReceiptData } from '../utils/receipt';
import { orderTypeLabel, paymentLabel } from '../ui';

/** A staff-side order as a receipt, with the linked member's balance when the club is on. */
export function receiptFromOrder(order: OrderSelect, items: OrderItemSelect[], settings: SettingsSelect): ReceiptData {
  const loyalty = parseLoyalty(settings.loyalty);
  const member = order.customerId ? store.getCustomers().find(c => c.id === order.customerId) : undefined;
  return {
    cafeName: settings.cafeName, address: settings.address || '', contactPhone: settings.contactPhone || '', currency: settings.currency,
    timeZone: settings.timeZone || 'UTC', orderNumber: order.orderNumber, customerName: order.customerName || '', orderType: order.orderType,
    paymentMethod: order.paymentMethod, status: order.status, createdAt: order.createdAt, pickupAt: order.pickupAt || null,
    lines: items.map(item => ({
      name: item.itemName, options: optionNames(item.variantsJson), quantity: item.quantity, unitPrice: item.unitPrice,
      discountAmount: item.discountAmount || 0, total: item.itemTotal ?? Number((item.quantity * item.unitPrice - (item.discountAmount || 0)).toFixed(2))
    })),
    subtotal: order.subtotal, discountAmount: order.discountAmount, taxAmount: order.taxAmount, totalAmount: order.totalAmount,
    tipAmount: order.tipAmount || 0, taxRate: settings.taxRate,
    club: member && loyalty.enabled ? { stamps: member.stamps || 0, points: member.points || 0, stampsPerReward: loyalty.stampsPerReward, earnedStamps: 0, earnedPoints: 0 } : null
  };
}

const when = (r: ReceiptData) => {
  try { return new Date(r.createdAt).toLocaleString(intlTag(), { timeZone: r.timeZone, dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return new Date(r.createdAt).toLocaleString(intlTag()); }
};

/** Rows of the money summary, shared by the screen and the printout. */
function summaryRows(r: ReceiptData): Array<{ label: string; value: string; strong?: boolean }> {
  const money = (value: number) => formatMoney(value, r.currency);
  return [
    { label: tr('Subtotal'), value: money(r.subtotal) },
    ...(r.discountAmount > 0 ? [{ label: tr('Discount'), value: `−${money(r.discountAmount)}` }] : []),
    { label: tr('Tax ({taxRate}%)', { taxRate: r.taxRate }), value: money(r.taxAmount) },
    { label: tr('Total'), value: money(r.totalAmount), strong: r.tipAmount <= 0 },
    ...(r.tipAmount > 0 ? [{ label: tr('Tip'), value: money(r.tipAmount) }, { label: tr('Paid'), value: money(r.totalAmount + r.tipAmount), strong: true }] : [])
  ];
}

function clubLine(r: ReceiptData) {
  if (!r.club) return '';
  const parts = [];
  if (r.club.earnedStamps) parts.push(tr('+{count} stamps', { count: r.club.earnedStamps }));
  if (r.club.stampsPerReward) parts.push(tr('{onCard} of {per} stamps', { onCard: r.club.stamps % r.club.stampsPerReward, per: r.club.stampsPerReward }));
  if (r.club.earnedPoints) parts.push(tr('+{count} points', { count: r.club.earnedPoints }));
  if (r.club.points) parts.push(tr('{count} points', { count: r.club.points }));
  return parts.join(' · ');
}

/** The receipt on screen: what was ordered, the money, and the club balance. */
export function ReceiptView({ receipt: r, className = '' }: { receipt: ReceiptData; className?: string }) {
  const money = (value: number) => formatMoney(value, r.currency);
  return (
    <div className={`receipt ${className}`}>
      <div className="receipt-head">
        <strong>{r.cafeName}</strong>
        {r.address && <span>{r.address}</span>}
        <span>{tr('Order {orderNumber}', { orderNumber: r.orderNumber })} · {when(r)}</span>
        <span>{orderTypeLabel(r.orderType)} · {paymentLabel(r.paymentMethod)}{r.pickupAt ? ` · ${tr('Pickup {time}', { time: pickupLabel(r.pickupAt, r.timeZone) })}` : ''}</span>
      </div>
      <ul className="receipt-lines">
        {r.lines.map((line, index) => (
          <li key={index}>
            <span>
              <span className="tabular">{line.quantity}×</span> {line.name}
              {line.options.length > 0 && <small>{line.options.join(', ')}</small>}
              {line.discountAmount > 0 && <small>{tr('−{discountAmount} off', { discountAmount: money(line.discountAmount) })}</small>}
            </span>
            <span className="tabular">{money(line.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="receipt-sum">
        {summaryRows(r).map(row => <div key={row.label} data-strong={row.strong || undefined}><dt>{row.label}</dt><dd className="tabular">{row.value}</dd></div>)}
      </dl>
      {r.club && clubLine(r) && <p className="receipt-club">{tr('Club')}: {clubLine(r)}</p>}
      <p className="receipt-thanks">{tr('Thank you!')}</p>
    </div>
  );
}

/** Prints the receipt on an 80 mm roll, which also fits A4. */
export function printReceipt(r: ReceiptData) {
  const locale = getLocale();
  const money = (value: number) => escapeHtml(formatMoney(value, r.currency));
  const lines = r.lines.map(line => `<tr><td>${line.quantity}× ${escapeHtml(line.name)}${line.options.length ? `<small>${escapeHtml(line.options.join(', '))}</small>` : ''}${line.discountAmount > 0 ? `<small>${escapeHtml(tr('−{discountAmount} off', { discountAmount: formatMoney(line.discountAmount, r.currency) }))}</small>` : ''}</td><td class="n">${money(line.total)}</td></tr>`).join('');
  const sums = summaryRows(r).map(row => `<tr${row.strong ? ' class="strong"' : ''}><td>${escapeHtml(row.label)}</td><td class="n">${escapeHtml(row.value)}</td></tr>`).join('');
  const club = clubLine(r);
  const html = `<!doctype html><html lang="${locale}" dir="${dirOf(locale)}"><head><meta charset="utf-8"><title>${escapeHtml(r.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  html, body { margin: 0; background: #fff; color: #000; }
  body { font: 10pt/1.35 'Vazirmatn', system-ui, -apple-system, 'Segoe UI', sans-serif; width: 72mm; margin: 0 auto; }
  header { text-align: center; display: grid; gap: 1mm; padding-bottom: 3mm; border-bottom: 1px dashed #000; }
  header strong { font-size: 14pt; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
  td { padding: 1mm 0; vertical-align: top; }
  td.n { text-align: end; white-space: nowrap; padding-inline-start: 3mm; direction: ltr; unicode-bidi: isolate; }
  small { display: block; color: #333; font-size: 8.5pt; }
  .sums { border-top: 1px dashed #000; }
  .strong td { font-weight: 700; font-size: 12pt; border-top: 1px solid #000; }
  p { text-align: center; margin: 2mm 0; }
</style></head><body>
<header><strong>${escapeHtml(r.cafeName)}</strong>${r.address ? `<span>${escapeHtml(r.address)}</span>` : ''}${r.contactPhone ? `<span>${escapeHtml(r.contactPhone)}</span>` : ''}
<span>${escapeHtml(tr('Order {orderNumber}', { orderNumber: r.orderNumber }))} · ${escapeHtml(when(r))}</span>
<span>${escapeHtml(orderTypeLabel(r.orderType))} · ${escapeHtml(paymentLabel(r.paymentMethod))}${r.pickupAt ? ` · ${escapeHtml(tr('Pickup {time}', { time: pickupLabel(r.pickupAt, r.timeZone) }))}` : ''}</span>
${r.customerName ? `<span>${escapeHtml(r.customerName)}</span>` : ''}</header>
<table>${lines}</table>
<table class="sums">${sums}</table>
${club ? `<p>${escapeHtml(tr('Club'))}: ${escapeHtml(club)}</p>` : ''}
<p>${escapeHtml(tr('Thank you!'))}</p>
</body></html>`;
  printDocument(html);
}
