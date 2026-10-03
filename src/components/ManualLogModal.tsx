import React, { useEffect, useRef, useState } from 'react';
import { SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { AffixInput, Field, FormDialog, Input, Notice, Segmented, Select, localDateKey, timestampForDay } from '../ui';

export const EXPENSE_CATEGORIES = [
  'Tea & Coffee Supplies',
  'Packaging & Cups',
  'Utilities & Power',
  'Equipment & Repairs',
  'Rent & Lease',
  'Labor Wages (Staff)',
  'Marketing & Other'
];

export const INCOME_CATEGORIES = [
  'Catering & Corporate',
  'Wholesale Tea & Coffee',
  'Event & Space Rental',
  'Merchandise & Retail',
  'Consulting & Services',
  'General Manual Revenue'
];

const INCOME_METHODS = [['card', 'Card / wire'], ['cash', 'Cash'], ['google_pay', 'Google Pay'], ['online', 'Online / direct transfer']];
const EXPENSE_METHODS = [['bank_transfer', 'Bank transfer'], ['card', 'Company card'], ['cash', 'Petty cash']];

interface ManualLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'income' | 'expense';
  settings: SettingsSelect;
  onFinancialsUpdated: () => void;
}

export const ManualLogModal: React.FC<ManualLogModalProps> = ({ isOpen, onClose, initialType = 'income', settings, onFinancialsUpdated }) => {
  const manualIncomeItemId = useRef(`manual-inc-${crypto.randomUUID()}`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logType, setLogType] = useState<'income' | 'expense'>(initialType);
  const [date, setDate] = useState(() => localDateKey());
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');

  const applyType = (type: 'income' | 'expense') => {
    setLogType(type);
    setCategory(type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    setPaymentMethod(type === 'income' ? 'card' : 'bank_transfer');
  };

  useEffect(() => {
    if (!isOpen) return;
    applyType(initialType);
    setDate(localDateKey());
    setTitle('');
    setParty('');
    setAmount('');
    setError('');
  }, [isOpen, initialType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !title.trim() || !amount) return;
    setError('');
    const value = parseFloat(amount) || 0;
    if (logType === 'income') {
      setSaving(true);
      try {
        await store.createOrder({
          customerName: party.trim() || 'Manual Income Entry',
          orderType: 'takeout',
          paymentMethod: paymentMethod as 'cash',
          status: 'completed',
          createdAt: timestampForDay(date),
          items: [{ menuItemId: manualIncomeItemId.current, itemName: `[${category}] ${title.trim()}`, quantity: 1, unitPrice: value, variants: [] }]
        });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Income could not be saved.');
        return;
      } finally {
        setSaving(false);
      }
    } else {
      store.createExpense({
        category,
        description: title.trim() + (party.trim() ? ` (${party.trim()})` : ''),
        amount: value,
        date: date || localDateKey(),
        paymentMethod: paymentMethod as 'cash',
        loggedByStaffId: 'staff-hasti'
      });
    }
    onFinancialsUpdated();
    onClose();
  };

  const income = logType === 'income';
  return (
    <FormDialog
      open={isOpen}
      onClose={onClose}
      busy={saving}
      title="Log income or expense"
      description="For money that didn't come through an order, or costs outside wages."
      submitLabel={income ? 'Record income' : 'Record expense'}
      submitDisabled={!title.trim() || !amount}
      onSubmit={handleSubmit}
    >
      <Segmented block label="Entry type" value={logType} onChange={applyType} options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label={income ? 'What was it for?' : 'What was bought?'}>{id => (
        <Input id={id} autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder={income ? 'e.g. Corporate tea bar event' : 'e.g. Matcha powder restock'} />
      )}</Field>
      <div className="ws-form-row cols-2">
        <Field label="Amount">{id => <AffixInput id={id} affix={settings.currency} type="number" inputMode="decimal" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />}</Field>
        <Field label="Date">{id => <Input id={id} type="date" required value={date} onChange={e => setDate(e.target.value)} />}</Field>
      </div>
      <div className="ws-form-row cols-2">
        <Field label="Category">{id => (
          <Select id={id} value={category} onChange={e => setCategory(e.target.value)}>
            {(income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}</Field>
        <Field label={income ? 'Received by' : 'Paid with'}>{id => (
          <Select id={id} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            {(income ? INCOME_METHODS : EXPENSE_METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}</Field>
      </div>
      <Field label={income ? 'Paid by' : 'Paid to'} optional>{id => (
        <Input id={id} value={party} onChange={e => setParty(e.target.value)} placeholder={income ? 'e.g. Acme Corp' : 'e.g. Local dairy supplier'} />
      )}</Field>
    </FormDialog>
  );
};
