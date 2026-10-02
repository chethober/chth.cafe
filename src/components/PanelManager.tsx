import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CheckSquare,
  Clock,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Check,
  X,
  Plus,
  Search,
  User,
  KeyRound,
  UserCheck,
  UserX,
  Tag,
  DollarSign,
  Utensils,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Circle,
  PlayCircle,
  CreditCard,
  QrCode,
  Boxes,
  Sun,
  Moon,
  Wrench,
  ChevronRight,
  Zap,
  BarChart3,
  Trash2
} from 'lucide-react';
import {
  OrderSelect,
  OrderItemSelect,
  TaskSelect,
  StaffSelect,
  ShiftSelect,
  MenuItemSelect,
  SettingsSelect,
  CategorySelect,
  MenuVariantSelect
} from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';

interface PanelManagerProps {
  settings: SettingsSelect;
  orders: OrderSelect[];
  orderItems: OrderItemSelect[];
  tasks: TaskSelect[];
  staffList: StaffSelect[];
  shifts: ShiftSelect[];
  menuItems: MenuItemSelect[];
  categories: CategorySelect[];
  menuVariants: MenuVariantSelect[];
  onStateChange: () => void;
}

const TASK_CATEGORIES = ['Opening', 'Closing', 'Inventory', 'Cleaning', 'Maintenance'];
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Opening: <Sun className="w-3 h-3 text-amber-400" />,
  Closing: <Moon className="w-3 h-3 text-indigo-400" />,
  Inventory: <Boxes className="w-3 h-3 text-blue-400" />,
  Cleaning: <Sparkles className="w-3 h-3 text-emerald-400" />,
  Maintenance: <Wrench className="w-3 h-3 text-rose-400" />
};

