import React, { useEffect, useMemo, useState } from 'react';
import { Award, Contact, Pencil, Phone, Settings2, SlidersHorizontal, Trash2, UserPlus, X } from 'lucide-react';
import { CategorySelect, CustomerSelect, OrderItemSelect, OrderSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { normalizePhone } from '../services/customers';
import {
  AffixInput, Avatar, Badge, Button, Card, Checkbox, ConfirmDialog, Dialog, EmptyState, Field, FormDialog, IconButton, Input, KeyValue, List, ListItem,
  Notice, Page, PageHeader, SearchInput, Segmented, Stat, StatGrid, Textarea, ToggleRow, formatDate, money, orderStatusTone, plural, ORDER_STATUS_LABELS
} from '../ui';
import { OrderDetailsDialog } from './shared';
import { parseLoyalty, pointsOn, stampProgress, stampsOn, type LoyaltySettings } from '../utils/loyalty';
import { tr } from '../i18n';

/** "3 of 8 stamps · 12 points", or '' when the club has no stamp card or points. */
export function balanceLabel(loyalty: LoyaltySettings, member: Pick<CustomerSelect, 'stamps' | 'points'>) {
  const parts: string[] = [];
  if (stampsOn(loyalty)) {
    const { rewards, onCard, per } = stampProgress(loyalty, member.stamps || 0);
    parts.push(rewards ? tr('{count} free ready · {onCard} of {per} stamps', { count: rewards, onCard, per }) : tr('{onCard} of {per} stamps', { onCard, per }));
  }
  if (pointsOn(loyalty)) parts.push(plural(member.points || 0, 'point'));
  return parts.join(' · ');
}

/** The stamp card as dots: filled for each stamp on the current card. */
export function StampCard({ loyalty, stamps }: { loyalty: LoyaltySettings; stamps: number }) {
  const { rewards, onCard, per } = stampProgress(loyalty, stamps);
  return (
    <div className="ws-stamp-card" role="img" aria-label={tr('{onCard} of {per} stamps', { onCard, per })}>
      {Array.from({ length: per }, (_, i) => <span key={i} className="ws-stamp" data-on={i < onCard || undefined} />)}
      {rewards > 0 && <Badge tone="positive" icon={<Award />}>{plural(rewards, 'free item')}</Badge>}
    </div>
  );
}

interface LedgerEntry { id: string; orderId: string | null; orderNumber: string | null; kind: 'earn' | 'redeem' | 'adjust'; stamps: number; points: number; note: string; createdAt: string }

/** The club's rules: the stamp card, points, and what each is worth. Saved with the café settings. */
function ClubRulesDialog({ open, onClose, settings, categories, onSaved }: { open: boolean; onClose: () => void; settings: SettingsSelect; categories: CategorySelect[]; onSaved: () => void }) {
  const [rules, setRules] = useState(() => parseLoyalty(settings.loyalty));
  const [stamps, setStamps] = useState('');
  const [spend, setSpend] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const current = parseLoyalty(settings.loyalty);
    setRules(current); setStamps(current.stampsPerReward ? String(current.stampsPerReward) : '');
    setSpend(current.spendPerPoint ? String(current.spendPerPoint) : ''); setValue(current.pointValue ? String(current.pointValue) : ''); setError('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = parseLoyalty({ ...rules, stampsPerReward: parseInt(stamps, 10) || 0, spendPerPoint: parseFloat(spend) || 0, pointValue: parseFloat(value) || 0 });
    if (next.enabled && !stampsOn(next) && !pointsOn(next)) return setError(tr('Set up a stamp card, points, or both.'));
    setSaving(true); setError('');
    try {
      await store.saveSettings({ ...settings, loyalty: JSON.stringify(next) });
      onSaved(); onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('The rules could not be saved.'));
    } finally { setSaving(false); }
  };
  const toggle = (id: string) => setRules(r => ({ ...r, stampCategoryIds: r.stampCategoryIds.includes(id) ? r.stampCategoryIds.filter(c => c !== id) : [...r.stampCategoryIds, id] }));
  return (
    <FormDialog open={open} onClose={onClose} busy={saving} title={tr('Club rewards')} description={tr('Members earn when an order linked to them is completed. Cancelled orders give back what they spent.')} submitLabel={tr('Save rules')} onSubmit={submit}>
      {error && <Notice tone="danger">{error}</Notice>}
      <ToggleRow icon={<Award />} title={tr('Rewards on')} description={tr('Off keeps balances but stops earning and spending.')} checked={rules.enabled} onChange={enabled => setRules(r => ({ ...r, enabled }))} />
      <Field label={tr('Stamps for a free item')} hint={tr('A stamp for each paid item in the categories below. 0 for no stamp card.')}>{(id, hint) => <Input id={id} aria-describedby={hint} type="number" inputMode="numeric" min="0" max="50" step="1" value={stamps} onChange={e => setStamps(e.target.value)} placeholder="8" />}</Field>
      <div className="ws-field">
        <span className="ws-label">{tr('Stamp categories')}</span>
        <div className="ws-check-grid">
          {categories.map(c => <Checkbox key={c.id} checked={rules.stampCategoryIds.includes(c.id)} onChange={() => toggle(c.id)}>{c.name}</Checkbox>)}
        </div>
        <span className="ws-hint">{rules.stampCategoryIds.length ? tr('Only these earn stamps and can be the free item.') : tr('None picked: every category.')}</span>
      </div>
      <div className="ws-form-row cols-2">
        <Field label={tr('Spend for one point')} hint={tr('Empty for no points.')}>{(id, hint) => <AffixInput id={id} aria-describedby={hint} affix={settings.currency} type="number" inputMode="decimal" min="0" step="any" value={spend} onChange={e => setSpend(e.target.value)} />}</Field>
        <Field label={tr('One point is worth')}>{id => <AffixInput id={id} affix={settings.currency} type="number" inputMode="decimal" min="0" step="any" value={value} onChange={e => setValue(e.target.value)} />}</Field>
      </div>
    </FormDialog>
  );
}

