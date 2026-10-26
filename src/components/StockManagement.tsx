import { InventoryMovements } from './InventoryMovements';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Check, Download, Package, Pencil, Plus, Tags, Trash2, Wallet, X, XCircle } from 'lucide-react';
import { StockItemSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { copyCSVToClipboard, downloadCSV, downloadJSON, downloadStyledExcel } from '../utils/exportUtils';
import {
  AffixInput, Badge, Button, Card, Checkbox, Chips, ConfirmDialog, Dialog, EmptyState, ExportDialog, Field, FormDialog, IconButton, Input, List, ListItem,
  Notice, Page, PageHeader, Progress, SearchInput, Segmented, Select, SortFilter, Stat, StatGrid, Stepper, localDateKey, money, plural, slug
} from '../ui';
import { MAX_STOCK_CATEGORY_LENGTH } from '../utils/stockCategories';

interface StockManagementProps {
  settings: SettingsSelect;
  stockItems: StockItemSelect[];
  onStockUpdated: () => void;
}

const NEW_CATEGORY = '__new__';
const MEASUREMENT_UNITS = ['kg', 'g', 'liters', 'ml', 'units', 'bags', 'packs'];
type Level = 'in_stock' | 'low_stock' | 'out_of_stock';
type SortField = 'quantity' | 'unitCost' | 'totalValuation' | 'name' | 'category';

export const stockLevel = (item: StockItemSelect): Level => item.quantity <= 0 ? 'out_of_stock' : item.quantity <= item.minThreshold ? 'low_stock' : 'in_stock';
const LEVEL_BADGE: Record<Level, { tone: 'positive' | 'warning' | 'danger'; label: string }> = {
  in_stock: { tone: 'positive', label: 'In stock' }, low_stock: { tone: 'warning', label: 'Low' }, out_of_stock: { tone: 'danger', label: 'Out' }
};
const step = (unit: string) => (unit === 'g' || unit === 'ml' ? 100 : 1);

export const StockManagement: React.FC<StockManagementProps> = ({ settings, stockItems, onStockUpdated }) => {
  const currency = settings.currency || '₹';
  const fmt = (v: number) => money(v, currency);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState<'all' | Level>('all');
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StockItemSelect | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const stockCategories = store.getStockCategories();

  /* ------------------------------------------------------- Add / edit */
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockItemSelect | null>(null);
  const [form, setForm] = useState({ name: '', category: '', newCategory: '', quantity: '', unit: 'kg', unitCost: '', minThreshold: '5' });
  const [formError, setFormError] = useState('');
  const openForm = (item?: StockItemSelect) => {
    setEditing(item || null);
    setForm(item
      ? { name: item.name, category: item.category, newCategory: '', quantity: String(item.quantity), unit: item.unit, unitCost: String(item.unitCost), minThreshold: String(item.minThreshold) }
      : { name: '', category: category !== 'all' ? category : stockCategories[0] || NEW_CATEGORY, newCategory: '', quantity: '', unit: 'kg', unitCost: '', minThreshold: '5' });
    setFormError('');
    setFormOpen(true);
  };
  const saveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseFloat(form.quantity);
    const unitCost = parseFloat(form.unitCost);
    const minThreshold = parseFloat(form.minThreshold);
    if (!form.name.trim()) return setFormError('Give the material a name.');
    if (Number.isNaN(quantity) || quantity < 0) return setFormError('Quantity must be zero or more.');
    if (Number.isNaN(unitCost) || unitCost < 0) return setFormError('Unit cost must be zero or more.');
    if (Number.isNaN(minThreshold) || minThreshold < 0) return setFormError('Low-stock level must be zero or more.');
    const typed = form.newCategory.trim().replace(/\s+/g, ' ');
    if (form.category === NEW_CATEGORY && !typed) return setFormError('Name the new category.');
    // A typed name that matches an existing category, in any case, files the material there.
    const materialCategory = form.category !== NEW_CATEGORY ? form.category
      : stockCategories.find(c => c.toLowerCase() === typed.toLowerCase()) || typed;
    const data = { name: form.name.trim(), category: materialCategory, quantity, unit: form.unit, unitCost, minThreshold };
    if (editing) store.updateStockItem(editing.id, data);
    else store.addStockItem(data);
    if (!stockCategories.includes(materialCategory)) {
      // The material already shows under it; this keeps the category once the material moves on.
      store.saveStockCategories([...stockCategories, materialCategory]).catch(() => {});
    }
    setFormOpen(false);
    onStockUpdated();
  };

  /* ------------------------------------------------------------ Metrics */
  const totalValue = stockItems.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const levelCount = (l: Level) => stockItems.filter(i => stockLevel(i) === l).length;
  // Problems first: out of stock, then low, then the rest by name.
  const levelRank: Record<Level, number> = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
  const visible = stockItems
    .filter(i => {
      const q = search.trim().toLowerCase();
      return (!q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
        && (category === 'all' || i.category === category)
        && (level === 'all' || stockLevel(i) === level);
    })
    .sort((a, b) => levelRank[stockLevel(a)] - levelRank[stockLevel(b)] || a.name.localeCompare(b.name));

  /* ------------------------------------------------------------- Export */
  const [xCategory, setXCategory] = useState('all');
  const [xLevel, setXLevel] = useState<'all' | Level>('all');
  const [xSort, setXSort] = useState<SortField>('totalValuation');
  const [xOrder, setXOrder] = useState<'asc' | 'desc'>('desc');
  const [xCost, setXCost] = useState(true);
  const [xThreshold, setXThreshold] = useState(true);
  const records = useMemo(() => stockItems
    .filter(i => (xCategory === 'all' || i.category === xCategory) && (xLevel === 'all' || stockLevel(i) === xLevel))
    .sort((a, b) => {
      const cmp = xSort === 'totalValuation' ? a.quantity * a.unitCost - b.quantity * b.unitCost
        : xSort === 'quantity' ? a.quantity - b.quantity
        : xSort === 'unitCost' ? a.unitCost - b.unitCost
        : xSort === 'name' ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category);
      return xOrder === 'desc' ? -cmp : cmp;
    }), [stockItems, xCategory, xLevel, xSort, xOrder]);
  const xValue = records.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const xLow = records.filter(i => stockLevel(i) === 'low_stock').length;
  const xOut = records.filter(i => stockLevel(i) === 'out_of_stock').length;
  const fileBase = `stock_inventory${xCategory !== 'all' ? `_${slug(xCategory)}` : ''}_${localDateKey()}`;
  const build = () => {
    const headers = ['Material ID', 'Material Name', 'Category', 'Quantity Available', 'Unit'];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['left', 'left', 'left', 'right', 'center'];
    if (xCost) { headers.push(`Unit Cost (${currency})`); columnAlignments.push('right'); }
    headers.push(`Total Valuation (${currency})`); columnAlignments.push('right');
    if (xThreshold) { headers.push('Min Threshold', 'Stock Status'); columnAlignments.push('right', 'center'); }
    const rows = records.map(i => {
      const row: (string | number)[] = [i.id, i.name, i.category, Number(i.quantity.toFixed(3)), i.unit];
      if (xCost) row.push(Number(i.unitCost.toFixed(2)));
      row.push(Number((i.quantity * i.unitCost).toFixed(2)));
      if (xThreshold) row.push(Number(i.minThreshold.toFixed(2)), stockLevel(i) === 'out_of_stock' ? 'OUT OF STOCK' : stockLevel(i) === 'low_stock' ? 'LOW STOCK ALERT' : 'Normal');
      return row;
    });
    return { headers, rows, columnAlignments };
  };

  return (
    <Page>
      <PageHeader
        title="Stock"
        description="Raw materials, what they're worth, and what needs reordering. Orders deduct recipes automatically."
        actions={<>
          <Button icon={<Download />} onClick={() => setExportOpen(true)}>Export</Button>
          <Button icon={<Tags />} onClick={() => setCategoriesOpen(true)}>Categories</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => openForm()}>Add material</Button>
        </>}
      />

      <StatGrid>
        <Stat label="Stock value" icon={<Wallet />} value={fmt(totalValue)} hint="Quantity × unit cost" />
        <Stat label="Materials" icon={<Package />} value={stockItems.length} onClick={() => setLevel('all')} active={level === 'all'} />
        <Stat label="Running low" icon={<AlertTriangle />} value={levelCount('low_stock')} tone={levelCount('low_stock') ? 'warning' : 'neutral'} onClick={() => setLevel('low_stock')} active={level === 'low_stock'} />
        <Stat label="Out of stock" icon={<XCircle />} value={levelCount('out_of_stock')} tone={levelCount('out_of_stock') ? 'danger' : 'neutral'} onClick={() => setLevel('out_of_stock')} active={level === 'out_of_stock'} />
      </StatGrid>

      <div className="ws-toolbar-stack">
        <div className="ws-toolbar">
          <SearchInput className="ws-grow" value={search} onChange={setSearch} placeholder="Search materials" label="Search materials" />
          <Segmented label="Stock level" value={level} onChange={setLevel} options={[
            { value: 'all', label: 'All' },
            { value: 'in_stock', label: 'In stock', count: levelCount('in_stock') },
            { value: 'low_stock', label: 'Low', count: levelCount('low_stock') },
            { value: 'out_of_stock', label: 'Out', count: levelCount('out_of_stock') }
          ]} />
        </div>
        <Chips label="Material category" value={category} onChange={setCategory} options={[
          { value: 'all', label: 'All categories' },
          ...stockCategories.map(c => ({ value: c, label: c, count: stockItems.filter(i => i.category === c).length }))
        ]} />
      </div>

      <Card flush title="Materials" description={`${visible.length} of ${stockItems.length} shown`}>
        {visible.length === 0 ? (
          <EmptyState icon={<Boxes />} title={stockItems.length ? 'Nothing matches' : 'No materials yet'}
            description={stockItems.length ? 'Try a different search or filter.' : 'Add the ingredients and supplies you buy, so recipes can track them.'}
            action={!stockItems.length && <Button variant="primary" icon={<Plus />} onClick={() => openForm()}>Add material</Button>} />
        ) : (
          <List label="Materials">
            {visible.map(item => {
              const l = stockLevel(item);
              const badge = LEVEL_BADGE[l];
              const fill = item.minThreshold > 0 ? item.quantity / (item.minThreshold * 3) : item.quantity > 0 ? 1 : 0;
              return (
                <ListItem
                  key={item.id}
                  title={<><span className="ws-truncate">{item.name}</span><Badge tone={badge.tone} dot>{badge.label}</Badge></>}
                  subtitle={<>
                    <span>{item.category}</span>
                    <span className="tabular">{fmt(item.unitCost)} / {item.unit}</span>
                    <span className="tabular">Worth {fmt(item.quantity * item.unitCost)}</span>
                  </>}
                  trail={<div style={{ width: 140 }}>
                    <div className="tabular" style={{ fontWeight: 600, marginBottom: 6 }}>{Number(item.quantity.toFixed(3))} {item.unit}</div>
                    <Progress value={fill} tone={badge.tone} label={`${item.name} stock level`} />
                    <div className="ws-hint tabular" style={{ marginTop: 4 }}>Reorder at {item.minThreshold} {item.unit}</div>
                  </div>}
                  actions={<>
                    <Stepper label={`${item.name} by ${step(item.unit)} ${item.unit}`} value={<span className="ws-hint">±{step(item.unit)}</span>}
                      onDecrement={() => { store.adjustStockQuantity(item.id, -step(item.unit)); onStockUpdated(); }}
                      onIncrement={() => { store.adjustStockQuantity(item.id, step(item.unit)); onStockUpdated(); }} />
                    <IconButton label={`Edit ${item.name}`} onClick={() => openForm(item)}><Pencil /></IconButton>
                    <IconButton label={`Delete ${item.name}`} variant="danger-ghost" onClick={() => setDeleteTarget(item)}><Trash2 /></IconButton>
                  </>}
                />
              );
            })}
          </List>
        )}
      </Card>

      <InventoryMovements items={stockItems} />

      <FormDialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit ${editing.name}` : 'Add material'} submitLabel={editing ? 'Save changes' : 'Add material'} onSubmit={saveForm}>
        {formError && <Notice tone="danger">{formError}</Notice>}
        <Field label="Name">{id => <Input id={id} autoFocus required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ceremonial matcha powder" />}</Field>
        <div className="ws-form-row cols-2">
          <Field label="Category">{id => (
            <Select id={id} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {stockCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value={NEW_CATEGORY}>New category…</option>
            </Select>
          )}</Field>
          <Field label="Unit">{id => (
            <Select id={id} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
              {MEASUREMENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          )}</Field>
        </div>
        {form.category === NEW_CATEGORY && (
          <Field label="New category name">{id => <Input id={id} autoFocus required maxLength={MAX_STOCK_CATEGORY_LENGTH} value={form.newCategory} onChange={e => setForm({ ...form, newCategory: e.target.value })} placeholder="e.g. Cleaning supplies" />}</Field>
        )}
        <div className="ws-form-row cols-3">
          <Field label="On hand">{id => <Input id={id} type="number" inputMode="decimal" step="any" min="0" required value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="0" />}</Field>
          <Field label="Cost per unit">{id => <AffixInput id={id} affix={currency} type="number" inputMode="decimal" step="any" min="0" required value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} placeholder="0.00" />}</Field>
          <Field label="Reorder at">{id => <Input id={id} type="number" inputMode="decimal" step="any" min="0" required value={form.minThreshold} onChange={e => setForm({ ...form, minThreshold: e.target.value })} />}</Field>
        </div>
        <div className="ws-panel" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="ws-hint">Stock value</span>
          <strong className="tabular">{fmt((parseFloat(form.quantity) || 0) * (parseFloat(form.unitCost) || 0))}</strong>
        </div>
      </FormDialog>

      <StockCategoriesDialog
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        categories={stockCategories}
        stockItems={stockItems}
        onChanged={(from, to) => { if (category === from) setCategory(to ?? 'all'); onStockUpdated(); }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { store.deleteStockItem(deleteTarget.id); onStockUpdated(); } }}
        title={`Delete ${deleteTarget?.name || 'material'}?`}
        description="It's removed from stock, and any recipes that use it are updated. This cannot be undone."
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export stock"
        description="Stock levels, valuation, and low-stock warnings."
        records={records}
        rowKey={i => i.id}
        summary={[
          { label: 'Value', value: fmt(xValue) },
          { label: 'Materials', value: records.length },
          { label: 'Low', value: xLow, tone: 'warning' },
          { label: 'Out', value: xOut, tone: 'danger' }
        ]}
        previewColumns={[
          { key: 'name', header: 'Material', render: i => i.name },
          { key: 'cat', header: 'Category', render: i => i.category },
          { key: 'qty', header: 'On hand', align: 'right', render: i => `${i.quantity} ${i.unit}` },
          { key: 'value', header: 'Value', align: 'right', render: i => fmt(i.quantity * i.unitCost) },
          { key: 'level', header: 'Level', render: i => <Badge tone={LEVEL_BADGE[stockLevel(i)].tone}>{LEVEL_BADGE[stockLevel(i)].label}</Badge> }
        ]}
        onReset={() => { setXCategory('all'); setXLevel('all'); setXSort('totalValuation'); setXOrder('desc'); setXCost(true); setXThreshold(true); }}
        onCopy={() => { const d = build(); return copyCSVToClipboard(d.headers, d.rows); }}
        onCSV={() => { const d = build(); downloadCSV(`${fileBase}.csv`, d.headers, d.rows); }}
        onJSON={() => downloadJSON(`${fileBase}.json`, {
          metadata: { generatedAt: new Date().toISOString(), currency, totalItems: records.length, filters: { category: xCategory, status: xLevel, sortBy: xSort, sortOrder: xOrder }, summary: { totalValuation: xValue, inStockCount: records.length - xLow - xOut, lowStockCount: xLow, outOfStockCount: xOut } },
          stockItems: records.map(i => ({ id: i.id, name: i.name, category: i.category, quantity: i.quantity, unit: i.unit, unitCost: i.unitCost, minThreshold: i.minThreshold, totalValuation: i.quantity * i.unitCost, status: stockLevel(i) }))
        })}
        onExcel={() => {
          const d = build();
          const totalsRow: (string | number)[] = ['TOTAL VALUATION', `${records.length} Raw Materials`, '', '', ''];
          if (xCost) totalsRow.push('');
          totalsRow.push(Number(xValue.toFixed(2)));
          if (xThreshold) totalsRow.push('', `${xLow} Low / ${xOut} Out`);
          downloadStyledExcel({
            filename: `${fileBase}.xls`,
            title: 'CHTH Cafe — Stock & Raw Material Inventory Report',
            subtitle: `Export Date: ${new Date().toLocaleDateString()} | Category: ${xCategory.toUpperCase()} | Total Asset Value: ${fmt(xValue)}`,
            themeColor: xLow > 0 ? 'amber' : 'emerald',
            metadata: { 'Category Filter': xCategory.toUpperCase(), 'Stock Alert Filter': xLevel.toUpperCase(), 'Sort Order': `${xSort.toUpperCase()} (${xOrder.toUpperCase()})`, 'Store Currency': currency },
            summaryCards: [
              { label: 'Total Valuation', value: fmt(xValue) }, { label: 'Total Materials', value: records.length },
              { label: 'Low Stock Alerts', value: xLow }, { label: 'Out of Stock', value: xOut }
            ],
            ...d,
            totalsRow
          });
        }}
        filters={<>
          <div className="ws-form-row cols-2">
            <Field label="Category">{id => (
              <Select id={id} value={xCategory} onChange={e => setXCategory(e.target.value)}>
                <option value="all">All categories</option>
                {stockCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}</Field>
            <Field label="Stock level">{id => (
              <Select id={id} value={xLevel} onChange={e => setXLevel(e.target.value as typeof xLevel)}>
                <option value="all">All levels</option><option value="in_stock">In stock</option><option value="low_stock">Low</option><option value="out_of_stock">Out of stock</option>
              </Select>
            )}</Field>
          </div>
          <SortFilter value={xSort} onChange={setXSort} order={xOrder} onOrder={setXOrder} options={[
            { value: 'totalValuation', label: 'Value' }, { value: 'quantity', label: 'Quantity' }, { value: 'unitCost', label: 'Unit cost' }, { value: 'name', label: 'Name' }, { value: 'category', label: 'Category' }
          ]} />
          <Checkbox checked={xCost} onChange={setXCost}>Include unit cost</Checkbox>
          <Checkbox checked={xThreshold} onChange={setXThreshold}>Include reorder level and status</Checkbox>
        </>}
      />
    </Page>
  );
};


/** Add, rename and remove material categories. Renaming moves the materials along; a category with materials cannot be removed. */
function StockCategoriesDialog({ open, onClose, categories, stockItems, onChanged }: {
  open: boolean; onClose: () => void; categories: string[]; stockItems: StockItemSelect[];
  /** `to` is the new name after a rename, or undefined when the category was removed. */
  onChanged: (from: string, to?: string) => void;
}) {
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const countOf = (name: string) => stockItems.filter(i => i.category === name).length;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The categories could not be saved.'); return false; }
    finally { setBusy(false); }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) return setError(`“${name}” is already a category.`);
    if (await run(() => store.saveStockCategories([...categories, name]))) setNewName('');
  };
  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    const to = renaming.to.trim();
    if (!to || to === renaming.from) { setRenaming(null); return; }
    let saved = '';
    if (await run(async () => { saved = await store.renameStockCategory(renaming.from, to); })) { onChanged(renaming.from, saved); setRenaming(null); }
  };
  const remove = async (name: string) => {
    if (await run(() => store.saveStockCategories(categories.filter(c => c !== name)))) onChanged(name);
  };

  return (
    <Dialog open={open} onClose={() => { setRenaming(null); setError(''); onClose(); }} busy={busy} title="Material categories"
      description="Rename a category to move its materials along. Renaming onto an existing category merges the two."
      footer={<Button variant="primary" onClick={() => { setRenaming(null); setError(''); onClose(); }}>Done</Button>}>
      <div className="ws-form">
        {error && <Notice tone="danger">{error}</Notice>}
        <ul className="ws-list" style={{ margin: '0 -24px' }} aria-label="Categories">
          {categories.map(name => {
            const count = countOf(name);
            if (renaming?.from === name) return (
              <li key={name} className="ws-list-item">
                <form style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }} onSubmit={rename}>
                  <Input aria-label={`New name for ${name}`} autoFocus required maxLength={MAX_STOCK_CATEGORY_LENGTH} value={renaming.to} disabled={busy}
                    onChange={e => setRenaming({ from: name, to: e.target.value })} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }} />
                  <IconButton type="submit" label={`Save ${name}`} disabled={busy}><Check /></IconButton>
                  <IconButton label="Cancel rename" onClick={() => setRenaming(null)} disabled={busy}><X /></IconButton>
                </form>
              </li>
            );
            return (
              <ListItem
                key={name}
                title={<span className="ws-truncate">{name}</span>}
                subtitle={<span>{count ? plural(count, 'material') : 'No materials'}</span>}
                actions={<>
                  <IconButton label={`Rename ${name}`} disabled={busy} onClick={() => { setError(''); setRenaming({ from: name, to: name }); }}><Pencil /></IconButton>
                  <IconButton label={count ? `${name} has materials. Move them before removing it` : `Remove ${name}`} variant="danger-ghost" disabled={busy || count > 0} onClick={() => remove(name)}><Trash2 /></IconButton>
                </>}
              />
            );
          })}
        </ul>
        <form style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }} onSubmit={add}>
          <Field label="New category" className="ws-grow">{id => (
            <Input id={id} maxLength={MAX_STOCK_CATEGORY_LENGTH} value={newName} disabled={busy} onChange={e => { setNewName(e.target.value); setError(''); }} placeholder="e.g. Cleaning supplies" />
          )}</Field>
          <Button type="submit" icon={<Plus />} disabled={busy || !newName.trim()}>Add</Button>
        </form>
      </div>
    </Dialog>
  );
}