export const PanelManager: React.FC<PanelManagerProps> = ({
  settings,
  orders,
  orderItems,
  tasks,
  staffList: staff,
  shifts,
  menuItems,
  categories,
  menuVariants,
  onStateChange
}) => {
  // Orders State
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('active');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [panelSelectedOrderDetails, setPanelSelectedOrderDetails] = useState<OrderSelect | null>(null);

  // POS Multi-Item Order State
  const [recipeViewItem, setRecipeViewItem] = useState<MenuItemSelect | null>(null);
  const [posCustomer, setPosCustomer] = useState('');
  const [posOrderType, setPosOrderType] = useState<'dine_in' | 'takeout' | 'pickup'>('dine_in');
  const [posPayment, setPosPayment] = useState<'cash' | 'card' | 'google_pay' | 'online'>('card');
  const [posDate, setPosDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [posDiscount, setPosDiscount] = useState('0');
  const [posDiscountType, setPosDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [posCategoryFilter, setPosCategoryFilter] = useState<string>('all');
  const [posCart, setPosCart] = useState<
    Array<{
      menuItemId: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
    }>
  >([]);

  // Mobile Panel View Tab State
  const [panelMobileTab, setPanelMobileTab] = useState<'pos' | 'orders' | 'tasks' | 'shifts'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chth_panel_last_tab');
      if (saved && ['pos', 'orders', 'tasks', 'shifts'].includes(saved)) {
        return saved as 'pos' | 'orders' | 'tasks' | 'shifts';
      }
    }
    return 'orders';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chth_panel_last_tab', panelMobileTab);
    }
  }, [panelMobileTab]);

  // Cart Helper Operations
  const handleAddItemToPOSCart = (item: MenuItemSelect) => {
    if (!item.isInStock) return;
    setPosCart((prev) => {
      const idx = prev.findIndex((i) => i.menuItemId === item.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          itemName: item.name,
          quantity: 1,
          unitPrice: item.basePrice
        }
      ];
    });
  };

  const handleUpdatePOSCartQty = (menuItemId: string, delta: number) => {
    setPosCart((prev) =>
      prev
        .map((i) => {
          if (i.menuItemId === menuItemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as typeof posCart
    );
  };

  const handleRemoveItemFromPOSCart = (menuItemId: string) => {
    setPosCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const handleUpdatePOSCartPrice = (menuItemId: string, newPrice: number) => {
    setPosCart((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, unitPrice: Math.max(0, newPrice) } : i))
    );
  };

  // Manual Price Inquiry Item State
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  const handleAddCustomPriceItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) return;
    const price = parseFloat(customItemPrice);
    if (isNaN(price) || price < 0) return;

    const customId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setPosCart((prev) => [
      ...prev,
      {
        menuItemId: customId,
        itemName: customItemName.trim(),
        quantity: 1,
        unitPrice: price
      }
    ]);

    setCustomItemName('');
    setCustomItemPrice('');
    setShowCustomItemModal(false);
  };

  // Tasks State
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('all');
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('Opening');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');

  // Shifts Employee Tracker State (chth.store style)
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockTargetStaff, setClockTargetStaff] = useState<StaffSelect | null>(null);
  const [empPasswordInput, setEmpPasswordInput] = useState('');
  const [clockModalFeedback, setClockModalFeedback] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirmEmployeeClock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockTargetStaff) return;

    const isCurrentlyIn = shifts.some((s) => s.staffId === clockTargetStaff.id && !s.clockOut);
    const res = isCurrentlyIn
      ? store.clockOut(empPasswordInput, '', clockTargetStaff.id)
      : store.clockIn(empPasswordInput, '', clockTargetStaff.id);

    if (res.success) {
      setClockModalFeedback({ success: true, message: res.message });
      setTimeout(() => {
        setClockTargetStaff(null);
        setEmpPasswordInput('');
        setClockModalFeedback(null);
        onStateChange();
      }, 700);
    } else {
      setClockModalFeedback({ success: false, message: res.message });
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled') => {
    store.updateOrderStatus(orderId, status);
    onStateChange();
  };

  const handleCreatePOSOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingOrder) return;
    setOrderSaveError('');
    if (posCart.length === 0) return;

    const rawSubtotal = posCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    let discAmount = 0;
    const dVal = parseFloat(posDiscount) || 0;
    if (posDiscountType === 'percent') {
      discAmount = (rawSubtotal * dVal) / 100;
    } else {
      discAmount = dVal;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const createdAtTimestamp =
      posDate === todayStr
        ? new Date().toISOString()
        : new Date(`${posDate}T12:00:00`).toISOString();

    setSavingOrder(true);
    try {
      await store.createOrder({
      customerName: posCustomer.trim() || 'Walk-in',
      orderType: posOrderType,
      paymentMethod: posPayment,
      discountAmount: discAmount,
      status: 'pending',
      createdAt: createdAtTimestamp,
      items: posCart.map((i) => ({
        menuItemId: i.menuItemId,
        itemName: i.itemName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        variants: []
      }))
    });
    } catch (error) { setOrderSaveError(error instanceof Error ? error.message : 'Order could not be saved.'); return; }
    finally { setSavingOrder(false); }

    setPosCart([]);
    setPosCustomer('');
    setPosDiscount('0');
    setPosDate(todayStr);
    onStateChange();
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    store.createTask({
      title: taskTitle.trim(),
      description: '',
      category: taskCategory,
      priority: taskPriority,
      status: 'pending',
      assignedStaffId: null,
      dueDate: new Date().toISOString().split('T')[0]
    });
    setTaskTitle('');
    setShowAddTaskModal(false);
    onStateChange();
  };

  const handleCycleTaskStatus = (taskId: string, currentStatus: string) => {
    let nextStatus: 'pending' | 'in_progress' | 'completed' = 'pending';
    if (currentStatus === 'pending') nextStatus = 'in_progress';
    else if (currentStatus === 'in_progress') nextStatus = 'completed';
    store.updateTaskStatus(taskId, nextStatus);
    onStateChange();
  };

  const handleToggleStockItem = (itemId: string) => {
    store.toggleStock(itemId);
    onStateChange();
  };

  // Filtered lists
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = orderStatusFilter === 'all' || (orderStatusFilter === 'active' ? ['pending', 'preparing', 'ready'].includes(o.status) : o.status === orderStatusFilter);
    const matchesType = orderTypeFilter === 'all' || o.orderType === orderTypeFilter;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      (o.customerName && o.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase()));
    return matchesStatus && matchesType && matchesSearch;
  });

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = taskStatusFilter === 'all' || t.status === taskStatusFilter;
    const matchesCat = taskCategoryFilter === 'all' || t.category === taskCategoryFilter;
    return matchesStatus && matchesCat;
  });

  const activeShifts = shifts.filter((s) => !s.clockOut);
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
  const preparingOrdersCount = orders.filter((o) => o.status === 'preparing').length;
  const readyOrdersCount = orders.filter(o=>o.status === 'ready').length;
  const completedOrdersCount = orders.filter((o) => o.status === 'completed').length;
  const totalOrdersCount = orders.length || 1;

  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const taskProgressPct = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in font-sans">
      {/* Header Banner */}
      <div className="glass-panel-classy p-4 rounded-3xl border border-zinc-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center brand-glow">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-zinc-100 tracking-tight">
              Café daily panel
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Take orders, prepare drinks, and keep the shift running.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Shift overview">
        {[
          { label: 'Waiting to start', count: pendingOrdersCount, tab: 'orders', filter: 'pending' },
          { label: 'Being prepared', count: preparingOrdersCount, tab: 'orders', filter: 'preparing' },
          { label: 'Ready to serve', count: readyOrdersCount, tab: 'orders', filter: 'ready' },
          { label: 'Staff on shift', count: activeShifts.length, tab: 'shifts', filter: 'active' }
        ].map(({ label, count, tab, filter }) => (
          <button key={label} type="button" onClick={() => { setPanelMobileTab(tab as 'orders' | 'shifts'); setOrderStatusFilter(filter); }} className="glass-panel rounded-2xl p-4 text-left hover:border-amber-400 transition-colors">
            <span className="block text-2xl font-black text-zinc-100">{count}</span>
            <span className="text-xs text-zinc-400">{label}</span>
          </button>
        ))}
      </div>

      <nav aria-label="Daily panel sections" className="panel-navigation grid grid-cols-4 gap-1 p-1 rounded-2xl border border-zinc-800 sticky top-16 z-30 shadow-lg">
        {[
          { id: 'orders', label: 'Orders', icon: ShoppingBag },
          { id: 'pos', label: 'New order', icon: Plus },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare },
          { id: 'shifts', label: 'Clock in / out', icon: Clock }
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-current={panelMobileTab === id ? 'page' : undefined} aria-controls={`panel-${id}`} onClick={() => setPanelMobileTab(id as typeof panelMobileTab)} className={`min-h-14 px-2 py-3 rounded-xl font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-2 transition-colors ${panelMobileTab === id ? 'btn-brand text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}>
            <Icon className="w-4 h-4" /><span>{label}</span>
            {id === 'pos' && posCart.length > 0 && <span>({posCart.reduce((sum, item) => sum + item.quantity, 0)})</span>}
          </button>
        ))}
      </nav>

      {/* ========================================================================= */}
      {/* UNIFIED POS & STOCK COMMAND CENTER (MULTI-ITEM POS ORDERING)              */}
      {/* ========================================================================= */}
      <div id="panel-pos" className={`glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-4 shadow-lg ${panelMobileTab === 'pos' ? 'block' : 'hidden'}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-black text-zinc-100 text-sm tracking-tight">New order & menu availability</h2>
              <p className="text-[11px] text-zinc-400">Toggle item availability or add multiple items into one POS order</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 font-mono">
            <span className="text-emerald-400">{menuItems.filter((i) => i.isInStock).length} In Stock</span>
            <span>/</span>
            <span className="text-rose-400">{menuItems.filter((i) => !i.isInStock).length} Sold Out</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setPosCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
              posCategoryFilter === 'all'
                ? 'btn-brand text-zinc-950 shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            All Categories ({menuItems.length})
          </button>

          {categories.map((cat) => {
            const count = menuItems.filter((i) => i.categoryId === cat.id).length;
            const isSelected = posCategoryFilter === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setPosCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${
                  isSelected
                    ? 'btn-brand text-zinc-950 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] ${
                    isSelected ? 'bg-zinc-950/20 text-zinc-950 font-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Menu Items Grouped by Category */}
        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
          {categories
            .filter((cat) => posCategoryFilter === 'all' || posCategoryFilter === cat.id)
            .map((cat) => {
              const catItems = menuItems.filter((i) => i.categoryId === cat.id);
              if (catItems.length === 0) return null;

              return (
                <div key={cat.id} className="space-y-2">
                  {/* Category Header Banner */}
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1 pt-1">
                    <span className="font-extrabold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-amber-400" />
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold">
                      {catItems.length} {catItems.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>

                  {/* Category Product Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {catItems.map((item) => {
                      const inCartItem = posCart.find((ci) => ci.menuItemId === item.id);
                      const cartQty = inCartItem ? inCartItem.quantity : 0;

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 transition-all ${
                            cartQty > 0
                              ? 'bg-amber-950/30 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-extrabold text-xs text-zinc-100 block truncate">{item.name}</span>
                              <span className="font-mono text-[11px] text-amber-400 font-extrabold">
                                {settings.currency}{item.basePrice.toFixed(2)}
                              </span>
                            </div>

                            {/* Immediate Recipe & Stock Controls */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setRecipeViewItem(item)}
                                className="px-2 py-0.5 rounded-xl text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-sky-400 border border-zinc-700 cursor-pointer transition-colors flex items-center gap-1"
                                title="View Recipe Ingredients"
                              >
                                <Boxes className="w-3 h-3 text-sky-400" />
                                Recipe
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStockItem(item.id)}
                                className={`px-2 py-0.5 rounded-xl text-[10px] font-black cursor-pointer transition-all ${
                                  item.isInStock
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                                }`}
                              >
                                {item.isInStock ? 'In Stock' : 'Sold Out'}
                              </button>
                            </div>
                          </div>

                          {/* Add to Multi-Item Order Steppers / Button */}
                          {cartQty > 0 ? (
                            <div className="flex items-center justify-between bg-zinc-950 p-1 rounded-xl border border-amber-500/40">
                              <button
                                type="button"
                                onClick={() => handleUpdatePOSCartQty(item.id, -1)}
                                className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-black text-xs flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono font-black text-xs text-amber-400">
                                {cartQty} in order
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdatePOSCartQty(item.id, 1)}
                                className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddItemToPOSCart(item)}
                              disabled={!item.isInStock}
                              className={`w-full py-1.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                item.isInStock
                                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                                  : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                              }`}
                            >
                              {item.isInStock ? '+ Add to Order' : 'Item Sold Out'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Multi-Item Order Checkout Form & Basket */}
        <form aria-busy={savingOrder} onSubmit={handleCreatePOSOrder} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
        {orderSaveError && <p role="alert" className="p-3 rounded-xl border border-rose-500/40 text-rose-400">{orderSaveError}</p>}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-800 pb-2.5 gap-2">
            <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <ShoppingBag className="w-4 h-4 text-amber-400" /> Current Order Basket ({posCart.reduce((sum, i) => sum + i.quantity, 0)} Items)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCustomItemModal(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Tag className="w-3 h-3 text-amber-400" />
                + Custom / Manual Price Item
              </button>
              {posCart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPosCart([])}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Selected Basket Items Listing */}
          {posCart.length === 0 ? (
            <div className="py-4 text-center text-xs text-zinc-500 italic">
              No items in current order. Click <strong>+ Add to Order</strong> above or <strong>+ Custom / Manual Price Item</strong> to build an order.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {posCart.map((ci) => (
                <div
                  key={ci.menuItemId}
                  className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs gap-2"
                >
                  <span className="font-bold text-zinc-200 truncate flex-1">{ci.itemName}</span>

                  <div className="flex items-center gap-2">
                    {/* Manual Price Override Input */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500 font-bold">{settings.currency}</span>
                      <input
                        type="number"
                        step="any"
                        value={ci.unitPrice}
                        onChange={(e) => handleUpdatePOSCartPrice(ci.menuItemId, parseFloat(e.target.value) || 0)}
                        className="w-16 p-1 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-amber-400 font-bold text-right focus:outline-none focus:border-amber-500/50"
                        title="Manual Unit Price Override / Inquiry"
                      />
                    </div>

                    {/* Steppers */}
                    <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-0.5 rounded-lg border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => handleUpdatePOSCartQty(ci.menuItemId, -1)}
                        className="text-zinc-400 hover:text-zinc-100 font-black"
                      >
                        -
                      </button>
                      <span className="font-mono text-zinc-100 font-bold px-1">{ci.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdatePOSCartQty(ci.menuItemId, 1)}
                        className="text-amber-400 hover:text-amber-300 font-black"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-mono font-bold text-emerald-400 w-16 text-right">
                      {settings.currency}{(ci.unitPrice * ci.quantity).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItemFromPOSCart(ci.menuItemId)}
                      className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Customer, Date & Payment Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs pt-1">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={posDate}
                onChange={(e) => setPosDate(e.target.value)}
                className="w-full p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Customer / Table #
              </label>
              <input
                type="text"
                placeholder="Walk-in or Table #4"
                value={posCustomer}
                onChange={(e) => setPosCustomer(e.target.value)}
                className="w-full p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={posPayment}
                onChange={(e) => setPosPayment(e.target.value as any)}
                className="w-full p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="google_pay">Google Pay</option>
                <option value="online">Online (Swiggy / Zomato)</option>
              </select>
            </div>

            {/* Discount Section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Discount
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPosDiscountType('percent')}
                    className={`px-1 py-0.2 text-[9px] font-bold rounded ${posDiscountType === 'percent' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosDiscountType('fixed')}
                    className={`px-1 py-0.2 text-[9px] font-bold rounded ${posDiscountType === 'fixed' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}
                  >
                    {settings.currency}
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={posDiscount}
                onChange={(e) => setPosDiscount(e.target.value)}
                className="w-full p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-xs"
              />
            </div>
          </div>

          {/* Price Calculation Summary & Submit Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2.5 border-t border-zinc-800/80">
            {(() => {
              const rawSubtotal = posCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
              const dVal = parseFloat(posDiscount) || 0;
              const discAmt = posDiscountType === 'percent' ? (rawSubtotal * dVal) / 100 : dVal;
              const netSubtotal = Math.max(0, rawSubtotal - discAmt);
              const taxAmt = (netSubtotal * settings.taxRate) / 100;
              const totalAmt = netSubtotal + taxAmt;

              return (
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <span className="text-zinc-400">
                    Subtotal: <strong className="text-zinc-200">{settings.currency}{rawSubtotal.toFixed(2)}</strong>
                  </span>
                  {discAmt > 0 && (
                    <span className="text-emerald-400 font-bold">
                      Disc: -{settings.currency}{discAmt.toFixed(2)}
                    </span>
                  )}
                  <span className="text-zinc-400">
                    Tax ({settings.taxRate}%): <strong className="text-zinc-200">{settings.currency}{taxAmt.toFixed(2)}</strong>
                  </span>
                  <span className="text-amber-400 font-extrabold text-sm border-l border-zinc-800 pl-2.5">
                    Total: {settings.currency}{totalAmt.toFixed(2)}
                  </span>
                </div>
              );
            })()}

            <button
              type="submit"
              disabled={savingOrder || posCart.length === 0}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black uppercase tracking-wider text-xs shadow-lg cursor-pointer flex-shrink-0 ${
                posCart.length > 0
                  ? 'btn-brand text-zinc-950'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              Submit Order ({posCart.reduce((sum, i) => sum + i.quantity, 0)} Items)
            </button>
          </div>
        </form>
      </div>



      {/* ========================================================================= */}
      {/* ONE-ROW THREE-COLUMN ERGONOMIC LAYOUT: SHIFTS | TASKS | ORDERS            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 items-start">
        {/* ========================================================================= */}
        {/* COLUMN 1: EMPLOYEE TIME TRACKER (CHTH.STORE STYLE)                       */}
        {/* ========================================================================= */}
        <div id="panel-shifts" className={`space-y-4 ${panelMobileTab === 'shifts' ? 'block' : 'hidden'}`}>
          <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-5 shadow-lg">
            {/* Header & Digital Clock */}
            <div className="text-center space-y-1 border-b border-zinc-800 pb-4">
              <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Employee Time Tracker
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-zinc-100 tracking-tight">
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </div>
              <div className="text-xs text-zinc-400 font-medium">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            {/* Employee Cards Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1">
                <span>Select Employee to Clock</span>
                <span className="text-emerald-400">{activeShifts.length} Active On Shift</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {staff.map((member) => {
                  const isCheckedIn = activeShifts.some((s) => s.staffId === member.id);
                  const initial = member.name.charAt(0).toUpperCase();

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setClockTargetStaff(member);
                        setEmpPasswordInput('');
                        setClockModalFeedback(null);
                      }}
                      className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer text-center ${
                        isCheckedIn
                          ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30 hover:border-emerald-400'
                          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Avatar Circle */}
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg transition-all ${
                          isCheckedIn
                            ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {initial}
                      </div>

                      {/* Employee Name */}
                      <span className="font-extrabold text-xs text-zinc-100 truncate w-full">
                        {member.name}
                      </span>

                      {/* Status Pill */}
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isCheckedIn
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-500 bg-zinc-950'
                        }`}
                      >
                        {isCheckedIn ? 'Checked In' : 'Checked Out'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: SHIFT OPERATIONS TASKS                                          */}
        {/* ========================================================================= */}
        <div id="panel-tasks" className={`space-y-4 ${panelMobileTab === 'tasks' ? 'block' : 'hidden'}`}>
          <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-400" />
                <h3 className="font-black text-zinc-100 text-sm">Shift Operations Tasks</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddTaskModal(true)}
                  className="px-2.5 py-1 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Task
                </button>
                <span className="text-xs text-blue-400 font-extrabold">{taskProgressPct}% Done</span>
              </div>
            </div>

            {/* Task Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                onClick={() => setTaskCategoryFilter('all')}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-all ${
                  taskCategoryFilter === 'all'
                    ? 'btn-brand text-zinc-950 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                All ({tasks.length})
              </button>

              {TASK_CATEGORIES.map((cat) => {
                const count = tasks.filter((t) => t.category === cat).length;
                const isSelected = taskCategoryFilter === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setTaskCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-xl font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'btn-brand text-zinc-950 shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {CATEGORY_ICONS[cat]}
                    <span>{cat}</span>
                    <span className={`px-1 rounded text-[10px] ${isSelected ? 'bg-zinc-950/20 text-zinc-950 font-black' : 'bg-zinc-800 text-zinc-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tasks List */}
            {filteredTasks.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500 italic">
                No tasks in "{taskCategoryFilter}" category.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleCycleTaskStatus(task.id, task.status)}
                    className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-2 cursor-pointer hover:border-amber-500/30 transition-all text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : task.status === 'in_progress' ? (
                        <PlayCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                      )}
                      <span className={`font-bold truncate ${task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                        {task.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                      {CATEGORY_ICONS[task.category]} {task.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: LIVE KITCHEN & CUSTOMER ORDERS                                  */}
        {/* ========================================================================= */}
        <div id="panel-orders" className={`space-y-4 ${panelMobileTab === 'orders' ? 'block' : 'hidden'}`}>
          <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-4 shadow-lg">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                <h2 className="font-black text-zinc-100 text-sm tracking-tight">Customer orders</h2>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <button type="button" onClick={() => setOrderStatusFilter('active')} aria-pressed={orderStatusFilter === 'active'} className={`px-3 py-2 rounded-lg text-xs font-bold ${orderStatusFilter === 'active' ? 'btn-brand text-zinc-950' : 'text-zinc-400'}`}>Active ({pendingOrdersCount + preparingOrdersCount + readyOrdersCount})</button>
                <button
                  onClick={() => setOrderStatusFilter('all')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                    orderStatusFilter === 'all' ? 'btn-brand text-zinc-950' : 'text-zinc-400'
                  }`}
                >
                  All ({orders.length})
                </button>
                <button
                  onClick={() => setOrderStatusFilter('pending')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                    orderStatusFilter === 'pending' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'
                  }`}
                >
                  Pending ({pendingOrdersCount})
                </button>
                <button type="button" onClick={()=>setOrderStatusFilter('ready')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${orderStatusFilter === 'ready' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400'}`}>Ready ({readyOrdersCount})</button>
                <button
                  onClick={() => setOrderStatusFilter('preparing')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                    orderStatusFilter === 'preparing' ? 'bg-indigo-500 text-white' : 'text-zinc-400'
                  }`}
                >
                  Preparing ({preparingOrdersCount})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search order or customer..."
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Orders Cards List */}
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <ShoppingBag className="w-10 h-10 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400 font-medium">No orders matching the current filter.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredOrders.map((order) => {
                  const itemsForOrder = orderItems.filter((i) => i.orderId === order.id);

                  return (
                    <div
                      key={order.id}
                      onClick={() => setPanelSelectedOrderDetails(order)}
                      className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all cursor-pointer group ${
                        order.status === 'pending'
                          ? 'bg-amber-950/20 border-amber-500/40 shadow-lg hover:border-amber-400'
                          : order.status === 'preparing'
                          ? 'bg-indigo-950/20 border-indigo-500/40 hover:border-indigo-400'
                          : 'bg-zinc-900/60 border-zinc-800 opacity-75 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-black text-sm text-zinc-100 font-mono group-hover:text-amber-400">{order.orderNumber}</span>
                            {order.discountAmount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                -{settings.currency}{order.discountAmount.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400 font-medium block mt-0.5">
                            Customer: <strong className="text-zinc-200">{order.customerName || 'Walk-in'}</strong>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-sm text-amber-400 font-mono block">
                            {settings.currency}{order.totalAmount.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-bold text-amber-400/90 capitalize">
                            {order.paymentMethod === 'google_pay'
                              ? 'Google Pay'
                              : order.paymentMethod === 'online'
                              ? 'Swiggy / Zomato'
                              : order.paymentMethod}
                          </span>
                        </div>
                      </div>

                      {/* Items Listing */}
                      <div className="space-y-1 text-xs">
                        {itemsForOrder.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-zinc-300">
                            <span className="font-semibold truncate">
                              {item.quantity}x {item.itemName}
                            </span>
                            <span className="text-zinc-500 font-mono">{settings.currency}{(item.unitPrice * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Status Transition Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                            order.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : order.status === 'preparing'
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {order.status}
                        </span>

                        <div className="flex items-center gap-1 text-[11px]">
                          {order.status === 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateOrderStatus(order.id, 'preparing');
                              }}
                              className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                            >
                              Start Prep
                            </button>
                          )}

                          {['pending','preparing','ready'].includes(order.status) && <button type="button" onClick={e=> { e.stopPropagation(); if (window.confirm(order.status === 'pending' ? 'Cancel this order and return reserved ingredients to stock?' : 'Cancel this order? Prepared ingredients remain deducted from stock.')) handleUpdateOrderStatus(order.id, 'cancelled'); }} className="px-3 py-2 rounded-xl border border-rose-500/40 text-rose-400">Cancel order</button>}
                          {order.status === 'ready' && <button type="button" onClick={e => { e.stopPropagation(); handleUpdateOrderStatus(order.id, 'completed'); }} className="px-3 py-2 rounded-xl btn-brand text-zinc-950 font-semibold">Mark collected / paid</button>}
                          {order.status === 'preparing' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateOrderStatus(order.id, 'ready');
                              }}
                              className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black cursor-pointer shadow-md"
                            >
                              Mark Ready
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* CLOCK IN/OUT CONFIRMATION MODAL */}
      <Modal
        isOpen={!!clockTargetStaff}
        onClose={() => {
          setClockTargetStaff(null);
          setClockModalFeedback(null);
        }}
        title={
          <span className="flex items-center gap-2 font-black text-zinc-100">
            <Clock className="w-4 h-4 text-emerald-400" />
            {clockTargetStaff?.name}: Clock {shifts.some((s) => s.staffId === clockTargetStaff?.id && !s.clockOut) ? 'Out' : 'In'}
          </span>
        }
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleConfirmEmployeeClock} className="space-y-4 text-xs">
          <p className="text-zinc-400 text-xs">
            Enter password / PIN for <strong>{clockTargetStaff?.name}</strong> to confirm clock action.
          </p>

          <div>
            <input
              type="password"
              placeholder="Enter employee password..."
              value={empPasswordInput}
              onChange={(e) => setEmpPasswordInput(e.target.value)}
              autoFocus
              required
              className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-center font-mono text-lg tracking-widest focus:border-emerald-500"
            />
          </div>

          {clockModalFeedback && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold text-center ${
                clockModalFeedback.success
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {clockModalFeedback.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setClockTargetStaff(null);
                setClockModalFeedback(null);
              }}
              className="py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="py-2.5 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider cursor-pointer shadow-lg"
            >
              Confirm
            </button>
          </div>
        </form>
      </Modal>

      {/* CREATE TASK MODAL IN PANEL */}
      <Modal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        title="Create Shift Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Task Title
            </label>
            <input
              type="text"
              placeholder="e.g. Purge espresso machine steam wands"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer"
          >
            Create Task
          </button>
        </form>
      </Modal>

      {/* PANEL ORDER DETAILS INSPECTOR MODAL */}
      <Modal
        isOpen={!!panelSelectedOrderDetails}
        onClose={() => setPanelSelectedOrderDetails(null)}
        title={`Order Details • ${panelSelectedOrderDetails?.orderNumber || ''}`}
        maxWidth="max-w-md"
      >
        {panelSelectedOrderDetails && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-400">Customer:</span>
                <span className="font-extrabold text-zinc-100">{panelSelectedOrderDetails.customerName || 'Walk-in'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-400">Order Type:</span>
                <span className="font-extrabold text-amber-400 uppercase">{panelSelectedOrderDetails.orderType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-400">Status:</span>
                <span className="font-extrabold text-indigo-400 uppercase">{panelSelectedOrderDetails.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-400">Payment Channel:</span>
                <span className="font-extrabold text-emerald-400 capitalize">
                  {panelSelectedOrderDetails.paymentMethod === 'google_pay'
                    ? 'Google Pay'
                    : panelSelectedOrderDetails.paymentMethod === 'online'
                    ? 'Swiggy / Zomato'
                    : panelSelectedOrderDetails.paymentMethod}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                <span className="font-bold text-zinc-400">Order Time:</span>
                <span className="font-mono text-zinc-300">
                  {new Date(panelSelectedOrderDetails.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Line items list */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Ordered Line Items</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {orderItems.filter((i) => i.orderId === panelSelectedOrderDetails.id).length === 0 ? (
                  <p className="text-zinc-500 italic py-2">No line items found.</p>
                ) : (
                  orderItems.filter((i) => i.orderId === panelSelectedOrderDetails.id).map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-zinc-100 block">{item.quantity}x {item.itemName}</span>
                        <span className="text-[10px] text-zinc-400">Unit Price: {settings.currency}{item.unitPrice.toFixed(2)}</span>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-xs">
                        {settings.currency}{(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Price breakdown */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1 font-mono text-xs">
              {panelSelectedOrderDetails.discountAmount > 0 && (
                <div className="flex items-center justify-between text-rose-400">
                  <span>Discount Applied:</span>
                  <span>-{settings.currency}{panelSelectedOrderDetails.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-zinc-400">
                <span>Tax ({settings.taxRate}%):</span>
                <span>{settings.currency}{panelSelectedOrderDetails.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-black text-amber-400 pt-1 border-t border-zinc-800">
                <span>Total Amount:</span>
                <span>{settings.currency}{panelSelectedOrderDetails.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPanelSelectedOrderDetails(null)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-bold text-zinc-200 cursor-pointer"
            >
              Close Order Details
            </button>
          </div>
        )}
      </Modal>

      {/* Recipe Ingredients Modal in Panel Manager */}
      {recipeViewItem && (
        <Modal
          isOpen={!!recipeViewItem}
          onClose={() => setRecipeViewItem(null)}
          title={`Recipe & Ingredients: ${recipeViewItem.name}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <div>
                <span className="font-extrabold text-zinc-100 block">{recipeViewItem.name}</span>
                <span className="text-[10px] text-zinc-400">Base Selling Price: {settings.currency}{recipeViewItem.basePrice.toFixed(2)}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Recipe Breakdown
              </span>
            </div>

            {(() => {
              const recipeList = store.getMenuItemRecipe(recipeViewItem.id);
              const stockList = store.getStockItems();

              if (recipeList.length === 0) {
                return (
                  <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-zinc-500 space-y-1">
                    <Boxes className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="font-bold text-zinc-300 text-xs">No Recipe Ingredients Configured</p>
                    <p className="text-[11px] text-zinc-500">Configure raw material recipes in CHTH Admin Menu Editor.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Required Raw Materials Per Portion ({recipeList.length})
                  </span>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {recipeList.map((ing) => {
                      const material = stockList.find((s) => s.id === ing.stockItemId);
                      const isAvailable = material ? material.quantity >= ing.quantityRequired : false;

                      return (
                        <div
                          key={ing.id || ing.stockItemId}
                          className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-zinc-200">
                                {material ? material.name : ing.stockItemId}
                              </span>
                              {material && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                    isAvailable
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-rose-500/20 text-rose-400'
                                  }`}
                                >
                                  {isAvailable ? `${material.quantity} ${material.unit} in stock` : 'Low Stock'}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-400 block mt-0.5">
                              Consumes: <strong>{ing.quantityRequired} {material?.unit || 'units'}</strong> / portion
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setRecipeViewItem(null)}
                className="px-4 py-2 rounded-xl btn-brand text-zinc-950 font-bold text-xs cursor-pointer shadow-md"
              >
                Close Recipe
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Custom / Manual Price Inquiry Item Modal */}
      {showCustomItemModal && (
        <Modal
          isOpen={showCustomItemModal}
          onClose={() => setShowCustomItemModal(false)}
          title="Add Custom / Manual Price Item"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleAddCustomPriceItem} className="space-y-4 text-xs">
            <p className="text-zinc-400">
              Enter custom item title, catering portion name, or manual price quote to include in this order.
            </p>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Item Title / Inquiry Description *
              </label>
              <input
                type="text"
                placeholder="e.g. Custom Event Tea Blend / Special Catering Box"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Agreed / Manual Unit Price ({settings.currency || '₹'}) *
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={customItemPrice}
                onChange={(e) => setCustomItemPrice(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomItemModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl btn-brand text-zinc-950 font-bold text-xs shadow-md cursor-pointer"
              >
                Add to Order Basket
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