/** Adds or takes away stamps and points by hand, with the reason kept in the member's history. */
function AdjustBalanceDialog({ member, onClose, onSaved }: { member: CustomerSelect | null; onClose: () => void; onSaved: () => void }) {
  const [stamps, setStamps] = useState('');
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (member) { setStamps(''); setPoints(''); setNote(''); setError(''); } }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setSaving(true); setError('');
    try {
      await store.adjustMemberBalance(member.id, { stamps: parseInt(stamps, 10) || 0, points: parseInt(points, 10) || 0, note: note.trim() });
      onSaved(); onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('The balance could not be changed.'));
    } finally { setSaving(false); }
  };
  return (
    <FormDialog open={!!member} onClose={onClose} busy={saving} size="sm" title={tr('Adjust balance')} description={member ? tr('{name} has {balance}.', { name: member.name, balance: `${plural(member.stamps || 0, 'stamp')}, ${plural(member.points || 0, 'point')}` }) : undefined}
      submitLabel={tr('Save')} submitDisabled={(!parseInt(stamps, 10) && !parseInt(points, 10)) || !note.trim()} onSubmit={submit}>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="ws-form-row cols-2">
        <Field label={tr('Stamps')} hint={tr('Below zero takes away')}>{(id, hint) => <Input id={id} aria-describedby={hint} type="number" inputMode="numeric" step="1" value={stamps} onChange={e => setStamps(e.target.value)} placeholder="+1" />}</Field>
        <Field label={tr('Points')}>{id => <Input id={id} type="number" inputMode="numeric" step="1" value={points} onChange={e => setPoints(e.target.value)} placeholder="0" />}</Field>
      </div>
      <Field label={tr('Reason')}>{id => <Input id={id} required maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder={tr('e.g. Paper card brought in')} />}</Field>
    </FormDialog>
  );
}

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
      setError(err instanceof Error ? err.message : tr('The member could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      busy={saving}
      title={customer ? tr('Edit {name}', { name: customer.name }) : tr('New club member')}
      description={customer ? undefined : tr('Members are found by phone number at the till.')}
      submitLabel={customer ? tr('Save changes') : tr('Add member')}
      submitDisabled={!name.trim() || normalizePhone(phone).replace('+', '').length < 5}
      onSubmit={submit}
    >
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
      <Field label={tr('Name')}>{id => <Input id={id} autoFocus={!name} value={name} onChange={e => setName(e.target.value)} required maxLength={100} autoComplete="off" />}</Field>
      <Field label={tr('Phone')} hint={tr('Spaces and dashes are ignored.')}>{id => <Input id={id} autoFocus={!!name && !phone} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={30} autoComplete="off" />}</Field>
      <Field label={tr('Notes')} optional>{id => <Textarea id={id} rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} placeholder={tr('Usual order, allergies, birthday…')} />}</Field>
    </FormDialog>
  );
}

