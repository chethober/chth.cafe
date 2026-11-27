import React, { useEffect, useState } from 'react';
import { ClipboardCopy, MessageCircle, PackageCheck, Pencil, Plus, Send, Trash2, Truck, Wand2 } from 'lucide-react';
import { SettingsSelect, StockItemSelect } from '../db/schema';
import { store } from '../db/store';
import { readAPIResponse } from '../services/api';
import {
  AffixInput, Badge, Button, Card, Checkbox, ConfirmDialog, Dialog, EmptyState, Field, FormDialog, IconButton, Input, KeyValue, List, ListItem, Notice,
  Select, Textarea, formatDate, money, plural
} from '../ui';
import { purchaseOrderText, reorderQuantity, type PurchaseOrder, type PurchaseOrderStatus, type Supplier } from '../utils/purchasing';
import { tr } from '../i18n';

async function request<T>(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method, ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  } catch {
    throw new Error(tr('No connection. Try again when you are back online.'));
  }
  return readAPIResponse<T>(response);
}

/** The café's suppliers, read once and again after each change. */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const reload = () => request<{ data: Supplier[] }>('/api/suppliers').then(r => setSuppliers(r.data)).catch(() => {});
  useEffect(() => { void reload(); }, []);
  return { suppliers, reload };
}

const STATUS: Record<PurchaseOrderStatus, { label: () => string; tone: 'neutral' | 'info' | 'positive' | 'danger' }> = {
  draft: { label: () => tr('Draft'), tone: 'neutral' },
  sent: { label: () => tr('Ordered'), tone: 'info' },
  received: { label: () => tr('Received'), tone: 'positive' },
  cancelled: { label: () => tr('Cancelled'), tone: 'danger' }
};

interface DraftLine { stockItemId: string; quantity: string; unitCost: string }
const orderCost = (lines: Array<{ quantity: number; unitCost: number }>) => lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);

