import React, { useEffect, useState } from 'react';
import { Boxes, Cake, CheckCircle2, ChevronDown, Circle, Coffee, GlassWater, Leaf, Moon, Percent, PlayCircle, Plus, Sparkles, Sun, Trash2, User, Utensils, Wrench } from 'lucide-react';
import { CategorySelect, CustomerSelect, MenuItemSelect, OrderItemSelect, OrderSelect, SettingsSelect, StaffSelect, TaskSelect } from '../db/schema';
import { store, orderAmounts, type OrderLineInput } from '../db/store';
import {
  AffixInput, Badge, Button, Dialog, EmptyState, Field, FormDialog, IconButton, Input, KeyValue, ListItem, Notice, SearchInput, Segmented, Select, Stepper,
  formatDateTime, plural, localDateKey, money, orderStatusTone, orderTypeLabel, paymentLabel, ORDER_PAYMENT_METHODS, ORDER_STATUS_LABELS
} from '../ui';
import { CustomerPicker } from './CustomerClub';

/* --------------------------------------------------------------- Menu */

export const CATEGORY_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  Coffee: { icon: <Coffee />, label: 'Coffee / espresso' },
  Leaf: { icon: <Leaf />, label: 'Tea' },
  GlassWater: { icon: <GlassWater />, label: 'Cold drinks' },
  Cake: { icon: <Cake />, label: 'Bakery & pastries' },
  Utensils: { icon: <Utensils />, label: 'Brunch & food' }
};

/**
 * The menu as a short list of categories: tap one to open its items, tap an item to add it.
 * Several can be open at once, so opening one never shifts the others. A search query lists matches flat.
 */
