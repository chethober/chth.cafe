import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, CheckSquare, ChefHat, Clock, History, LayoutGrid, Pencil, Plus, Receipt, ShoppingBag, Shuffle, Tag, Users } from 'lucide-react';
import {
  OrderSelect,
  OrderItemSelect,
  TaskSelect,
  StaffSelect,
  ShiftSelect,
  MenuItemSelect,
  SettingsSelect,
  CategorySelect,
  MenuVariantSelect,
  CustomerSelect
} from '../db/schema';
import { store, orderAmounts } from '../db/store';
import {
  AffixInput, Avatar, Badge, Button, Card, Chips, ConfirmDialog, Dialog, EmptyState, Field, FormDialog, IconButton, Input,
  KeyValue, List, ListItem, Meter, Notice, Page, PageHeader, SearchInput, Segmented, Select, Stat, StatGrid, Switch,
  ageLabel, formatDate, reducedMotion, formatTime, localDateKey, minutesSince, money, orderTypeLabel, paymentLabel, plural, timestampForDay,
  ORDER_PAYMENT_METHODS, OrderPaymentMethod
} from '../ui';
import { CustomerClub, CustomerPicker } from './CustomerClub';
import {
  MenuPicker, OrderDetailsDialog, OrderEditDialog, OrderLinesEditor, TaskFormDialog, TaskRow, TASK_CATEGORIES, TASK_CATEGORY_ICONS, nextTaskStatus,
  addMenuItem, discountOff, lineQuantities, toOrderLines, type DiscountType, type EditableLine
} from './shared';
import { intlTag, tr } from '../i18n';

export type PanelSection = 'orders' | 'pos' | 'customers' | 'events' | 'tasks' | 'shifts';
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type OrderType = 'dine_in' | 'takeout' | 'pickup';

interface PanelManagerProps {
  section: PanelSection;
  onNavigate: (section: PanelSection) => void;
  settings: SettingsSelect;
  orders: OrderSelect[];
  orderItems: OrderItemSelect[];
  tasks: TaskSelect[];
  staffList: StaffSelect[];
  shifts: ShiftSelect[];
  menuItems: MenuItemSelect[];
  categories: CategorySelect[];
  menuVariants: MenuVariantSelect[];
  customers: CustomerSelect[];
  onStateChange: () => void;
}

const LANES: { status: 'pending' | 'preparing' | 'ready'; label: string; empty: string; color: string; next: OrderStatus; action: string }[] = [
  { status: 'pending', get empty() { return tr('Nothing waiting.'); }, get label() { return tr('Waiting'); }, color: 'var(--ws-warning)', next: 'preparing', get action() { return tr('Start prep'); } },
  { status: 'preparing', get empty() { return tr('Nothing preparing.'); }, get label() { return tr('Preparing'); }, color: 'var(--ws-info)', next: 'ready', get action() { return tr('Mark ready'); } },
  { status: 'ready', get empty() { return tr('Nothing ready.'); }, get label() { return tr('Ready'); }, color: 'var(--ws-positive)', next: 'completed', get action() { return tr('Collected & paid'); } }
];
const LATE_AFTER_MIN = 15;

