export interface Supplier {
  id: string;
  name: string;
  phone: string;
  /** A Telegram username or link, for sending orders. */
  telegram: string;
  leadTimeDays: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'cancelled';

export interface PurchaseOrderLine {
  id: string;
  stockItemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  receivedQuantity: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string | null;
  supplierName: string;
  status: PurchaseOrderStatus;
  notes: string;
  expectedOn: string;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  lines: PurchaseOrderLine[];
}

/** How much to order to bring a material back to twice its reorder level, or 0 when it is above the level. */
export function reorderQuantity(item: { quantity: number; minThreshold: number }) {
  if (item.quantity > item.minThreshold) return 0;
  const target = Math.max(item.minThreshold * 2, item.minThreshold + 1);
  return Math.max(0, Math.ceil((target - item.quantity) * 100) / 100);
}

const amount = (value: number) => Number(value.toFixed(3)).toString();

/** The order as plain text, to paste into Telegram, WhatsApp or an SMS. */
export function purchaseOrderText(po: Pick<PurchaseOrder, 'supplierName' | 'notes' | 'expectedOn' | 'lines'>, cafeName: string, formatMoney?: (value: number) => string) {
  const lines = po.lines.map(line => `• ${line.name}: ${amount(line.quantity)} ${line.unit}`);
  const total = po.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  return [
    `Order from ${cafeName}${po.supplierName ? ` for ${po.supplierName}` : ''}`,
    '',
    ...lines,
    ...(po.expectedOn ? ['', `Needed by ${po.expectedOn}`] : []),
    ...(po.notes ? ['', po.notes] : []),
    ...(formatMoney && total > 0 ? ['', `Estimated cost: ${formatMoney(total)}`] : []),
    '',
    'Thank you!'
  ].join('\n');
}

/** Why stock was thrown away. Stored as the key; shown translated. */
export const WASTE_REASONS = [
  { id: 'expired', label: 'Expired' },
  { id: 'spoiled', label: 'Spoiled' },
  { id: 'spilled', label: 'Spilled or dropped' },
  { id: 'mistake', label: 'Made wrong' },
  { id: 'returned', label: 'Sent back' },
  { id: 'staff', label: 'Staff drink or meal' },
  { id: 'other', label: 'Other' }
] as const;
export type WasteReason = (typeof WASTE_REASONS)[number]['id'];
export const isWasteReason = (value: unknown): value is WasteReason => WASTE_REASONS.some(r => r.id === value);
