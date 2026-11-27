import { ImageUpload } from './ImageUpload';
import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Boxes, CheckCircle2, Coffee, Download, EyeOff, FolderPlus, Languages, Pencil, Percent, Plus, SlidersHorizontal, Trash2, UtensilsCrossed, XCircle } from 'lucide-react';
import { CategorySelect, MenuItemSelect, MenuTranslations, MenuVariantSelect, SettingsSelect } from '../db/schema';
import { LOCALES } from '../chth-kit/locales.js';
import { store } from '../db/store';
import { copyCSVToClipboard, downloadCSV, downloadJSON, downloadStyledExcel } from '../utils/exportUtils';
import {
  AffixInput, Badge, Button, Card, Checkbox, Chips, ConfirmDialog, Dialog, EmptyState, ExportDialog, Field, FormDialog, IconButton, Input, KeyValue,
  List, ListItem, Notice, Page, PageHeader, SearchInput, Segmented, Select, SortFilter, Stat, StatGrid, Switch, Textarea, ToggleRow, localDateKey, money, plural, slug
} from '../ui';
import { CATEGORY_ICONS } from './shared';
import { MenuArrangeDialog } from './MenuArrangeDialog';
import { MenuOptionsDialog } from './MenuOptionsDialog';
import { intlTag, tr } from '../i18n';

interface MenuAdminProps {
  settings: SettingsSelect;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  menuVariants: MenuVariantSelect[];
  onMenuUpdated: () => void;
}

/** Trims each translation and drops empty ones, so blank fields fall back to the café's own text. */
function cleanTranslations(value: MenuTranslations): MenuTranslations {
  const clean: MenuTranslations = {};
  for (const [code, entry] of Object.entries(value) as [keyof MenuTranslations, { name?: string; description?: string }][]) {
    const name = entry?.name?.trim(), description = entry?.description?.trim();
    if (name || description) clean[code] = { ...(name && { name }), ...(description && { description }) };
  }
  return clean;
}

type SortField = 'price' | 'margin' | 'name' | 'category' | 'stock';
const marginPct = (price: number, margin: number) => (price > 0 ? (margin / price) * 100 : 0);
const EMPTY_ITEM = { name: '', categoryId: '', description: '', price: '', margin: '', badge: '', imageUrl: '', allergens: '', dietaryLabels: '', translations: {} as MenuTranslations };

/** Languages a name can be written in besides the café's own. */
const OTHER_LANGUAGES = LOCALES.filter(l => l.code !== 'en');
const translatedCount = (translations: MenuTranslations) => OTHER_LANGUAGES.filter(l => translations[l.code as keyof MenuTranslations]?.name?.trim()).length;

/**
 * The name (and description) in each other language, folded away until needed. Each field is
 * written in its own language and direction; empty ones fall back to the café's own text.
 */
function TranslationFields({ value, onChange, withDescription }: { value: MenuTranslations; onChange: (next: MenuTranslations) => void; withDescription?: boolean }) {
  const count = translatedCount(value);
  const set = (code: keyof MenuTranslations, field: 'name' | 'description', text: string) => onChange({ ...value, [code]: { ...value[code], [field]: text } });
  return (
    <details className="ws-translations" open={count > 0 || undefined}>
      <summary><Languages aria-hidden="true" /><span>{tr('Other languages')}</span><span className="ws-hint">{tr('{count} of {total} written', { count, total: OTHER_LANGUAGES.length })}</span></summary>
      <p className="ws-hint">{withDescription ? tr('Guests see these in their language. Leave a language empty to show the name and description above.') : tr('Guests see these in their language. Leave a language empty to show the name above.')}</p>
      {OTHER_LANGUAGES.map(({ code, native, dir }) => {
        const key = code as keyof MenuTranslations;
        return (
          <div key={code} className="ws-translation">
            <Field label={withDescription ? tr('{language} name', { language: native }) : native}>{id => <Input id={id} lang={code} dir={dir} maxLength={withDescription ? 200 : 100} value={value[key]?.name || ''} onChange={e => set(key, 'name', e.target.value)} />}</Field>
            {withDescription && <Field label={tr('{language} description', { language: native })}>{id => <Textarea id={id} lang={code} dir={dir} rows={2} maxLength={1000} value={value[key]?.description || ''} onChange={e => set(key, 'description', e.target.value)} />}</Field>}
          </div>
        );
      })}
    </details>
  );
}

