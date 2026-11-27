import { formatMoney } from './money';

/** One order as a receipt shows it, for the customer's tracking page, the till's printout and Telegram. */
export interface ReceiptData {
  cafeName: string;
  address: string;
  contactPhone: string;
  currency: string;
  timeZone: string;
  orderNumber: string;
  customerName: string;
  orderType: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  pickupAt: string | null;
  lines: Array<{ name: string; options: string[]; quantity: number; unitPrice: number; discountAmount: number; total: number }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  tipAmount: number;
  taxRate: number;
  /** Club stamps and points, when the order is linked to a member and the club is on. */
  club?: { stamps: number; points: number; stampsPerReward: number; earnedStamps: number; earnedPoints: number } | null;
}

/** Names of the options picked for a line, from its stored JSON: objects with a name, or plain names from older orders. */
export function optionNames(variantsJson: unknown): string[] {
  let parsed: unknown = variantsJson;
  if (typeof variantsJson === 'string') { try { parsed = JSON.parse(variantsJson); } catch { return []; } }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(v => typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string' ? (v as { name: string }).name : '').filter(Boolean);
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The receipt as a Telegram HTML message. */
export function receiptTelegramMessage(r: ReceiptData) {
  const money = (value: number) => formatMoney(value, r.currency);
  let when = r.createdAt;
  try { when = new Intl.DateTimeFormat('en-GB', { timeZone: r.timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(r.createdAt)); } catch {}
  const rows = [
    `🧾 <b>${escapeHtml(r.cafeName)}</b>`,
    `Order <b>${escapeHtml(r.orderNumber)}</b> · ${escapeHtml(when)}`,
    '',
    ...r.lines.map(line => `${line.quantity} × ${escapeHtml(line.name)}${line.options.length ? ` <i>(${escapeHtml(line.options.join(', '))})</i>` : ''} — ${money(line.total)}`),
    '',
    `Subtotal: ${money(r.subtotal)}`,
    ...(r.discountAmount > 0 ? [`Discount: −${money(r.discountAmount)}`] : []),
    `Tax: ${money(r.taxAmount)}`,
    `<b>Total: ${money(r.totalAmount)}</b>`,
    ...(r.tipAmount > 0 ? [`Tip: ${money(r.tipAmount)}`, `<b>Paid: ${money(r.totalAmount + r.tipAmount)}</b>`] : []),
    ...(r.club ? ['', `Club: ${r.club.earnedStamps ? `+${r.club.earnedStamps} stamps, ` : ''}${r.club.stamps} stamps${r.club.points ? ` · ${r.club.points} points` : ''}`] : []),
    '',
    'Thank you!'
  ];
  return rows.join('\n');
}
