import React, { useEffect, useState } from 'react';
import { Boxes, Cake, CheckCircle2, ChevronDown, Circle, Coffee, GlassWater, Leaf, Moon, PlayCircle, Plus, Sparkles, Sun, Trash2, User, Utensils, Wrench } from 'lucide-react';
import { CategorySelect, MenuItemSelect, OrderItemSelect, OrderSelect, StaffSelect, TaskSelect } from '../db/schema';
import { store } from '../db/store';
import {
  Badge, Button, Dialog, EmptyState, Field, FormDialog, IconButton, Input, KeyValue, ListItem, Select,
  formatDateTime, plural, localDateKey, money, orderStatusTone, orderTypeLabel, paymentLabel, ORDER_STATUS_LABELS
} from '../ui';

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
                  <span className="tabular">{money(item.quantity * item.unitPrice, currency)}</span>
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
