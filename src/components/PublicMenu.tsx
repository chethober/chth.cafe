import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Coffee, GlassWater, Leaf, Cake, Utensils, Search, Plus, Minus, ShoppingBag, CheckCircle2, X, MapPin, Phone, ChevronRight, Heart, SlidersHorizontal, Sparkles, Shuffle, Sun, Moon, Globe, type LucideIcon } from 'lucide-react';
import { CategorySelect, MenuItemSelect, MenuVariantSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { getOpeningStatus } from '../utils/openingHours';
import { OrderTracking, OrderReceipt } from './OrderTracking';
import { Modal } from './Modal';
import { PublicEvents } from './PublicEvents';
import { reducedMotion } from '../ui';
import { applyDocumentLocale, detectLocale, setLocale, useLocale, useT, type Locale } from '../i18n';
import { LOCALES } from '../chth-kit/locales.js';
import { footerModel } from '../chth-kit/footer.js';

interface PublicMenuProps {
  settings: SettingsSelect;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  menuVariants: MenuVariantSelect[];
  onOrderCreated?: () => void;
  theme: 'dark' | 'light';
  /** Switches the theme; the change spreads out from the button that was pressed. */
  onToggleTheme: (button: HTMLElement) => void;
}

interface CartItem {
  id: string;
  item: MenuItemSelect;
  variants: MenuVariantSelect[];
  quantity: number;
  unitPrice: number;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = { Coffee, GlassWater, Leaf, Cake, Utensils };
const categoryIcon = (name?: string | null) => CATEGORY_ICONS[name || 'Coffee'] || Coffee;

const SAVED_ITEMS_KEY = 'chth_menu_saved_items';

// The public menu picks its language once, before its first render (?lang= is remembered).
let localeChosen = false;
function chooseLocale() {
  if (localeChosen || typeof window === 'undefined') return;
  localeChosen = true;
  setLocale(detectLocale(), new URLSearchParams(window.location.search).has('lang'));
}

/** The shared CHTH footer: the CHTH mark, linking to chth.wtf. */
function ChthFooter({ locale }: { locale: Locale }) {
  const m = footerModel(locale, 'cafe');
  return <footer className="chth-footer" data-chth-footer>
    <a className="chth-footer__brand" href={m.infoUrl}>
      <span className="chth-footer__mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: m.logoSvg }} />
      <span>{m.partOf}</span>
    </a>
  </footer>;
}

function readSavedItems(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SAVED_ITEMS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// A stable hue per item, so photo-less items still get their own colour swatch.
const hueFor = (text: string) => [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 17);

function greetingFor(now: Date, timeZone: string) {
  let hour = now.getHours();
  try { hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now)); } catch { /* Fall back to device time. */ }
  if (hour < 5) return 'Up late?';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function ItemArt({ item, Icon, large = false }: { item: MenuItemSelect; Icon: LucideIcon; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (item.imageUrl && failedUrl !== item.imageUrl) {
    return <img src={item.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(item.imageUrl)} className="pm-art-photo" />;
  }
  return <div className="pm-art-swatch" style={{ '--pm-hue': hueFor(item.name) } as React.CSSProperties} aria-hidden="true">
    <Icon size={large ? 56 : 34} />
    <span>{item.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</span>
  </div>;
}

function SteamingCup() {
  return <svg viewBox="0 0 160 150" fill="none" aria-hidden="true" className="pm-cup">
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path className="pm-steam" d="M57 36c-13-12 12-17 1-30" />
      <path className="pm-steam" d="M79 37c-13-12 12-17 1-30" />
      <path className="pm-steam" d="M98 36c-11-9 8-14 2-24" />
      <path d="M32 57c8-8 70-8 80 0l-7 45c-2 22-65 23-67 0l-6-45Z" />
      <ellipse cx="72" cy="57" rx="40" ry="9" />
      <path d="M111 66c38-12 39 39-4 32M25 118c18 15 79 16 102-1" />
      <path d="m68 80 4 5 4-5M55 76v3M89 76v3" />
    </g>
  </svg>;
}

function Confetti({ burst }: { burst: number }) {
  if (!burst) return null;
  return <div key={burst} className="pm-confetti" aria-hidden="true">
    {Array.from({ length: 28 }, (_, index) => {
      const angle = (index / 28) * Math.PI * 2;
      const distance = 120 + (index % 5) * 34;
      return <i key={index} style={{
        '--x': `${Math.cos(angle) * distance}px`, '--y': `${Math.sin(angle) * distance - 80}px`,
        '--r': `${(index * 47) % 360}deg`, '--h': `${(index * 53) % 360}`
      } as React.CSSProperties} />;
    })}
  </div>;
}

export const PublicMenu: React.FC<PublicMenuProps> = ({ settings, categories, menuItems, menuVariants, onOrderCreated, theme, onToggleTheme }) => {
  chooseLocale();
  const locale = useLocale();
  const t = useT();
  useLayoutEffect(() => applyDocumentLocale(locale), [locale]);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(() => {
    try { const saved = JSON.parse(localStorage.getItem('chth_order_receipt') || 'null'); return saved?.id && saved?.token && saved?.number ? saved : null; } catch { return null; }
  });
  const [dietaryFilter, setDietaryFilter] = useState('');
  const [excludedAllergen, setExcludedAllergen] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedItemIds, setSavedItemIds] = useState<string[]>(readSavedItems);
  const [savedOnly, setSavedOnly] = useState(false);
  const [heartBurst, setHeartBurst] = useState<{ id: string; n: number } | null>(null);
  const [spin, setSpin] = useState<{ phase: 'idle' | 'spinning' | 'landed'; itemId: string | null; tick: number }>({ phase: 'idle', itemId: null, tick: 0 });
  const [lastAdded, setLastAdded] = useState<{ id: string; n: number } | null>(null);
  const [activeItem, setActiveItem] = useState<MenuItemSelect | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
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
  const [confetti, setConfetti] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const submittingRef = useRef(false);
  const submissionRef = useRef<{ signature: string; id: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();
  const addedTimer = useRef<ReturnType<typeof setTimeout>>();
  const spinTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const confettiTimer = useRef<ReturnType<typeof setTimeout>>();
  const railRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const cartBarRef = useRef<HTMLButtonElement>(null);
  const previousCartCount = useRef(0);
  // While a rail tap scrolls the page, scroll-spy would flick through every section on the way; hold it on the target.
  const jumpTarget = useRef<{ id: string; until: number } | null>(null);

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
      clearTimeout(confettiTimer.current);
      spinTimers.current.forEach(clearTimeout);
      window.removeEventListener('focus', updateTime);
      document.removeEventListener('visibilitychange', updateTime);
    };
  }, []);

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
  const greeting = t(greetingFor(now, settings.timeZone || 'Asia/Tehran'));
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
    .map(category => ({ id: category.id, name: category.name, Icon: categoryIcon(category.icon), items: matchingItems.filter(item => item.categoryId === category.id) }))
    .filter(section => section.items.length > 0);
  const uncategorizedItems = matchingItems.filter(item => !categories.some(category => category.id === item.categoryId));
  if (uncategorizedItems.length) sections.push({ id: 'uncategorized', name: t('More from our menu'), Icon: Utensils, items: uncategorizedItems });
  const sectionKey = sections.map(section => section.id).join('|');
  const currentSectionId = sections.some(section => section.id === activeSectionId) ? activeSectionId : sections[0]?.id || '';

  const pickableItems = sections.flatMap(section => section.items).filter(item => item.isInStock);
  const spinItem = menuItems.find(item => item.id === spin.itemId);
  const savedCount = menuItems.filter(item => savedItemIds.includes(item.id)).length;
  const activeFilterCount = (dietaryFilter ? 1 : 0) + (excludedAllergen ? 1 : 0);
  const resetFilters = () => { setSearchQuery(''); setOnlyInStock(false); setSavedOnly(false); setDietaryFilter(''); setExcludedAllergen(''); };
  const itemIcon = (item: MenuItemSelect) => sections.find(section => section.items.includes(item))?.Icon || categoryIcon(categories.find(category => category.id === item.categoryId)?.icon);
  const hasVariants = (item: MenuItemSelect) => menuVariants.some(variant => variant.menuItemId === item.id);

  // Scroll-spy: the active chip follows whichever section sits under the sticky rail.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const railBottom = railRef.current?.getBoundingClientRect().bottom ?? 0;
      const held = jumpTarget.current;
      if (held && Date.now() < held.until) {
        const top = document.getElementById(`section-${held.id}`)?.getBoundingClientRect().top;
        if (top === undefined || Math.abs(top - railBottom) > 24) return;
      }
      jumpTarget.current = null;
      let current = sections[0]?.id || '';
      for (const section of sections) {
        const top = document.getElementById(`section-${section.id}`)?.getBoundingClientRect().top;
        if (top !== undefined && top - railBottom <= 48) current = section.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1]?.id || current;
      setActiveSectionId(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  // Slide the rail indicator under the active chip, and keep that chip in view.
  useLayoutEffect(() => {
    const rail = railRef.current;
    const indicator = indicatorRef.current;
    const chip = rail?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!rail || !indicator) return;
    if (!chip) { indicator.style.opacity = '0'; return; }
    indicator.style.opacity = '1';
    indicator.style.width = `${chip.offsetWidth}px`;
    indicator.style.transform = `translateX(${chip.offsetLeft}px)`;
    const scroller = chip.parentElement;
    if (scroller) scroller.scrollTo({ left: chip.offsetLeft - (scroller.clientWidth - chip.offsetWidth) / 2, behavior: reducedMotion() || !indicator.dataset.ready ? 'auto' : 'smooth' });
    // The first placement snaps; later moves glide.
    requestAnimationFrame(() => { indicator.dataset.ready = 'true'; });
  }, [currentSectionId, sectionKey]);

  // The order bar gives a small bounce whenever something new lands in it.
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  useEffect(() => {
    if (cartCount > previousCartCount.current && previousCartCount.current > 0 && !reducedMotion()) {
      cartBarRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    }
    previousCartCount.current = cartCount;
  }, [cartCount]);

  const jumpTo = (sectionId: string) => {
    const target = document.getElementById(`section-${sectionId}`);
    const railBottom = railRef.current?.getBoundingClientRect().bottom ?? 0;
    if (!target) return;
    jumpTarget.current = { id: sectionId, until: Date.now() + 1200 };
    setActiveSectionId(sectionId);
    window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - railBottom - 8, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  const announce = (message: string) => {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(''), 4000);
  };
  const toggleSaved = (item: MenuItemSelect) => {
    const wasSaved = savedItemIds.includes(item.id);
    setSavedItemIds(previous => previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id]);
    if (!wasSaved) setHeartBurst(previous => ({ id: item.id, n: (previous?.n || 0) + 1 }));
    announce(t(wasSaved ? '{name} removed from your favorites' : '{name} saved for later', { name: item.name }));
  };
  const spinForMe = () => {
    if (spin.phase === 'spinning' || !pickableItems.length) return;
    const alternatives = pickableItems.filter(item => item.id !== spin.itemId);
    const pool = alternatives.length ? alternatives : pickableItems;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    spinTimers.current.forEach(clearTimeout);
    spinTimers.current = [];
    const land = () => {
      setSpin(previous => ({ phase: 'landed', itemId: winner.id, tick: previous.tick + 1 }));
      announce(t('The reel landed on {name}. Add it or spin again.', { name: winner.name }));
    };
    if (reducedMotion() || pickableItems.length < 2) { land(); return; }
    // The reel slows like a real one: each tick waits a little longer than the last.
    let elapsed = 0;
    for (let index = 0; index < 11; index++) {
      elapsed += 45 * Math.pow(1.2, index);
      const shown = pickableItems[Math.floor(Math.random() * pickableItems.length)];
      spinTimers.current.push(setTimeout(() => setSpin(previous => ({ phase: 'spinning', itemId: shown.id, tick: previous.tick + 1 })), elapsed));
    }
    setSpin(previous => ({ ...previous, phase: 'spinning' }));
    spinTimers.current.push(setTimeout(land, elapsed + 160));
  };
  const addItem = (item: MenuItemSelect, variants: MenuVariantSelect[], quantity = 1) => {
    if (submittingRef.current || !menuItems.find(current => current.id === item.id)?.isInStock) return;
    const id = `${item.id}-${variants.map(variant => variant.id).sort().join('-') || 'default'}`;
    const unitPrice = Number((item.basePrice + variants.reduce((sum, variant) => sum + variant.priceModifier, 0)).toFixed(2));
    setCart(previous => previous.some(line => line.id === id)
      ? previous.map(line => line.id === id ? { ...line, quantity: line.quantity + quantity } : line)
      : [...previous, { id, item, variants, quantity, unitPrice }]);
    setOrderError('');
    clearTimeout(addedTimer.current);
    setLastAdded(previous => ({ id: item.id, n: (previous?.n || 0) + 1 }));
    addedTimer.current = setTimeout(() => setLastAdded(null), 900);
    announce(quantity > 1 ? t('{count} × {name} added to your order', { count: quantity, name: item.name }) : t('{name} added to your order', { name: item.name }));
  };
  const updateQuantity = (id: string, delta: number) => {
    if (submittingRef.current) return;
    setCart(previous => previous.map(line => line.id === id ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0));
    setOrderError('');
  };
  const openDetail = (item: MenuItemSelect) => {
    if (submittingRef.current) return;
    const selections: Record<string, MenuVariantSelect> = {};
    menuVariants.filter(variant => variant.menuItemId === item.id).forEach(variant => {
      if (!selections[variant.groupName]) selections[variant.groupName] = variant;
    });
    setSelectedVariants(selections);
    setDetailQuantity(1);
    setActiveItem(item);
  };
  const quickAdd = (item: MenuItemSelect) => hasVariants(item) ? openDetail(item) : addItem(item, []);
  const customizedPrice = activeItem
    ? activeItem.basePrice + Object.values(selectedVariants).reduce((sum, variant) => sum + variant.priceModifier, 0) : 0;
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
    if (unavailableInCart) { setOrderError(t('Please remove unavailable items or options before placing your order.')); return; }
    const identity = orderType === 'dine_in' ? tableNumber.trim() : customerName.trim();
    if (!identity) { setOrderError(t(orderType === 'dine_in' ? 'Please enter your table number.' : 'Please enter your name.')); return; }
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
      if (!reducedMotion()) {
        setConfetti(previous => previous + 1);
        clearTimeout(confettiTimer.current);
        confettiTimer.current = setTimeout(() => setConfetti(0), 1400);
      }
      announce(t('Order {number} received. Please pay at the café.', { number: order.orderNumber }));
      onOrderCreated?.();
    } catch (error) {
      void store.syncFromAPI();
      setOrderError(error instanceof Error ? error.message : t('We couldn’t confirm your order. Please try again.'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="public-menu pm" id="menu-top">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{notice}</div>
      {notice && !activeItem && !isCartOpen && <div key={notice} className="pm-toast" aria-hidden="true"><CheckCircle2 size={18} />{notice}</div>}
      <Confetti burst={confetti} />

      <section aria-label={t('Café information')} className="pm-hero">
        <button type="button" className="pm-theme-toggle" data-theme={theme} onClick={e => onToggleTheme(e.currentTarget)}
          aria-label={t(theme === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance')}>
          <Sun className="pm-theme-sun" size={19} aria-hidden="true" />
          <Moon className="pm-theme-moon" size={19} aria-hidden="true" />
        </button>
        <label className="pm-lang" title={t('Language')}>
          <Globe size={19} aria-hidden="true" />
          <span className="sr-only">{t('Language')}</span>
          <select value={locale} onChange={event => setLocale(event.target.value as Locale)}>
            {LOCALES.map(l => <option key={l.code} value={l.code} lang={l.code}>{l.native}</option>)}
          </select>
        </label>
        <div className="pm-hero-copy">
          <p className="pm-eyebrow"><Sparkles size={14} />{greeting}</p>
          <h1>{settings.cafeName}</h1>
          <p className="pm-tagline">{t('Find your usual. Find a new usual.')}</p>
          <div className="pm-status">
            <span className={`pm-open-pill ${opening.isOpen ? 'is-open' : ''}`}><i />{opening.label}</span>
            <span>{opening.detail}</span>
          </div>
          <div className="pm-contact">
            {settings.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" rel="noreferrer"><MapPin size={15} />{settings.address}</a>}
            {settings.contactPhone && <a href={`tel:${settings.contactPhone.replace(/[^+\d]/g, '')}`}><Phone size={15} />{settings.contactPhone}</a>}
          </div>
        </div>

        <div className="pm-hero-side">
          {settings.logoUrl ? <img src={settings.logoUrl} alt={settings.cafeName} className="pm-logo" /> : <SteamingCup />}
          <div className={`pm-spin is-${spin.phase}`}>
            <p className="pm-spin-label">{t('Can’t decide?')}</p>
            <div className="pm-reel" aria-hidden={spin.phase === 'spinning'}>
              <span key={spin.tick} className="pm-reel-name">{spinItem ? spinItem.name : t('Let the menu choose')}</span>
            </div>
            {spin.phase === 'landed' && spinItem ? <div className="pm-spin-actions">
              <span className="pm-spin-price">{money(spinItem.basePrice)}</span>
              <button type="button" className="pm-button" disabled={isSubmitting} onClick={() => quickAdd(spinItem)}>{t(hasVariants(spinItem) ? 'Make it yours' : 'Add it')}<Plus size={16} /></button>
              <button type="button" className="pm-icon-button" onClick={spinForMe} aria-label={t('Spin again')}><Shuffle size={18} /></button>
            </div> : <button type="button" className="pm-button pm-spin-button" onClick={spinForMe} disabled={!pickableItems.length || spin.phase === 'spinning' || isSubmitting}>
              <Shuffle size={16} />{t(spin.phase === 'spinning' ? 'Spinning…' : 'Spin for me')}
            </button>}
          </div>
        </div>
      </section>

      {receipt && <OrderTracking receipt={receipt} onDismiss={() => { setReceipt(null); try { localStorage.removeItem('chth_order_receipt'); } catch {} }} />}

      <PublicEvents settings={settings} />

      <div className="pm-tools">
        <div className="pm-search">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="menu-search" className="sr-only">{t('Search the menu')}</label>
          <input id="menu-search" type="search" enterKeyHint="search" placeholder={t('What are you craving?')} value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
          {searchQuery && <button type="button" aria-label={t('Clear search')} onClick={() => setSearchQuery('')}><X size={18} /></button>}
        </div>
        <div className="pm-toggles">
          <button type="button" className="pm-chip" aria-pressed={onlyInStock} onClick={() => setOnlyInStock(value => !value)}>{t('Available now')}</button>
          <button type="button" className="pm-chip" aria-pressed={savedOnly} onClick={() => setSavedOnly(previous => !previous)}><Heart size={15} fill={savedOnly ? 'currentColor' : 'none'} />{t('Saved')}<b>{savedCount}</b></button>
          <button type="button" className={`pm-chip ${activeFilterCount ? 'has-filters' : ''}`} aria-expanded={filtersOpen} aria-controls="menu-filters" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={15} />{t('Filters')}{activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
        </div>
      </div>

      {filtersOpen && <div id="menu-filters" className="pm-filters">
        <label>{t('Dietary preference')}<select value={dietaryFilter} onChange={e => setDietaryFilter(e.target.value)}><option value="">{t('All items')}</option>{['vegan', 'vegetarian', 'gluten-free', 'decaf', 'caffeine-free'].map(v => <option key={v} value={v}>{t(v[0].toUpperCase() + v.slice(1))}</option>)}</select></label>
        <label>{t('Exclude allergen')}<select value={excludedAllergen} onChange={e => setExcludedAllergen(e.target.value)}><option value="">{t('No exclusion')}</option>{['milk', 'nuts', 'gluten', 'egg', 'soy'].map(v => <option key={v} value={v}>{t(v[0].toUpperCase() + v.slice(1))}</option>)}</select></label>
        <p>{t('Labels are supplied by café staff. Ask staff about substitutions and cross-contact. Allergen exclusions hide items with unconfirmed labels.')}</p>
      </div>}

      {sections.length > 0 && <nav ref={railRef} aria-label={t('Menu categories')} className="pm-rail">
        <div className="pm-rail-scroller">
          <span ref={indicatorRef} className="pm-rail-indicator" aria-hidden="true" />
          {sections.map(section => <a key={section.id} href={`#section-${section.id}`} aria-current={currentSectionId === section.id ? 'true' : undefined}
            onClick={event => { event.preventDefault(); jumpTo(section.id); }} className="pm-rail-chip">
            <span className="pm-rail-icon"><section.Icon size={16} /></span>{section.name}<small>{section.items.length}</small>
          </a>)}
        </div>
      </nav>}

      {sections.length === 0 ? <div className="pm-empty">
        <Coffee size={36} aria-hidden="true" />
        <h2>{savedOnly && savedCount === 0 ? t('Your usuals start here.') : query ? t('Nothing matches “{query}”.', { query: searchQuery.trim() }) : t('Nothing on this page yet.')}</h2>
        <p>{t(savedOnly && savedCount === 0 ? 'Tap a heart on anything you like. It’ll be waiting here next time.' : query ? 'Try a shorter word, or clear your search and filters.' : 'Try resetting your filters.')}</p>
        <button type="button" className="pm-button" onClick={resetFilters}>{t('Reset filters')}</button>
      </div> : <div className="pm-sections">
        {sections.map(section => <section key={section.id} id={`section-${section.id}`} aria-labelledby={`category-${section.id}`} className="pm-section">
          <header className="pm-section-head">
            <span className="pm-section-icon"><section.Icon size={22} /></span>
            <h2 id={`category-${section.id}`}>{section.name}</h2>
            <span className="pm-section-count">{t('{count} to try', { count: section.items.length })}</span>
          </header>
          <div className="pm-grid">
            {section.items.map((item, index) => {
              const variants = menuVariants.filter(variant => variant.menuItemId === item.id);
              const simpleLine = cart.find(line => line.item.id === item.id && line.variants.length === 0);
              const quantity = cart.filter(line => line.item.id === item.id).reduce((sum, line) => sum + line.quantity, 0);
              const minimumModifiers = [...new Set(variants.map(variant => variant.groupName))].reduce((sum, group) => sum + Math.min(...variants.filter(variant => variant.groupName === group).map(variant => variant.priceModifier)), 0);
              const saved = savedItemIds.includes(item.id);
              const labels = item.dietaryLabels?.split(',').map(label => label.trim()).filter(Boolean) || [];
              return <article key={item.id} className={`pm-card ${!item.isInStock ? 'is-sold-out' : ''} ${quantity > 0 ? 'is-in-order' : ''}`} style={{ '--pm-i': Math.min(index, 8) } as React.CSSProperties}>
                <button type="button" className="pm-card-open" onClick={() => openDetail(item)} aria-label={t('{name}, {price}. View details', { name: item.name, price: money(item.basePrice + minimumModifiers) })}>
                  <div className="pm-art">
                    <ItemArt item={item} Icon={section.Icon} />
                    {item.badge && <span className="pm-badge">{item.badge}</span>}
                    {!item.isInStock && <span className="pm-sold-out">{t('Sold out')}</span>}
                  </div>
                  <div className="pm-card-body">
                    <h3>{item.name}</h3>
                    {item.description && <p>{item.description}</p>}
                    {labels.length > 0 && <ul className="pm-tags">{labels.map(label => <li key={label}>{label}</li>)}</ul>}
                  </div>
                </button>
                <button type="button" className={`pm-heart ${saved ? 'is-saved' : ''}`} aria-label={t(saved ? 'Unsave {name}' : 'Save {name}', { name: item.name })} aria-pressed={saved} onClick={() => toggleSaved(item)}>
                  <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
                  {heartBurst?.id === item.id && <span key={heartBurst.n} className="pm-heart-burst" aria-hidden="true" />}
                </button>
                <div className="pm-card-foot">
                  <span className="pm-price">{variants.length > 0 && <small>{t('from')}</small>}{money(item.basePrice + minimumModifiers)}</span>
                  {lastAdded?.id === item.id && <span key={lastAdded.n} className="pm-plus-one" aria-hidden="true">+1</span>}
                  {simpleLine ? <div className="pm-stepper">
                    <button type="button" aria-label={t('Remove one {name}', { name: item.name })} disabled={isSubmitting} onClick={() => updateQuantity(simpleLine.id, -1)}><Minus size={16} /></button>
                    <span>{simpleLine.quantity}</span>
                    <button type="button" aria-label={t('Add one {name}', { name: item.name })} disabled={!item.isInStock || isSubmitting} onClick={() => updateQuantity(simpleLine.id, 1)}><Plus size={16} /></button>
                  </div> : <button type="button" className="pm-add" aria-label={t(variants.length ? 'Customize {name}' : 'Add {name}', { name: item.name })} disabled={!item.isInStock || isSubmitting} onClick={() => quickAdd(item)}>
                    <Plus size={20} />{quantity > 0 && <b>{quantity}</b>}
                  </button>}
                </div>
              </article>;
            })}
          </div>
        </section>)}
      </div>}

<ChthFooter locale={locale} />

      {cartCount > 0 && <div className="pm-cart-bar">
        <button ref={cartBarRef} type="button" onClick={() => setIsCartOpen(true)}>
          <span className="pm-cart-count"><ShoppingBag size={18} /><b>{cartCount}</b></span>
          <span className="pm-cart-label">{t('Your order')}</span>
          <span className="pm-cart-total">{money(total)}<ChevronRight size={18} /></span>
        </button>
      </div>}

      <Modal isOpen={!!activeItem} onClose={() => setActiveItem(null)} appearance="paper" maxWidth="max-w-lg" title={<span className="text-lg font-semibold">{activeItem?.name}</span>}>
        {activeItem && <div className="public-menu pm-detail space-y-5 text-sm">
          <div className="pm-detail-art"><ItemArt item={activeItem} Icon={itemIcon(activeItem)} large /></div>
          {activeItem.badge && <span className="pm-detail-badge">{activeItem.badge}</span>}
          {activeItem.description && <p className="text-zinc-400 leading-relaxed">{activeItem.description}</p>}
          <dl className="pm-detail-facts">
            <div><dt>{t('Allergens')}</dt><dd>{activeItem.allergens || t('Not confirmed — ask staff')}</dd></div>
            {activeItem.dietaryLabels && <div><dt>{t('Dietary')}</dt><dd>{activeItem.dietaryLabels}</dd></div>}
          </dl>
          {[...new Set(menuVariants.filter(variant => variant.menuItemId === activeItem.id).map(variant => variant.groupName))].map(group => <fieldset key={group}>
            <legend className="font-semibold text-zinc-100 mb-3">{group}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {menuVariants.filter(variant => variant.menuItemId === activeItem.id && variant.groupName === group).map(variant => <label key={variant.id} className={`flex min-h-12 items-center gap-3 p-3 rounded-xl border cursor-pointer ${selectedVariants[group]?.id === variant.id ? 'border-amber-500 brand-text bg-amber-500/20' : 'border-zinc-800 text-zinc-300 bg-zinc-900'}`}>
                <input type="radio" name={`variant-${group}`} checked={selectedVariants[group]?.id === variant.id} onChange={() => setSelectedVariants(previous => ({ ...previous, [group]: variant }))} className="accent-amber-500" />
                <span className="flex-1">{variant.name}</span>{variant.priceModifier !== 0 && <span className="text-xs whitespace-nowrap">{variant.priceModifier > 0 ? '+' : '−'}{money(Math.abs(variant.priceModifier))}</span>}
              </label>)}
            </div>
          </fieldset>)}
          {!activeItem.isInStock ? <p className="pm-detail-soldout">{t('Sold out for now — check back soon.')}</p> : <div className="pm-detail-foot">
            <div className="pm-stepper">
              <button type="button" aria-label={t('One fewer')} disabled={detailQuantity <= 1} onClick={() => setDetailQuantity(value => Math.max(1, value - 1))}><Minus size={16} /></button>
              <span>{detailQuantity}</span>
              <button type="button" aria-label={t('One more')} disabled={detailQuantity >= 20} onClick={() => setDetailQuantity(value => Math.min(20, value + 1))}><Plus size={16} /></button>
            </div>
            <button type="button" disabled={isSubmitting || !menuItems.find(item => item.id === activeItem.id)?.isInStock} onClick={() => { addItem(activeItem, Object.values(selectedVariants), detailQuantity); setActiveItem(null); }} className="pm-button pm-detail-add">{t('Add · {price}', { price: money(customizedPrice * detailQuantity) })}</button>
          </div>}
        </div>}
      </Modal>

      <Modal appearance="paper" isOpen={isCartOpen} closeDisabled={isSubmitting} onClose={() => { if (!submittingRef.current) setIsCartOpen(false); }} title={<span className="text-lg font-semibold flex items-center gap-2"><ShoppingBag size={20} />{t('Your order')}</span>} maxWidth="max-w-lg">
        {!cart.length ? <div className="pm-checkout-empty"><ShoppingBag aria-hidden="true" /><p>{t('Your order is empty. Choose something from the menu.')}</p></div> : <form onSubmit={handlePlaceOrder} className="public-menu pm-checkout">
          <fieldset disabled={isSubmitting} className="pm-checkout-fields">
            <legend className="sr-only">{t('Order details')}</legend>
            <ul className="pm-checkout-lines">
              {cart.map(line => {
                const available = menuItems.find(item => item.id === line.item.id)?.isInStock;
                return <li key={line.id} className="pm-checkout-line" data-unavailable={!available || undefined}>
                  <div className="pm-checkout-line-text"><b>{line.item.name}</b>
                    {!!line.variants.length && <small>{line.variants.map(variant => `${variant.groupName}: ${variant.name}`).join(', ')}</small>}
                    {!available && <small className="pm-checkout-warn">{t('Sold out · please remove this item')}</small>}
                    <span className="pm-price">{money(line.unitPrice * line.quantity)}</span>
                  </div>
                  <div className="pm-stepper">
                    <button type="button" aria-label={t('Remove one {name}', { name: line.item.name })} onClick={() => updateQuantity(line.id, -1)}><Minus size={16} /></button>
                    <span>{line.quantity}</span>
                    <button type="button" disabled={!available} aria-label={t('Add one {name}', { name: line.item.name })} onClick={() => updateQuantity(line.id, 1)}><Plus size={16} /></button>
                  </div>
                </li>;
              })}
            </ul>
            <fieldset className="pm-checkout-group"><legend>{t('Order type')}</legend>
              <div className="pm-checkout-choices" style={{ '--cols': 3 } as React.CSSProperties}>{([['dine_in', 'Dine-in'], ['takeout', 'Takeaway'], ['pickup', 'Pickup']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={orderType === value} onClick={() => { setOrderType(value); setOrderError(''); }} className="pm-chip">{t(label)}</button>)}</div>
            </fieldset>
            <label className="pm-checkout-field"><span>{t(orderType === 'dine_in' ? 'Table number' : 'Your name')}</span>
              <input id="order-identity" type="text" autoComplete={orderType === 'dine_in' ? 'off' : 'name'} required maxLength={100} placeholder={t(orderType === 'dine_in' ? 'e.g. 04' : 'Your name')} value={orderType === 'dine_in' ? tableNumber : customerName} onChange={event => { if (orderType === 'dine_in') setTableNumber(event.target.value); else setCustomerName(event.target.value); setOrderError(''); }} />
            </label>
            <fieldset className="pm-checkout-group"><legend>{t('Pay at the café')}</legend>
              <div className="pm-checkout-choices">{(['card', 'cash'] as const).map(value => <button type="button" key={value} aria-pressed={paymentMethod === value} onClick={() => setPaymentMethod(value)} className="pm-chip">{t(value === 'card' ? 'Card' : 'Cash')}</button>)}</div>
              <p className="pm-checkout-fine">{t('Payment is collected at the café when you receive your order.')}</p>
            </fieldset>
          </fieldset>
          <dl className="pm-checkout-totals">
            <div><dt>{t('Subtotal')}</dt><dd>{money(subtotal)}</dd></div>
            {settings.taxRate > 0 && <div><dt>{t('Tax ({rate}%)', { rate: settings.taxRate })}</dt><dd>{money(tax)}</dd></div>}
            <div className="is-total"><dt>{t('Total')}</dt><dd>{money(total)}</dd></div>
          </dl>
          {!opening.isOpen && <p className="pm-checkout-note">{opening.label}. {opening.detail} {t('You can keep browsing and order when we’re open.')}</p>}
          {unavailableInCart && <p className="pm-checkout-error">{t('Please remove unavailable items or options before placing your order.')}</p>}
          {orderError && <p role="alert" className="pm-checkout-error">{orderError}</p>}
          <button type="submit" disabled={isSubmitting || !opening.isOpen || unavailableInCart} aria-busy={isSubmitting} className="pm-button pm-checkout-submit">{isSubmitting ? t('Sending your order…') : t('Place order · {price}', { price: money(total) })}</button>
        </form>}
      </Modal>
    </div>
  );
};