/* ------------------------------------------------------- Order picker */

/**
 * The till's "Customer or table" field: free text still works for tables and walk-ins,
 * and typing a name or phone offers club members to link the order to.
 */
export function CustomerPicker({ customers, orders, text, onTextChange, member, onMemberChange, allowSignUp = true, loyalty }: {
  customers: CustomerSelect[]; orders: OrderSelect[];
  /** The club's rules, to show a linked member's stamps and points. */
  loyalty?: LoyaltySettings;
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
      <Field label={tr('Customer')}>{() => (
        <div className="ws-member-chip">
          <Avatar name={member.name} />
          <div className="ws-list-main">
            <div className="ws-list-title">{member.name} <Badge tone="positive">{tr('Member')}</Badge></div>
            <div className="ws-list-sub"><span className="tabular">{member.phone}</span><span>{visitsLabel(s)}</span>{loyalty?.enabled && balanceLabel(loyalty, member) && <span>{balanceLabel(loyalty, member)}</span>}</div>
          </div>
          <IconButton label={tr('Unlink {name}', { name: member.name })} onClick={() => onMemberChange(null)}><X /></IconButton>
        </div>
      )}</Field>
    );
  }
  return (
    <>
      <Field label={tr('Customer or table')} optional hint={query.length >= 2 && !matches.length ? tr('No club member matches.') : tr('Type a name or phone to find a club member.')}>{id => (
        <Input id={id} value={text} onChange={e => onTextChange(e.target.value)} placeholder={tr('Walk-in')} autoComplete="off" />
      )}</Field>
      {query.length >= 2 && (matches.length > 0 || allowSignUp) && (
        <div className="ws-member-matches">
          {matches.length > 0 && (
            <List label={tr('Matching club members')}>
              {matches.map(c => (
                <ListItem key={c.id} lead={<Avatar name={c.name} />} title={c.name} subtitle={<><span className="tabular">{c.phone}</span><span>{visitsLabel(stats.get(c.id) || NO_VISITS)}</span></>} onClick={() => pick(c)} label={tr('Link order to {name}', { name: c.name })} />
              ))}
            </List>
          )}
          {allowSignUp && <Button variant="ghost" size="sm" icon={<UserPlus />} onClick={() => setSignUpOpen(true)}>{tr('Add “{query}” to the club', { query })}</Button>}
        </div>
      )}
      {allowSignUp && <CustomerFormDialog open={signUpOpen} onClose={() => setSignUpOpen(false)} initialQuery={query} onSaved={pick} />}
    </>
  );
}

/* --------------------------------------------------------- Directory */

type SortKey = 'name' | 'visits' | 'recent';

