import { ImageUpload } from './ImageUpload';
import React, { useMemo, useState } from 'react';
import { Boxes, CheckCircle2, Coffee, Download, FolderPlus, Pencil, Percent, Plus, Trash2, UtensilsCrossed, XCircle } from 'lucide-react';
import { CategorySelect, MenuItemSelect, MenuVariantSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { copyCSVToClipboard, downloadCSV, downloadJSON, downloadStyledExcel } from '../utils/exportUtils';
import {
  AffixInput, Badge, Button, Card, Checkbox, Chips, ConfirmDialog, Dialog, EmptyState, ExportDialog, Field, FormDialog, IconButton, Input, KeyValue,
  List, ListItem, Notice, Page, PageHeader, SearchInput, Segmented, Select, SortFilter, Stat, StatGrid, Switch, Textarea, localDateKey, money, plural, slug
} from '../ui';
import { CATEGORY_ICONS } from './shared';

interface MenuAdminProps {
  settings: SettingsSelect;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  menuVariants: MenuVariantSelect[];
  onMenuUpdated: () => void;
}

type SortField = 'price' | 'margin' | 'name' | 'category' | 'stock';
const marginPct = (price: number, margin: number) => (price > 0 ? (margin / price) * 100 : 0);
const EMPTY_ITEM = { name: '', categoryId: '', description: '', price: '', margin: '', badge: '', imageUrl: '', allergens: '', dietaryLabels: '' };

export const MenuAdmin: React.FC<MenuAdminProps> = ({ settings, categories, menuItems, onMenuUpdated }) => {
  const currency = settings.currency;
  const fmt = (v: number) => money(v, currency);
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<'all' | 'in_stock' | 'sold_out'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'item' | 'category'; id: string; name: string; itemCount?: number } | null>(null);

  /* ------------------------------------------------------- Category form */
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategorySelect | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Coffee');
  const openCategory = (cat?: CategorySelect) => { setEditingCat(cat || null); setCatName(cat?.name || ''); setCatIcon(cat?.icon || 'Coffee'); setCatOpen(true); };
  const saveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    if (editingCat) store.updateCategory(editingCat.id, { name: catName.trim(), icon: catIcon });
    else store.createCategory(catName.trim(), catIcon);
    setCatOpen(false);
    onMenuUpdated();
  };

  /* ----------------------------------------------------------- Item form */
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemSelect | null>(null);
  const [item, setItem] = useState(EMPTY_ITEM);
  const [itemError, setItemError] = useState('');
  const openItem = (existing?: MenuItemSelect, categoryId?: string) => {
    setEditingItem(existing || null);
    setItem(existing ? {
      name: existing.name, categoryId: existing.categoryId, description: existing.description || '', price: String(existing.basePrice ?? 0),
      margin: String(existing.profitMargin ?? 0), badge: existing.badge || '', imageUrl: existing.imageUrl || '',
      allergens: existing.allergens || '', dietaryLabels: existing.dietaryLabels || ''
    } : { ...EMPTY_ITEM, categoryId: categoryId || categories[0]?.id || '' });
    setItemError('');
    setItemOpen(true);
  };
  const saveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(item.price);
    if (!item.name.trim()) return setItemError('Give the item a name.');
    if (Number.isNaN(price) || price < 0) return setItemError('Enter a valid selling price.');
    if (!item.categoryId) return setItemError('Create a category first.');
    const data = {
      name: item.name.trim(), categoryId: item.categoryId, description: item.description.trim(),
      allergens: item.allergens.trim(), dietaryLabels: item.dietaryLabels.trim(),
      basePrice: price, profitMargin: parseFloat(item.margin) || 0, badge: item.badge.trim(), imageUrl: item.imageUrl.trim()
    };
    if (editingItem) store.updateMenuItem(editingItem.id, data);
    else store.createMenuItem({ ...data, isInStock: true }, []);
    setItemOpen(false);
    onMenuUpdated();
  };
  const formPrice = parseFloat(item.price) || 0;
  const formMargin = parseFloat(item.margin) || 0;

  /* -------------------------------------------------------------- Recipe */
  const [recipeItem, setRecipeItem] = useState<MenuItemSelect | null>(null);
  const [ingredients, setIngredients] = useState<{ stockItemId: string; quantityRequired: number }[]>([]);
  const [ingredientId, setIngredientId] = useState('');
  const [ingredientQty, setIngredientQty] = useState('');
  const stock = store.getStockItems();
  const openRecipe = (target: MenuItemSelect) => {
    setRecipeItem(target);
    setIngredients(store.getMenuItemRecipe(target.id).map(r => ({ stockItemId: r.stockItemId, quantityRequired: r.quantityRequired })));
    setIngredientId(stock[0]?.id || '');
    setIngredientQty('');
  };
  const addIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(ingredientQty);
    if (!ingredientId || Number.isNaN(qty) || qty <= 0) return;
    setIngredients(prev => prev.some(i => i.stockItemId === ingredientId)
      ? prev.map(i => i.stockItemId === ingredientId ? { ...i, quantityRequired: qty } : i)
      : [...prev, { stockItemId: ingredientId, quantityRequired: qty }]);
    setIngredientQty('');
  };
  const recipeCost = ingredients.reduce((sum, ing) => {
    const material = stock.find(s => s.id === ing.stockItemId);
    return sum + (material ? ing.quantityRequired * material.unitCost : 0);
  }, 0);
  const saveRecipe = () => {
    if (!recipeItem) return;
    store.saveMenuItemRecipe(recipeItem.id, ingredients);
    // The recipe defines the cost, so the margin follows from it.
    store.updateMenuItem(recipeItem.id, { profitMargin: Math.max(0, Number((recipeItem.basePrice - recipeCost).toFixed(2))) });
    setRecipeItem(null);
    onMenuUpdated();
  };

  /* -------------------------------------------------------------- Metrics */
  const inStock = menuItems.filter(i => i.isInStock).length;
  const avgMargin = menuItems.length ? menuItems.reduce((s, i) => s + marginPct(i.basePrice, i.profitMargin ?? 0), 0) / menuItems.length : 0;
  const matches = (i: MenuItemSelect) => {
    const q = search.trim().toLowerCase();
    return (!q || i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
      && (availability === 'all' || (availability === 'in_stock' ? i.isInStock : !i.isInStock));
  };
  const filtering = search.trim() !== '' || availability !== 'all';
  const shownCategories = categories.filter(c => categoryFilter === 'all' || c.id === categoryFilter);

  /* --------------------------------------------------------------- Export */
  const [xCategory, setXCategory] = useState('all');
  const [xStock, setXStock] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [xSort, setXSort] = useState<SortField>('price');
  const [xOrder, setXOrder] = useState<'asc' | 'desc'>('desc');
  const [xMargin, setXMargin] = useState(true);
  const [xCost, setXCost] = useState(true);
  const [xDesc, setXDesc] = useState(true);
  const catName_ = (id: string) => categories.find(c => c.id === id)?.name || 'General';
  const records = useMemo(() => menuItems
    .filter(i => (xCategory === 'all' || i.categoryId === xCategory) && (xStock === 'all' || (xStock === 'in_stock' ? i.isInStock : !i.isInStock)))
    .sort((a, b) => {
      const cmp = xSort === 'price' ? a.basePrice - b.basePrice
        : xSort === 'margin' ? (a.profitMargin || 0) - (b.profitMargin || 0)
        : xSort === 'name' ? a.name.localeCompare(b.name)
        : xSort === 'category' ? catName_(a.categoryId).localeCompare(catName_(b.categoryId))
        : Number(a.isInStock) - Number(b.isInStock);
      return xOrder === 'desc' ? -cmp : cmp;
    }), [menuItems, categories, xCategory, xStock, xSort, xOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  const xIn = records.filter(i => i.isInStock).length;
  const xAvgPrice = records.length ? records.reduce((s, i) => s + i.basePrice, 0) / records.length : 0;
  const xAvgMargin = records.length ? records.reduce((s, i) => s + (i.profitMargin || 0), 0) / records.length : 0;
  const xCat = categories.find(c => c.id === xCategory);
  const fileBase = `menu_catalogue${xCat ? `_${slug(xCat.name)}` : ''}_${localDateKey()}`;
  const build = () => {
    const headers = ['Item ID', 'Item Name', 'Category', `Base Price (${currency})`];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['left', 'left', 'left', 'right'];
    if (xMargin) { headers.push(`Profit Margin (${currency})`, 'Margin %'); columnAlignments.push('right', 'right'); }
    if (xCost) { headers.push(`Estimated Cost (${currency})`); columnAlignments.push('right'); }
    headers.push('Stock Availability', 'Badge Tag'); columnAlignments.push('center', 'center');
    if (xDesc) { headers.push('Description'); columnAlignments.push('left'); }
    const rows = records.map(i => {
      const margin = i.profitMargin ?? 0;
      const row: (string | number)[] = [i.id, i.name, catName_(i.categoryId), Number(i.basePrice.toFixed(2))];
      if (xMargin) row.push(Number(margin.toFixed(2)), `${marginPct(i.basePrice, margin).toFixed(1)}%`);
      if (xCost) row.push(Number(Math.max(0, i.basePrice - margin).toFixed(2)));
      row.push(i.isInStock ? 'In Stock' : 'Sold Out', i.badge || 'None');
      if (xDesc) row.push(i.description || '');
      return row;
    });
    return { headers, rows, columnAlignments };
  };

  return (
    <Page>
      <PageHeader
        title="Menu"
        description="What customers can order, what it costs you, and what's available right now."
        actions={<>
          <Button icon={<Download />} onClick={() => setExportOpen(true)}>Export</Button>
          <Button icon={<FolderPlus />} onClick={() => openCategory()}>New category</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => openItem()} disabled={!categories.length}>Add item</Button>
        </>}
      />

      <StatGrid>
        <Stat label="Menu items" icon={<UtensilsCrossed />} value={menuItems.length} hint={plural(categories.length, 'category', 'categories')} />
        <Stat label="Available" icon={<CheckCircle2 />} value={inStock} tone="positive" onClick={() => setAvailability('in_stock')} active={availability === 'in_stock'} />
        <Stat label="Sold out" icon={<XCircle />} value={menuItems.length - inStock} tone={menuItems.length - inStock ? 'danger' : 'neutral'} onClick={() => setAvailability('sold_out')} active={availability === 'sold_out'} />
        <Stat label="Average margin" icon={<Percent />} value={`${avgMargin.toFixed(1)}%`} hint="Of selling price" />
      </StatGrid>

      <div className="ws-toolbar-stack">
        <div className="ws-toolbar">
          <SearchInput className="ws-grow" value={search} onChange={setSearch} placeholder="Search the menu" label="Search menu items" />
          <Segmented label="Availability" value={availability} onChange={setAvailability} options={[
            { value: 'all', label: 'All' }, { value: 'in_stock', label: 'Available', count: inStock }, { value: 'sold_out', label: 'Sold out', count: menuItems.length - inStock }
          ]} />
        </div>
        <Chips label="Category" value={categoryFilter} onChange={setCategoryFilter} options={[
          { value: 'all', label: 'All categories' },
          ...categories.map(c => ({ value: c.id, label: c.name, icon: CATEGORY_ICONS[c.icon || '']?.icon, count: menuItems.filter(i => i.categoryId === c.id).length }))
        ]} />
      </div>

      {categories.length === 0 ? (
        <Card><EmptyState icon={<UtensilsCrossed />} title="Start with a category" description="Categories group the menu, like Coffee or Pastries." action={<Button variant="primary" icon={<FolderPlus />} onClick={() => openCategory()}>New category</Button>} /></Card>
      ) : shownCategories.map(cat => {
        const all = menuItems.filter(i => i.categoryId === cat.id);
        const items = all.filter(matches);
        if (filtering && items.length === 0) return null;
        return (
          <Card
            key={cat.id}
            flush
            title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="muted" style={{ display: 'inline-flex', width: 18 }}>{CATEGORY_ICONS[cat.icon || '']?.icon || <Coffee />}</span>{cat.name}</span>}
            description={plural(all.length, 'item')}
            actions={<>
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => openItem(undefined, cat.id)}>Item</Button>
              <IconButton label={`Edit category ${cat.name}`} onClick={() => openCategory(cat)}><Pencil /></IconButton>
              <IconButton label={`Delete category ${cat.name}`} variant="danger-ghost" onClick={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name, itemCount: all.length })}><Trash2 /></IconButton>
            </>}
          >
            {items.length === 0 ? (
              <p className="ws-hint" style={{ padding: '8px var(--ws-pad) 16px', margin: 0 }}>No items in this category yet.</p>
            ) : (
              <List label={`${cat.name} items`}>
                {items.map(i => {
                  const margin = i.profitMargin ?? 0;
                  const pct = marginPct(i.basePrice, margin);
                  return (
                    <ListItem
                      key={i.id}
                      dim={!i.isInStock}
                      onClick={() => openItem(i)}
                      label={`Edit ${i.name}`}
                      lead={i.imageUrl ? <img src={i.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 'var(--ws-radius-sm)', objectFit: 'cover' }} /> : undefined}
                      title={<><span className="ws-truncate">{i.name}</span>{i.badge && <Badge tone="accent">{i.badge}</Badge>}{!i.isInStock && <Badge tone="danger">Sold out</Badge>}</>}
                      subtitle={<>
                        {i.description && <span className="ws-truncate" style={{ maxWidth: 320, display: 'block' }}>{i.description}</span>}
                        <span className="tabular">Cost {fmt(Math.max(0, i.basePrice - margin))}</span>
                        <span className="tabular" style={{ color: pct >= 50 ? 'var(--ws-positive)' : pct < 20 ? 'var(--ws-danger)' : undefined }}>{pct.toFixed(0)}% margin</span>
                      </>}
                      trail={<span className="ws-amount" style={{ fontSize: 15 }}>{fmt(i.basePrice)}</span>}
                      actions={<>
                        <Switch label={`${i.name} available`} checked={i.isInStock} onChange={() => { store.toggleStock(i.id); onMenuUpdated(); }} />
                        <IconButton label={`Recipe for ${i.name}`} onClick={() => openRecipe(i)}><Boxes /></IconButton>
                        <IconButton label={`Delete ${i.name}`} variant="danger-ghost" onClick={() => setDeleteTarget({ type: 'item', id: i.id, name: i.name })}><Trash2 /></IconButton>
                      </>}
                    />
                  );
                })}
              </List>
            )}
          </Card>
        );
      })}

      {/* ------------------------------------------------------------ Dialogs */}
      <FormDialog open={catOpen} onClose={() => setCatOpen(false)} size="sm" title={editingCat ? 'Edit category' : 'New category'} submitLabel={editingCat ? 'Save' : 'Create category'} submitDisabled={!catName.trim()} onSubmit={saveCategory}>
        <Field label="Name">{id => <Input id={id} autoFocus required value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Cold brews" />}</Field>
        <Field label="Icon">{id => (
          <Select id={id} value={catIcon} onChange={e => setCatIcon(e.target.value)}>
            {Object.entries(CATEGORY_ICONS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        )}</Field>
      </FormDialog>

      <FormDialog open={itemOpen} onClose={() => setItemOpen(false)} title={editingItem ? `Edit ${editingItem.name}` : 'Add menu item'} submitLabel={editingItem ? 'Save changes' : 'Add item'} onSubmit={saveItem}
        secondaryAction={editingItem && <Button variant="ghost" icon={<Boxes />} onClick={() => { const target = editingItem; setItemOpen(false); openRecipe(target); }}>Recipe</Button>}>
        {itemError && <Notice tone="danger">{itemError}</Notice>}
        <div className="ws-form-row cols-2">
          <Field label="Name">{id => <Input id={id} autoFocus required value={item.name} onChange={e => setItem({ ...item, name: e.target.value })} placeholder="e.g. Vanilla cloud latte" />}</Field>
          <Field label="Category">{id => (
            <Select id={id} required value={item.categoryId} onChange={e => setItem({ ...item, categoryId: e.target.value })}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}</Field>
        </div>
        <div className="ws-form-row cols-2">
          <Field label="Selling price">{id => <AffixInput id={id} affix={currency} type="number" inputMode="decimal" step="0.01" min="0" required value={item.price} onChange={e => setItem({ ...item, price: e.target.value })} placeholder="0.00" />}</Field>
          <Field label="Profit per item" hint="Set automatically when you save a recipe">{(id, hint) => <AffixInput id={id} aria-describedby={hint} affix={currency} type="number" inputMode="decimal" step="0.01" value={item.margin} onChange={e => setItem({ ...item, margin: e.target.value })} placeholder="0.00" />}</Field>
        </div>
        {formPrice > 0 && (
          <div className="ws-panel">
            <KeyValue items={[
              { label: 'Estimated cost', value: fmt(Math.max(0, formPrice - formMargin)) },
              { label: 'Margin', value: `${marginPct(formPrice, formMargin).toFixed(1)}%`, tone: formMargin >= 0 ? 'positive' : 'danger' }
            ]} />
          </div>
        )}
        <Field label="Description" optional>{id => <Textarea id={id} rows={3} value={item.description} onChange={e => setItem({ ...item, description: e.target.value })} placeholder="Taste, roast, or what's in it" />}</Field>
        <Field label="Badge" optional hint="Shown on the public menu, e.g. Signature or New">{(id, hint) => <Input id={id} aria-describedby={hint} value={item.badge} onChange={e => setItem({ ...item, badge: e.target.value })} />}</Field>
        <div className="ws-form-row cols-2">
          <Field label="Allergens" hint="Comma separated, or “none” once confirmed">{(id, hint) => <Input id={id} aria-describedby={hint} maxLength={500} value={item.allergens} onChange={e => setItem({ ...item, allergens: e.target.value })} placeholder="milk, nuts, gluten" />}</Field>
          <Field label="Dietary labels" hint="Comma separated">{(id, hint) => <Input id={id} aria-describedby={hint} maxLength={500} value={item.dietaryLabels} onChange={e => setItem({ ...item, dietaryLabels: e.target.value })} placeholder="vegan, decaf" />}</Field>
        </div>
        <ImageUpload label="Photo" value={item.imageUrl} onChange={imageUrl => setItem(prev => ({ ...prev, imageUrl }))} />
      </FormDialog>

      <Dialog
        open={!!recipeItem}
        onClose={() => setRecipeItem(null)}
        size="lg"
        title={recipeItem ? `Recipe · ${recipeItem.name}` : ''}
        description="Materials used per portion. Each order deducts these from stock, and the cost sets the item's margin."
        footer={<><Button variant="ghost" onClick={() => setRecipeItem(null)}>Cancel</Button><Button variant="primary" onClick={saveRecipe}>Save recipe</Button></>}
      >
        <div className="ws-form">
          {ingredients.length === 0 ? (
            <div className="ws-lane-empty">No ingredients yet.</div>
          ) : (
            <div className="ws-card" style={{ overflow: 'hidden' }}>
              <ul className="ws-list">
                {ingredients.map(ing => {
                  const material = stock.find(s => s.id === ing.stockItemId);
                  return (
                    <ListItem
                      key={ing.stockItemId}
                      title={material?.name || 'Removed material'}
                      subtitle={<span className="tabular">{ing.quantityRequired} {material?.unit || 'units'} per portion</span>}
                      trail={<span className="ws-amount">{fmt(material ? ing.quantityRequired * material.unitCost : 0)}</span>}
                      actions={<IconButton label={`Remove ${material?.name || 'ingredient'}`} variant="danger-ghost" onClick={() => setIngredients(prev => prev.filter(i => i.stockItemId !== ing.stockItemId))}><Trash2 /></IconButton>}
                    />
                  );
                })}
              </ul>
            </div>
          )}
          {stock.length === 0 ? (
            <Notice tone="neutral">Add materials on the Stock page to build recipes.</Notice>
          ) : (
            <form onSubmit={addIngredient} className="ws-form-row" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto', alignItems: 'end' }}>
              <Field label="Material">{id => (
                <Select id={id} value={ingredientId} onChange={e => setIngredientId(e.target.value)}>
                  {stock.map(m => <option key={m.id} value={m.id}>{m.name} ({m.quantity} {m.unit} on hand)</option>)}
                </Select>
              )}</Field>
              <Field label={`Per portion (${stock.find(s => s.id === ingredientId)?.unit || 'units'})`}>{id => (
                <Input id={id} type="number" inputMode="decimal" step="any" min="0" value={ingredientQty} onChange={e => setIngredientQty(e.target.value)} placeholder="0.015" />
              )}</Field>
              <Button type="submit" icon={<Plus />} disabled={!ingredientQty}>Add</Button>
            </form>
          )}
          {recipeItem && (
            <div className="ws-panel">
              <KeyValue items={[
                { label: 'Recipe cost', value: fmt(recipeCost) },
                { label: 'Selling price', value: fmt(recipeItem.basePrice) },
                { label: 'Profit per item', value: fmt(recipeItem.basePrice - recipeCost), tone: recipeItem.basePrice - recipeCost >= 0 ? 'positive' : 'danger' }
              ]} />
            </div>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'item') store.deleteMenuItem(deleteTarget.id);
          else store.deleteCategory(deleteTarget.id);
          onMenuUpdated();
        }}
        title={`Delete ${deleteTarget?.name || ''}?`}
        description={deleteTarget?.type === 'category' && deleteTarget.itemCount
          ? <>This also deletes the <strong>{plural(deleteTarget.itemCount, 'item')}</strong> in this category. This cannot be undone.</>
          : 'It disappears from the menu. This cannot be undone.'}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export menu"
        description="Prices, margins, and availability for your catalogue."
        records={records}
        rowKey={i => i.id}
        summary={[
          { label: 'Items', value: records.length },
          { label: 'Available', value: xIn, tone: 'positive' },
          { label: 'Avg price', value: fmt(xAvgPrice) },
          { label: 'Avg profit', value: fmt(xAvgMargin) }
        ]}
        previewColumns={[
          { key: 'name', header: 'Item', render: i => i.name },
          { key: 'cat', header: 'Category', render: i => catName_(i.categoryId) },
          { key: 'price', header: 'Price', align: 'right', render: i => fmt(i.basePrice) },
          { key: 'margin', header: 'Margin', align: 'right', render: i => `${marginPct(i.basePrice, i.profitMargin ?? 0).toFixed(0)}%` },
          { key: 'stock', header: 'Status', render: i => <Badge tone={i.isInStock ? 'positive' : 'danger'}>{i.isInStock ? 'Available' : 'Sold out'}</Badge> }
        ]}
        onReset={() => { setXCategory('all'); setXStock('all'); setXSort('price'); setXOrder('desc'); setXMargin(true); setXCost(true); setXDesc(true); }}
        onCopy={() => { const d = build(); return copyCSVToClipboard(d.headers, d.rows); }}
        onCSV={() => { const d = build(); downloadCSV(`${fileBase}.csv`, d.headers, d.rows); }}
        onJSON={() => downloadJSON(`${fileBase}.json`, {
          metadata: { generatedAt: new Date().toISOString(), currency, totalItems: records.length, filters: { category: xCat?.name || 'all', stockStatus: xStock, sortBy: xSort, sortOrder: xOrder }, summary: { inStockCount: xIn, outOfStockCount: records.length - xIn, averageBasePrice: xAvgPrice, averageProfitMargin: xAvgMargin } },
          items: records.map(i => ({ id: i.id, name: i.name, category: catName_(i.categoryId), basePrice: i.basePrice, profitMargin: i.profitMargin, estimatedCost: Math.max(0, i.basePrice - (i.profitMargin || 0)), isInStock: i.isInStock, badge: i.badge, description: i.description }))
        })}
        onExcel={() => {
          const d = build();
          const totalsRow: (string | number)[] = ['AVERAGES / TOTAL', `${records.length} Menu Items`, '', Number(xAvgPrice.toFixed(2))];
          if (xMargin) totalsRow.push(Number(xAvgMargin.toFixed(2)), '');
          if (xCost) totalsRow.push(Number((xAvgPrice - xAvgMargin).toFixed(2)));
          totalsRow.push(`${xIn} In Stock / ${records.length - xIn} Out`, '');
          if (xDesc) totalsRow.push('');
          downloadStyledExcel({
            filename: `${fileBase}.xls`,
            title: 'CHTH Cafe — Menu Items & Pricing Catalogue',
            subtitle: `Export Date: ${new Date().toLocaleDateString()} | Category: ${xCat?.name || 'ALL CATEGORIES'} | Items: ${records.length}`,
            themeColor: 'amber',
            metadata: { 'Category Filter': xCat?.name || 'All Categories', 'Stock Filter': xStock.toUpperCase(), 'Sort Order': `${xSort.toUpperCase()} (${xOrder.toUpperCase()})`, 'Store Currency': currency },
            summaryCards: [
              { label: 'Total Items', value: records.length },
              { label: 'In Stock', value: `${xIn} (${records.length ? Math.round((xIn / records.length) * 100) : 0}%)` },
              { label: 'Avg Base Price', value: fmt(xAvgPrice) },
              { label: 'Avg Margin', value: fmt(xAvgMargin) }
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
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}</Field>
            <Field label="Availability">{id => (
              <Select id={id} value={xStock} onChange={e => setXStock(e.target.value as typeof xStock)}>
                <option value="all">All items</option><option value="in_stock">Available</option><option value="out_of_stock">Sold out</option>
              </Select>
            )}</Field>
          </div>
          <SortFilter value={xSort} onChange={setXSort} order={xOrder} onOrder={setXOrder} options={[
            { value: 'price', label: 'Price' }, { value: 'margin', label: 'Profit' }, { value: 'name', label: 'Name' }, { value: 'category', label: 'Category' }, { value: 'stock', label: 'Availability' }
          ]} />
          <Checkbox checked={xMargin} onChange={setXMargin}>Include profit and margin %</Checkbox>
          <Checkbox checked={xCost} onChange={setXCost}>Include estimated cost</Checkbox>
          <Checkbox checked={xDesc} onChange={setXDesc}>Include descriptions</Checkbox>
        </>}
      />
    </Page>
  );
};