/** Suppliers: who they are, how to reach them and how long they take to deliver. */
function SuppliersDialog({ open, onClose, suppliers, onChanged }: { open: boolean; onClose: () => void; suppliers: Supplier[]; onChanged: () => void }) {
  const empty = { name: '', phone: '', telegram: '', leadTimeDays: '1', notes: '' };
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const edit = (s: Supplier | 'new') => {
    setEditing(s); setError('');
    setForm(s === 'new' ? empty : { name: s.name, phone: s.phone, telegram: s.telegram, leadTimeDays: String(s.leadTimeDays), notes: s.notes });
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || busy) return;
    setBusy(true); setError('');
    try {
      const body = { ...form, leadTimeDays: parseInt(form.leadTimeDays, 10) || 0 };
      if (editing === 'new') await request('/api/suppliers', 'POST', body);
      else await request(`/api/suppliers/${encodeURIComponent(editing.id)}`, 'PUT', body);
      setEditing(null);
      onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : tr('The supplier could not be saved.')); }
    finally { setBusy(false); }
  };
  return (
    <>
      <Dialog open={open && !editing && !deleteTarget} onClose={onClose} title={tr('Suppliers')} description={tr('Link each material to the supplier you buy it from; reorders are grouped by supplier.')}
        footer={<><span className="ws-spacer"><Button icon={<Plus />} onClick={() => edit('new')}>{tr('Add supplier')}</Button></span><Button variant="primary" onClick={onClose}>{tr('Done')}</Button></>}>
        {suppliers.length === 0 ? <EmptyState icon={<Truck />} title={tr('No suppliers yet')} description={tr('Add the roaster, the dairy and the bakery you order from.')} /> : (
          <List label={tr('Suppliers')}>
            {suppliers.map(s => (
              <ListItem key={s.id} onClick={() => edit(s)} label={tr('Edit {name}', { name: s.name })}
                title={s.name}
                subtitle={<>{s.phone && <span className="tabular">{s.phone}</span>}{s.telegram && <span>{s.telegram}</span>}<span>{tr('Delivers in {days}', { days: plural(s.leadTimeDays, 'day') })}</span></>}
                actions={<IconButton label={tr('Delete {name}', { name: s.name })} variant="danger-ghost" onClick={() => setDeleteTarget(s)}><Trash2 /></IconButton>} />
            ))}
          </List>
        )}
      </Dialog>
      <FormDialog open={!!editing} onClose={() => setEditing(null)} busy={busy} title={editing === 'new' ? tr('Add supplier') : tr('Edit {name}', { name: editing ? (editing as Supplier).name : '' })}
        submitLabel={editing === 'new' ? tr('Add supplier') : tr('Save changes')} submitDisabled={!form.name.trim()} onSubmit={save}>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label={tr('Name')}>{id => <Input id={id} autoFocus required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />}</Field>
        <div className="ws-form-row cols-2">
          <Field label={tr('Phone')} optional hint={tr('For WhatsApp')}>{(id, hint) => <Input id={id} aria-describedby={hint} type="tel" maxLength={40} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />}</Field>
          <Field label={tr('Telegram')} optional>{id => <Input id={id} maxLength={100} value={form.telegram} onChange={e => setForm({ ...form, telegram: e.target.value })} placeholder="@supplier" />}</Field>
        </div>
        <Field label={tr('Delivery takes')} hint={tr('Days from ordering; sets the expected date on new orders.')}>{(id, hint) => <AffixInput id={id} aria-describedby={hint} affix={tr('days')} type="number" inputMode="numeric" min="0" max="90" step="1" value={form.leadTimeDays} onChange={e => setForm({ ...form, leadTimeDays: e.target.value })} />}</Field>
        <Field label={tr('Notes')} optional>{id => <Textarea id={id} rows={2} maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder={tr('Order days, minimum order, account number…')} />}</Field>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) void request(`/api/suppliers/${encodeURIComponent(deleteTarget.id)}`, 'DELETE').then(onChanged).catch(() => {}); }}
        title={tr('Delete {value}?', { value: deleteTarget?.name || '' })} description={tr('Its materials and orders stay, without a supplier.')} />
    </>
  );
}

/**
 * Purchase orders: draft them by hand or from everything running low, send them to the supplier,
 * and receive them into stock, which records the delivery and can update each material's cost.
 */