export const MenuAdmin: React.FC<MenuAdminProps> = ({ settings, categories, menuItems, menuVariants, onMenuUpdated }) => {
  const currency = settings.currency;
  const fmt = (v: number) => money(v, currency);
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<'all' | 'in_stock' | 'sold_out'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'item' | 'category'; id: string; name: string; itemCount?: number } | null>(null);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [optionsItem, setOptionsItem] = useState<MenuItemSelect | null>(null);
  const optionCount = (itemId: string) => menuVariants.filter(v => v.menuItemId === itemId).length;

  /* ------------------------------------------------------- Category form */
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategorySelect | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Coffee');
  const [catPrivate, setCatPrivate] = useState(false);
  const [catTranslations, setCatTranslations] = useState<MenuTranslations>({});
  const openCategory = (cat?: CategorySelect) => {
    setEditingCat(cat || null); setCatName(cat?.name || ''); setCatIcon(cat?.icon || 'Coffee');
    setCatPrivate(cat?.isPrivate === true); setCatTranslations(cat?.translations || {}); setCatOpen(true);
  };
  const saveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const extra = { isPrivate: catPrivate, translations: cleanTranslations(catTranslations) };
    if (editingCat) store.updateCategory(editingCat.id, { name: catName.trim(), icon: catIcon, ...extra });
    else store.createCategory(catName.trim(), catIcon, undefined, undefined, extra);
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
      allergens: existing.allergens || '', dietaryLabels: existing.dietaryLabels || '', translations: existing.translations || {}
    } : { ...EMPTY_ITEM, categoryId: categoryId || categories[0]?.id || '' });
    setItemError('');
    setItemOpen(true);
  };
  const saveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(item.price);
    if (!item.name.trim()) return setItemError(tr('Give the item a name.'));
    if (Number.isNaN(price) || price < 0) return setItemError(tr('Enter a valid selling price.'));
    if (!item.categoryId) return setItemError(tr('Create a category first.'));
    const data = {
      name: item.name.trim(), categoryId: item.categoryId, description: item.description.trim(),
      allergens: item.allergens.trim(), dietaryLabels: item.dietaryLabels.trim(),
      basePrice: price, profitMargin: parseFloat(item.margin) || 0, badge: item.badge.trim(), imageUrl: item.imageUrl.trim(),
      translations: cleanTranslations(item.translations)
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
    if (xMargin) { headers.push(tr('Profit Margin ({currency})', { currency }), tr('Margin %')); columnAlignments.push('right', 'right'); }
    if (xCost) { headers.push(tr('Estimated Cost ({currency})', { currency })); columnAlignments.push('right'); }
    headers.push(tr('Stock Availability'), tr('Badge Tag')); columnAlignments.push('center', 'center');
    if (xDesc) { headers.push(tr('Description')); columnAlignments.push('left'); }
    const rows = records.map(i => {
      const margin = i.profitMargin ?? 0;
      const row: (string | number)[] = [i.id, i.name, catName_(i.categoryId), Number(i.basePrice.toFixed(2))];
      if (xMargin) row.push(Number(margin.toFixed(2)), `${marginPct(i.basePrice, margin).toFixed(1)}%`);
      if (xCost) row.push(Number(Math.max(0, i.basePrice - margin).toFixed(2)));
      row.push(i.isInStock ? tr('In Stock') : tr('Sold Out'), i.badge || tr('None'));
      if (xDesc) row.push(i.description || '');
      return row;
    });
    return { headers, rows, columnAlignments };
  };

  return (
    <Page>
      <PageHeader
        title={tr('Menu')}
        description={tr('What customers can order, what it costs you, and what\'s available right now.')}
        actions={<>
          <Button icon={<Download />} onClick={() => setExportOpen(true)}>{tr('Export')}</Button>
          <Button icon={<ArrowUpDown />} onClick={() => setArrangeOpen(true)} disabled={!categories.length}>{tr('Arrange')}</Button>
          <Button icon={<FolderPlus />} onClick={() => openCategory()}>{tr('New category')}</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => openItem()} disabled={!categories.length}>{tr('Add item')}</Button>
        </>}
      />

      <StatGrid>
        <Stat label={tr('Menu items')} icon={<UtensilsCrossed />} value={menuItems.length} hint={plural(categories.length, 'category', 'categories')} />
        <Stat label={tr('Available')} icon={<CheckCircle2 />} value={inStock} tone="positive" onClick={() => setAvailability('in_stock')} active={availability === 'in_stock'} />
        <Stat label={tr('Sold out')} icon={<XCircle />} value={menuItems.length - inStock} tone={menuItems.length - inStock ? 'danger' : 'neutral'} onClick={() => setAvailability('sold_out')} active={availability === 'sold_out'} />
        <Stat label={tr('Average margin')} icon={<Percent />} value={`${avgMargin.toFixed(1)}%`} hint={tr('Of selling price')} />
      </StatGrid>

      <div className="ws-toolbar-stack">
        <div className="ws-toolbar">
          <SearchInput className="ws-grow" value={search} onChange={setSearch} placeholder={tr('Search the menu')} label={tr('Search menu items')} />
          <Segmented label={tr('Availability')} value={availability} onChange={setAvailability} options={[
            { value: 'all', label: tr('All') }, { value: 'in_stock', label: tr('Available'), count: inStock }, { value: 'sold_out', label: tr('Sold out'), count: menuItems.length - inStock }
          ]} />
        </div>
        <Chips label={tr('Category')} value={categoryFilter} onChange={setCategoryFilter} options={[
          { value: 'all', label: tr('All categories') },
          ...categories.map(c => ({ value: c.id, label: c.name, icon: CATEGORY_ICONS[c.icon || '']?.icon, count: menuItems.filter(i => i.categoryId === c.id).length }))
        ]} />
      </div>

      {categories.length === 0 ? (
        <Card><EmptyState icon={<UtensilsCrossed />} title={tr('Start with a category')} description={tr('Categories group the menu, like Coffee or Pastries.')} action={<Button variant="primary" icon={<FolderPlus />} onClick={() => openCategory()}>{tr('New category')}</Button>} /></Card>
      ) : shownCategories.map(cat => {
        const all = menuItems.filter(i => i.categoryId === cat.id);
        const items = all.filter(matches);
        if (filtering && items.length === 0) return null;
        return (
          <Card
            key={cat.id}
            flush
            title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="muted" style={{ display: 'inline-flex', width: 18 }}>{CATEGORY_ICONS[cat.icon || '']?.icon || <Coffee />}</span>{cat.name}{cat.isPrivate && <Badge icon={<EyeOff />}>{tr('Private')}</Badge>}</span>}
            description={plural(all.length, 'item')}
            actions={<>
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => openItem(undefined, cat.id)}>{tr('Item')}</Button>
              <IconButton label={tr('Edit category {name}', { name: cat.name })} onClick={() => openCategory(cat)}><Pencil /></IconButton>
              <IconButton label={tr('Delete category {name}', { name: cat.name })} variant="danger-ghost" onClick={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name, itemCount: all.length })}><Trash2 /></IconButton>
            </>}
          >
            {items.length === 0 ? (
              <p className="ws-hint" style={{ padding: 'var(--chth-space-8) var(--ws-pad) var(--chth-space-16)', margin: 0 }}>{tr('No items in this category yet.')}</p>
            ) : (
              <List label={tr('{name} items', { name: cat.name })}>
                {items.map(i => {
                  const margin = i.profitMargin ?? 0;
                  const pct = marginPct(i.basePrice, margin);
                  return (
                    <ListItem
                      key={i.id}
                      dim={!i.isInStock}
                      onClick={() => openItem(i)}
                      label={tr('Edit {name}', { name: i.name })}
                      lead={i.imageUrl ? <img src={i.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 'var(--ws-radius-sm)', objectFit: 'cover' }} /> : undefined}
                      title={<><span className="ws-truncate">{i.name}</span>{i.badge && <Badge tone="accent">{i.badge}</Badge>}{!i.isInStock && <Badge tone="danger">{tr('Sold out')}</Badge>}</>}
                      subtitle={<>
                        {i.description && <span className="ws-truncate" style={{ maxWidth: 320, display: 'block' }}><bdi>{i.description}</bdi></span>}
                        <span className="tabular">{tr('Cost {amount}', { amount: fmt(Math.max(0, i.basePrice - margin)) })}</span>
                        {optionCount(i.id) > 0 && <span>{plural(optionCount(i.id), 'option')}</span>}
                        <span className="tabular" style={{ color: pct >= 50 ? 'var(--ws-positive)' : pct < 20 ? 'var(--ws-danger)' : undefined }}>{tr('{pct}% margin', { pct: pct.toFixed(0) })}</span>
                      </>}
                      trail={<span className="ws-amount" style={{ fontSize: 15 }}>{fmt(i.basePrice)}</span>}
                      actions={<>
                        <Switch label={tr('{name} available', { name: i.name })} checked={i.isInStock} onChange={() => { store.toggleStock(i.id); onMenuUpdated(); }} />
                        <IconButton label={tr('Recipe for {name}', { name: i.name })} onClick={() => openRecipe(i)}><Boxes /></IconButton>
                        <IconButton label={tr('Options for {name}', { name: i.name })} onClick={() => setOptionsItem(i)}><SlidersHorizontal /></IconButton>
                        <IconButton label={tr('Delete {name}', { name: i.name })} variant="danger-ghost" onClick={() => setDeleteTarget({ type: 'item', id: i.id, name: i.name })}><Trash2 /></IconButton>
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
      <FormDialog open={catOpen} onClose={() => setCatOpen(false)} size="sm" title={editingCat ? tr('Edit category') : tr('New category')} submitLabel={editingCat ? tr('Save') : tr('Create category')} submitDisabled={!catName.trim()} onSubmit={saveCategory}>
        <Field label={tr('Name')}>{id => <Input id={id} autoFocus required value={catName} onChange={e => setCatName(e.target.value)} placeholder={tr('e.g. Cold brews')} />}</Field>
        <Field label={tr('Icon')}>{id => (
          <Select id={id} value={catIcon} onChange={e => setCatIcon(e.target.value)}>
            {Object.entries(CATEGORY_ICONS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        )}</Field>
        <ToggleRow icon={<EyeOff />} title={tr('Private')} description={tr('Only staff see it, in the admin and panel. It and its items are hidden from the public menu and cannot be ordered there.')} checked={catPrivate} onChange={setCatPrivate} />
        <TranslationFields value={catTranslations} onChange={setCatTranslations} />
      </FormDialog>

      <FormDialog open={itemOpen} onClose={() => setItemOpen(false)} title={editingItem ? tr('Edit {name}', { name: editingItem.name }) : tr('Add menu item')} submitLabel={editingItem ? tr('Save changes') : tr('Add item')} onSubmit={saveItem}
        secondaryAction={editingItem && <>
          <Button variant="ghost" icon={<Boxes />} onClick={() => { const target = editingItem; setItemOpen(false); openRecipe(target); }}>{tr('Recipe')}</Button>
          <Button variant="ghost" icon={<SlidersHorizontal />} onClick={() => { const target = editingItem; setItemOpen(false); setOptionsItem(target); }}>{tr('Options')}</Button>
        </>}>
        {itemError && <Notice tone="danger">{itemError}</Notice>}
        <div className="ws-form-row cols-2">
          <Field label={tr('Name')}>{id => <Input id={id} autoFocus required value={item.name} onChange={e => setItem({ ...item, name: e.target.value })} placeholder={tr('e.g. Vanilla cloud latte')} />}</Field>
          <Field label={tr('Category')}>{id => (
            <Select id={id} required value={item.categoryId} onChange={e => setItem({ ...item, categoryId: e.target.value })}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}</Field>
        </div>
        <div className="ws-form-row cols-2">
          <Field label={tr('Selling price')}>{id => <AffixInput id={id} affix={currency} type="number" inputMode="decimal" step="0.01" min="0" required value={item.price} onChange={e => setItem({ ...item, price: e.target.value })} placeholder="0.00" />}</Field>
          <Field label={tr('Profit per item')} hint={tr('Set automatically when you save a recipe')}>{(id, hint) => <AffixInput id={id} aria-describedby={hint} affix={currency} type="number" inputMode="decimal" step="0.01" value={item.margin} onChange={e => setItem({ ...item, margin: e.target.value })} placeholder="0.00" />}</Field>
        </div>
        {formPrice > 0 && (
          <div className="ws-panel">
            <KeyValue items={[
              { label: tr('Estimated cost'), value: fmt(Math.max(0, formPrice - formMargin)) },
              { label: tr('Margin'), value: `${marginPct(formPrice, formMargin).toFixed(1)}%`, tone: formMargin >= 0 ? 'positive' : 'danger' }
            ]} />
          </div>
        )}
        <Field label={tr('Description')} optional>{id => <Textarea id={id} rows={3} value={item.description} onChange={e => setItem({ ...item, description: e.target.value })} placeholder={tr('Taste, roast, or what\'s in it')} />}</Field>
        <Field label={tr('Badge')} optional hint={tr('Shown on the public menu, e.g. Signature or New')}>{(id, hint) => <Input id={id} aria-describedby={hint} value={item.badge} onChange={e => setItem({ ...item, badge: e.target.value })} />}</Field>
        <div className="ws-form-row cols-2">
          <Field label={tr('Allergens')} hint={tr('Comma separated, or “none” once confirmed')}>{(id, hint) => <Input id={id} aria-describedby={hint} maxLength={500} value={item.allergens} onChange={e => setItem({ ...item, allergens: e.target.value })} placeholder="milk, nuts, gluten" />}</Field>
          <Field label={tr('Dietary labels')} hint={tr('Comma separated')}>{(id, hint) => <Input id={id} aria-describedby={hint} maxLength={500} value={item.dietaryLabels} onChange={e => setItem({ ...item, dietaryLabels: e.target.value })} placeholder="vegan, decaf" />}</Field>
        </div>
        <ImageUpload label={tr('Photo')} value={item.imageUrl} onChange={imageUrl => setItem(prev => ({ ...prev, imageUrl }))} />
        <TranslationFields withDescription value={item.translations} onChange={translations => setItem(prev => ({ ...prev, translations }))} />
      </FormDialog>

      <Dialog
        open={!!recipeItem}
        onClose={() => setRecipeItem(null)}
        size="lg"
        title={recipeItem ? tr('Recipe · {name}', { name: recipeItem.name }) : ''}
        description={tr('Materials used per portion. Each order deducts these from stock, and the cost sets the item\'s margin.')}
        footer={<><Button variant="ghost" onClick={() => setRecipeItem(null)}>{tr('Cancel')}</Button><Button variant="primary" onClick={saveRecipe}>{tr('Save recipe')}</Button></>}
      >
        <div className="ws-form">
          {ingredients.length === 0 ? (
            <div className="ws-lane-empty">{tr('No ingredients yet.')}</div>
          ) : (
            <div className="ws-card" style={{ overflow: 'hidden' }}>
              <ul className="ws-list">
                {ingredients.map(ing => {
                  const material = stock.find(s => s.id === ing.stockItemId);
                  return (
                    <ListItem
                      key={ing.stockItemId}
                      title={material?.name || tr('Removed material')}
                      subtitle={<span className="tabular">{tr('{quantityRequired} {value} per portion', { quantityRequired: ing.quantityRequired, value: material?.unit || 'units' })}</span>}
                      trail={<span className="ws-amount">{fmt(material ? ing.quantityRequired * material.unitCost : 0)}</span>}
                      actions={<IconButton label={tr('Remove {value}', { value: material?.name || 'ingredient' })} variant="danger-ghost" onClick={() => setIngredients(prev => prev.filter(i => i.stockItemId !== ing.stockItemId))}><Trash2 /></IconButton>}
                    />
                  );
                })}
              </ul>
            </div>
          )}
          {stock.length === 0 ? (
            <Notice tone="neutral">{tr('Add materials on the Stock page to build recipes.')}</Notice>
          ) : (
            <form onSubmit={addIngredient} className="ws-form-row" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto', alignItems: 'end' }}>
              <Field label={tr('Material')}>{id => (
                <Select id={id} value={ingredientId} onChange={e => setIngredientId(e.target.value)}>
                  {stock.map(m => <option key={m.id} value={m.id}>{tr('{name} ({quantity} {unit} on hand)', { name: m.name, quantity: m.quantity, unit: m.unit })}</option>)}
                </Select>
              )}</Field>
              <Field label={tr('Per portion ({value})', { value: stock.find(s => s.id === ingredientId)?.unit || 'units' })}>{id => (
                <Input id={id} type="number" inputMode="decimal" step="any" min="0" value={ingredientQty} onChange={e => setIngredientQty(e.target.value)} placeholder="0.015" />
              )}</Field>
              <Button type="submit" icon={<Plus />} disabled={!ingredientQty}>{tr('Add')}</Button>
            </form>
          )}
          {recipeItem && (
            <div className="ws-panel">
              <KeyValue items={[
                { label: tr('Recipe cost'), value: fmt(recipeCost) },
                { label: tr('Selling price'), value: fmt(recipeItem.basePrice) },
                { label: tr('Profit per item'), value: fmt(recipeItem.basePrice - recipeCost), tone: recipeItem.basePrice - recipeCost >= 0 ? 'positive' : 'danger' }
              ]} />
            </div>
          )}
        </div>
      </Dialog>

      <MenuArrangeDialog open={arrangeOpen} onClose={() => setArrangeOpen(false)} categories={categories} menuItems={menuItems} onSaved={onMenuUpdated} />
      <MenuOptionsDialog item={optionsItem} variants={menuVariants} stock={stock} currency={currency} onClose={() => setOptionsItem(null)} onSaved={onMenuUpdated} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'item') store.deleteMenuItem(deleteTarget.id);
          else store.deleteCategory(deleteTarget.id);
          onMenuUpdated();
        }}
        title={tr('Delete {value}?', { value: deleteTarget?.name || '' })}
        description={deleteTarget?.type === 'category' && deleteTarget.itemCount
          ? tr('This also deletes {items} in this category. This cannot be undone.', { items: plural(deleteTarget.itemCount, 'item') })
          : tr('It disappears from the menu. This cannot be undone.')}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={tr('Export menu')}
        description={tr('Prices, margins, and availability for your catalogue.')}
        records={records}
        rowKey={i => i.id}
        summary={[
          { label: tr('Items'), value: records.length },
          { label: tr('Available'), value: xIn, tone: 'positive' },
          { label: tr('Avg price'), value: fmt(xAvgPrice) },
          { label: tr('Avg profit'), value: fmt(xAvgMargin) }
        ]}
        previewColumns={[
          { key: 'name', header: tr('Item'), render: i => i.name },
          { key: 'cat', header: tr('Category'), render: i => catName_(i.categoryId) },
          { key: 'price', header: tr('Price'), align: 'right', render: i => fmt(i.basePrice) },
          { key: 'margin', header: tr('Margin'), align: 'right', render: i => `${marginPct(i.basePrice, i.profitMargin ?? 0).toFixed(0)}%` },
          { key: 'stock', header: tr('Status'), render: i => <Badge tone={i.isInStock ? 'positive' : 'danger'}>{i.isInStock ? tr('Available') : tr('Sold out')}</Badge> }
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
          totalsRow.push(tr('{xIn} In Stock / {value} Out', { xIn, value: records.length - xIn }), '');
          if (xDesc) totalsRow.push('');
          downloadStyledExcel({
            filename: `${fileBase}.xls`,
            title: tr('CHTH Cafe — Menu Items & Pricing Catalogue'),
            subtitle: tr('Export Date: {value} | Category: {value2} | Items: {length}', { value: new Date().toLocaleDateString(intlTag()), value2: xCat?.name || 'ALL CATEGORIES', length: records.length }),
            themeColor: 'amber',
            metadata: { 'Category Filter': xCat?.name || 'All Categories', 'Stock Filter': xStock.toUpperCase(), 'Sort Order': `${xSort.toUpperCase()} (${xOrder.toUpperCase()})`, 'Store Currency': currency },
            summaryCards: [
              { label: tr('Total Items'), value: records.length },
              { label: tr('In Stock'), value: `${xIn} (${records.length ? Math.round((xIn / records.length) * 100) : 0}%)` },
              { label: tr('Avg Base Price'), value: fmt(xAvgPrice) },
              { label: tr('Avg Margin'), value: fmt(xAvgMargin) }
            ],
            ...d,
            totalsRow
          });
        }}
        filters={<>
          <div className="ws-form-row cols-2">
            <Field label={tr('Category')}>{id => (
              <Select id={id} value={xCategory} onChange={e => setXCategory(e.target.value)}>
                <option value="all">{tr('All categories')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}</Field>
            <Field label={tr('Availability')}>{id => (
              <Select id={id} value={xStock} onChange={e => setXStock(e.target.value as typeof xStock)}>
                <option value="all">{tr('All items')}</option><option value="in_stock">{tr('Available')}</option><option value="out_of_stock">{tr('Sold out')}</option>
              </Select>
            )}</Field>
          </div>
          <SortFilter value={xSort} onChange={setXSort} order={xOrder} onOrder={setXOrder} options={[
            { value: 'price', label: tr('Price') }, { value: 'margin', label: tr('Profit') }, { value: 'name', label: tr('Name') }, { value: 'category', label: tr('Category') }, { value: 'stock', label: tr('Availability') }
          ]} />
          <Checkbox checked={xMargin} onChange={setXMargin}>{tr('Include profit and margin %')}</Checkbox>
          <Checkbox checked={xCost} onChange={setXCost}>{tr('Include estimated cost')}</Checkbox>
          <Checkbox checked={xDesc} onChange={setXDesc}>{tr('Include descriptions')}</Checkbox>
        </>}
      />
    </Page>
  );
};
