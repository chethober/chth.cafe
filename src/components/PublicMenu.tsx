import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Coffee,
  GlassWater,
  Leaf,
  Cake,
  Utensils,
  Search,
  Plus,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Info,
  Clock,
  MapPin,
  Phone,
  ChevronRight,
  Flame,
  Award,
  Sliders,
  TrendingUp,
  Heart,
  Zap
} from 'lucide-react';
import { CategorySelect, MenuItemSelect, MenuVariantSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';

interface PublicMenuProps {
  settings: SettingsSelect;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  menuVariants: MenuVariantSelect[];
  onOrderCreated?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Coffee: <Coffee className="w-4 h-4" />,
  GlassWater: <GlassWater className="w-4 h-4" />,
  Leaf: <Leaf className="w-4 h-4" />,
  Cake: <Cake className="w-4 h-4" />,
  Utensils: <Utensils className="w-4 h-4" />
};

export const PublicMenu: React.FC<PublicMenuProps> = ({
  settings,
  categories,
  menuItems,
  menuVariants,
  onOrderCreated
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);

  // Customization modal state
  const [activeItem, setActiveItem] = useState<MenuItemSelect | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, MenuVariantSelect>>({});

  // Cart state
  const [cart, setCart] = useState<
    Array<{
      id: string;
      item: MenuItemSelect;
      variants: MenuVariantSelect[];
      quantity: number;
      unitPrice: number;
    }>
  >([]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout' | 'pickup'>('dine_in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'google_pay' | 'online'>('card');
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);

  // Keyboard shortcut listener (ESC to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCartOpen(false);
        setActiveItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter items
  const filteredItems = menuItems.filter((item) => {
    const matchesCat = selectedCatId === 'all' || item.categoryId === selectedCatId;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.badge && item.badge.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStock = !onlyInStock || item.isInStock;
    return matchesCat && matchesSearch && matchesStock;
  });

  // Top Customer Favorites (Items with badges or high popularity)
  const favoriteItems = menuItems.filter((item) => item.badge || item.isInStock).slice(0, 3);

  const openCustomizeModal = (item: MenuItemSelect) => {
    if (!item.isInStock) return;
    setActiveItem(item);
    // Pre-select first variant in each group
    const itemVars = menuVariants.filter((v) => v.menuItemId === item.id);
    const initialSelections: Record<string, MenuVariantSelect> = {};
    const groups = Array.from(new Set(itemVars.map((v) => v.groupName)));

    groups.forEach((group) => {
      const firstInGroup = itemVars.find((v) => v.groupName === group);
      if (firstInGroup) {
        initialSelections[group] = firstInGroup;
      }
    });

    setSelectedVariants(initialSelections);
  };

  const handleQuickAdd = (item: MenuItemSelect) => {
    if (!item.isInStock) return;
    const cartItemId = `${item.id}-default`;
    setCart((prev) => {
      const existingIdx = prev.findIndex((ci) => ci.id === cartItemId || (ci.item.id === item.id && ci.variants.length === 0));
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          id: cartItemId,
          item,
          variants: [],
          quantity: 1,
          unitPrice: item.basePrice
        }
      ];
    });
  };

  const handleQuickUpdateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.item.id === itemId && ci.variants.length === 0) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as typeof cart
    );
  };

  const calculateCustomizedPrice = () => {
    if (!activeItem) return 0;
    let price = activeItem.basePrice;
    Object.values(selectedVariants).forEach((variant) => {
      price += variant.priceModifier;
    });
    return Number(price.toFixed(2));
  };

  const handleAddToCart = () => {
    if (!activeItem) return;
    const variantsList = Object.values(selectedVariants);
    const unitPrice = calculateCustomizedPrice();
    const cartItemId = `${activeItem.id}-${variantsList.map((v) => v.id).sort().join('-')}`;

    setCart((prev) => {
      const existingIdx = prev.findIndex((ci) => ci.id === cartItemId);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          id: cartItemId,
          item: activeItem,
          variants: variantsList,
          quantity: 1,
          unitPrice
        }
      ];
    });

    setActiveItem(null);
    setIsCartOpen(true);
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.id === id) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as typeof cart
    );
  };

  const cartSubtotal = Number(
    cart.reduce((sum, ci) => sum + ci.unitPrice * ci.quantity, 0).toFixed(2)
  );
  const cartTax = Number(((cartSubtotal * settings.taxRate) / 100).toFixed(2));
  const cartTotal = Number((cartSubtotal + cartTax).toFixed(2));
  const cartTotalItemsCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const newOrder = store.createOrder({
      customerName: customerName.trim() || 'Guest Customer',
      orderType,
      paymentMethod,
      items: cart.map((ci) => ({
        menuItemId: ci.item.id,
        itemName: ci.item.name,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        variants: ci.variants.map((v) => `${v.groupName}: ${v.name}`)
      }))
    });

    setCart([]);
    setIsCartOpen(false);
    setCustomerName('');
    setOrderSuccessMsg(`Order ${newOrder.orderNumber} placed! Your order is being prepared.`);

    if (onOrderCreated) {
      onOrderCreated();
    }

    setTimeout(() => {
      setOrderSuccessMsg(null);
    }, 6000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-28 md:pb-16 font-sans">
      {/* Navbar Order Success Notification Portal */}
      {orderSuccessMsg && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10000] bg-emerald-500 text-zinc-950 px-4 py-2 rounded-2xl shadow-2xl font-black border border-emerald-300 flex items-center gap-2 text-xs animate-scale-up">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{orderSuccessMsg}</span>
        </div>,
        document.body
      )}

      {/* Hero Header Banner - Compact & Mobile Optimized */}
      <div className="relative overflow-hidden rounded-3xl glass-panel-classy p-4 sm:p-8 shadow-2xl">
        <div
          className="absolute -right-24 -top-24 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: settings.brandPrimary }}
        />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-5">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.cafeName}
                className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 sm:ring-4 ring-amber-500/20 shadow-xl flex-shrink-0"
              />
            ) : (
              <div
                className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-zinc-950 font-black text-xl sm:text-3xl shadow-xl flex-shrink-0 brand-bg"
              >
                <Coffee className="w-7 h-7 sm:w-10 sm:h-10 text-zinc-950" />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-zinc-100">
                  {settings.cafeName}
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Open
                </span>
              </div>
              <p className="text-zinc-400 text-xs sm:text-base max-w-xl font-medium line-clamp-1 sm:line-clamp-none">
                Artisanal tea, specialty espresso & daily handmade pastries.
              </p>

              <div className="hidden sm:flex flex-wrap items-center gap-4 mt-2 text-xs text-zinc-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 brand-text" />
                  {settings.address}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 brand-text" />
                  {settings.contactPhone}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Cart Trigger Pill (Desktop) */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="hidden md:flex px-5 py-3 rounded-2xl btn-brand text-zinc-950 font-extrabold items-center justify-center gap-3 shadow-xl cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>View Order Bag</span>
            {cartTotalItemsCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-950 text-amber-400 text-xs font-black">
                {cartTotalItemsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH & CATEGORY FILTER BAR                                               */}
      {/* ========================================================================= */}
      <div className="glass-panel-classy p-3 sm:p-4 rounded-2xl space-y-2.5 border border-zinc-800/80 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search coffee, matcha, artisan teas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Toggles */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <button
              onClick={() => setOnlyInStock(!onlyInStock)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                onlyInStock
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              In Stock Only
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => setSelectedCatId('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              selectedCatId === 'all'
                ? 'btn-brand text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            All ({menuItems.length})
          </button>

          {categories.map((cat) => {
            const count = menuItems.filter((i) => i.categoryId === cat.id).length;
            const isSelected = selectedCatId === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'btn-brand text-zinc-950 shadow-md'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {CATEGORY_ICONS[cat.icon || 'Coffee'] || <Coffee className="w-3.5 h-3.5" />}
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                    isSelected ? 'bg-zinc-950/20 text-zinc-950 font-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MENU ITEMS GRID                                                          */}
      {/* ========================================================================= */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-zinc-800 space-y-3">
          <Coffee className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-extrabold text-zinc-300">No menu items found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Try resetting your search query or selecting another category.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCatId('all');
              setOnlyInStock(false);
            }}
            className="px-4 py-2 rounded-xl btn-brand font-bold text-xs text-zinc-950"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredItems.map((item) => {
            const hasVariants = menuVariants.some((v) => v.menuItemId === item.id);
            const simpleCartItem = cart.find((ci) => ci.item.id === item.id && ci.variants.length === 0);
            const inCartQty = simpleCartItem ? simpleCartItem.quantity : 0;

            return (
              <div
                key={item.id}
                className={`glass-card p-4 sm:p-5 rounded-3xl border flex flex-col justify-between space-y-3 relative overflow-hidden transition-all ${
                  item.isInStock
                    ? 'border-zinc-800/80 hover:border-amber-500/30'
                    : 'border-rose-900/30 bg-rose-950/10 opacity-60'
                }`}
              >
                <div>
                  {/* Badges & Category Header */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    {item.badge ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                        {item.badge}
                      </span>
                    ) : (
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                        Artisan Specialty
                      </span>
                    )}

                    {!item.isInStock && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        Sold Out
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-extrabold text-sm sm:text-base text-zinc-100 tracking-tight transition-colors">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Price & 1-Tap Quick Add / Steppers */}
                <div className="flex items-center justify-between pt-2.5 border-t border-zinc-800/80">
                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold block">Base Price</span>
                    <span className="font-black text-base sm:text-lg text-amber-400 font-mono">
                      {settings.currency}{item.basePrice.toFixed(2)}
                    </span>
                  </div>

                  {hasVariants ? (
                    <button
                      onClick={() => openCustomizeModal(item)}
                      disabled={!item.isInStock}
                      className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                        item.isInStock
                          ? 'btn-brand text-zinc-950 shadow-md'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Customize</span>
                    </button>
                  ) : inCartQty > 0 ? (
                    <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-amber-500/40">
                      <button
                        onClick={() => handleQuickUpdateQty(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono text-xs font-black text-amber-400 w-5 text-center">
                        {inCartQty}
                      </span>
                      <button
                        onClick={() => handleQuickUpdateQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleQuickAdd(item)}
                      disabled={!item.isInStock}
                      className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                        item.isInStock
                          ? 'btn-brand text-zinc-950 shadow-md'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>1-Tap Add</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Persistent Floating Mobile Cart Bar */}
      {cartTotalItemsCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden animate-scale-up">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full p-3.5 rounded-2xl btn-brand text-zinc-950 font-extrabold flex items-center justify-between shadow-2xl border border-amber-300/40 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center font-black text-xs">
                {cartTotalItemsCount}
              </div>
              <div className="text-left leading-tight">
                <span className="text-xs uppercase font-black tracking-wider block">Your Order Bag</span>
                <span className="text-zinc-900 text-[10px] font-bold">Tap to view & checkout</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black bg-zinc-950 text-amber-400 px-3 py-1 rounded-xl">
                {settings.currency}{cartTotal.toFixed(2)}
              </span>
              <ChevronRight className="w-5 h-5 text-zinc-950" />
            </div>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMIZE ITEM MODAL                                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!activeItem}
        onClose={() => setActiveItem(null)}
        title={
          <div>
            <span className="font-black text-base text-zinc-100 block">{activeItem?.name}</span>
            <span className="text-[10px] text-zinc-400 font-medium block">
              {activeItem?.description || 'Customize your order preferences'}
            </span>
          </div>
        }
      >
        {activeItem && (
          <div className="space-y-4">
            {/* Flavor Profile Visual Meters (Infographic) */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                Flavor Profile & Intensity Gauge
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 font-bold mb-1">
                    <span>Roast / Intensity</span>
                    <span>4/5</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-500 w-4/5 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 font-bold mb-1">
                    <span>Sweetness Balance</span>
                    <span>3/5</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-emerald-500 w-3/5 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Variant Options Selector */}
            {(() => {
              const itemVars = menuVariants.filter((v) => v.menuItemId === activeItem.id);
              const groups = Array.from(new Set(itemVars.map((v) => v.groupName)));

              if (groups.length === 0) {
                return <p className="text-xs text-zinc-400 italic">No customization options for this item.</p>;
              }

              return (
                <div className="space-y-4">
                  {groups.map((group) => {
                    const variantsInGroup = itemVars.filter((v) => v.groupName === group);
                    return (
                      <div key={group} className="space-y-2">
                        <label className="text-xs font-bold text-zinc-300 block">{group}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {variantsInGroup.map((v) => {
                            const isSelected = selectedVariants[group]?.id === v.id;
                            return (
                              <button
                                key={v.id}
                                onClick={() =>
                                  setSelectedVariants((prev) => ({
                                    ...prev,
                                    [group]: v
                                  }))
                                }
                                className={`p-2.5 rounded-xl text-xs font-semibold border flex items-center justify-between transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 font-bold'
                                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                                }`}
                              >
                                <span>{v.name}</span>
                                {v.priceModifier > 0 && (
                                  <span className="text-[10px] text-amber-400 font-mono">
                                    +{settings.currency}{v.priceModifier.toFixed(2)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Price Breakdown & Add Button */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Price</span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {settings.currency}{calculateCustomizedPrice().toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleAddToCart}
                className="px-5 py-3 rounded-2xl btn-brand text-zinc-950 font-extrabold text-xs uppercase tracking-wider shadow-xl flex items-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                Add to Cart
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* CART & CHECKOUT MODAL (USES BASE MODAL COMPONENT)                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title={
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            <span className="font-black text-base text-zinc-100">Your Order Bag</span>
          </div>
        }
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {/* Items List */}
          {cart.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <ShoppingBag className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 font-semibold">Your bag is currently empty.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {cart.map((ci) => (
                <div
                  key={ci.id}
                  className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-extrabold text-xs text-zinc-100 block truncate">{ci.item.name}</span>
                    {ci.variants.length > 0 && (
                      <p className="text-[10px] text-zinc-400 truncate">
                        {ci.variants.map((v) => `${v.name}`).join(', ')}
                      </p>
                    )}
                    <span className="font-bold text-xs text-amber-400 font-mono mt-0.5 block">
                      {settings.currency}{(ci.unitPrice * ci.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => updateCartQty(ci.id, -1)}
                      className="w-6 h-6 rounded-lg bg-zinc-900 text-zinc-300 font-bold flex items-center justify-center hover:bg-zinc-800 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-zinc-100 w-4 text-center">{ci.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(ci.id, 1)}
                      className="w-6 h-6 rounded-lg bg-zinc-900 text-zinc-300 font-bold flex items-center justify-center hover:bg-zinc-800 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Checkout Section */}
          {cart.length > 0 && (
            <form onSubmit={handlePlaceOrder} className="space-y-3 pt-3 border-t border-zinc-800/80 text-xs">
              {/* Payment Method Selector */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-2 rounded-xl text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1 ${
                      paymentMethod === 'card'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    💳 Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-2 rounded-xl text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1 ${
                      paymentMethod === 'cash'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('google_pay')}
                    className={`p-2 rounded-xl text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1 ${
                      paymentMethod === 'google_pay'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    📱 GPay
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`p-2 rounded-xl text-[11px] font-bold border cursor-pointer flex items-center justify-center gap-1 ${
                      paymentMethod === 'online'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    🛵 Online
                  </button>
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Your Name / Table Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hasti - Table 04"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
                  required
                />
              </div>

              {/* Subtotal & Total Breakdown */}
              <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-1 text-[11px] font-medium">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono">{settings.currency}{cartSubtotal.toFixed(2)}</span>
                </div>
                {settings.taxRate > 0 && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Estimated Tax ({settings.taxRate}%)</span>
                    <span className="font-mono">{settings.currency}{cartTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-100 font-extrabold text-sm pt-1 border-t border-zinc-800">
                  <span>Total Amount</span>
                  <span className="text-amber-400 font-mono">{settings.currency}{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Submit Order Button */}
              <button
                type="submit"
                className="w-full py-3 rounded-2xl btn-brand text-zinc-950 font-black text-xs uppercase tracking-wider shadow-xl cursor-pointer"
              >
                Confirm & Place Order ({settings.currency}{cartTotal.toFixed(2)})
              </button>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};
