import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  ArrowDownRight,
  Calendar,
  Tag,
  User,
  DollarSign,
  Plus
} from 'lucide-react';
import { SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';

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

interface ManualLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'income' | 'expense';
  settings: SettingsSelect;
  onFinancialsUpdated: () => void;
}

export const ManualLogModal: React.FC<ManualLogModalProps> = ({
  isOpen,
  onClose,
  initialType = 'income',
  settings,
  onFinancialsUpdated
}) => {
  const manualIncomeItemId = useRef(`manual-inc-${crypto.randomUUID()}`);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState('');
  const [logType, setLogType] = useState<'income' | 'expense'>(initialType);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>('');
  const [title, setTitle] = useState('');
  const [payer, setPayer] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('card');

  // Reset category when logType or modal visibility changes
  useEffect(() => {
    if (isOpen) {
      setLogType(initialType);
      setDate(new Date().toISOString().split('T')[0]);
      setCategory(initialType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
      setPaymentMethod(initialType === 'income' ? 'card' : 'bank_transfer');
      setTitle('');
      setPayer('');
      setAmount('');
    }
  }, [isOpen, initialType]);

  // Update default category when switching tabs inside modal
  const handleTypeChange = (type: 'income' | 'expense') => {
    setLogType(type);
    setCategory(type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    setPaymentMethod(type === 'income' ? 'card' : 'bank_transfer');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingOrder) return;
    setOrderSaveError('');
    if (!title.trim() || !amount) return;

    const numericAmount = parseFloat(amount) || 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const createdAtTimestamp =
      date === todayStr
        ? new Date().toISOString()
        : new Date(`${date}T12:00:00`).toISOString();

    if (logType === 'income') {
    setSavingOrder(true);
    try {
      await store.createOrder({
        customerName: payer.trim() || 'Manual Income Entry',
        orderType: 'takeout',
        paymentMethod: paymentMethod as any,
        status: 'completed',
        createdAt: createdAtTimestamp,
        items: [
          {
            menuItemId: manualIncomeItemId.current,
            itemName: `[${category}] ${title.trim()}`,
            quantity: 1,
            unitPrice: numericAmount,
            variants: []
          }
        ]
      });
    } catch (error) { setOrderSaveError(error instanceof Error ? error.message : 'Order could not be saved.'); return; }
    finally { setSavingOrder(false); }
    } else {
      store.createExpense({
        category,
        description: title.trim() + (payer.trim() ? ` (${payer.trim()})` : ''),
        amount: numericAmount,
        date: date || todayStr,
        paymentMethod: paymentMethod as any,
        loggedByStaffId: 'staff-hasti'
      });
    }

    onFinancialsUpdated();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-black text-sm text-zinc-100">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <span>Manual Financial Log Entry</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Income / Expense Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              logType === 'income'
                ? 'bg-emerald-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Log Income
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              logType === 'expense'
                ? 'bg-rose-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            Log Expense
          </button>
        </div>

        <form aria-busy={savingOrder} onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        {orderSaveError && <p role="alert" className="p-3 rounded-xl border border-rose-500/40 text-rose-400">{orderSaveError}</p>}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-zinc-400" /> Log Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer focus:outline-none focus:border-amber-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-zinc-400" /> Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer focus:outline-none focus:border-amber-500/50"
              >
                {(logType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              {logType === 'income' ? 'Income Title / Source Description' : 'Expense Description / Vendor'}
            </label>
            <input
              type="text"
              placeholder={
                logType === 'income'
                  ? 'e.g. Corporate Catering Tea Bar Event'
                  : 'e.g. Organic Matcha Powder Restock'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <User className="w-3 h-3 text-zinc-400" />{' '}
              {logType === 'income' ? 'Payer / Client Name (Optional)' : 'Vendor / Paid To (Optional)'}
            </label>
            <input
              type="text"
              placeholder={logType === 'income' ? 'e.g. Acme Corp or Private Client' : 'e.g. Local Dairy Supplier'}
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Amount ({settings.currency})
              </label>
              <input
                type="number" inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 font-mono font-bold text-sm focus:outline-none ${
                  logType === 'income' ? 'text-emerald-400 focus:border-emerald-500/50' : 'text-rose-400 focus:border-rose-500/50'
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer focus:outline-none focus:border-amber-500/50"
              >
                {logType === 'income' ? (
                  <>
                    <option value="card">Card / Wire</option>
                    <option value="cash">Cash</option>
                    <option value="google_pay">Google Pay</option>
                    <option value="online">Online / Direct Transfer</option>
                  </>
                ) : (
                  <>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Company Card</option>
                    <option value="cash">Petty Cash</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <button
            type="submit" disabled={savingOrder}
            className={`w-full py-3 rounded-xl font-black uppercase tracking-wider shadow-lg cursor-pointer transition flex items-center justify-center gap-2 ${
              logType === 'income'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                : 'bg-rose-500 hover:bg-rose-400 text-zinc-950'
            }`}
          >
            <Plus className="w-4 h-4" />
            {logType === 'income' ? 'Record Income Entry' : 'Record Expense Entry'}
          </button>
        </form>
      </div>
    </Modal>
  );
};
