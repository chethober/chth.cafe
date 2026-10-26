import React, { useEffect, useState } from 'react';
import { CategorySelect, CustomerSelect, MenuItemSelect, SettingsSelect } from '../db/schema';
import { store, orderAmounts } from '../db/store';
import {
  Field, FormDialog, Input, KeyValue, Notice, SearchInput, Segmented, Select,
  localDateKey, money, paymentLabel, plural, timestampForDay, ORDER_PAYMENT_METHODS, OrderPaymentMethod
} from '../ui';
import { CustomerPicker } from './CustomerClub';
import { MenuPicker, OrderLinesEditor, addMenuItem, lineQuantities, toOrderLines, type EditableLine } from './shared';

interface QuickPOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  settings: SettingsSelect;
  onOrderCreated: () => void;
}

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
  const [cart, setCart] = useState<EditableLine[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setDate(localDateKey()); setCustomer(''); setMember(null); setOrderType('dine_in'); setPayment('card');
    setSearch(''); setOpenCategories([]); setCart([]); setError('');
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (item: MenuItemSelect) => setCart(prev => addMenuItem(prev, item));
  const lines = toOrderLines(cart);
  const { subtotal, discountAmount, taxAmount: tax, totalAmount: total } = orderAmounts(lines, 0, settings.taxRate);

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
        items: lines
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
            quantities={lineQuantities(cart)}
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
          <OrderLinesEditor lines={cart} onChange={setCart} currency={settings.currency} />
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
          items={[
            { label: `Subtotal · ${plural(cart.reduce((s, l) => s + l.quantity, 0), 'item')}`, value: fmt(subtotal) },
            ...(discountAmount > 0 ? [{ label: 'Discounts', value: `−${fmt(discountAmount)}`, tone: 'positive' as const }] : []),
            ...(settings.taxRate > 0 ? [{ label: `Tax (${settings.taxRate}%)`, value: fmt(tax) }] : [])
          ]}
          total={{ label: 'Total', value: fmt(total) }}
        />
      )}
    </FormDialog>
  );
};
