import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Calendar,
  User,
  CreditCard,
  Utensils,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import { MenuItemSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';

interface QuickPOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItemSelect[];
  settings: SettingsSelect;
  onOrderCreated: () => void;
}

interface POSCartItem {
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export const QuickPOSModal: React.FC<QuickPOSModalProps> = ({
  isOpen,
  onClose,
  menuItems,
  settings,
  onOrderCreated
}) => {
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('Walk-in');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout' | 'pickup'>('dine_in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'google_pay' | 'online'>('card');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [cart, setCart] = useState<POSCartItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setOrderDate(new Date().toISOString().split('T')[0]);
      setCustomerName('Walk-in');
      setOrderType('dine_in');
      setPaymentMethod('card');
      setSelectedItemId(menuItems[0]?.id || '');
      setSelectedQty(1);
      setCart([]);
    }
  }, [isOpen, menuItems]);

  const handleAddToCart = () => {
    const item = menuItems.find((i) => i.id === selectedItemId);
    if (!item || selectedQty <= 0) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex((ci) => ci.menuItemId === item.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + selectedQty
        };
        return updated;
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          itemName: item.name,
          quantity: selectedQty,
          unitPrice: item.basePrice
        }
      ];
    });

    setSelectedQty(1);
  };

  const handleUpdateQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.menuItemId === menuItemId) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as POSCartItem[]
    );
  };

  const handleRemoveFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.menuItemId !== menuItemId));
  };

  const rawSubtotal = cart.reduce((sum, ci) => sum + ci.unitPrice * ci.quantity, 0);
  const taxAmount = (rawSubtotal * settings.taxRate) / 100;
  const totalAmount = rawSubtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingOrder) return;
    setOrderSaveError('');
    if (cart.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const createdAtTimestamp =
      orderDate === todayStr
        ? new Date().toISOString()
        : new Date(`${orderDate}T12:00:00`).toISOString();

    setSavingOrder(true);
    try {
      await store.createOrder({
      customerName: customerName.trim() || 'Walk-in',
      orderType,
      paymentMethod,
      status: 'completed',
      createdAt: createdAtTimestamp,
      items: cart.map((ci) => ({
        menuItemId: ci.menuItemId,
        itemName: ci.itemName,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        variants: []
      }))
    });
    } catch (error) { setOrderSaveError(error instanceof Error ? error.message : 'Order could not be saved.'); return; }
    finally { setSavingOrder(false); }

    onOrderCreated();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-black text-sm text-zinc-100">
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          <span>Record Quick POS Walk-in Sale</span>
        </div>
      }
    >
      <form aria-busy={savingOrder} onSubmit={handleSubmit} className="space-y-4 text-xs">
        {orderSaveError && <p role="alert" className="p-3 rounded-xl border border-rose-500/40 text-rose-400">{orderSaveError}</p>}

        {/* Date & Order Meta Row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-zinc-400" /> Order Date
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer focus:outline-none focus:border-amber-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <User className="w-3 h-3 text-zinc-400" /> Customer Name
            </label>
            <input
              type="text"
              placeholder="e.g. Walk-in or John"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Utensils className="w-3 h-3 text-zinc-400" /> Order Type
            </label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer focus:outline-none focus:border-amber-500/50"
            >
              <option value="dine_in">Dine-in</option>
              <option value="takeout">Takeout</option>
              <option value="pickup">Pickup</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-zinc-400" /> Payment Channel
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer focus:outline-none focus:border-amber-500/50"
            >
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="google_pay">Google Pay</option>
              <option value="online">Online (Swiggy / Zomato)</option>
            </select>
          </div>
        </div>

        {/* Item Selection & Quantity Controls */}
        <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2">
          <label className="block text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
            Add Items to Multi-Item Cart
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddToCart();
                }
              }}
              className="flex-1 min-w-0 truncate p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 cursor-pointer text-xs focus:outline-none focus:border-amber-500/50"
            >
              {menuItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {settings.currency}{i.basePrice.toFixed(2)}
                </option>
              ))}
            </select>

            <input
              type="number" inputMode="decimal"
              min="1"
              max="99"
              value={selectedQty}
              onChange={(e) => setSelectedQty(Math.max(1, parseInt(e.target.value) || 1))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddToCart();
                }
              }}
              className="w-16 flex-shrink-0 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-center font-bold text-xs"
            />

            <button
              type="button"
              onClick={handleAddToCart}
              className="px-4 py-2.5 flex-shrink-0 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-md active:scale-[0.97] whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Add
            </button>
          </div>
        </div>

        {/* Multi-Item Cart List Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-amber-400" /> Current Order Cart ({cart.reduce((sum, i) => sum + i.quantity, 0)} Items)
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="p-4 text-center rounded-2xl bg-zinc-900/50 border border-dashed border-zinc-800 text-zinc-500 text-xs italic">
              No items in order cart yet. Select menu items above to add.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {cart.map((item) => (
                <div
                  key={item.menuItemId}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-zinc-200 block truncate text-xs">
                      {item.itemName}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {settings.currency}{item.unitPrice.toFixed(2)} × {item.quantity} ={' '}
                      <span className="text-amber-400 font-bold">
                        {settings.currency}{(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </span>
                  </div>

                  {/* Quantity Stepper & Remove */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800 p-0.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.menuItemId, -1)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 font-mono font-bold text-xs text-zinc-200">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.menuItemId, 1)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.menuItemId)}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Remove Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Totals Summary */}
        {cart.length > 0 && (
          <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1 font-mono text-xs">
            <div className="flex justify-between text-zinc-400 text-[11px]">
              <span>Subtotal:</span>
              <span>{settings.currency}{rawSubtotal.toFixed(2)}</span>
            </div>
            {settings.taxRate > 0 && (
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Tax ({settings.taxRate}%):</span>
                <span>{settings.currency}{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-amber-400 font-extrabold text-sm pt-1 border-t border-zinc-800">
              <span>Total Payable:</span>
              <span>{settings.currency}{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={savingOrder || cart.length === 0}
          className="w-full py-3 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" /> Record POS Sale ({settings.currency}{totalAmount.toFixed(2)})
        </button>
      </form>
    </Modal>
  );
};
