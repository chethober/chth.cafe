import React, { useEffect, useMemo, useState } from 'react';
import { Contact, Pencil, Phone, Trash2, UserPlus, X } from 'lucide-react';
import { CustomerSelect, OrderItemSelect, OrderSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { normalizePhone } from '../services/customers';
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Field, FormDialog, IconButton, Input, KeyValue, List, ListItem,
  Notice, Page, PageHeader, SearchInput, Segmented, Stat, StatGrid, Textarea, formatDate, money, orderStatusTone, plural, ORDER_STATUS_LABELS
} from '../ui';
import { OrderDetailsDialog } from './shared';

export interface CustomerStats { visits: number; spend: number; lastVisit: string | null }
const NO_VISITS: CustomerStats = { visits: 0, spend: 0, lastVisit: null };

/** Visits and spend count completed orders only, so open and cancelled orders never inflate a member's history. */
export function useCustomerStats(orders: OrderSelect[]) {
  return useMemo(() => {
    const stats = new Map<string, CustomerStats>();
    for (const order of orders) {
      if (!order.customerId || order.status !== 'completed') continue;
      const s = stats.get(order.customerId) || { ...NO_VISITS };
      s.visits++;
      s.spend += order.totalAmount;
      if (!s.lastVisit || order.createdAt > s.lastVisit) s.lastVisit = order.createdAt;
      stats.set(order.customerId, s);
    }
    return stats;
  }, [orders]);
}

/** Matches by name, or by phone digits when the query has any ("0912" finds "+98 912…" only if the digits line up). */
export function matchCustomers(customers: CustomerSelect[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return customers;
  const digits = normalizePhone(q).replace('+', '');
  return customers.filter(c => c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.includes(digits)));
}

const visitsLabel = (s: CustomerStats) => s.visits ? `${plural(s.visits, 'visit')} · last ${formatDate(s.lastVisit!)}` : 'No visits yet';

/* --------------------------------------------------------------- Form */

export function CustomerFormDialog({ open, onClose, customer, initialQuery = '', onSaved }: {
  open: boolean; onClose: () => void; customer?: CustomerSelect | null; initialQuery?: string; onSaved?: (customer: CustomerSelect) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    // A typed query prefills whichever field it looks like.
    const looksLikePhone = /^[+\d\s\-()۰-۹٠-٩]+$/.test(initialQuery.trim());
    setName(customer?.name ?? (looksLikePhone ? '' : initialQuery.trim()));
    setPhone(customer?.phone ?? (looksLikePhone ? initialQuery.trim() : ''));
    setNotes(customer?.notes ?? '');
    setError('');
  }, [open, customer, initialQuery]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const input = { name: name.trim(), phone, notes: notes.trim() };
      const saved = customer ? await store.updateCustomer(customer.id, input) : await store.createCustomer(input);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The member could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      busy={saving}
      title={customer ? `Edit ${customer.name}` : 'New club member'}
      description={customer ? undefined : 'Members are found by phone number at the till.'}
      submitLabel={customer ? 'Save changes' : 'Add member'}
      submitDisabled={!name.trim() || normalizePhone(phone).replace('+', '').length < 5}
      onSubmit={submit}
    >
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
      <Field label="Name">{id => <Input id={id} autoFocus={!name} value={name} onChange={e => setName(e.target.value)} required maxLength={100} autoComplete="off" />}</Field>
      <Field label="Phone" hint="Spaces and dashes are ignored.">{id => <Input id={id} autoFocus={!!name && !phone} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={30} autoComplete="off" />}</Field>
      <Field label="Notes" optional>{id => <Textarea id={id} rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} placeholder="Usual order, allergies, birthday…" />}</Field>
    </FormDialog>
  );
}

/* ------------------------------------------------------- Order picker */

/**
 * The till's "Customer or table" field: free text still works for tables and walk-ins,
 * and typing a name or phone offers club members to link the order to.
 */
