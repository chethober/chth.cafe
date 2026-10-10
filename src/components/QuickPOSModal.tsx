import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CategorySelect, CustomerSelect, MenuItemSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import {
  Field, FormDialog, IconButton, Input, KeyValue, Notice, SearchInput, Segmented, Select, Stepper,
  localDateKey, money, paymentLabel, plural, timestampForDay, ORDER_PAYMENT_METHODS, OrderPaymentMethod
} from '../ui';
import { CustomerPicker } from './CustomerClub';
import { MenuPicker } from './shared';

interface QuickPOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  settings: SettingsSelect;
  onOrderCreated: () => void;
}

interface Line { menuItemId: string; itemName: string; quantity: number; unitPrice: number }

/** Records a completed sale after the fact (e.g. a missed walk-in or back-dated order). */
export const QuickPOSModal: React.FC<QuickPOSModalProps> = ({ isOpen, onClose, categories, menuItems, settings, onOrderCreated }) => {
  const fmt = (v: number) => money(v, settings.currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(() => localDateKey());
  const [customer, setCustomer] = useState('');
  const [member, setMember] = useState<CustomerSelect | null>(null);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout' | 'pickup'>('dine_in');
  const [payment, setPayment] = useState<OrderPaymentMethod>('card');
  const [search, setSearch] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [cart, setCart] = useState<Line[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setDate(localDateKey()); setCustomer(''); setMember(null); setOrderType('dine_in'); setPayment('card');
    setSearch(''); setOpenCategories([]); setCart([]); setError('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (item: MenuItemSelect) =>
    setCart(prev => prev.some(l => l.menuItemId === item.id)
      ? prev.map(l => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l)
      : [...prev, { menuItemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.basePrice }]);
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
        customerName: member?.name || customer.trim() || 'Walk-in',
        customerId: member?.id,
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
      <div className="ws-field">
        <span className="ws-label">Add items</span>
        <div className="ws-toolbar-stack">
          <SearchInput value={search} onChange={setSearch} placeholder="Find a drink or dish" label="Search menu" />
          <MenuPicker
            categories={categories}
            menuItems={menuItems}
            query={search}
            open={openCategories}
            onOpenChange={setOpenCategories}
            quantities={Object.fromEntries(cart.map(l => [l.menuItemId, l.quantity]))}
            onAdd={add}
            fmt={fmt}
            allowSoldOut
          />
        </div>
      </div>

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
      <CustomerPicker customers={store.getCustomers()} orders={store.getOrders()} text={customer} onTextChange={setCustomer} member={member} onMemberChange={setMember} allowSignUp={false} />
      <div className="ws-form-row cols-2">
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
