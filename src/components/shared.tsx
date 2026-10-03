import React, { useEffect, useState } from 'react';
import { Boxes, CheckCircle2, Circle, Moon, PlayCircle, Sparkles, Sun, Trash2, User, Wrench } from 'lucide-react';
import { OrderItemSelect, OrderSelect, StaffSelect, TaskSelect } from '../db/schema';
import { store } from '../db/store';
import {
  Badge, Button, Dialog, Field, FormDialog, IconButton, Input, KeyValue, ListItem, Select,
  formatDateTime, localDateKey, money, orderStatusTone, orderTypeLabel, paymentLabel, ORDER_STATUS_LABELS
} from '../ui';

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
