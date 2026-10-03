import React, { useEffect, useRef, useState } from 'react';
import { Coffee, GlassWater, Leaf, Cake, Utensils, Search, Plus, Minus, ShoppingBag, CheckCircle2, X, MapPin, Phone, ChevronRight, Dice5, Heart, ArrowUp, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { CategorySelect, MenuItemSelect, MenuVariantSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { getOpeningStatus } from '../utils/openingHours';
import { OrderTracking, OrderReceipt } from './OrderTracking';
import { Modal } from './Modal';

interface PublicMenuProps {
  settings: SettingsSelect;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  menuVariants: MenuVariantSelect[];
  onOrderCreated?: () => void;
}

interface CartItem {
  id: string;
  item: MenuItemSelect;
  variants: MenuVariantSelect[];
  quantity: number;
  unitPrice: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Coffee: <Coffee size={16} />, GlassWater: <GlassWater size={16} />,
  Leaf: <Leaf size={16} />, Cake: <Cake size={16} />, Utensils: <Utensils size={16} />
};

function ItemPhoto({ item }: { item: MenuItemSelect }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!item.imageUrl || failedUrl === item.imageUrl) return null;
  return <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async"
    onError={() => setFailedUrl(item.imageUrl)}
    className="menu-photo h-20 w-20 sm:h-24 sm:w-24 object-cover shrink-0" />;
}

const SAVED_ITEMS_KEY = 'chth_menu_saved_items';

function readSavedItems(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SAVED_ITEMS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function CupSketch() {
  return <svg viewBox="0 0 160 150" fill="none" aria-hidden="true" className="cup-sketch">
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 57c8-8 70-8 80 0l-7 45c-2 22-65 23-67 0l-6-45Z" />
      <ellipse cx="72" cy="57" rx="40" ry="9" />
      <path d="M111 66c38-12 39 39-4 32M25 118c18 15 79 16 102-1M57 36c-13-12 12-17 1-30M79 37c-13-12 12-17 1-30M98 36c-11-9 8-14 2-24" />
      <path d="m68 80 4 5 4-5M55 76v3M89 76v3M20 48l-8-5M132 42l8-7M140 56l10-2" />
    </g>
  </svg>;
}

export const PublicMenu: React.FC<PublicMenuProps> = ({ settings, categories, menuItems, menuVariants, onOrderCreated }) => {
  const [receipt, setReceipt] = useState<OrderReceipt | null>(() => {
    try { const saved = JSON.parse(localStorage.getItem('chth_order_receipt') || 'null'); return saved?.id && saved?.token && saved?.number ? saved : null; } catch { return null; }
  });
  const [dietaryFilter, setDietaryFilter] = useState('');
  const [excludedAllergen, setExcludedAllergen] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedItemIds, setSavedItemIds] = useState<string[]>(readSavedItems);
  const [savedOnly, setSavedOnly] = useState(false);
  const [suggestedId, setSuggestedId] = useState<string | null>(null);
  const [pickNumber, setPickNumber] = useState(0);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<MenuItemSelect | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, MenuVariantSelect>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout' | 'pickup'>('dine_in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');
  const [notice, setNotice] = useState('');
  const [orderError, setOrderError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const submittingRef = useRef(false);
  const submissionRef = useRef<{ signature: string; id: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();
  const categoryBarRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try { localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(savedItemIds)); } catch { /* Saving still works for this visit. */ }
  }, [savedItemIds]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const updateTime = () => setNow(new Date());
    window.addEventListener('focus', updateTime);
    document.addEventListener('visibilitychange', updateTime);
    return () => {
      clearInterval(timer);
      clearTimeout(noticeTimer.current);
      clearTimeout(addedTimer.current);
      window.removeEventListener('focus', updateTime);
      document.removeEventListener('visibilitychange', updateTime);
    };
  }, []);

  useEffect(() => {
    if (selectedCatId !== 'all' && !categories.some(category => category.id === selectedCatId)) setSelectedCatId('all');
  }, [categories, selectedCatId]);

  useEffect(() => {
    const selected = categoryBarRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const scroller = selected?.parentElement;
    if (selected && scroller) scroller.scrollLeft = selected.offsetLeft - scroller.offsetLeft - (scroller.clientWidth - selected.clientWidth) / 2;
    // Switching category from deep in the list would strand the reader mid-page; start them at the top of the new list.
    const railBottom = categoryBarRef.current?.getBoundingClientRect().bottom;
    const resultsTop = resultsRef.current?.getBoundingClientRect().top;
    if (railBottom !== undefined && resultsTop !== undefined && resultsTop < railBottom) window.scrollTo({ top: window.scrollY + resultsTop - railBottom - 12 });
  }, [selectedCatId]);

  // Refresh an existing cart after menu changes, while keeping it fixed during submission.
  useEffect(() => {
    if (isSubmitting) return;
    setCart(previous => previous.map(line => {
      const item = menuItems.find(candidate => candidate.id === line.item.id);
      if (!item) return line;
      const variants = line.variants.map(selected => menuVariants.find(candidate => candidate.id === selected.id && candidate.menuItemId === item.id) || selected);
      const unitPrice = Number((item.basePrice + variants.reduce((sum, variant) => sum + variant.priceModifier, 0)).toFixed(2));
      return { ...line, item, variants, unitPrice };
    }));
  }, [menuItems, menuVariants, isSubmitting]);

  const opening = getOpeningStatus(settings.openHours, now, settings.timeZone || 'Asia/Tehran');
  const money = (amount: number) => `${settings.currency}${amount.toFixed(2).replace(/\.00$/, '')}`;
  const query = searchQuery.trim().toLocaleLowerCase();
  const matchingItems = menuItems.filter(item =>
    (!dietaryFilter || item.dietaryLabels?.split(',').some(label => label.trim().toLowerCase() === dietaryFilter)) &&
    (!excludedAllergen || (!!item.allergens && item.allergens.toLowerCase() !== 'unknown' && !item.allergens.split(',').some(label => label.trim().toLowerCase() === excludedAllergen))) &&
    (!onlyInStock || item.isInStock) &&
    (!savedOnly || savedItemIds.includes(item.id)) &&
    [item.name, item.description, item.badge].some(value => value?.toLocaleLowerCase().includes(query))
  );
  const orderedCategories = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);
  const sections = orderedCategories
    .filter(category => selectedCatId === 'all' || selectedCatId === category.id)
    .map(category => ({ id: category.id, name: category.name, items: matchingItems.filter(item => item.categoryId === category.id) }))
    .filter(section => section.items.length > 0);
  const uncategorizedItems = matchingItems.filter(item => !categories.some(category => category.id === item.categoryId));
  if (selectedCatId === 'all' && uncategorizedItems.length) sections.push({ id: 'uncategorized', name: 'More from our menu', items: uncategorizedItems });

  const pickableItems = sections.flatMap(section => section.items).filter(item => item.isInStock);
  const suggestedItem = pickableItems.find(item => item.id === suggestedId);
  const savedCount = menuItems.filter(item => savedItemIds.includes(item.id)).length;
  const activeFilterCount = (dietaryFilter ? 1 : 0) + (excludedAllergen ? 1 : 0);
  const resetFilters = () => { setSearchQuery(''); setSelectedCatId('all'); setOnlyInStock(false); setSavedOnly(false); setDietaryFilter(''); setExcludedAllergen(''); };

  const announce = (message: string) => {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(''), 4000);
  };
  const toggleSaved = (item: MenuItemSelect) => {
    const wasSaved = savedItemIds.includes(item.id);
    setSavedItemIds(previous => previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id]);
    announce(wasSaved ? `${item.name} removed from your favorites` : `${item.name} saved for later`);
  };
  const pickForMe = () => {
    const alternatives = pickableItems.filter(item => item.id !== suggestedId);
    const pool = alternatives.length ? alternatives : pickableItems;
    if (!pool.length) return;
    const item = pool[Math.floor(Math.random() * pool.length)];
    setSuggestedId(item.id);
    setPickNumber(previous => previous + 1);
    announce(`The menu picked ${item.name}. Add it or try another pick.`);
  };
  const addItem = (item: MenuItemSelect, variants: MenuVariantSelect[]) => {
    if (submittingRef.current || !menuItems.find(current => current.id === item.id)?.isInStock) return;
    const id = `${item.id}-${variants.map(variant => variant.id).sort().join('-') || 'default'}`;
    const unitPrice = Number((item.basePrice + variants.reduce((sum, variant) => sum + variant.priceModifier, 0)).toFixed(2));
    setCart(previous => previous.some(line => line.id === id)
      ? previous.map(line => line.id === id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...previous, { id, item, variants, quantity: 1, unitPrice }]);
    setOrderError('');
    clearTimeout(addedTimer.current);
    setLastAddedId(item.id);
    addedTimer.current = setTimeout(() => setLastAddedId(null), 1600);
    announce(`${item.name} added to your order`);
  };
  const updateQuantity = (id: string, delta: number) => {
    if (submittingRef.current) return;
    setCart(previous => previous.map(line => line.id === id ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0));
    setOrderError('');
  };
  const openCustomize = (item: MenuItemSelect) => {
    if (!item.isInStock || submittingRef.current) return;
    const selections: Record<string, MenuVariantSelect> = {};
    menuVariants.filter(variant => variant.menuItemId === item.id).forEach(variant => {
      if (!selections[variant.groupName]) selections[variant.groupName] = variant;
    });
    setSelectedVariants(selections);
    setActiveItem(item);
  };
  const customizedPrice = activeItem
    ? activeItem.basePrice + Object.values(selectedVariants).reduce((sum, variant) => sum + variant.priceModifier, 0) : 0;
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = Number(cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0).toFixed(2));
  const tax = Number((subtotal * settings.taxRate / 100).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  const unavailableInCart = cart.some(line => !menuItems.find(item => item.id === line.item.id)?.isInStock || line.variants.some(selected => !menuVariants.some(variant => variant.id === selected.id && variant.menuItemId === line.item.id)) || menuVariants.some(variant => variant.menuItemId === line.item.id && !line.variants.some(selected => selected.groupName === variant.groupName)));

  const handlePlaceOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || !cart.length) return;
    const currentOpening = getOpeningStatus(settings.openHours, new Date(), settings.timeZone || 'Asia/Tehran');
    setNow(new Date());
    if (!currentOpening.isOpen) { setOrderError(currentOpening.detail); return; }
    if (unavailableInCart) { setOrderError('Please remove unavailable items or options before placing your order.'); return; }
    const identity = orderType === 'dine_in' ? tableNumber.trim() : customerName.trim();
    if (!identity) { setOrderError(orderType === 'dine_in' ? 'Please enter your table number.' : 'Please enter your name.'); return; }
    const input = {
      customerName: orderType === 'dine_in' ? `Table ${identity}` : identity,
      orderType, paymentMethod,
      items: cart.map(line => ({
        menuItemId: line.item.id, itemName: line.item.name,
        quantity: line.quantity, unitPrice: line.unitPrice,
        variants: line.variants.map(variant => variant.id)
      }))
    };
    const signature = JSON.stringify(input);
    if (submissionRef.current?.signature !== signature) submissionRef.current = { signature, id: `public-${crypto.randomUUID()}` };
    submittingRef.current = true;
    setIsSubmitting(true);
    setOrderError('');
    try {
      const order = await store.submitPublicOrder(input, submissionRef.current.id);
      if (order.trackingToken) {
        const savedReceipt = { id: order.id, token: order.trackingToken, number: order.orderNumber };
        setReceipt(savedReceipt);
        try { localStorage.setItem('chth_order_receipt', JSON.stringify(savedReceipt)); } catch {}
      }
      setCart([]);
      setIsCartOpen(false);
      setCustomerName('');
      setTableNumber('');
      submissionRef.current = null;
      announce(`Order ${order.orderNumber} received. Please pay at the café.`);
      onOrderCreated?.();
    } catch (error) {
      void store.syncFromAPI();
      setOrderError(error instanceof Error ? error.message : 'We couldn’t confirm your order. Please try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="public-menu menu-zine space-y-7 pb-28" id="menu-top">
      <div role="status" aria-live="polite" aria-atomic="true" className={notice ? 'menu-notice fixed top-20 left-4 right-4 sm:left-auto sm:right-6 z-[10000] rounded-2xl bg-zinc-900 border border-zinc-800 p-4 shadow-lg flex items-center gap-3 text-sm text-zinc-100' : 'sr-only'}>
        {notice && <CheckCircle2 className="brand-text shrink-0" size={20} />}{notice}
      </div>

      <section aria-label="Café information" className="menu-hero">
        <div className="menu-issue-line"><span>{settings.cafeName} / café menu</span><span>Take your time.</span></div>
        <div className="menu-cover">
          <div className="menu-cover-copy">
            <h1>{settings.cafeName}<span className="menu-cover-aside">a little pause.</span></h1>
            <p className="menu-cover-caption">Find your usual. Find a new usual.</p>
            <div className="menu-hours-line">
              <span className={`menu-open-stamp ${opening.isOpen ? 'is-open' : ''}`}>{opening.label}</span>
              <span>{opening.detail}</span>
            </div>
          </div>
          <div className="menu-cover-margin">
            {settings.logoUrl ? <img src={settings.logoUrl} alt={settings.cafeName} className="menu-store-image" /> : <CupSketch />}
            <div className="menu-pick-note">
              <span className="menu-hand-note">The indecisive corner</span>
              <p>Something different today?</p>
              <button type="button" onClick={pickForMe} disabled={!pickableItems.length || isSubmitting} className="menu-pick-button" aria-label="Pick something for me">
                <Dice5 key={pickNumber} className={pickNumber ? 'menu-dice-rolled' : ''} size={20} />{suggestedItem ? 'Pick again' : 'Pick for me'}<ArrowUpRight size={17} />
              </button>
              <span className="menu-pick-footnote">From available items in your current view.</span>
            </div>
          </div>
        </div>
        <div className="menu-cover-bottom">
          <div className="menu-contact-links">
            {settings.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" rel="noreferrer"><MapPin size={15} />{settings.address}</a>}
            {settings.contactPhone && <a href={`tel:${settings.contactPhone.replace(/[^+\d]/g, '')}`}><Phone size={15} />{settings.contactPhone}</a>}
          </div>
          <button type="button" onClick={() => setIsCartOpen(true)} className="menu-order-ticket"><ShoppingBag size={17} />Your order<span>{cartCount.toString().padStart(2, '0')}</span></button>
        </div>
      </section>

      {suggestedItem && <aside key={`${suggestedItem.id}-${pickNumber}`} className="menu-recommendation" aria-label="The menu’s pick">
        <div className="menu-recommendation-label"><Dice5 size={20} /><span>Leave it to chance</span></div>
        <div className="menu-recommendation-copy"><h2>{suggestedItem.name}</h2>{suggestedItem.description && <p>{suggestedItem.description}</p>}</div>
        <div className="menu-recommendation-actions">
          <button type="button" disabled={isSubmitting} onClick={() => menuVariants.some(variant => variant.menuItemId === suggestedItem.id) ? openCustomize(suggestedItem) : addItem(suggestedItem, [])} className="menu-ink-button">{menuVariants.some(variant => variant.menuItemId === suggestedItem.id) ? 'Make it yours' : 'Add to my order'}<Plus size={16} /></button>
          <button type="button" onClick={pickForMe} disabled={isSubmitting} className="menu-text-button"><Dice5 size={16} />Another pick</button>
          <button type="button" aria-label="Dismiss recommendation" onClick={() => setSuggestedId(null)} className="menu-dismiss"><X size={18} /></button>
        </div>
      </aside>}

      {receipt && <OrderTracking receipt={receipt} onDismiss={() => { setReceipt(null); try { localStorage.removeItem('chth_order_receipt'); } catch {} }} />}
      <div className="menu-tools flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <label htmlFor="menu-search" className="sr-only">Search the menu</label>
          <input id="menu-search" type="search" enterKeyHint="search" placeholder="Something on your mind?" value={searchQuery}
            onChange={event => { if (!searchQuery && event.target.value) setSelectedCatId('all'); setSearchQuery(event.target.value); }}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            className="w-full min-h-12 rounded-xl bg-zinc-900 border border-zinc-800 pl-11 pr-12 text-base text-zinc-100" />
          {searchQuery && <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-zinc-400"><X size={18} /></button>}
        </div>
        <button type="button" aria-pressed={onlyInStock} onClick={() => setOnlyInStock(value => !value)}
          className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${onlyInStock ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>Available only</button>
        <button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(previous => !previous)} className={`menu-saved-toggle min-h-11 rounded-xl border px-4 text-sm font-semibold ${savedOnly ? 'is-selected' : ''}`}><Heart size={16} fill={savedOnly ? 'currentColor' : 'none'} />Saved <span>{savedCount}</span></button>
        <button type="button" aria-expanded={filtersOpen} aria-controls="menu-filters" onClick={() => setFiltersOpen(open => !open)} className={`menu-filter-toggle min-h-11 rounded-xl border px-4 text-sm font-semibold ${activeFilterCount ? 'has-filters' : ''}`}><SlidersHorizontal size={16} />Filters{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
      </div>

      {filtersOpen && <div id="menu-filters" className="menu-filters grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-3 mb-5 text-sm">
        <label className="flex flex-col gap-1.5">Dietary preference<select value={dietaryFilter} onChange={e=>setDietaryFilter(e.target.value)} className="w-full sm:w-auto min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3"><option value="">All items</option>{['vegan','vegetarian','gluten-free','decaf','caffeine-free'].map(v=><option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
        <label className="flex flex-col gap-1.5">Exclude allergen<select value={excludedAllergen} onChange={e=>setExcludedAllergen(e.target.value)} className="w-full sm:w-auto min-h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3"><option value="">No exclusion</option>{['milk','nuts','gluten','egg','soy'].map(v=><option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
        <p className="col-span-2 w-full text-xs text-zinc-400">Labels are supplied by café staff. Ask staff about substitutions and cross-contact. Allergen exclusions hide items with unconfirmed labels.</p>
      </div>}
      <nav ref={categoryBarRef} aria-label="Menu categories" className="menu-categories sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b border-zinc-800 bg-zinc-950">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button type="button" aria-pressed={selectedCatId === 'all'} onClick={() => setSelectedCatId('all')}
            className={`shrink-0 min-h-11 rounded-xl px-4 text-sm font-semibold ${selectedCatId === 'all' ? 'btn-brand text-zinc-950' : 'bg-zinc-900 text-zinc-300'}`}>All <span className="opacity-70 ml-1">{matchingItems.length}</span></button>
          {orderedCategories.map(category => <button key={category.id} type="button" aria-pressed={selectedCatId === category.id} onClick={() => setSelectedCatId(category.id)}
            className={`shrink-0 min-h-11 flex items-center gap-2 rounded-xl px-4 text-sm font-semibold ${selectedCatId === category.id ? 'btn-brand text-zinc-950' : 'bg-zinc-900 text-zinc-300'}`}>
            {CATEGORY_ICONS[category.icon || 'Coffee'] || CATEGORY_ICONS.Coffee}{category.name}<span className="opacity-70">{matchingItems.filter(item => item.categoryId === category.id).length}</span>
          </button>)}
        </div>
      </nav>

      <div ref={resultsRef}>
      {sections.length === 0 ? <div className="rounded-2xl border border-zinc-800 py-12 text-center space-y-3">
        <Coffee className="mx-auto text-zinc-500" size={32} /><h2 className="text-lg font-semibold text-zinc-100">{savedOnly && savedCount === 0 ? 'Your usuals start here.' : query ? `Nothing matches “${searchQuery.trim()}”.` : 'Nothing on this page yet.'}</h2>
        <p className="text-sm text-zinc-400">{savedOnly && savedCount === 0 ? 'Tap a heart beside anything you like. It’ll be waiting here next time.' : query ? 'Try a shorter word, or clear your search and filters.' : 'Try another category or reset your filters.'}</p>
        <button type="button" className="min-h-11 rounded-xl btn-brand px-5 font-semibold text-zinc-950" onClick={resetFilters}>Reset filters</button>
      </div> : <div className="menu-sections space-y-9">
        {sections.map((section, sectionIndex) => <section key={section.id} aria-labelledby={`category-${section.id}`} className="menu-section space-y-4">
          <div className="menu-section-heading"><span className="menu-section-number">{(sectionIndex + 1).toString().padStart(2, '0')}</span><h2 id={`category-${section.id}`} className="text-2xl font-semibold text-zinc-100">{section.name}</h2><span className="menu-section-count">{section.items.length} things to try</span></div>
          <div className="menu-ledger grid grid-cols-1 md:grid-cols-2">
            {section.items.map(item => {
              const variants = menuVariants.filter(variant => variant.menuItemId === item.id);
              const simpleLine = cart.find(line => line.item.id === item.id && line.variants.length === 0);
              const quantity = cart.filter(line => line.item.id === item.id).reduce((sum, line) => sum + line.quantity, 0);
              const minimumModifiers = [...new Set(variants.map(variant => variant.groupName))].reduce((sum, group) => sum + Math.min(...variants.filter(variant => variant.groupName === group).map(variant => variant.priceModifier)), 0);
              return <article key={item.id} className={`menu-card flex flex-col gap-4 ${!item.isInStock ? 'menu-card-unavailable' : ''} ${lastAddedId === item.id ? 'menu-card-just-added' : ''}`}>
                <div className="menu-item-topline">
                  <span className="menu-item-number">/{(menuItems.findIndex(current => current.id === item.id) + 1).toString().padStart(2, '0')}</span>
                  <button type="button" className={`menu-save-button ${savedItemIds.includes(item.id) ? 'is-saved' : ''}`} aria-label={`${savedItemIds.includes(item.id) ? 'Unsave' : 'Save'} ${item.name}`} aria-pressed={savedItemIds.includes(item.id)} onClick={() => toggleSaved(item)}><Heart size={19} fill={savedItemIds.includes(item.id) ? 'currentColor' : 'none'} /></button>
                </div>
                <div className="flex gap-4 flex-1">
                  <div className="flex-1 min-w-0">
                    {(item.badge || !item.isInStock) && <div className="flex flex-wrap gap-2 mb-2 text-xs font-semibold">
                      {item.badge && <span className="menu-item-badge">{item.badge}</span>}
                      {!item.isInStock && <span className="text-rose-400">Sold out</span>}
                    </div>}
                    <h3 className="text-lg font-semibold text-zinc-100 leading-snug">{item.name}</h3>
                    {item.description && <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{item.description}</p>}
                  </div>
                  <ItemPhoto item={item} />
                </div>
                <div className="menu-item-bottom flex flex-wrap items-center justify-between gap-3">
                  <div><span className="text-lg font-semibold brand-text">{variants.length > 0 && <span className="text-xs text-zinc-400 mr-1">From</span>}{money(item.basePrice + minimumModifiers)}</span>
                    {<span className="block text-xs text-zinc-400 mt-1">Allergens: {item.allergens || 'Not confirmed — ask staff'}{item.dietaryLabels ? ` · ${item.dietaryLabels}` : ''}</span>}
                    {quantity > 0 && <span className="block text-xs text-zinc-400 mt-1">{quantity} in your order</span>}
                  </div>
                  {lastAddedId === item.id && <span className="menu-added-stamp" aria-hidden="true">on the ticket ✓</span>}
                  {variants.length > 0 ? <button type="button" onClick={() => openCustomize(item)} disabled={!item.isInStock || isSubmitting} className="min-h-11 px-4 rounded-xl btn-brand text-zinc-950 text-sm font-semibold inline-flex items-center gap-2"><Plus size={16} />Customize</button>
                    : simpleLine ? <div className="flex items-center gap-2 rounded-xl border border-zinc-800">
                      <button type="button" aria-label={`Remove one ${item.name}`} disabled={isSubmitting} onClick={() => updateQuantity(simpleLine.id, -1)} className="h-11 w-11 flex items-center justify-center text-zinc-300"><Minus size={16} /></button>
                      <span className="min-w-5 text-center font-semibold text-zinc-100">{simpleLine.quantity}</span>
                      <button type="button" aria-label={`Add one ${item.name}`} disabled={!item.isInStock || isSubmitting} onClick={() => updateQuantity(simpleLine.id, 1)} className="h-11 w-11 flex items-center justify-center brand-text"><Plus size={16} /></button>
                    </div> : <button type="button" aria-label={`Add ${item.name}`} onClick={() => addItem(item, [])} disabled={!item.isInStock || isSubmitting} className="min-h-11 px-4 rounded-xl btn-brand text-zinc-950 text-sm font-semibold inline-flex items-center gap-2"><Plus size={16} />Add</button>}
                </div>
              </article>;
            })}
          </div>
        </section>)}
      </div>}
      </div>

      <div className="menu-endnote"><span className="menu-hand-note">Good things take a little pause.</span><button type="button" className="menu-text-button" onClick={() => document.getElementById('menu-top')?.scrollIntoView({ block: 'start', behavior: document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>Back to the top<ArrowUp size={16} /></button></div>

      {cartCount > 0 && <div className="menu-cart-bar fixed left-4 right-4 z-40 md:left-auto md:right-6 md:w-96">
        <button type="button" onClick={() => setIsCartOpen(true)} className="w-full min-h-14 p-4 rounded-2xl btn-brand text-zinc-950 font-semibold flex items-center justify-between gap-3 shadow-lg">
          <span className="flex items-center gap-3"><ShoppingBag size={20} /><span>Your order · {cartCount}</span></span><span className="flex items-center gap-2">{money(total)}<ChevronRight size={18} /></span>
        </button>
      </div>}

      <Modal isOpen={!!activeItem} onClose={() => setActiveItem(null)} appearance="paper" title={<span className="text-lg font-semibold">{activeItem?.name}</span>}>
        {activeItem && <div className="public-menu menu-customization space-y-6 text-sm">
          {activeItem.description && <p className="text-zinc-400 leading-relaxed">{activeItem.description}</p>}
          {[...new Set(menuVariants.filter(variant => variant.menuItemId === activeItem.id).map(variant => variant.groupName))].map(group => <fieldset key={group}>
            <legend className="font-semibold text-zinc-100 mb-3">{group}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {menuVariants.filter(variant => variant.menuItemId === activeItem.id && variant.groupName === group).map(variant => <label key={variant.id} className={`flex min-h-12 items-center gap-3 p-3 rounded-xl border cursor-pointer ${selectedVariants[group]?.id === variant.id ? 'border-amber-500 brand-text bg-amber-500/20' : 'border-zinc-800 text-zinc-300 bg-zinc-900'}`}>
                <input type="radio" name={`variant-${group}`} checked={selectedVariants[group]?.id === variant.id} onChange={() => setSelectedVariants(previous => ({ ...previous, [group]: variant }))} className="accent-amber-500" />
                <span className="flex-1">{variant.name}</span>{variant.priceModifier !== 0 && <span className="text-xs whitespace-nowrap">{variant.priceModifier > 0 ? '+' : '−'}{money(Math.abs(variant.priceModifier))}</span>}
              </label>)}
            </div>
          </fieldset>)}
          <div className="flex items-center justify-between gap-4 border-t border-zinc-800 pt-4">
            <span className="text-xl font-semibold brand-text">{money(customizedPrice)}</span>
            <button type="button" disabled={isSubmitting || !menuItems.find(item => item.id === activeItem.id)?.isInStock} onClick={() => { addItem(activeItem, Object.values(selectedVariants)); setActiveItem(null); }} className="min-h-12 rounded-xl btn-brand px-5 text-zinc-950 font-semibold">Add to your order</button>
          </div>
        </div>}
      </Modal>

      <Modal appearance="paper" isOpen={isCartOpen} closeDisabled={isSubmitting} onClose={() => { if (!submittingRef.current) setIsCartOpen(false); }} title={<span className="text-lg font-semibold flex items-center gap-2"><ShoppingBag size={20} />Your order</span>} maxWidth="max-w-lg">
        {!cart.length ? <div className="py-10 text-center text-sm text-zinc-400">Your order is empty. Choose something from the menu.</div> : <form onSubmit={handlePlaceOrder} className="public-menu menu-checkout space-y-5 text-sm">
          <fieldset disabled={isSubmitting} className="space-y-5 min-w-0">
            <legend className="sr-only">Order details</legend>
            <div className="space-y-3">
              {cart.map(line => {
                const available = menuItems.find(item => item.id === line.item.id)?.isInStock;
                return <div key={line.id} className="rounded-xl border border-zinc-800 p-3 flex flex-wrap justify-between items-center gap-3">
                  <div className="flex-1 min-w-0"><span className="font-semibold text-zinc-100">{line.item.name}</span>
                    {!!line.variants.length && <p className="text-xs text-zinc-400 mt-1">{line.variants.map(variant => `${variant.groupName}: ${variant.name}`).join(', ')}</p>}
                    {!available && <p className="text-xs text-rose-400 mt-1">Sold out · please remove this item</p>}
                    <span className="block brand-text font-semibold mt-1">{money(line.unitPrice * line.quantity)}</span>
                  </div>
                  <div className="flex items-center rounded-xl border border-zinc-800">
                    <button type="button" aria-label={`Remove one ${line.item.name}`} onClick={() => updateQuantity(line.id, -1)} className="w-11 h-11 flex items-center justify-center text-zinc-300"><Minus size={16} /></button>
                    <span className="min-w-5 text-center font-semibold text-zinc-100">{line.quantity}</span>
                    <button type="button" disabled={!available} aria-label={`Add one ${line.item.name}`} onClick={() => updateQuantity(line.id, 1)} className="w-11 h-11 flex items-center justify-center text-zinc-300"><Plus size={16} /></button>
                  </div>
                </div>;
              })}
            </div>
            <fieldset><legend className="mb-2 font-semibold text-zinc-300">Order type</legend>
              <div className="grid grid-cols-3 gap-2">{([['dine_in', 'Dine-in'], ['takeout', 'Takeaway'], ['pickup', 'Pickup']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={orderType === value} onClick={() => { setOrderType(value); setOrderError(''); }} className={`min-h-11 rounded-xl border font-semibold ${orderType === value ? 'bg-amber-500/20 border-amber-500/40 brand-text' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>{label}</button>)}</div>
            </fieldset>
            <div><label htmlFor="order-identity" className="block mb-2 font-semibold text-zinc-300">{orderType === 'dine_in' ? 'Table number' : 'Your name'}</label>
              <input id="order-identity" type="text" autoComplete={orderType === 'dine_in' ? 'off' : 'name'} required maxLength={100} placeholder={orderType === 'dine_in' ? 'e.g. 04' : 'Your name'} value={orderType === 'dine_in' ? tableNumber : customerName} onChange={event => { if (orderType === 'dine_in') setTableNumber(event.target.value); else setCustomerName(event.target.value); setOrderError(''); }} className="w-full min-h-12 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-base text-zinc-100" />
            </div>
            <fieldset><legend className="mb-2 font-semibold text-zinc-300">Pay at the café</legend>
              <div className="grid grid-cols-2 gap-2">{(['card', 'cash'] as const).map(value => <button type="button" key={value} aria-pressed={paymentMethod === value} onClick={() => setPaymentMethod(value)} className={`min-h-11 rounded-xl border font-semibold ${paymentMethod === value ? 'bg-amber-500/20 border-amber-500/40 brand-text' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>{value === 'card' ? 'Card' : 'Cash'}</button>)}</div>
              <p className="text-xs text-zinc-400 mt-2">Payment is collected at the café when you receive your order.</p>
            </fieldset>
          </fieldset>
          <div className="rounded-xl bg-zinc-900 p-4 space-y-2">
            <div className="flex justify-between text-zinc-400"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {settings.taxRate > 0 && <div className="flex justify-between text-zinc-400"><span>Tax ({settings.taxRate}%)</span><span>{money(tax)}</span></div>}
            <div className="flex justify-between text-base font-semibold text-zinc-100 border-t border-zinc-800 pt-3"><span>Total</span><span className="brand-text">{money(total)}</span></div>
          </div>
          {!opening.isOpen && <p className="text-sm text-zinc-300 rounded-xl border border-zinc-800 p-3">{opening.label}. {opening.detail} You can keep browsing and order when we’re open.</p>}
          {unavailableInCart && <p className="text-sm text-rose-400">Please remove unavailable items or options before placing your order.</p>}
          {orderError && <p role="alert" className="text-sm text-rose-400">{orderError}</p>}
          <button type="submit" disabled={isSubmitting || !opening.isOpen || unavailableInCart} aria-busy={isSubmitting} className="w-full min-h-12 rounded-xl btn-brand text-zinc-950 font-semibold px-4">{isSubmitting ? 'Sending your order…' : `Place order · ${money(total)}`}</button>
        </form>}
      </Modal>
    </div>
  );
};