export function CustomerPicker({ customers, orders, text, onTextChange, member, onMemberChange, allowSignUp = true }: {
  customers: CustomerSelect[]; orders: OrderSelect[];
  text: string; onTextChange: (text: string) => void;
  member: CustomerSelect | null; onMemberChange: (member: CustomerSelect | null) => void;
  /** Off inside another dialog, where a sign-up form would stack a second modal. */
  allowSignUp?: boolean;
}) {
  const stats = useCustomerStats(orders);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const query = text.trim();
  const matches = query.length >= 2 ? matchCustomers(customers, query).slice(0, 4) : [];
  const pick = (c: CustomerSelect) => { onMemberChange(c); onTextChange(''); };

  if (member) {
    const s = stats.get(member.id) || NO_VISITS;
    return (
      <Field label="Customer">{() => (
        <div className="ws-member-chip">
          <Avatar name={member.name} />
          <div className="ws-list-main">
            <div className="ws-list-title">{member.name} <Badge tone="positive">Member</Badge></div>
            <div className="ws-list-sub"><span className="tabular">{member.phone}</span><span>{visitsLabel(s)}</span></div>
          </div>
          <IconButton label={`Unlink ${member.name}`} onClick={() => onMemberChange(null)}><X /></IconButton>
        </div>
      )}</Field>
    );
  }
  return (
    <>
      <Field label="Customer or table" optional hint={query.length >= 2 && !matches.length ? 'No club member matches.' : 'Type a name or phone to find a club member.'}>{id => (
        <Input id={id} value={text} onChange={e => onTextChange(e.target.value)} placeholder="Walk-in" autoComplete="off" />
      )}</Field>
      {query.length >= 2 && (matches.length > 0 || allowSignUp) && (
        <div className="ws-member-matches">
          {matches.length > 0 && (
            <List label="Matching club members">
              {matches.map(c => (
                <ListItem key={c.id} lead={<Avatar name={c.name} />} title={c.name} subtitle={<><span className="tabular">{c.phone}</span><span>{visitsLabel(stats.get(c.id) || NO_VISITS)}</span></>} onClick={() => pick(c)} label={`Link order to ${c.name}`} />
              ))}
            </List>
          )}
          {allowSignUp && <Button variant="ghost" size="sm" icon={<UserPlus />} onClick={() => setSignUpOpen(true)}>Add “{query}” to the club</Button>}
        </div>
      )}
      {allowSignUp && <CustomerFormDialog open={signUpOpen} onClose={() => setSignUpOpen(false)} initialQuery={query} onSaved={pick} />}
    </>
  );
}

/* --------------------------------------------------------- Directory */

type SortKey = 'name' | 'visits' | 'recent';

