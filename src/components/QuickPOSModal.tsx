import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MenuItemSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import {
  Button, Field, FormDialog, IconButton, Input, KeyValue, Notice, Segmented, Select, Stepper,
  localDateKey, money, paymentLabel, plural, timestampForDay, ORDER_PAYMENT_METHODS, OrderPaymentMethod
} from '../ui';

interface QuickPOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItemSelect[];
  settings: SettingsSelect;
  onOrderCreated: () => void;
}

interface Line { menuItemId: string; itemName: string; quantity: number; unitPrice: number }

/** Records a completed sale after the fact (e.g. a missed walk-in or back-dated order). */
export const QuickPOSModal: React.FC<QuickPOSModalProps> = ({ isOpen, onClose, menuItems, settings, onOrderCreated }) => {
  const fmt = (v: number) => money(v, settings.currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(() => localDateKey());
  const [customer, setCustomer] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout' | 'pickup'>('dine_in');
  const [payment, setPayment] = useState<OrderPaymentMethod>('card');
  const [selectedId, setSelectedId] = useState('');
  const [cart, setCart] = useState<Line[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setDate(localDateKey()); setCustomer(''); setOrderType('dine_in'); setPayment('card');
    setSelectedId(menuItems[0]?.id || ''); setCart([]); setError('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => {
    const item = menuItems.find(i => i.id === selectedId);
    if (!item) return;
    setCart(prev => prev.some(l => l.menuItemId === item.id)
      ? prev.map(l => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l)
      : [...prev, { menuItemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.basePrice }]);
  };
  const changeQty = (id: string, delta: number) =>
    setCart(prev => prev.flatMap(l => l.menuItemId !== id ? [l] : l.quantity + delta > 0 ? [{ ...l, quantity: l.quantity + delta }] : []));

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const tax = (subtotal * settings.taxRate) / 100;
  const total = subtotal + tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || cart.length === 0) return;
    setError('');
    setSaving(true);
    try {
      await store.createOrder({
        customerName: customer.trim() || 'Walk-in',
        orderType,
        paymentMethod: payment,
        status: 'completed',
        createdAt: timestampForDay(date),
        items: cart.map(l => ({ ...l, variants: [] }))
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sale could not be saved.');
      return;
    } finally {
      setSaving(false);
    }
    onOrderCreated();
    onClose();
  };

  return (
    <FormDialog
      open={isOpen}
      onClose={onClose}
      busy={saving}
      title="Record a sale"
      description="Saved as a completed, paid order."
      submitLabel={cart.length ? `Record ${fmt(total)}` : 'Record sale'}
      submitDisabled={cart.length === 0}
      onSubmit={handleSubmit}
    >
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Add items">{id => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Select id={id} value={selectedId} onChange={e => setSelectedId(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}>
            {menuItems.map(i => <option key={i.id} value={i.id}>{i.name} · {fmt(i.basePrice)}</option>)}
          </Select>
          <Button icon={<Plus />} onClick={add} disabled={!selectedId}>Add</Button>
        </div>
      )}</Field>

      {cart.length === 0 ? (
        <div className="ws-lane-empty">No items yet.</div>
      ) : (
        <div className="ws-panel" style={{ padding: '4px 12px' }}>
          <ul className="ws-list">
            {cart.map(l => (
              <li key={l.menuItemId} className="ws-list-item" style={{ padding: '8px 0', minHeight: 0 }}>
                <div className="ws-list-main">
                  <span className="ws-truncate" style={{ fontWeight: 600 }}>{l.itemName}</span>
                  <span className="ws-hint tabular">{fmt(l.unitPrice)} each</span>
                </div>
                <Stepper label={`${l.itemName} quantity`} value={l.quantity} onDecrement={() => changeQty(l.menuItemId, -1)} onIncrement={() => changeQty(l.menuItemId, 1)} />
                <span className="ws-amount" style={{ minWidth: 72, textAlign: 'right' }}>{fmt(l.unitPrice * l.quantity)}</span>
                <IconButton label={`Remove ${l.itemName}`} variant="danger-ghost" onClick={() => setCart(prev => prev.filter(x => x.menuItemId !== l.menuItemId))}><Trash2 /></IconButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Segmented block label="Order type" value={orderType} onChange={setOrderType} options={[{ value: 'dine_in', label: 'Dine-in' }, { value: 'takeout', label: 'Takeout' }, { value: 'pickup', label: 'Pickup' }]} />
      <div className="ws-form-row cols-3">
        <Field label="Customer" optional>{id => <Input id={id} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Walk-in" />}</Field>
        <Field label="Payment">{id => (
          <Select id={id} value={payment} onChange={e => setPayment(e.target.value as OrderPaymentMethod)}>
            {ORDER_PAYMENT_METHODS.map(m => <option key={m} value={m}>{paymentLabel(m)}</option>)}
          </Select>
        )}</Field>
        <Field label="Date">{id => <Input id={id} type="date" required max={localDateKey()} value={date} onChange={e => setDate(e.target.value)} />}</Field>
      </div>
      {cart.length > 0 && (
        <KeyValue
          items={[{ label: `Subtotal · ${plural(cart.reduce((s, l) => s + l.quantity, 0), 'item')}`, value: fmt(subtotal) }, ...(settings.taxRate > 0 ? [{ label: `Tax (${settings.taxRate}%)`, value: fmt(tax) }] : [])]}
          total={{ label: 'Total', value: fmt(total) }}
        />
      )}
    </FormDialog>
  );
};