export function MenuPicker({ categories, menuItems, query = '', open, onOpenChange, quantities, onAdd, fmt, allowSoldOut, itemActions }: {
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  query?: string;
  open: string[];
  onOpenChange: (open: string[]) => void;
  quantities: Record<string, number>;
  onAdd: (item: MenuItemSelect) => void;
  fmt: (value: number) => string;
  /** Let sold-out items be added anyway, e.g. when recording a past sale. */
  allowSoldOut?: boolean;
  itemActions?: (item: MenuItemSelect) => React.ReactNode;
}) {
  const known = new Set(categories.map(c => c.id));
  const groups = [
    ...categories.map(c => ({ id: c.id, name: c.name, icon: CATEGORY_ICONS[c.icon || '']?.icon || <Coffee />, items: menuItems.filter(i => i.categoryId === c.id) })),
    { id: 'other', name: 'Other', icon: <Utensils />, items: menuItems.filter(i => !known.has(i.categoryId)) }
  ].filter(g => g.items.length > 0);

  const row = (item: MenuItemSelect) => {
    const qty = quantities[item.id] || 0;
    const addable = item.isInStock || !!allowSoldOut;
    return (
      <li key={item.id} className="ws-picker-item" data-sold-out={!item.isInStock || undefined}>
        <button type="button" className="ws-picker-add" disabled={!addable} onClick={() => onAdd(item)}
          aria-label={addable ? `Add ${item.name}, ${fmt(item.basePrice)}${qty ? `. ${qty} in order` : ''}` : `${item.name} is sold out`}>
          <span className="ws-picker-item-name">{item.name}</span>
          <span className="ws-picker-price">{addable ? fmt(item.basePrice) : 'Sold out'}</span>
          {qty > 0 ? <span className="ws-picker-qty" aria-hidden="true">{qty}</span> : <span className="ws-picker-plus" aria-hidden="true"><Plus /></span>}
        </button>
        {itemActions && <div className="ws-picker-actions">{itemActions(item)}</div>}
      </li>
    );
  };

  const q = query.trim().toLowerCase();
  if (q) {
    const matches = menuItems.filter(i => i.name.toLowerCase().includes(q));
    if (!matches.length) return <div className="ws-picker-group"><EmptyState title="Nothing matches" description="Try another search term." /></div>;
    return <div className="ws-picker-group"><ul className="ws-picker-items" aria-label="Search results">{matches.map(row)}</ul></div>;
  }

  return (
    <div className="ws-picker">
      {groups.map(group => {
        const isOpen = open.includes(group.id);
        const inOrder = group.items.reduce((sum, i) => sum + (quantities[i.id] || 0), 0);
        return (
          <section key={group.id} className="ws-picker-group">
            <button type="button" className="ws-picker-head" aria-expanded={isOpen} aria-controls={`ws-picker-${group.id}`}
              onClick={() => onOpenChange(isOpen ? open.filter(id => id !== group.id) : [...open, group.id])}>
              <span className="ws-picker-icon" aria-hidden="true">{group.icon}</span>
              <span className="ws-picker-name">{group.name}</span>
              {inOrder > 0 && <span className="ws-picker-qty" aria-label={`${inOrder} in order`}>{inOrder}</span>}
              <span className="ws-picker-meta">{plural(group.items.length, 'item')}</span>
              <ChevronDown className="ws-picker-chevron" aria-hidden="true" />
            </button>
            {isOpen && <ul id={`ws-picker-${group.id}`} className="ws-picker-items" aria-label={group.name}>{group.items.map(row)}</ul>}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Tasks */

export const TASK_CATEGORIES = ['Opening', 'Closing', 'Inventory', 'Cleaning', 'Maintenance'] as const;
export const TASK_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Opening: <Sun />, Closing: <Moon />, Inventory: <Boxes />, Cleaning: <Sparkles />, Maintenance: <Wrench />
};
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { pending: 'To do', in_progress: 'In progress', completed: 'Done' };
export const nextTaskStatus = (status: string): TaskStatus => status === 'pending' ? 'in_progress' : status === 'in_progress' ? 'completed' : 'pending';

const STATUS_ICON = { pending: Circle, in_progress: PlayCircle, completed: CheckCircle2 };
const STATUS_COLOR = { pending: 'var(--ws-muted)', in_progress: 'var(--ws-accent)', completed: 'var(--ws-positive)' };

/** One checklist row. Tapping the status cycles to do → in progress → done. */
export function TaskRow({ task, staffName, onCycle, onDelete }: { task: TaskSelect; staffName?: string; onCycle: () => void; onDelete?: () => void }) {
  const status = (task.status as TaskStatus) in STATUS_ICON ? (task.status as TaskStatus) : 'pending';
  const Icon = STATUS_ICON[status];
  const done = status === 'completed';
  return (
    <ListItem
      onClick={onCycle}
      label={`${task.title}: ${TASK_STATUS_LABELS[status]}. Activate to mark ${TASK_STATUS_LABELS[nextTaskStatus(status)]}.`}
      lead={<Icon style={{ width: 24, height: 24, color: STATUS_COLOR[status] }} aria-hidden="true" />}
      title={<>
        <span className="ws-truncate" style={done ? { textDecoration: 'line-through', color: 'var(--ws-muted)' } : undefined}>{task.title}</span>
        {task.priority === 'high' && !done && <Badge tone="danger">High</Badge>}
      </>}
      subtitle={<>
        <span>{TASK_CATEGORY_ICONS[task.category]}{task.category}</span>
        {staffName && <span><User />{staffName}</span>}
        {status === 'in_progress' && <Badge tone="accent">In progress</Badge>}
      </>}
      actions={onDelete && <IconButton label={`Delete ${task.title}`} variant="danger-ghost" onClick={onDelete}><Trash2 /></IconButton>}
    />
  );
}

/** Create-task form, shared by the admin checklist and the daily panel. */
export function TaskFormDialog({ open, onClose, staffList, onCreated }: { open: boolean; onClose: () => void; staffList?: StaffSelect[]; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Opening');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [staffId, setStaffId] = useState('');
  useEffect(() => { if (open) { setTitle(''); setPriority('medium'); setStaffId(''); } }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    store.createTask({
      title: title.trim(), description: '', category, priority, status: 'pending',
      assignedStaffId: staffId || null, dueDate: localDateKey()
    });
    onCreated();
    onClose();
  };

  return (
    <FormDialog open={open} onClose={onClose} title="New task" description="Added to today's checklist." submitLabel="Add task" submitDisabled={!title.trim()} onSubmit={submit}>
      <Field label="What needs doing?">{id => <Input id={id} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Purge the steam wands" required maxLength={200} />}</Field>
      <div className="ws-form-row cols-2">
        <Field label="Category">{id => (
          <Select id={id} value={category} onChange={e => setCategory(e.target.value)}>
            {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}</Field>
        <Field label="Priority">{id => (
          <Select id={id} value={priority} onChange={e => setPriority(e.target.value as typeof priority)}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </Select>
        )}</Field>
      </div>
      {staffList && (
        <Field label="Assign to" optional>{id => (
          <Select id={id} value={staffId} onChange={e => setStaffId(e.target.value)}>
            <option value="">Anyone on shift</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
          </Select>
        )}</Field>
      )}
    </FormDialog>
  );
}

/* ----------------------------------------------------------------- Orders */

/** A line being entered or edited. The discount is typed as a percentage or an amount for the whole line. */
export interface EditableLine {
  key: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  variants: string[];
  /** Chosen options, shown under the name. */
  variantLabel?: string;
  discount: string;
  discountType: 'percent' | 'fixed';
}
export type DiscountType = EditableLine['discountType'];

/** What a typed discount takes off `gross`, never more than all of it. */
export const discountOff = (gross: number, value: string, type: DiscountType) => {
  const typed = Math.max(0, parseFloat(value) || 0);
  return Number(Math.min(gross, type === 'percent' ? (gross * typed) / 100 : typed).toFixed(2));
};
export const lineDiscount = (line: EditableLine) => discountOff(line.unitPrice * line.quantity, line.discount, line.discountType);
export const toOrderLines = (lines: EditableLine[]): OrderLineInput[] => lines.map(line => ({
  menuItemId: line.menuItemId, itemName: line.itemName, quantity: line.quantity, unitPrice: line.unitPrice, variants: line.variants, discountAmount: lineDiscount(line)
}));
/** One more of a menu item: onto its plain line if there is one, else a new line. */
export const addMenuItem = (lines: EditableLine[], item: MenuItemSelect): EditableLine[] =>
  lines.some(l => l.menuItemId === item.id && !l.variants.length)
    ? lines.map(l => l.menuItemId === item.id && !l.variants.length ? { ...l, quantity: l.quantity + 1 } : l)
    : [...lines, { key: crypto.randomUUID(), menuItemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.basePrice, variants: [], discount: '', discountType: 'percent' }];
export const lineQuantities = (lines: EditableLine[]) =>
  lines.reduce<Record<string, number>>((all, l) => ({ ...all, [l.menuItemId]: (all[l.menuItemId] || 0) + l.quantity }), {});

/** The lines of an order being built or edited: quantity, optional price, a discount per line, and removal. */
export function OrderLinesEditor({ lines, onChange, currency, editablePrice, flush }: {
  lines: EditableLine[]; onChange: (update: (lines: EditableLine[]) => EditableLine[]) => void; currency: string;
  editablePrice?: boolean;
  /** Bleed the rows to the edges of a card. */
  flush?: boolean;
}) {
  const fmt = (v: number) => money(v, currency);
  const [discountOpen, setDiscountOpen] = useState<string[]>([]);
  // Immutable updates: StrictMode double-invokes updaters, so mutating would double-count.
  const update = (key: string, change: Partial<EditableLine>) => onChange(prev => prev.map(l => l.key === key ? { ...l, ...change } : l));
  const changeQty = (key: string, delta: number) =>
    onChange(prev => prev.flatMap(l => l.key !== key ? [l] : l.quantity + delta > 0 ? [{ ...l, quantity: l.quantity + delta }] : []));
  return (
    <ul className="ws-list" style={flush ? { margin: '0 calc(var(--ws-pad) * -1)' } : undefined} aria-label="Order lines">
      {lines.map(line => {
        const gross = line.unitPrice * line.quantity;
        const off = lineDiscount(line);
        const showDiscount = discountOpen.includes(line.key) || line.discount !== '';
        return (
          <li key={line.key} className="ws-list-item" style={{ flexWrap: 'wrap', gap: 8, ...(flush ? {} : { paddingInline: 0 }) }}>
            <div className="ws-list-main" style={{ flexBasis: '100%' }}>
              <div className="ws-list-title"><span className="ws-truncate">{line.itemName}</span></div>
              {(line.variantLabel || !editablePrice) && <div className="ws-list-sub">
                {line.variantLabel && <span>{line.variantLabel}</span>}
                {!editablePrice && <span className="tabular">{fmt(line.unitPrice)} each</span>}
              </div>}
            </div>
            <Stepper label={`${line.itemName} quantity`} value={line.quantity} onDecrement={() => changeQty(line.key, -1)} onIncrement={() => changeQty(line.key, 1)} />
            {editablePrice && (
              <div style={{ width: 104 }}>
                <AffixInput affix={currency} aria-label={`${line.itemName} unit price`} type="number" inputMode="decimal" step="any" min="0" value={line.unitPrice}
                  onChange={e => update(line.key, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })} style={{ minHeight: 36, paddingRight: 6 }} />
              </div>
            )}
            <IconButton label={showDiscount ? `Remove discount on ${line.itemName}` : `Discount ${line.itemName}`} variant={showDiscount ? 'secondary' : 'ghost'} aria-pressed={showDiscount}
              onClick={() => {
                if (showDiscount) { update(line.key, { discount: '' }); setDiscountOpen(open => open.filter(k => k !== line.key)); }
                else setDiscountOpen(open => [...open, line.key]);
              }}><Percent /></IconButton>
            <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <span className="ws-amount" style={{ display: 'block' }}>{fmt(gross - off)}</span>
              {off > 0 && <span className="ws-hint tabular" style={{ textDecoration: 'line-through' }}>{fmt(gross)}</span>}
            </span>
            <IconButton label={`Remove ${line.itemName}`} variant="danger-ghost" onClick={() => onChange(prev => prev.filter(l => l.key !== line.key))}><Trash2 /></IconButton>
            {showDiscount && (
              <div style={{ flexBasis: '100%', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input aria-label={`Discount on ${line.itemName}`} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" autoFocus={line.discount === ''}
                  value={line.discount} onChange={e => update(line.key, { discount: e.target.value })} style={{ minHeight: 36, flex: 1 }} />
                <Segmented label={`Discount type for ${line.itemName}`} value={line.discountType} onChange={discountType => update(line.key, { discountType })}
                  options={[{ value: 'percent', label: '%' }, { value: 'fixed', label: currency }]} />
                {off > 0 && <span className="ws-amount" data-tone="positive">−{fmt(off)}</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Change an open order (or, for an admin, a completed one): lines, line discounts, the order discount and its details. */
export function OrderEditDialog({ order, items, settings, categories, menuItems, onClose, onSaved }: {
  order: OrderSelect | null; items: OrderItemSelect[]; settings: SettingsSelect; categories: CategorySelect[]; menuItems: MenuItemSelect[];
  onClose: () => void; onSaved?: (order: OrderSelect) => void;
}) {
  const currency = settings.currency;
  const fmt = (v: number) => money(v, currency);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [customer, setCustomer] = useState('');
  const [member, setMember] = useState<CustomerSelect | null>(null);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout' | 'pickup'>('dine_in');
  const [payment, setPayment] = useState('card');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('fixed');
  const [search, setSearch] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order) return;
    const editable = items.map<EditableLine>(item => {
      let chosen: unknown[] = [];
      try { chosen = JSON.parse(item.variantsJson || '[]'); } catch { /* unreadable options: keep the line without them */ }
      const variants = chosen.map(v => typeof v === 'string' ? v : (v as { id?: string })?.id || '').filter(Boolean);
      const variantLabel = chosen.map(v => typeof v === 'string' ? v : (v as { name?: string })?.name || '').filter(Boolean).join(', ');
      const off = item.discountAmount || 0;
      return { key: item.id, menuItemId: item.menuItemId, itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice, variants, variantLabel, discount: off ? String(off) : '', discountType: 'fixed' };
    });
    // Whatever the order's discount is beyond its lines was taken off the whole order.
    const wholeOrder = Number((order.discountAmount - editable.reduce((sum, l) => sum + lineDiscount(l), 0)).toFixed(2));
    setLines(editable);
    const linked = order.customerId ? store.getCustomers().find(c => c.id === order.customerId) || null : null;
    setMember(linked); setCustomer(linked ? '' : order.customerName || '');
    setOrderType(order.orderType as typeof orderType); setPayment(order.paymentMethod);
    setDiscount(wholeOrder > 0 ? String(wholeOrder) : ''); setDiscountType('fixed');
    setSearch(''); setOpenCategories([]); setError('');
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderLines = toOrderLines(lines);
  const gross = orderLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const lineDiscounts = orderLines.reduce((sum, l) => sum + (l.discountAmount || 0), 0);
  const orderDiscount = discountOff(gross - lineDiscounts, discount, discountType);
  const amounts = orderAmounts(orderLines, orderDiscount, settings.taxRate);
  const payments: string[] = ORDER_PAYMENT_METHODS.includes(payment as never) ? [...ORDER_PAYMENT_METHODS] : [...ORDER_PAYMENT_METHODS, payment];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || saving || !lines.length) return;
    setSaving(true); setError('');
    try {
      const saved = await store.updateOrder(order.id, {
        customerName: member?.name || customer.trim() || 'Walk-in', customerId: member?.id || null,
        orderType, paymentMethod: payment, orderDiscount, items: orderLines
      });
      onSaved?.(saved);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The order could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={!!order}
      onClose={onClose}
      busy={saving}
      size="lg"
      title={order ? <>Edit <span className="mono">{order.orderNumber}</span></> : ''}
      description={order ? `${ORDER_STATUS_LABELS[order.status] || order.status} · ${formatDateTime(order.createdAt)}. Ingredients are taken from or returned to stock to match.` : undefined}
      submitLabel={`Save · ${fmt(amounts.totalAmount)}`}
      submitDisabled={!lines.length}
      onSubmit={submit}
    >
      {error && <Notice tone="danger">{error}</Notice>}
      {lines.length === 0 ? <div className="ws-lane-empty">An order needs at least one item. Add one below, or cancel the order instead.</div>
        : <div className="ws-panel" style={{ padding: '4px 12px' }}><OrderLinesEditor lines={lines} onChange={setLines} currency={currency} /></div>}
      <div className="ws-field">
        <span className="ws-label">Add items</span>
        <div className="ws-toolbar-stack">
          <SearchInput value={search} onChange={setSearch} placeholder="Find a drink or dish" label="Search menu" />
          <MenuPicker categories={categories} menuItems={menuItems} query={search} open={openCategories} onOpenChange={setOpenCategories}
            quantities={lineQuantities(lines)} onAdd={item => setLines(prev => addMenuItem(prev, item))} fmt={fmt} />
        </div>
      </div>
      <Segmented block label="Order type" value={orderType} onChange={setOrderType} options={[{ value: 'dine_in', label: 'Dine-in' }, { value: 'takeout', label: 'Takeout' }, { value: 'pickup', label: 'Pickup' }]} />
      <CustomerPicker customers={store.getCustomers()} orders={store.getOrders()} text={customer} onTextChange={setCustomer} member={member} onMemberChange={setMember} allowSignUp={false} />
      <div className="ws-form-row cols-2">
        <Field label="Payment">{id => (
          <Select id={id} value={payment} onChange={e => setPayment(e.target.value)}>
            {payments.map(m => <option key={m} value={m}>{paymentLabel(m)}</option>)}
          </Select>
        )}</Field>
        <Field label="Order discount" hint="On top of any item discounts" aside={
          <Segmented label="Order discount type" value={discountType} onChange={setDiscountType} options={[{ value: 'percent', label: '%' }, { value: 'fixed', label: currency }]} />
        }>{id => <Input id={id} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />}</Field>
      </div>
      <KeyValue
        items={[
          { label: `Subtotal · ${plural(lines.reduce((sum, l) => sum + l.quantity, 0), 'item')}`, value: fmt(amounts.subtotal) },
          ...(amounts.discountAmount > 0 ? [{ label: 'Discounts', value: `−${fmt(amounts.discountAmount)}`, tone: 'positive' as const }] : []),
          { label: `Tax (${settings.taxRate}%)`, value: fmt(amounts.taxAmount) }
        ]}
        total={{ label: 'Total', value: fmt(amounts.totalAmount) }}
      />
    </FormDialog>
  );
}

/** Read-only order receipt, shared by the panel and the finance ledger. */
export function OrderDetailsDialog({ order, items, currency, taxRate, onClose, actions }: {
  order: OrderSelect | null; items: OrderItemSelect[]; currency: string; taxRate: number; onClose: () => void; actions?: React.ReactNode;
}) {
  return (
    <Dialog
      open={!!order}
      onClose={onClose}
      title={order ? <span className="mono">{order.orderNumber}</span> : ''}
      description={order ? `${order.customerName || 'Walk-in'} · ${formatDateTime(order.createdAt)}` : undefined}
      footer={<>{actions}<Button variant="primary" onClick={onClose}>Done</Button></>}
    >
      {order && (
        <div className="ws-form">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone={orderStatusTone(order.status)} dot>{ORDER_STATUS_LABELS[order.status] || order.status}</Badge>
            <Badge>{orderTypeLabel(order.orderType)}</Badge>
            <Badge>{paymentLabel(order.paymentMethod)}</Badge>
          </div>
          {items.length === 0 ? (
            <p className="ws-hint">No line items were recorded for this order.</p>
          ) : (
            <ul className="ws-ticket-lines" style={{ fontSize: 14 }}>
              {items.map(item => (
                <li key={item.id}>
                  <span><strong className="tabular">{item.quantity}×</strong> {item.itemName}</span>
                  <span className="tabular" style={{ textAlign: 'right' }}>
                    {money(item.quantity * item.unitPrice - (item.discountAmount || 0), currency)}
                    {item.discountAmount > 0 && <span className="ws-hint" style={{ display: 'block' }}>−{money(item.discountAmount, currency)} off</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <KeyValue
            items={[
              { label: 'Subtotal', value: money(order.subtotal, currency) },
              ...(order.discountAmount > 0 ? [{ label: 'Discount', value: `−${money(order.discountAmount, currency)}`, tone: 'positive' as const }] : []),
              { label: `Tax (${taxRate}%)`, value: money(order.taxAmount, currency) }
            ]}
            total={{ label: 'Total', value: money(order.totalAmount, currency) }}
          />
        </div>
      )}
    </Dialog>
  );
}
