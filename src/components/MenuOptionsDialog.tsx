import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MenuItemSelect, MenuVariantSelect, StockItemSelect, VariantStockDelta } from '../db/schema';
import { store } from '../db/store';
import { AffixInput, Button, Dialog, Field, IconButton, Input, Notice, Select, money } from '../ui';
import { tr } from '../i18n';

interface DraftOption { id: string; group: string; name: string; price: string; stock: { stockItemId: string; quantity: string }[] }
interface DraftGroup { key: string; name: string }

const newOption = (group: string): DraftOption => ({ id: `var-${crypto.randomUUID()}`, group, name: '', price: '', stock: [] });

/**
 * An item's options, such as milk or size, grouped as customers choose them: one option from each group.
 * Each option can change the price and what the drink takes from stock, e.g. oat milk instead of dairy.
 */
export function MenuOptionsDialog({ item, variants, stock, currency, onClose, onSaved }: {
  item: MenuItemSelect | null; variants: MenuVariantSelect[]; stock: StockItemSelect[]; currency: string; onClose: () => void; onSaved: () => void;
}) {
  const fmt = (v: number) => money(v, currency);
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [options, setOptions] = useState<DraftOption[]>([]);
  const [newGroup, setNewGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!item) return;
    const own = variants.filter(v => v.menuItemId === item.id);
    const named = [...new Set(own.map(v => v.groupName))].map(name => ({ key: crypto.randomUUID(), name }));
    setGroups(named);
    setOptions(own.map(v => ({
      id: v.id, group: named.find(g => g.name === v.groupName)!.key, name: v.name, price: v.priceModifier ? String(v.priceModifier) : '',
      stock: (v.stock || []).map(s => ({ stockItemId: s.stockItemId, quantity: String(s.quantity) }))
    })));
    setNewGroup(''); setError('');
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id: string, change: Partial<DraftOption>) => setOptions(prev => prev.map(o => o.id === id ? { ...o, ...change } : o));
  const groupName = (key: string) => groups.find(g => g.key === key)?.name.trim() || '';
  const unitCost = (id: string) => stock.find(s => s.id === id)?.unitCost || 0;
  const costChange = (o: DraftOption) => o.stock.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0) * unitCost(s.stockItemId), 0);

  const save = async () => {
    if (!item || saving) return;
    const names = new Set<string>();
    if (new Set(groups.map(g => g.name.trim())).size !== groups.length) return setError(tr('Two groups have the same name.'));
    for (const o of options) {
      if (!groupName(o.group) || !o.name.trim()) return setError(tr('Every option needs a group and a name.'));
      const key = `${groupName(o.group)}\u0000${o.name.trim()}`;
      if (names.has(key)) return setError(tr('“{name}” appears twice in {group}.', { name: o.name.trim(), group: groupName(o.group) }));
      names.add(key);
      if (o.stock.some(s => !s.stockItemId || !(parseFloat(s.quantity) || 0))) return setError(tr('Enter how much each material changes for {name}, above or below zero.', { name: o.name.trim() }));
    }
    const next: MenuVariantSelect[] = options.map(o => ({
      id: o.id, menuItemId: item.id, groupName: groupName(o.group), name: o.name.trim(), priceModifier: Number((parseFloat(o.price) || 0).toFixed(2)),
      stock: o.stock.map<VariantStockDelta>(s => ({ stockItemId: s.stockItemId, quantity: parseFloat(s.quantity) }))
    }));
    setSaving(true); setError('');
    try {
      await store.saveMenuItemOptions(item.id, next);
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('The options could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      size="lg"
      busy={saving}
      title={item ? tr('Options · {name}', { name: item.name }) : ''}
      description={tr('Customers pick one option from each group. A recipe change is added to (or, below zero, taken off) the item\'s recipe, so stock and cost follow the choice.')}
      footer={<><Button variant="ghost" onClick={onClose}>{tr('Cancel')}</Button><Button variant="primary" loading={saving} onClick={save}>{tr('Save options')}</Button></>}
    >
      <div className="ws-form">
        {error && <Notice tone="danger">{error}</Notice>}
        {groups.length === 0 && <div className="ws-lane-empty">{tr('No options yet. Add a group such as Milk or Size.')}</div>}
        {groups.map(group => (
          <section key={group.key} className="ws-options-group">
            <div className="ws-options-group-head">
              <Field label={tr('Group')}>{id => <Input id={id} value={group.name} maxLength={60} onChange={e => setGroups(prev => prev.map(g => g.key === group.key ? { ...g, name: e.target.value } : g))} />}</Field>
              <Button size="sm" icon={<Plus />} onClick={() => setOptions(prev => [...prev, newOption(group.key)])}>{tr('Option')}</Button>
              <IconButton label={tr('Remove the {name} group', { name: group.name })} variant="danger-ghost" onClick={() => { setGroups(prev => prev.filter(g => g.key !== group.key)); setOptions(prev => prev.filter(o => o.group !== group.key)); }}><Trash2 /></IconButton>
            </div>
            {options.filter(o => o.group === group.key).map(o => (
              <div key={o.id} className="ws-option">
                <div className="ws-option-row">
                  <Input aria-label={tr('Option name')} placeholder={tr('e.g. Oat milk')} maxLength={100} value={o.name} onChange={e => update(o.id, { name: e.target.value })} />
                  <AffixInput affix={currency} aria-label={tr('Price change for {name}', { name: o.name || tr('this option') })} type="number" inputMode="decimal" step="0.01" placeholder="0" value={o.price} onChange={e => update(o.id, { price: e.target.value })} />
                  <IconButton label={tr('Remove {name}', { name: o.name || tr('this option') })} variant="danger-ghost" onClick={() => setOptions(prev => prev.filter(x => x.id !== o.id))}><Trash2 /></IconButton>
                </div>
                {o.stock.map((s, index) => {
                  const material = stock.find(m => m.id === s.stockItemId);
                  return (
                    <div key={index} className="ws-option-stock">
                      <Select aria-label={tr('Material')} value={s.stockItemId} onChange={e => update(o.id, { stock: o.stock.map((x, i) => i === index ? { ...x, stockItemId: e.target.value } : x) })}>
                        {stock.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </Select>
                      <AffixInput affix={material?.unit || ''} aria-label={tr('Change in {name} per portion', { name: material?.name || tr('material') })} type="number" inputMode="decimal" step="any" placeholder="+0.25 / −0.25"
                        value={s.quantity} onChange={e => update(o.id, { stock: o.stock.map((x, i) => i === index ? { ...x, quantity: e.target.value } : x) })} />
                      <IconButton label={tr('Remove {name}', { name: material?.name || tr('material') })} onClick={() => update(o.id, { stock: o.stock.filter((_, i) => i !== index) })}><Trash2 /></IconButton>
                    </div>
                  );
                })}
                <div className="ws-option-foot">
                  {stock.length > 0 && <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => update(o.id, { stock: [...o.stock, { stockItemId: stock.find(m => !o.stock.some(x => x.stockItemId === m.id))?.id || stock[0].id, quantity: '' }] })}>{tr('Recipe change')}</Button>}
                  {o.stock.length > 0 && <span className="ws-hint tabular">{tr('Cost {change} per portion', { change: `${costChange(o) >= 0 ? '+' : '−'}${fmt(Math.abs(costChange(o)))}` })}</span>}
                </div>
              </div>
            ))}
          </section>
        ))}
        <form className="ws-form-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'end' }}
          onSubmit={e => {
            e.preventDefault();
            const name = newGroup.trim();
            if (!name || groups.some(g => g.name.trim() === name)) return;
            const key = crypto.randomUUID();
            setGroups(prev => [...prev, { key, name }]); setOptions(prev => [...prev, newOption(key)]); setNewGroup('');
          }}>
          <Field label={tr('New group')} hint={tr('For an optional extra, add a “None” option at no charge.')}>{(id, hint) => <Input id={id} aria-describedby={hint} maxLength={60} value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder={tr('e.g. Milk')} />}</Field>
          <Button type="submit" icon={<Plus />} disabled={!newGroup.trim()}>{tr('Add group')}</Button>
        </form>
      </div>
    </Dialog>
  );
}