export function CustomerClub({ settings, customers, orders, orderItems, categories = [], canDelete, onChanged }: {
  settings: SettingsSelect; customers: CustomerSelect[]; orders: OrderSelect[]; orderItems: OrderItemSelect[]; categories?: CategorySelect[];
  /** Only the admin removes members, sets the club's rewards and adjusts balances; the panel can add and correct members. */
  canDelete: boolean; onChanged: () => void;
}) {
  const fmt = (v: number) => money(v, settings.currency);
  const loyalty = parseLoyalty(settings.loyalty);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<CustomerSelect | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const stats = useCustomerStats(orders);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerSelect | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerSelect | null>(null);
  const [viewOrder, setViewOrder] = useState<OrderSelect | null>(null);
  const viewing = customers.find(c => c.id === viewingId) || null;
  const balanceKey = viewing ? `${viewing.id}:${viewing.stamps}:${viewing.points}` : '';
  useEffect(() => {
    if (!viewing || !loyalty.enabled) { setLedger(null); return; }
    let live = true;
    fetch(`/api/customers/${encodeURIComponent(viewing.id)}/ledger`).then(r => r.json() as Promise<{ data?: LedgerEntry[] }>).then(result => { if (live) setLedger(result.data || []); }).catch(() => { if (live) setLedger([]); });
    return () => { live = false; };
  }, [balanceKey, loyalty.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

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
        title={tr('Customer club')}
        description={tr('Members are linked to orders at the till by name or phone. Visits and spend count completed orders.')}
        actions={<>
          {canDelete && <Button icon={<Settings2 />} onClick={() => setRulesOpen(true)}>{tr('Rewards')}</Button>}
          <Button variant="primary" icon={<UserPlus />} onClick={() => openForm(null)}>{tr('New member')}</Button>
        </>}
      />
      {canDelete && !loyalty.enabled && <Notice tone="info" action={<Button size="sm" variant="ghost" onClick={() => setRulesOpen(true)}>{tr('Set up')}</Button>}>{tr('Reward regulars with a stamp card or points. Members earn on every completed order.')}</Notice>}
      <StatGrid>
        <Stat label={tr('Members')} value={customers.length} />
        <Stat label={tr('Joined this month')} value={newThisMonth} tone={newThisMonth ? 'positive' : 'neutral'} />
        <Stat label={tr('Returning')} value={returning} hint={tr('2 or more visits')} />
        <Stat label={tr('Member spend')} value={fmt(clubSpend)} />
      </StatGrid>

      <Card flush title={tr('Members')} description={search.trim() ? tr('{length} of {length2}', { length: visible.length, length2: customers.length }) : plural(customers.length, 'member')}>
        {customers.length > 0 && (
          <div className="ws-toolbar" style={{ padding: '0 var(--ws-pad) var(--chth-space-12)' }}>
            <SearchInput className="ws-grow" value={search} onChange={setSearch} placeholder={tr('Search name or phone')} label={tr('Search members')} />
            <Segmented label={tr('Sort members')} value={sort} onChange={setSort} options={[
              { value: 'name', label: 'A–Z' }, { value: 'visits', label: tr('Top') }, { value: 'recent', label: tr('Recent') }
            ]} />
          </div>
        )}
        {customers.length === 0 ? (
          <EmptyState icon={<Contact />} title={tr('No club members yet')} description={tr('Add members here, or from the New order screen while taking an order.')} action={<Button variant="primary" icon={<UserPlus />} onClick={() => openForm(null)}>{tr('Add the first member')}</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon={<Contact />} title={tr('No members match')} description={tr('Nothing found for “{search}”.', { search: search.trim() })} />
        ) : (
          <List label={tr('Club members')}>
            {visible.map(c => {
              const s = statsOf(c.id);
              return (
                <ListItem
                  key={c.id}
                  lead={<Avatar name={c.name} />}
                  title={c.name}
                  subtitle={<><span className="tabular">{c.phone}</span><span>{visitsLabel(s)}</span>{loyalty.enabled && balanceLabel(loyalty, c) && <span>{balanceLabel(loyalty, c)}</span>}</>}
                  trail={<>{loyalty.enabled && stampsOn(loyalty) && stampProgress(loyalty, c.stamps || 0).rewards > 0 && <Badge tone="positive" icon={<Award />}>{tr('Free item')}</Badge>}<span className="ws-amount">{fmt(s.spend)}</span></>}
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
        open={!!viewing && !formOpen && !viewOrder && !adjusting}
        onClose={() => setViewingId(null)}
        title={viewing?.name || ''}
        description={viewing ? tr('Member since {createdAt}', { createdAt: formatDate(viewing.createdAt, { dateStyle: 'medium' }) }) : undefined}
        footer={viewing && <>
          {canDelete && <span className="ws-spacer"><Button variant="danger-ghost" icon={<Trash2 />} onClick={() => { setDeleteTarget(viewing); setViewingId(null); }}>{tr('Delete')}</Button></span>}
          <Button icon={<Pencil />} onClick={() => openForm(viewing)}>{tr('Edit')}</Button>
          <Button variant="primary" onClick={() => setViewingId(null)}>{tr('Done')}</Button>
        </>}
      >
        {viewing && (
          <div className="ws-form">
            <a className="ws-member-phone tabular" href={`tel:${viewing.phone}`}><Phone aria-hidden="true" />{viewing.phone}</a>
            <KeyValue items={[
              { label: tr('Visits'), value: statsOf(viewing.id).visits },
              { label: tr('Last visit'), value: statsOf(viewing.id).lastVisit ? formatDate(statsOf(viewing.id).lastVisit!, { dateStyle: 'medium' }) : '—' },
              { label: tr('Average order'), value: statsOf(viewing.id).visits ? fmt(statsOf(viewing.id).spend / statsOf(viewing.id).visits) : '—' }
            ]} total={{ label: tr('Total spend'), value: fmt(statsOf(viewing.id).spend) }} />
            {viewing.notes && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{viewing.notes}</p>}
            {loyalty.enabled && (
              <div className="ws-panel ws-form">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{tr('Rewards')}</strong>
                  {canDelete && <Button size="sm" variant="ghost" icon={<SlidersHorizontal />} onClick={() => setAdjusting(viewing)}>{tr('Adjust')}</Button>}
                </div>
                {stampsOn(loyalty) && <StampCard loyalty={loyalty} stamps={viewing.stamps || 0} />}
                {pointsOn(loyalty) && <span className="tabular">{tr('{points}, worth {value}', { points: plural(viewing.points || 0, 'point'), value: fmt((viewing.points || 0) * loyalty.pointValue) })}</span>}
                {ledger && ledger.length > 0 && (
                  <ul className="ws-ledger" aria-label={tr('Rewards history')}>
                    {ledger.slice(0, 12).map(entry => (
                      <li key={entry.id}>
                        <span>{entry.kind === 'earn' ? tr('Earned on {order}', { order: entry.orderNumber || '' }) : entry.kind === 'redeem' ? tr('Spent on {order}', { order: entry.orderNumber || '' }) : entry.note || tr('Adjusted')}</span>
                        <span className="tabular" data-tone={entry.stamps + entry.points >= 0 ? 'positive' : 'danger'}>
                          {[entry.stamps ? `${entry.stamps > 0 ? '+' : ''}${plural(entry.stamps, 'stamp')}` : '', entry.points ? `${entry.points > 0 ? '+' : ''}${plural(entry.points, 'point')}` : ''].filter(Boolean).join(' · ')}
                        </span>
                        <span className="ws-hint">{formatDate(entry.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {memberOrders.length === 0 ? <p className="ws-hint">{tr('No orders linked yet.')}</p> : (
              <List label={tr('Orders for {name}', { name: viewing.name })} maxHeight={280}>
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
      {canDelete && <ClubRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} settings={settings} categories={categories} onSaved={onChanged} />}
      <AdjustBalanceDialog member={adjusting} onClose={() => setAdjusting(null)} onSaved={onChanged} />
      <OrderDetailsDialog order={viewOrder} items={viewOrder ? orderItems.filter(i => i.orderId === viewOrder.id) : []} currency={settings.currency} taxRate={settings.taxRate} onClose={() => setViewOrder(null)} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { store.deleteCustomer(deleteTarget.id); onChanged(); } }}
        title={tr('Delete {value}?', { value: deleteTarget?.name || 'member' })}
        description={tr('They leave the club. Their past orders stay in your sales under the same name, but no longer count as member visits.')}
      />
    </Page>
  );
}