export function CustomerClub({ settings, customers, orders, orderItems, canDelete, onChanged }: {
  settings: SettingsSelect; customers: CustomerSelect[]; orders: OrderSelect[]; orderItems: OrderItemSelect[];
  /** Only the admin removes members; the panel can add and correct them. */
  canDelete: boolean; onChanged: () => void;
}) {
  const fmt = (v: number) => money(v, settings.currency);
  const stats = useCustomerStats(orders);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerSelect | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerSelect | null>(null);
  const [viewOrder, setViewOrder] = useState<OrderSelect | null>(null);
  const viewing = customers.find(c => c.id === viewingId) || null;

  const statsOf = (id: string) => stats.get(id) || NO_VISITS;
  const visible = matchCustomers(customers, search).slice().sort((a, b) =>
    sort === 'visits' ? statsOf(b.id).visits - statsOf(a.id).visits || statsOf(b.id).spend - statsOf(a.id).spend
    : sort === 'recent' ? (statsOf(b.id).lastVisit || '').localeCompare(statsOf(a.id).lastVisit || '')
    : a.name.localeCompare(b.name));

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = customers.filter(c => new Date(c.createdAt) >= monthStart).length;
  const returning = customers.filter(c => statsOf(c.id).visits >= 2).length;
  const clubSpend = [...stats.values()].reduce((sum, s) => sum + s.spend, 0);

  const memberOrders = viewing ? orders.filter(o => o.customerId === viewing.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const openForm = (customer: CustomerSelect | null) => { setEditing(customer); setFormOpen(true); };

  return (
    <Page>
      <PageHeader
        title="Customer club"
        description="Members are linked to orders at the till by name or phone. Visits and spend count completed orders."
        actions={<Button variant="primary" icon={<UserPlus />} onClick={() => openForm(null)}>New member</Button>}
      />
      <StatGrid>
        <Stat label="Members" value={customers.length} />
        <Stat label="Joined this month" value={newThisMonth} tone={newThisMonth ? 'positive' : 'neutral'} />
        <Stat label="Returning" value={returning} hint="2 or more visits" />
        <Stat label="Member spend" value={fmt(clubSpend)} />
      </StatGrid>

      <Card flush title="Members" description={search.trim() ? `${visible.length} of ${customers.length}` : plural(customers.length, 'member')}>
        {customers.length > 0 && (
          <div className="ws-toolbar" style={{ padding: '0 var(--ws-pad) 12px' }}>
            <SearchInput className="ws-grow" value={search} onChange={setSearch} placeholder="Search name or phone" label="Search members" />
            <Segmented label="Sort members" value={sort} onChange={setSort} options={[
              { value: 'name', label: 'A–Z' }, { value: 'visits', label: 'Top' }, { value: 'recent', label: 'Recent' }
            ]} />
          </div>
        )}
        {customers.length === 0 ? (
          <EmptyState icon={<Contact />} title="No club members yet" description="Add members here, or from the New order screen while taking an order." action={<Button variant="primary" icon={<UserPlus />} onClick={() => openForm(null)}>Add the first member</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon={<Contact />} title="No members match" description={`Nothing found for “${search.trim()}”.`} />
        ) : (
          <List label="Club members">
            {visible.map(c => {
              const s = statsOf(c.id);
              return (
                <ListItem
                  key={c.id}
                  lead={<Avatar name={c.name} />}
                  title={c.name}
                  subtitle={<><span className="tabular">{c.phone}</span><span>{visitsLabel(s)}</span></>}
                  trail={<span className="ws-amount">{fmt(s.spend)}</span>}
                  onClick={() => setViewingId(c.id)}
                  label={`${c.name}, ${visitsLabel(s)}`}
                />
              );
            })}
          </List>
        )}
      </Card>

      {/* Hidden, not closed, while an order or the edit form is on top, so closing those returns here. */}
      <Dialog
        open={!!viewing && !formOpen && !viewOrder}
        onClose={() => setViewingId(null)}
        title={viewing?.name || ''}
        description={viewing ? `Member since ${formatDate(viewing.createdAt, { dateStyle: 'medium' })}` : undefined}
        footer={viewing && <>
          {canDelete && <span className="ws-spacer"><Button variant="danger-ghost" icon={<Trash2 />} onClick={() => { setDeleteTarget(viewing); setViewingId(null); }}>Delete</Button></span>}
          <Button icon={<Pencil />} onClick={() => openForm(viewing)}>Edit</Button>
          <Button variant="primary" onClick={() => setViewingId(null)}>Done</Button>
        </>}
      >
        {viewing && (
          <div className="ws-form">
            <a className="ws-member-phone tabular" href={`tel:${viewing.phone}`}><Phone aria-hidden="true" />{viewing.phone}</a>
            <KeyValue items={[
              { label: 'Visits', value: statsOf(viewing.id).visits },
              { label: 'Last visit', value: statsOf(viewing.id).lastVisit ? formatDate(statsOf(viewing.id).lastVisit!, { dateStyle: 'medium' }) : '—' },
              { label: 'Average order', value: statsOf(viewing.id).visits ? fmt(statsOf(viewing.id).spend / statsOf(viewing.id).visits) : '—' }
            ]} total={{ label: 'Total spend', value: fmt(statsOf(viewing.id).spend) }} />
            {viewing.notes && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{viewing.notes}</p>}
            {memberOrders.length === 0 ? <p className="ws-hint">No orders linked yet.</p> : (
              <List label={`Orders for ${viewing.name}`} maxHeight={280}>
                {memberOrders.slice(0, 50).map(o => (
                  <ListItem
                    key={o.id}
                    title={<span className="mono">{o.orderNumber}</span>}
                    subtitle={<><span>{formatDate(o.createdAt, { dateStyle: 'medium' })}</span><Badge tone={orderStatusTone(o.status)} dot>{ORDER_STATUS_LABELS[o.status] || o.status}</Badge></>}
                    trail={<span className="ws-amount">{fmt(o.totalAmount)}</span>}
                    onClick={() => setViewOrder(o)}
                  />
                ))}
              </List>
            )}
          </div>
        )}
      </Dialog>

      <CustomerFormDialog open={formOpen} onClose={() => setFormOpen(false)} customer={editing} onSaved={onChanged} />
      <OrderDetailsDialog order={viewOrder} items={viewOrder ? orderItems.filter(i => i.orderId === viewOrder.id) : []} currency={settings.currency} taxRate={settings.taxRate} onClose={() => setViewOrder(null)} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { store.deleteCustomer(deleteTarget.id); onChanged(); } }}
        title={`Delete ${deleteTarget?.name || 'member'}?`}
        description="They leave the club. Their past orders stay in your sales under the same name, but no longer count as member visits."
      />
    </Page>
  );
}