export const PanelManager: React.FC<PanelManagerProps> = ({
  section, onNavigate, settings, orders, orderItems, tasks, staffList: staff, shifts, menuItems, categories, customers, onStateChange
}) => {
  const currency = settings.currency;
  const fmt = (v: number) => money(v, currency);

  // One clock drives order ages and the time clock; it ticks faster only where seconds show.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), section === 'shifts' ? 1000 : 30000);
    return () => window.clearInterval(timer);
  }, [section]);

  const activeShifts = shifts.filter(s => !s.clockOut);
  const countBy = (status: string) => orders.filter(o => o.status === status).length;

  /* ------------------------------------------------------------- Orders */
  const [orderView, setOrderView] = useState<'board' | 'history'>('board');
  const [mobileLane, setMobileLane] = useState<'pending' | 'preparing' | 'ready'>('pending');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderType, setOrderType] = useState<'all' | OrderType>('all');
  const [historyLimit, setHistoryLimit] = useState(30);
  const [detailsOrder, setDetailsOrder] = useState<OrderSelect | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderSelect | null>(null);
  const [editTarget, setEditTarget] = useState<OrderSelect | null>(null);
  // Orders still on this device are edited once they reach the server.
  const canEdit = (order: OrderSelect) => ['pending', 'preparing', 'ready'].includes(order.status) && !store.isQueuedOrder(order.id);

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItemSelect[]>();
    orderItems.forEach(item => { const list = map.get(item.orderId) || []; list.push(item); map.set(item.orderId, list); });
    return map;
  }, [orderItems]);

  const matchesOrderFilters = (o: OrderSelect) => {
    const q = orderSearch.trim().toLowerCase();
    const matchesSearch = !q || o.orderNumber.toLowerCase().includes(q) || (o.customerName || '').toLowerCase().includes(q);
    return matchesSearch && (orderType === 'all' || o.orderType === orderType);
  };
  // Oldest first on the board: the order that has waited longest is served first.
  const boardOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status) && matchesOrderFilters(o))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const historyOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status) && matchesOrderFilters(o))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    store.updateOrderStatus(orderId, status);
    onStateChange();
  };

  const showOrders = (lane: 'pending' | 'preparing' | 'ready') => { onNavigate('orders'); setOrderView('board'); setMobileLane(lane); };

  /* ---------------------------------------------------------------- POS */
  const [cart, setCart] = useState<EditableLine[]>([]);
  const [posOpen, setPosOpen] = useState<string[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posCustomer, setPosCustomer] = useState('');
  const [posMember, setPosMember] = useState<CustomerSelect | null>(null);
  const [posOrderType, setPosOrderType] = useState<OrderType>('dine_in');
  const [posPayment, setPosPayment] = useState<OrderPaymentMethod>('card');
  const [posDate, setPosDate] = useState(() => localDateKey());
  const [posDiscount, setPosDiscount] = useState('');
  const [posDiscountType, setPosDiscountType] = useState<DiscountType>('percent');
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderPlaced, setOrderPlaced] = useState('');
  const [recipeItem, setRecipeItem] = useState<MenuItemSelect | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const ticketRef = useRef<HTMLDivElement>(null);

  const addToCart = (item: MenuItemSelect) => {
    if (!item.isInStock) return;
    setOrderPlaced('');
    setCart(prev => addMenuItem(prev, item));
  };

  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const cartLines = toOrderLines(cart);
  const lineDiscounts = cartLines.reduce((sum, l) => sum + (l.discountAmount || 0), 0);
  // The order discount applies to what is left after item discounts.
  const orderDiscount = discountOff(cartLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) - lineDiscounts, posDiscount, posDiscountType);
  const { subtotal, discountAmount: discount, taxAmount: tax, totalAmount: total } = orderAmounts(cartLines, orderDiscount, settings.taxRate);

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingOrder || cart.length === 0) return;
    setOrderError('');
    setSavingOrder(true);
    let placed;
    try {
      placed = await store.createOrder({
        customerName: posMember?.name || posCustomer.trim() || 'Walk-in',
        customerId: posMember?.id,
        orderType: posOrderType,
        paymentMethod: posPayment,
        discountAmount: orderDiscount,
        status: 'pending',
        createdAt: timestampForDay(posDate),
        items: cartLines
      });
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Order could not be saved.');
      return;
    } finally {
      setSavingOrder(false);
    }
    setOrderPlaced(`Order for ${posMember?.name || posCustomer.trim() || 'walk-in'} ${store.isQueuedOrder(placed.id) ? 'kept on this device. It goes to the server when the connection is back.' : 'sent to the board.'}`);
    setCart([]);
    setPosCustomer('');
    setPosMember(null);
    setPosDiscount('');
    setPosDate(localDateKey());
    onStateChange();
  };

  const addCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(customPrice);
    if (!customName.trim() || Number.isNaN(price) || price < 0) return;
    setCart(prev => [...prev, { key: crypto.randomUUID(), menuItemId: `custom-${crypto.randomUUID()}`, itemName: customName.trim(), quantity: 1, unitPrice: price, variants: [], discount: '', discountType: 'percent' }]);
    setCustomName('');
    setCustomPrice('');
    setCustomOpen(false);
  };

  // What's on screen: search matches, else the open categories, else the whole menu.
  const posQuery = posSearch.trim().toLowerCase();
  const visibleMenu = menuItems.filter(item => posQuery
    ? item.name.toLowerCase().includes(posQuery)
    : !posOpen.length || posOpen.includes(categories.some(c => c.id === item.categoryId) ? item.categoryId : 'other'));
  const cartQuantities = lineQuantities(cart);

  // "Pick for me": a short reel through the in-stock items on screen that slows to a stop, like the public menu's.
  const [pick, setPick] = useState<{ phase: 'idle' | 'spinning' | 'landed'; itemId: string | null; tick: number }>({ phase: 'idle', itemId: null, tick: 0 });
  const pickTimers = useRef<number[]>([]);
  useEffect(() => () => pickTimers.current.forEach(window.clearTimeout), []);
  const pickable = visibleMenu.filter(item => item.isInStock);
  const pickedItem = menuItems.find(item => item.id === pick.itemId);
  const pickForMe = () => {
    if (pick.phase === 'spinning' || !pickable.length) return;
    const alternatives = pickable.filter(item => item.id !== pick.itemId);
    const pool = alternatives.length ? alternatives : pickable;
    // Roll outside the updaters: StrictMode double-invokes them.
    const winner = pool[Math.floor(Math.random() * pool.length)];
    pickTimers.current.forEach(window.clearTimeout);
    pickTimers.current = [];
    const land = () => setPick(prev => ({ phase: 'landed', itemId: winner.id, tick: prev.tick + 1 }));
    if (reducedMotion() || pickable.length < 2) { land(); return; }
    let elapsed = 0;
    for (let index = 0; index < 11; index++) {
      elapsed += 45 * Math.pow(1.2, index);
      const shown = pickable[Math.floor(Math.random() * pickable.length)];
      pickTimers.current.push(window.setTimeout(() => setPick(prev => ({ phase: 'spinning', itemId: shown.id, tick: prev.tick + 1 })), elapsed));
    }
    setPick(prev => ({ ...prev, phase: 'spinning' }));
    pickTimers.current.push(window.setTimeout(land, elapsed + 160));
  };

  /* -------------------------------------------------------------- Tasks */
  const [taskStatus, setTaskStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [taskCategory, setTaskCategory] = useState('all');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const visibleTasks = tasks.filter(t => (taskStatus === 'all' || t.status === taskStatus) && (taskCategory === 'all' || t.category === taskCategory));
  const doneCount = tasks.filter(t => t.status === 'completed').length;
  const progressCount = tasks.filter(t => t.status === 'in_progress').length;

  /* ------------------------------------------------------------- Shifts */
  const [clockTarget, setClockTarget] = useState<StaffSelect | null>(null);
  const [pin, setPin] = useState('');
  const [clockFeedback, setClockFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const clockTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(clockTimer.current), []);
  const targetIsIn = !!clockTarget && activeShifts.some(s => s.staffId === clockTarget.id);

  const confirmClock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockTarget) return;
    const result = targetIsIn ? store.clockOut(pin, '', clockTarget.id) : store.clockIn(pin, '', clockTarget.id);
    setClockFeedback({ success: result.success, message: result.message });
    if (!result.success) return;
    onStateChange();
    clockTimer.current = window.setTimeout(() => { setClockTarget(null); setPin(''); setClockFeedback(null); }, 900);
  };

  /* ------------------------------------------------------------- Render */
  return (
    <>
      {section === 'orders' && (
        <Page>
          <PageHeader
            title={tr('Orders')}
            description={tr('Oldest orders come first. Move each one along as it\'s made.')}
            actions={<Button variant="primary" icon={<Plus />} onClick={() => onNavigate('pos')}>{tr('New order')}</Button>}
          />
          <StatGrid>
            <Stat label={tr('Waiting')} value={countBy('pending')} tone={countBy('pending') ? 'warning' : 'neutral'} onClick={() => showOrders('pending')} />
            <Stat label={tr('Preparing')} value={countBy('preparing')} onClick={() => showOrders('preparing')} />
            <Stat label={tr('Ready to hand over')} value={countBy('ready')} tone={countBy('ready') ? 'positive' : 'neutral'} onClick={() => showOrders('ready')} />
            <Stat label={tr('Team on shift')} value={activeShifts.length} icon={<Users />} onClick={() => onNavigate('shifts')} />
          </StatGrid>

          <div className="ws-toolbar">
            <Segmented label={tr('Orders view')} value={orderView} onChange={setOrderView} options={[
              { value: 'board', label: tr('Live board'), icon: <LayoutGrid />, count: boardOrders.length },
              { value: 'history', label: tr('History'), icon: <History /> }
            ]} />
            <SearchInput className="ws-grow" value={orderSearch} onChange={setOrderSearch} placeholder={tr('Search order number or customer')} label={tr('Search orders')} />
            <Select aria-label={tr('Order type')} value={orderType} onChange={e => setOrderType(e.target.value as typeof orderType)} style={{ width: 'auto' }}>
              <option value="all">{tr('All order types')}</option>
              <option value="dine_in">{tr('Dine-in')}</option>
              <option value="takeout">{tr('Takeout')}</option>
              <option value="pickup">{tr('Pickup')}</option>
            </Select>
          </div>

          {orderView === 'board' ? (
            <>
              <div className="ws-hide-desktop">
                <Segmented block label={tr('Board column')} value={mobileLane} onChange={setMobileLane} options={LANES.map(l => ({ value: l.status, label: l.label, count: boardOrders.filter(o => o.status === l.status).length }))} />
              </div>
              <div className="ws-board">
                {LANES.map(lane => {
                  const laneOrders = boardOrders.filter(o => o.status === lane.status);
                  return (
                    <section key={lane.status} className={`ws-lane ${mobileLane === lane.status ? '' : 'ws-hide-mobile'}`} aria-label={tr('{label} orders', { label: lane.label })}>
                      <div className="ws-lane-head">
                        <strong><span className="ws-lane-dot" style={{ background: lane.color }} />{lane.label}</strong>
                        <span className="ws-hint tabular">{laneOrders.length}</span>
                      </div>
                      {laneOrders.length === 0 ? (
                        <div className="ws-lane-empty">{lane.empty}</div>
                      ) : laneOrders.map(order => {
                        const lines = itemsByOrder.get(order.id) || [];
                        const age = minutesSince(order.createdAt, now);
                        return (
                          <article
                            key={order.id}
                            className="ws-ticket"
                            data-interactive=""
                            tabIndex={0}
                            aria-label={tr('Order {orderNumber} for {value}', { orderNumber: order.orderNumber, value: order.customerName || tr('Walk-in') })}
                            onClick={() => setDetailsOrder(order)}
                            onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setDetailsOrder(order); }}
                          >
                            <div className="ws-ticket-head">
                              <div style={{ minWidth: 0 }}>
                                <div className="ws-ticket-num">{order.orderNumber}</div>
                                <div className="ws-hint ws-truncate">{order.customerName || tr('Walk-in')} · {orderTypeLabel(order.orderType)}{store.isQueuedOrder(order.id) && tr(' · on this device, not sent yet')}</div>
                              </div>
                              <span className="ws-ticket-age" data-late={lane.status !== 'ready' && age >= LATE_AFTER_MIN ? '' : undefined}>
                                <Clock width={12} height={12} style={{ display: 'inline', verticalAlign: '-1px', marginInlineEnd: 4 }} />{ageLabel(age)}
                              </span>
                            </div>
                            <ul className="ws-ticket-lines">
                              {lines.map(line => <li key={line.id}><span><strong className="tabular">{line.quantity}×</strong> {line.itemName}</span></li>)}
                              {lines.length === 0 && <li className="ws-hint">{tr('No items recorded')}</li>}
                            </ul>
                            <div className="ws-ticket-foot">
                              <span className="ws-hint"><strong className="tabular" style={{ color: 'var(--ws-ink)' }}>{fmt(order.totalAmount)}</strong> · {paymentLabel(order.paymentMethod)}</span>
                            </div>
                            <div className="ws-ticket-foot" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                              <Button size="sm" variant="danger-ghost" onClick={() => setCancelTarget(order)}>{tr('Cancel')}</Button>
                              {canEdit(order) && <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEditTarget(order)}>{tr('Edit')}</Button>}
                              <Button size="sm" variant={lane.status === 'ready' ? 'accent' : 'primary'} onClick={() => updateOrderStatus(order.id, lane.next)}>{lane.action}</Button>
                            </div>
                          </article>
                        );
                      })}
                    </section>
                  );
                })}
              </div>
            </>
          ) : (
            <Card flush title={tr('Order history')} description={tr('{length} completed or cancelled', { length: plural(historyOrders.length, 'order') })}>
              {historyOrders.length === 0 ? (
                <EmptyState icon={<History />} title={tr('No past orders')} description={tr('Completed and cancelled orders appear here.')} />
              ) : (
                <>
                  <List>
                    {historyOrders.slice(0, historyLimit).map(order => (
                      <ListItem
                        key={order.id}
                        onClick={() => setDetailsOrder(order)}
                        title={<><span className="mono">{order.orderNumber}</span><span className="ws-truncate">{order.customerName || tr('Walk-in')}</span></>}
                        subtitle={<><span>{formatDate(order.createdAt)} · {formatTime(order.createdAt)}</span><span>{paymentLabel(order.paymentMethod)}</span></>}
                        trail={<>
                          <span className="ws-amount">{fmt(order.totalAmount)}</span>
                          <Badge tone={order.status === 'completed' ? 'positive' : 'danger'}>{order.status === 'completed' ? tr('Completed') : tr('Cancelled')}</Badge>
                        </>}
                      />
                    ))}
                  </List>
                  {historyOrders.length > historyLimit && (
                    <div style={{ padding: 16, textAlign: 'center' }}><Button size="sm" onClick={() => setHistoryLimit(l => l + 30)}>{tr('Show more')}</Button></div>
                  )}
                </>
              )}
            </Card>
          )}
        </Page>
      )}

      {section === 'pos' && (
        <Page>
          <PageHeader
            title={tr('New order')}
            description={tr('{length} items available · {length2} sold out', { length: menuItems.filter(i => i.isInStock).length, length2: menuItems.filter(i => !i.isInStock).length })}
            actions={<Button icon={<Tag />} onClick={() => setCustomOpen(true)}>{tr('Custom item')}</Button>}
          />
          <div className="ws-grid ws-grid-pos">
            <div className="ws-toolbar-stack" style={{ minWidth: 0 }}>
              <SearchInput value={posSearch} onChange={setPosSearch} placeholder={tr('Find a drink or dish')} label={tr('Search menu')} />
              <div className={`ws-pick is-${pick.phase}`}>
                <div className="ws-pick-reel" aria-hidden={pick.phase !== 'landed'}>
                  <span className="ws-pick-label">{pick.phase === 'landed' ? tr('How about') : tr('Can’t decide?')}</span>
                  <span key={pick.tick} className="ws-pick-name">{pickedItem ? pickedItem.name : tr('Let the menu choose')}</span>
                </div>
                <span className="sr-only" role="status">{pick.phase === 'landed' && pickedItem ? tr('Picked {name}, {basePrice}', { name: pickedItem.name, basePrice: fmt(pickedItem.basePrice) }) : ''}</span>
                {pick.phase === 'landed' && pickedItem ? (
                  <div className="ws-pick-actions">
                    <Button variant="primary" icon={<Plus />} disabled={!pickedItem.isInStock || savingOrder} onClick={() => addToCart(pickedItem)}>
                      {pickedItem.isInStock ? tr('Add · {basePrice}', { basePrice: fmt(pickedItem.basePrice) }) : tr('Sold out')}
                    </Button>
                    <IconButton label={tr('Pick again')} onClick={pickForMe} disabled={!pickable.length || savingOrder}><Shuffle /></IconButton>
                  </div>
                ) : (
                  <Button icon={<Shuffle />} onClick={pickForMe} disabled={!pickable.length || pick.phase === 'spinning' || savingOrder}>
                    {pick.phase === 'spinning' ? tr('Picking…') : tr('Pick for me')}
                  </Button>
                )}
              </div>
              <MenuPicker
                categories={categories}
                menuItems={menuItems}
                query={posSearch}
                open={posOpen}
                onOpenChange={setPosOpen}
                quantities={cartQuantities}
                onAdd={addToCart}
                fmt={fmt}
                itemActions={item => <>
                  <IconButton label={tr('Recipe for {name}', { name: item.name })} onClick={() => setRecipeItem(item)}><Boxes /></IconButton>
                  <Switch label={tr('{name} available', { name: item.name })} checked={item.isInStock} onChange={() => { store.toggleStock(item.id); onStateChange(); }} />
                </>}
              />
            </div>

            <div ref={ticketRef} className="ws-sticky-col" style={{ scrollMarginTop: 80 }}>
              <Card title={tr('Current order')} description={cartCount ? plural(cartCount, 'item') : tr('Tap menu items to add them')} actions={cart.length > 0 && <Button size="sm" variant="ghost" onClick={() => setCart([])}>{tr('Clear')}</Button>}>
                <form className="ws-form" onSubmit={submitOrder} aria-busy={savingOrder}>
                  {orderPlaced && <Notice tone="positive" action={<Button size="sm" variant="ghost" onClick={() => onNavigate('orders')}>{tr('View board')}</Button>}>{orderPlaced}</Notice>}
                  {orderError && <Notice tone="danger">{orderError}</Notice>}
                  {cart.length === 0 ? (
                    <div className="ws-lane-empty"><Receipt width={20} height={20} style={{ margin: '0 auto var(--chth-space-8)' }} />{tr('The order is empty.')}</div>
                  ) : (
                    <OrderLinesEditor lines={cart} onChange={setCart} currency={currency} editablePrice flush />
                  )}

                  <Segmented block label={tr('Order type')} value={posOrderType} onChange={setPosOrderType} options={[
                    { value: 'dine_in', label: tr('Dine-in') }, { value: 'takeout', label: tr('Takeout') }, { value: 'pickup', label: tr('Pickup') }
                  ]} />
                  <CustomerPicker customers={customers} orders={orders} text={posCustomer} onTextChange={setPosCustomer} member={posMember} onMemberChange={setPosMember} />
                  <div className="ws-form-row cols-2">
                    <Field label={tr('Payment')}>{id => (
                      <Select id={id} value={posPayment} onChange={e => setPosPayment(e.target.value as OrderPaymentMethod)}>
                        {ORDER_PAYMENT_METHODS.map(m => <option key={m} value={m}>{paymentLabel(m)}</option>)}
                      </Select>
                    )}</Field>
                    <Field label={tr('Order date')} hint={posDate !== localDateKey() ? tr('Back-dated order') : undefined}>{id => <Input id={id} type="date" value={posDate} max={localDateKey()} onChange={e => setPosDate(e.target.value || localDateKey())} />}</Field>
                  </div>
                  <Field label={tr('Order discount')} hint={lineDiscounts > 0 ? tr('On top of the item discounts') : undefined} aside={
                    <Segmented label={tr('Discount type')} value={posDiscountType} onChange={setPosDiscountType} options={[{ value: 'percent', label: '%' }, { value: 'fixed', label: currency }]} />
                  }>{id => <Input id={id} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={posDiscount} onChange={e => setPosDiscount(e.target.value)} />}</Field>
                  <KeyValue
                    items={[
                      { label: tr('Subtotal'), value: fmt(subtotal) },
                      ...(discount > 0 ? [{ label: tr('Discounts'), value: `−${fmt(discount)}`, tone: 'positive' as const }] : []),
                      { label: tr('Tax ({taxRate}%)', { taxRate: settings.taxRate }), value: fmt(tax) }
                    ]}
                    total={{ label: tr('Total'), value: fmt(total) }}
                  />
                  <Button type="submit" variant="primary" size="lg" block loading={savingOrder} disabled={cart.length === 0}>
                    {savingOrder ? tr('Sending…') : tr('Send to board · {total}', { total: fmt(total) })}
                  </Button>
                </form>
              </Card>
            </div>
          </div>
          {cart.length > 0 && (
            <div className="ws-mobile-bar">
              <Button variant="primary" size="lg" block icon={<ShoppingBag />} onClick={() => ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                {tr('Review order · {cartCount} · {total}', { cartCount: plural(cartCount, 'item'), total: fmt(total) })}
              </Button>
            </div>
          )}
        </Page>
      )}

      {section === 'customers' && (
        <CustomerClub settings={settings} customers={customers} orders={orders} orderItems={orderItems} canDelete={false} onChanged={onStateChange} />
      )}

      {section === 'tasks' && (
        <Page>
          <PageHeader
            title={tr('Checklist')}
            description={tr('Tap a task to move it from to do, to in progress, to done.')}
            actions={<Button variant="primary" icon={<Plus />} onClick={() => setTaskFormOpen(true)}>{tr('New task')}</Button>}
          />
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>{tr('{doneCount} of {length} done', { doneCount, length: tasks.length })}</strong>
              <span className="ws-hint">{tr('{progressCount} in progress · {value} to do', { progressCount, value: tasks.length - doneCount - progressCount })}</span>
            </div>
            <Meter size="lg" label={tr('{doneCount} done, {progressCount} in progress', { doneCount, progressCount })} segments={[
              { value: doneCount, tone: 'positive', label: tr('Done') },
              { value: progressCount, tone: 'accent', label: tr('In progress') },
              { value: tasks.length - doneCount - progressCount, tone: 'muted', label: tr('To do') }
            ]} />
          </Card>
          <div className="ws-toolbar-stack">
            <Segmented label={tr('Task status')} value={taskStatus} onChange={setTaskStatus} options={[
              { value: 'all', label: tr('All'), count: tasks.length },
              { value: 'pending', label: tr('To do'), count: tasks.filter(t => t.status === 'pending').length },
              { value: 'in_progress', label: tr('In progress'), count: progressCount },
              { value: 'completed', label: tr('Done'), count: doneCount }
            ]} />
            <Chips label={tr('Task category')} value={taskCategory} onChange={setTaskCategory} options={[
              { value: 'all', label: tr('All categories') },
              ...TASK_CATEGORIES.map(c => ({ value: c, label: tr(c), icon: TASK_CATEGORY_ICONS[c], count: tasks.filter(t => t.category === c).length }))
            ]} />
          </div>
          <Card flush>
            {visibleTasks.length === 0 ? (
              <EmptyState icon={<CheckSquare />} title={tr('No tasks here')} description={tr('Nothing matches these filters.')} />
            ) : (
              <List label={tr('Tasks')}>
                {visibleTasks.map(task => (
                  <TaskRow key={task.id} task={task} staffName={staff.find(s => s.id === task.assignedStaffId)?.name}
                    onCycle={() => { store.updateTaskStatus(task.id, nextTaskStatus(task.status)); onStateChange(); }} />
                ))}
              </List>
            )}
          </Card>
        </Page>
      )}

      {section === 'shifts' && (
        <Page>
          <PageHeader title={tr('Clock in / out')} description={tr('Choose your name, then enter your PIN.')} />
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="ws-clock" aria-live="off">{now.toLocaleTimeString(intlTag(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
                <div className="ws-hint" style={{ marginTop: 8 }}>{now.toLocaleDateString(intlTag(), { weekday: 'long', month: 'long', day: 'numeric' })}</div>
              </div>
              <Badge tone={activeShifts.length ? 'positive' : 'neutral'} dot>{tr('{length} on shift', { length: plural(activeShifts.length, 'person', 'people') })}</Badge>
            </div>
          </Card>
          {staff.length === 0 ? (
            <Card><EmptyState icon={<Users />} title={tr('No team members yet')} description={tr('Add staff from the admin workspace.')} /></Card>
          ) : (
            <div className="ws-people">
              {staff.map(member => {
                const shift = activeShifts.find(s => s.staffId === member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    className="ws-person"
                    data-on={shift ? '' : undefined}
                    onClick={() => { setClockTarget(member); setPin(''); setClockFeedback(null); }}
                    aria-label={`${member.name}, ${shift ? `on shift since ${formatTime(shift.clockIn)}. Clock out` : 'off shift. Clock in'}`}
                  >
                    <Avatar name={member.name} size="lg" tone={shift ? 'positive' : undefined} />
                    <span>
                      <strong style={{ display: 'block' }}>{member.name}</strong>
                      <span className="ws-hint">{member.role}</span>
                    </span>
                    {shift ? <Badge tone="positive" dot>{tr('Since {clockIn}', { clockIn: formatTime(shift.clockIn) })}</Badge> : <Badge>{tr('Off shift')}</Badge>}
                  </button>
                );
              })}
            </div>
          )}
        </Page>
      )}

      {/* ---------------------------------------------------------- Dialogs */}
      <OrderDetailsDialog
        order={detailsOrder}
        items={detailsOrder ? itemsByOrder.get(detailsOrder.id) || [] : []}
        currency={currency}
        taxRate={settings.taxRate}
        onClose={() => setDetailsOrder(null)}
        actions={detailsOrder && ['pending', 'preparing', 'ready'].includes(detailsOrder.status) && <>
          <span className="ws-spacer"><Button variant="danger-ghost" onClick={() => { setCancelTarget(detailsOrder); setDetailsOrder(null); }}>{tr('Cancel order')}</Button></span>
          {canEdit(detailsOrder) && <Button icon={<Pencil />} onClick={() => { setEditTarget(detailsOrder); setDetailsOrder(null); }}>{tr('Edit')}</Button>}
        </>}
      />

      <OrderEditDialog
        order={editTarget}
        items={editTarget ? itemsByOrder.get(editTarget.id) || [] : []}
        settings={settings}
        categories={categories}
        menuItems={menuItems}
        onClose={() => setEditTarget(null)}
        onSaved={onStateChange}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && updateOrderStatus(cancelTarget.id, 'cancelled')}
        title={tr('Cancel {value}?', { value: cancelTarget?.orderNumber || 'order' })}
        confirmLabel={tr('Cancel order')}
        description={tr('Ingredients for this order stay deducted from stock. An admin can delete the order to return them.')}
      />

      <FormDialog
        open={!!clockTarget}
        onClose={() => { setClockTarget(null); setClockFeedback(null); }}
        size="sm"
        title={clockTarget ? `${targetIsIn ? 'Clock out' : 'Clock in'} ${clockTarget.name}` : ''}
        description={tr('Enter your PIN to confirm.')}
        submitLabel={targetIsIn ? tr('Clock out') : tr('Clock in')}
        submitDisabled={!pin || clockFeedback?.success}
        onSubmit={confirmClock}
      >
        <Field label="PIN">{id => (
          <Input id={id} className="ws-pin" type="password" inputMode="numeric" autoComplete="off" autoFocus required value={pin}
            onChange={e => { setPin(e.target.value); if (clockFeedback && !clockFeedback.success) setClockFeedback(null); }} />
        )}</Field>
        {clockFeedback && <Notice tone={clockFeedback.success ? 'positive' : 'danger'}>{clockFeedback.message}</Notice>}
      </FormDialog>

      <TaskFormDialog open={taskFormOpen} onClose={() => setTaskFormOpen(false)} onCreated={onStateChange} />

      <FormDialog open={customOpen} onClose={() => setCustomOpen(false)} title={tr('Custom item')} description={tr('For catering, specials, or an agreed price.')} submitLabel={tr('Add to order')} submitDisabled={!customName.trim() || customPrice === ''} onSubmit={addCustomItem}>
        <Field label={tr('Item name')}>{id => <Input id={id} autoFocus required value={customName} onChange={e => setCustomName(e.target.value)} placeholder={tr('e.g. Event tea blend')} />}</Field>
        <Field label={tr('Unit price')}>{id => <AffixInput id={id} affix={currency} type="number" inputMode="decimal" step="any" min="0" required value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="0.00" />}</Field>
      </FormDialog>

      <Dialog open={!!recipeItem} onClose={() => setRecipeItem(null)} title={recipeItem ? tr('Recipe · {name}', { name: recipeItem.name }) : ''} description={tr('Raw materials used per portion.')} footer={<Button variant="primary" onClick={() => setRecipeItem(null)}>{tr('Done')}</Button>}>
        {recipeItem && (() => {
          const recipe = store.getMenuItemRecipe(recipeItem.id);
          const stock = store.getStockItems();
          if (recipe.length === 0) return <EmptyState icon={<ChefHat />} title={tr('No recipe yet')} description={tr('Add ingredients from the admin menu editor.')} />;
          return (
            <ul className="ws-list" style={{ margin: '0 calc(-1 * var(--chth-space-24))' }}>
              {recipe.map(ing => {
                const material = stock.find(s => s.id === ing.stockItemId);
                const enough = material ? material.quantity >= ing.quantityRequired : false;
                return (
                  <ListItem
                    key={ing.id || ing.stockItemId}
                    title={material?.name || tr('Removed material')}
                    subtitle={<span>{tr('{quantityRequired} {value} per portion', { quantityRequired: ing.quantityRequired, value: material?.unit || 'units' })}</span>}
                    trail={material && <Badge tone={enough ? 'positive' : 'danger'}>{enough ? tr('{quantity} {unit} left', { quantity: material.quantity, unit: material.unit }) : tr('Not enough stock')}</Badge>}
                  />
                );
              })}
            </ul>
          );
        })()}
      </Dialog>
    </>
  );
};
