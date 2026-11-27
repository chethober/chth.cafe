import React, { useState } from 'react';
import { BadgePercent, CalendarClock, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { CategorySelect, MenuItemSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import {
  AffixInput, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, FormDialog, IconButton, Input, List, ListItem, Notice, Page, PageHeader,
  Segmented, Stat, StatGrid, Switch, ToggleRow, money, plural
} from '../ui';
import { cafeClock, describePromotion, promotionError, promotionHours, promotionLive, type Promotion } from '../utils/promotions';
import { intlTag, tr } from '../i18n';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
export const weekdayName = (day: number, width: 'short' | 'long' = 'short') =>
  new Date(Date.UTC(2023, 0, 1 + day)).toLocaleDateString(intlTag(), { weekday: width, timeZone: 'UTC' });

type Draft = Omit<Promotion, 'id' | 'createdAt' | 'updatedAt' | 'value'> & { id?: string; value: string };
const EMPTY: Draft = { name: '', kind: 'percent', value: '', categoryIds: [], itemIds: [], days: [], startTime: '', endTime: '', startsOn: '', endsOn: '', active: true };

/** Where a promotion stands right now, for its badge. */
function promotionState(p: Promotion, now: Date, timeZone: string): { label: string; tone: 'positive' | 'info' | 'neutral' | 'danger' } {
  if (!p.active) return { label: tr('Off'), tone: 'neutral' };
  if (promotionLive(p, now, timeZone)) return { label: tr('Running now'), tone: 'positive' };
  const today = cafeClock(now, timeZone).date;
  if (p.endsOn && p.endsOn < today) return { label: tr('Ended'), tone: 'danger' };
  return { label: tr('Scheduled'), tone: 'info' };
}

/** "Mon, Wed" or "Every day". */
const dayList = (days: number[]) => days.length === 0 || days.length === 7 ? tr('Every day') : DAYS.filter(d => days.includes(d)).map(d => weekdayName(d)).join(', ');

/** Happy hours and offers: what they take off, which items, and when. */
export function Promotions({ settings, categories, menuItems, promotions, onChanged }: {
  settings: SettingsSelect; categories: CategorySelect[]; menuItems: MenuItemSelect[]; promotions: Promotion[]; onChanged: () => void;
}) {
  const fmt = (v: number) => money(v, settings.currency);
  const timeZone = settings.timeZone || 'UTC';
  const now = new Date();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);

  const covers = (p: Pick<Promotion, 'categoryIds' | 'itemIds'>) => {
    if (!p.categoryIds.length && !p.itemIds.length) return tr('Whole menu');
    const names = [
      ...categories.filter(c => p.categoryIds.includes(c.id)).map(c => c.name),
      ...menuItems.filter(i => p.itemIds.includes(i.id)).map(i => i.name)
    ];
    return names.length > 3 ? tr('{names} and {count} more', { names: names.slice(0, 3).join(', '), count: names.length - 3 }) : names.join(', ');
  };

  const open = (p?: Promotion) => {
    setDraft(p ? { ...p, value: String(p.value) } : { ...EMPTY });
    setError('');
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || saving) return;
    const input = { ...draft, name: draft.name.trim(), value: parseFloat(draft.value) || 0 };
    const problem = promotionError({ ...input, id: '', createdAt: '', updatedAt: '' });
    if (problem) return setError(tr(problem));
    setSaving(true); setError('');
    try {
      await store.savePromotion(input);
      setDraft(null);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('The promotion could not be saved.'));
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (p: Promotion) => {
    try { await store.savePromotion({ ...p, active: !p.active }); onChanged(); }
    catch { /* the list shows the saved state again */ }
  };
  const toggleIn = <T,>(list: T[], value: T) => list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  const running = promotions.filter(p => promotionLive(p, now, timeZone)).length;
  const active = promotions.filter(p => p.active).length;

  return (
    <Page>
      <PageHeader
        title={tr('Promotions')}
        description={tr('Happy hours and offers. The public menu and the till take the best running promotion off each item; promotions never stack.')}
        actions={<Button variant="primary" icon={<Plus />} onClick={() => open()}>{tr('New promotion')}</Button>}
      />
      <StatGrid columns={3}>
        <Stat label={tr('Running now')} icon={<BadgePercent />} value={running} tone={running ? 'positive' : 'neutral'} />
        <Stat label={tr('Switched on')} icon={<CalendarClock />} value={active} />
        <Stat label={tr('Switched off')} value={promotions.length - active} />
      </StatGrid>
      <Card flush>
        {promotions.length === 0 ? (
          <EmptyState icon={<BadgePercent />} title={tr('No promotions yet')} description={tr('Set up a happy hour, such as 20% off cold drinks from 15:00 to 17:00 on weekdays.')}
            action={<Button variant="primary" icon={<Plus />} onClick={() => open()}>{tr('New promotion')}</Button>} />
        ) : (
          <List label={tr('Promotions')}>
            {promotions.map(p => {
              const state = promotionState(p, now, timeZone);
              const hours = promotionHours(p);
              return (
                <ListItem
                  key={p.id}
                  dim={!p.active}
                  onClick={() => open(p)}
                  label={tr('Edit {name}', { name: p.name })}
                  title={<><span className="ws-truncate">{p.name}</span><Badge tone={state.tone} dot>{state.label}</Badge></>}
                  subtitle={<>
                    <span>{covers(p)}</span>
                    <span><Clock />{dayList(p.days)}{hours && ` · ${hours}`}</span>
                    {(p.startsOn || p.endsOn) && <span className="tabular">{p.startsOn || '…'} – {p.endsOn || '…'}</span>}
                  </>}
                  trail={<span className="ws-amount">{describePromotion(p, fmt)}</span>}
                  actions={<>
                    <Switch label={tr('{name} switched on', { name: p.name })} checked={p.active} onChange={() => { void toggle(p); }} />
                    <IconButton label={tr('Edit {name}', { name: p.name })} onClick={() => open(p)}><Pencil /></IconButton>
                    <IconButton label={tr('Delete {name}', { name: p.name })} variant="danger-ghost" onClick={() => setDeleteTarget(p)}><Trash2 /></IconButton>
                  </>}
                />
              );
            })}
          </List>
        )}
      </Card>

      <FormDialog
        open={!!draft}
        onClose={() => setDraft(null)}
        busy={saving}
        size="lg"
        title={draft?.id ? tr('Edit {name}', { name: draft.name }) : tr('New promotion')}
        description={tr('Times and dates follow the café\'s time zone ({timeZone}).', { timeZone })}
        submitLabel={draft?.id ? tr('Save changes') : tr('Create promotion')}
        onSubmit={save}
      >
        {draft && <>
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label={tr('Name')} hint={tr('Shown to customers, e.g. Happy hour')}>{(id, hint) => <Input id={id} aria-describedby={hint} autoFocus required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />}</Field>
          <div className="ws-form-row cols-2">
            <Field label={tr('Discount')} aside={<Segmented label={tr('Discount type')} value={draft.kind} onChange={kind => setDraft({ ...draft, kind })} options={[{ value: 'percent', label: '%' }, { value: 'fixed', label: settings.currency }]} />}>{id => (
              <AffixInput id={id} affix={draft.kind === 'percent' ? '%' : settings.currency} type="number" inputMode="decimal" min="0" step="0.01" max={draft.kind === 'percent' ? 100 : undefined} required value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} />
            )}</Field>
            <ToggleRow title={tr('Switched on')} description={tr('Off keeps it here without applying it.')} checked={draft.active} onChange={active => setDraft({ ...draft, active })} />
          </div>
          <div className="ws-field">
            <span className="ws-label">{tr('Days')}</span>
            <div className="ws-day-picks" role="group" aria-label={tr('Days')}>
              {DAYS.map(d => (
                <button key={d} type="button" className="ws-day-pick" aria-pressed={draft.days.includes(d)} onClick={() => setDraft({ ...draft, days: toggleIn(draft.days, d).sort() })}>{weekdayName(d)}</button>
              ))}
            </div>
            <span className="ws-hint">{draft.days.length ? dayList(draft.days) : tr('None picked: every day')}</span>
          </div>
          <div className="ws-form-row cols-2">
            <Field label={tr('From')} optional hint={tr('Leave both times empty for all day. An end before the start runs past midnight.')}>{(id, hint) => <Input id={id} aria-describedby={hint} type="time" value={draft.startTime} onChange={e => setDraft({ ...draft, startTime: e.target.value })} />}</Field>
            <Field label={tr('Until')} optional>{id => <Input id={id} type="time" value={draft.endTime} onChange={e => setDraft({ ...draft, endTime: e.target.value })} />}</Field>
          </div>
          <div className="ws-form-row cols-2">
            <Field label={tr('First day')} optional>{id => <Input id={id} type="date" value={draft.startsOn} onChange={e => setDraft({ ...draft, startsOn: e.target.value })} />}</Field>
            <Field label={tr('Last day')} optional>{id => <Input id={id} type="date" min={draft.startsOn || undefined} value={draft.endsOn} onChange={e => setDraft({ ...draft, endsOn: e.target.value })} />}</Field>
          </div>
          <details className="ws-translations" open={draft.categoryIds.length + draft.itemIds.length > 0 || undefined}>
            <summary><BadgePercent aria-hidden="true" /><span>{tr('Applies to')}</span><span className="ws-hint">{covers(draft)}</span></summary>
            <p className="ws-hint">{tr('Pick categories, single items, or both. Pick nothing for the whole menu.')}</p>
            {categories.map(c => {
              const items = menuItems.filter(i => i.categoryId === c.id);
              return (
                <div key={c.id} className="ws-translation">
                  <Checkbox checked={draft.categoryIds.includes(c.id)} onChange={() => setDraft({ ...draft, categoryIds: toggleIn(draft.categoryIds, c.id) })}>
                    <strong>{c.name}</strong> <span className="ws-hint">{tr('Every item, {count}', { count: plural(items.length, 'item') })}</span>
                  </Checkbox>
                  {!draft.categoryIds.includes(c.id) && items.length > 0 && (
                    <div className="ws-check-grid">
                      {items.map(i => <Checkbox key={i.id} checked={draft.itemIds.includes(i.id)} onChange={() => setDraft({ ...draft, itemIds: toggleIn(draft.itemIds, i.id) })}>{i.name}</Checkbox>)}
                    </div>
                  )}
                </div>
              );
            })}
          </details>
        </>}
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { store.deletePromotion(deleteTarget.id); onChanged(); } }}
        title={tr('Delete {value}?', { value: deleteTarget?.name || '' })}
        description={tr('Orders already placed keep their discount. To pause it instead, switch it off.')}
      />
    </Page>
  );
}