export function Purchasing({ settings, stockItems, suppliers, onSuppliersChanged }: {
  settings: SettingsSelect; stockItems: StockItemSelect[]; suppliers: Supplier[]; onSuppliersChanged: () => void;
}) {
  const fmt = (v: number) => money(v, settings.currency);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'positive' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | 'new' | null>(null);
  const [form, setForm] = useState<{ supplierId: string; expectedOn: string; notes: string; lines: DraftLine[] }>({ supplierId: '', expectedOn: '', notes: '', lines: [] });
  const [formError, setFormError] = useState('');
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [received, setReceived] = useState<Record<string, { quantity: string; unitCost: string }>>({});
  const [updateCosts, setUpdateCosts] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const reload = () => request<{ data: PurchaseOrder[] }>('/api/purchase-orders').then(r => setOrders(r.data)).catch(() => {});
  useEffect(() => { void reload(); }, []);
  const run = async (work: () => Promise<void>, failure: string) => {
    setBusy(true); setNotice(null);
    try { await work(); }
    catch (reason) { setNotice({ tone: 'danger', text: reason instanceof Error ? reason.message : failure }); }
    finally { setBusy(false); }
  };

  const open = orders.filter(o => o.status === 'draft' || o.status === 'sent');
  const closed = orders.filter(o => o.status === 'received' || o.status === 'cancelled');
  const lowStock = stockItems.filter(i => reorderQuantity(i) > 0).length;
  const supplierOf = (o: PurchaseOrder) => suppliers.find(s => s.id === o.supplierId);

  const reorder = () => run(async () => {
    const result = await request<{ created: number; data: PurchaseOrder[] }>('/api/purchase-orders/reorder', 'POST', {});
    setOrders(result.data);
    setNotice(result.created
      ? { tone: 'positive', text: tr('{count} drafted from low stock. Check the quantities, then send.', { count: plural(result.created, 'order') }) }
      : { tone: 'info', text: tr('Nothing to reorder: everything low is already on an open order.') });
  }, tr('Reorder drafts could not be made.'));

  const openForm = (po: PurchaseOrder | 'new') => {
    setEditing(po); setFormError('');
    setForm(po === 'new'
      ? { supplierId: '', expectedOn: '', notes: '', lines: [] }
      : { supplierId: po.supplierId || '', expectedOn: po.expectedOn || '', notes: po.notes || '', lines: po.lines.map(l => ({ stockItemId: l.stockItemId, quantity: String(l.quantity), unitCost: String(l.unitCost) })) });
  };
  const addLine = () => {
    const free = stockItems.filter(i => !form.lines.some(l => l.stockItemId === i.id));
    const pick = free.find(i => !form.supplierId || i.supplierId === form.supplierId) || free[0];
    if (pick) setForm({ ...form, lines: [...form.lines, { stockItemId: pick.id, quantity: String(reorderQuantity(pick) || 1), unitCost: String(pick.unitCost) }] });
  };
  const formLines = form.lines.map(l => ({ stockItemId: l.stockItemId, quantity: parseFloat(l.quantity) || 0, unitCost: parseFloat(l.unitCost) || 0 }));
  const saveForm = async (status?: PurchaseOrderStatus) => {
    if (!editing) return;
    setBusy(true); setFormError('');
    try {
      const body = { supplierId: form.supplierId || null, expectedOn: form.expectedOn, notes: form.notes, lines: formLines, ...(status && { status }) };
      if (editing === 'new') {
        const created = await request<{ data: PurchaseOrder }>('/api/purchase-orders', 'POST', body);
        if (status === 'sent') await request(`/api/purchase-orders/${encodeURIComponent(created.data.id)}`, 'PUT', { status });
      } else {
        await request(`/api/purchase-orders/${encodeURIComponent(editing.id)}`, 'PUT', body);
      }
      setEditing(null);
      await reload();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : tr('The order could not be saved.')); }
    finally { setBusy(false); }
  };

  const shareText = (po: PurchaseOrder) => purchaseOrderText(po, settings.cafeName, fmt);
  const copy = (po: PurchaseOrder) => {
    void navigator.clipboard?.writeText(shareText(po)).then(
      () => setNotice({ tone: 'positive', text: tr('Order copied. Paste it into a message to {name}.', { name: po.supplierName || tr('the supplier') }) }),
      () => setNotice({ tone: 'danger', text: tr('Copying is blocked in this browser.') })
    );
  };
  const whatsappUrl = (po: PurchaseOrder) => {
    const phone = (supplierOf(po)?.phone || '').replace(/[^\d]/g, '');
    return `https://wa.me/${phone}?text=${encodeURIComponent(shareText(po))}`;
  };
  const telegramShareUrl = (po: PurchaseOrder) => `https://t.me/share/url?url=${encodeURIComponent(shareText(po))}`;
  const sendToCafeChat = (po: PurchaseOrder) => run(async () => {
    await request(`/api/purchase-orders/${encodeURIComponent(po.id)}/telegram`, 'POST', {});
    setNotice({ tone: 'positive', text: tr('Sent to the café\'s Telegram chat, ready to forward.') });
  }, tr('Telegram did not accept the message.'));
  const markSent = (po: PurchaseOrder) => run(async () => { await request(`/api/purchase-orders/${encodeURIComponent(po.id)}`, 'PUT', { status: 'sent' }); await reload(); }, tr('The order could not be updated.'));
  const cancel = (po: PurchaseOrder) => run(async () => { await request(`/api/purchase-orders/${encodeURIComponent(po.id)}`, 'PUT', { status: 'cancelled' }); await reload(); }, tr('The order could not be updated.'));

  const openReceive = (po: PurchaseOrder) => {
    setReceiving(po); setUpdateCosts(true);
    setReceived(Object.fromEntries(po.lines.map(l => [l.id, { quantity: String(l.quantity), unitCost: String(l.unitCost) }])));
  };
  const receive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiving) return;
    await run(async () => {
      await request(`/api/purchase-orders/${encodeURIComponent(receiving.id)}/receive`, 'POST', {
        updateCosts,
        lines: receiving.lines.map(l => ({ id: l.id, receivedQuantity: parseFloat(received[l.id]?.quantity) || 0, unitCost: parseFloat(received[l.id]?.unitCost) || 0 }))
      });
      setReceiving(null);
      setNotice({ tone: 'positive', text: tr('Delivery added to stock.') });
      await Promise.all([reload(), store.syncFromAPI()]);
    }, tr('The delivery could not be recorded.'));
  };

  const row = (po: PurchaseOrder) => {
    const status = STATUS[po.status];
    return (
      <ListItem
        key={po.id}
        dim={po.status === 'cancelled'}
        onClick={() => (po.status === 'draft' || po.status === 'sent') ? openForm(po) : undefined}
        label={tr('Order from {name}', { name: po.supplierName || tr('no supplier') })}
        title={<><span className="ws-truncate">{po.supplierName || tr('No supplier')}</span><Badge tone={status.tone} dot>{status.label()}</Badge></>}
        subtitle={<>
          <span>{plural(po.lines.length, 'material')}</span>
          <span>{po.lines.slice(0, 3).map(l => l.name).join(', ')}{po.lines.length > 3 ? '…' : ''}</span>
          {po.expectedOn && po.status !== 'received' && <span>{tr('Due {date}', { date: formatDate(`${po.expectedOn}T12:00:00`) })}</span>}
          {po.receivedAt && <span>{tr('Received {date}', { date: formatDate(po.receivedAt) })}</span>}
        </>}
        trail={<span className="ws-amount">{fmt(orderCost(po.status === 'received' ? po.lines.map(l => ({ quantity: l.receivedQuantity, unitCost: l.unitCost })) : po.lines))}</span>}
        actions={(po.status === 'draft' || po.status === 'sent') && <>
          {po.status === 'draft' && <Button size="sm" variant="ghost" icon={<Send />} disabled={busy} onClick={() => markSent(po)}>{tr('Mark ordered')}</Button>}
          <Button size="sm" variant="primary" icon={<PackageCheck />} disabled={busy} onClick={() => openReceive(po)}>{tr('Receive')}</Button>
        </>}
      />
    );
  };

  const editingOrder = editing && editing !== 'new' ? editing : null;
  return (
    <Card flush title={tr('Purchase orders')} description={open.length ? tr('{count} open', { count: plural(open.length, 'order') }) : tr('Order from suppliers and receive deliveries into stock.')}
      actions={<>
        <Button size="sm" variant="ghost" icon={<Truck />} onClick={() => setSuppliersOpen(true)}>{tr('Suppliers')}</Button>
        <Button size="sm" icon={<Wand2 />} disabled={busy || !lowStock} onClick={reorder}>{lowStock ? tr('Reorder low stock ({count})', { count: lowStock }) : tr('Nothing low')}</Button>
        <Button size="sm" variant="primary" icon={<Plus />} disabled={!stockItems.length} onClick={() => openForm('new')}>{tr('New order')}</Button>
      </>}>
      {notice && <div style={{ padding: '0 var(--ws-pad) var(--chth-space-12)' }}><Notice tone={notice.tone} role="status">{notice.text}</Notice></div>}
      {open.length === 0 ? (
        <EmptyState icon={<Truck />} title={tr('No open orders')} description={lowStock ? tr('{count} running low. Draft orders for them in one tap.', { count: plural(lowStock, 'material') }) : tr('When materials run low, draft orders for them here.')} />
      ) : <List label={tr('Open purchase orders')}>{open.map(row)}</List>}
      {closed.length > 0 && (
        <div style={{ padding: 'var(--chth-space-8) var(--ws-pad) var(--chth-space-12)' }}>
          <Button size="sm" variant="ghost" aria-expanded={showClosed} onClick={() => setShowClosed(v => !v)}>{showClosed ? tr('Hide past orders') : tr('Past orders ({count})', { count: closed.length })}</Button>
        </div>
      )}
      {showClosed && <List label={tr('Past purchase orders')}>{closed.slice(0, 30).map(row)}</List>}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        busy={busy}
        title={editing === 'new' ? tr('New purchase order') : editingOrder ? tr('Order from {name}', { name: editingOrder.supplierName || tr('no supplier') }) : ''}
        description={editingOrder ? `${STATUS[editingOrder.status].label()} · ${formatDate(editingOrder.createdAt, { dateStyle: 'medium' })}` : tr('Pick a supplier and what to order. Quantities use each material\'s unit.')}
        footer={<>
          {editingOrder && <span className="ws-spacer">
            {editingOrder.status === 'draft'
              ? <Button variant="danger-ghost" icon={<Trash2 />} onClick={() => { setDeleteTarget(editingOrder); setEditing(null); }}>{tr('Delete')}</Button>
              : <Button variant="danger-ghost" onClick={() => { void cancel(editingOrder); setEditing(null); }}>{tr('Cancel order')}</Button>}
          </span>}
          <Button variant="ghost" onClick={() => setEditing(null)}>{tr('Close')}</Button>
          <Button disabled={!form.lines.length || busy} onClick={() => void saveForm()}>{tr('Save')}</Button>
          {(editing === 'new' || editingOrder?.status === 'draft') && <Button variant="primary" icon={<Send />} disabled={!form.lines.length || busy} onClick={() => void saveForm('sent')}>{tr('Save as ordered')}</Button>}
        </>}
      >
        <div className="ws-form">
          {formError && <Notice tone="danger">{formError}</Notice>}
          <div className="ws-form-row cols-2">
            <Field label={tr('Supplier')}>{id => (
              <Select id={id} value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">{tr('No supplier')}</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}</Field>
            <Field label={tr('Needed by')} optional>{id => <Input id={id} type="date" value={form.expectedOn} onChange={e => setForm({ ...form, expectedOn: e.target.value })} />}</Field>
          </div>
          {form.lines.length === 0 ? <div className="ws-lane-empty">{tr('No materials yet.')}</div> : (
            <div className="ws-po-lines">
              {form.lines.map((line, index) => {
                const material = stockItems.find(i => i.id === line.stockItemId);
                const set = (change: Partial<DraftLine>) => setForm({ ...form, lines: form.lines.map((l, i) => i === index ? { ...l, ...change } : l) });
                return (
                  <div key={index} className="ws-po-line">
                    <Select aria-label={tr('Material')} value={line.stockItemId} onChange={e => set({ stockItemId: e.target.value })}>
                      {stockItems.map(i => <option key={i.id} value={i.id} disabled={i.id !== line.stockItemId && form.lines.some(l => l.stockItemId === i.id)}>{tr('{name} ({quantity} {unit} on hand)', { name: i.name, quantity: Number(i.quantity.toFixed(3)), unit: i.unit })}</option>)}
                    </Select>
                    <AffixInput affix={material?.unit || ''} aria-label={tr('Quantity of {name}', { name: material?.name || '' })} type="number" inputMode="decimal" min="0" step="any" value={line.quantity} onChange={e => set({ quantity: e.target.value })} />
                    <AffixInput affix={settings.currency} aria-label={tr('Cost per unit of {name}', { name: material?.name || '' })} type="number" inputMode="decimal" min="0" step="any" value={line.unitCost} onChange={e => set({ unitCost: e.target.value })} />
                    <IconButton label={tr('Remove {name}', { name: material?.name || '' })} variant="danger-ghost" onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}><Trash2 /></IconButton>
                  </div>
                );
              })}
            </div>
          )}
          <div><Button size="sm" icon={<Plus />} onClick={addLine} disabled={form.lines.length >= stockItems.length}>{tr('Add material')}</Button></div>
          <Field label={tr('Notes for the supplier')} optional>{id => <Textarea id={id} rows={2} maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder={tr('Delivery window, substitutions…')} />}</Field>
          <KeyValue items={[{ label: tr('Materials'), value: form.lines.length }]} total={{ label: tr('Estimated cost'), value: fmt(orderCost(formLines)) }} />
          {editingOrder && (
            <div className="ws-panel ws-form">
              <strong>{tr('Send it')}</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" icon={<ClipboardCopy />} onClick={() => copy(editingOrder)}>{tr('Copy text')}</Button>
                <a className="chth-btn chth-btn--secondary chth-btn--sm" href={whatsappUrl(editingOrder)} target="_blank" rel="noreferrer"><span className="chth-btn__icon" aria-hidden="true"><MessageCircle /></span><span className="chth-btn__label">WhatsApp</span></a>
                <a className="chth-btn chth-btn--secondary chth-btn--sm" href={telegramShareUrl(editingOrder)} target="_blank" rel="noreferrer"><span className="chth-btn__icon" aria-hidden="true"><Send /></span><span className="chth-btn__label">Telegram</span></a>
                <Button size="sm" variant="ghost" icon={<Send />} disabled={busy} onClick={() => sendToCafeChat(editingOrder)}>{tr('To the café chat')}</Button>
              </div>
              <span className="ws-hint">{tr('Shares the saved order. Save changes first.')}</span>
            </div>
          )}
        </div>
      </Dialog>

      <FormDialog open={!!receiving} onClose={() => setReceiving(null)} busy={busy} size="lg" title={receiving ? tr('Receive from {name}', { name: receiving.supplierName || tr('no supplier') }) : ''}
        description={tr('Enter what actually arrived and what it cost. It is added to stock as a delivery.')} submitLabel={tr('Add to stock')} onSubmit={receive}>
        {receiving && <>
          <div className="ws-po-lines">
            {receiving.lines.map(line => (
              <div key={line.id} className="ws-po-line" data-receive="">
                <span className="ws-truncate"><strong>{line.name}</strong><span className="ws-hint" style={{ display: 'block' }}>{tr('Ordered {quantity} {unit}', { quantity: line.quantity, unit: line.unit })}</span></span>
                <AffixInput affix={line.unit} aria-label={tr('Received {name}', { name: line.name })} type="number" inputMode="decimal" min="0" step="any" value={received[line.id]?.quantity ?? ''} onChange={e => setReceived({ ...received, [line.id]: { ...received[line.id], quantity: e.target.value } })} />
                <AffixInput affix={settings.currency} aria-label={tr('Cost per unit of {name}', { name: line.name })} type="number" inputMode="decimal" min="0" step="any" value={received[line.id]?.unitCost ?? ''} onChange={e => setReceived({ ...received, [line.id]: { ...received[line.id], unitCost: e.target.value } })} />
              </div>
            ))}
          </div>
          <Checkbox checked={updateCosts} onChange={setUpdateCosts}>{tr('Update each material\'s cost to these prices')}</Checkbox>
          <KeyValue items={[]} total={{ label: tr('Delivery cost'), value: fmt(receiving.lines.reduce((sum, l) => sum + (parseFloat(received[l.id]?.quantity) || 0) * (parseFloat(received[l.id]?.unitCost) || 0), 0)) }} />
        </>}
      </FormDialog>

      <SuppliersDialog open={suppliersOpen} onClose={() => setSuppliersOpen(false)} suppliers={suppliers} onChanged={onSuppliersChanged} />
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) void run(async () => { await request(`/api/purchase-orders/${encodeURIComponent(deleteTarget.id)}`, 'DELETE'); await reload(); }, tr('The order could not be deleted.')); }}
        title={tr('Delete this draft?')} description={tr('Nothing was ordered yet, so stock is not affected.')} />
    </Card>
  );
}
