import React, { useState, useMemo } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  Tag,
  Coffee,
  GlassWater,
  Leaf,
  Cake,
  Utensils,
  BarChart3,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  DollarSign,
  Download,
  Pencil,
  TrendingUp,
  Percent,
  Boxes,
  Layers,
  SlidersHorizontal,
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  RotateCcw,
  Eye,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { CategorySelect, MenuItemSelect, MenuVariantSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import {
  downloadStyledExcel,
  downloadCSV,
  downloadJSON,
  copyCSVToClipboard
} from '../utils/exportUtils';

interface MenuAdminProps {
  settings: SettingsSelect;
  categories: CategorySelect[];
  menuItems: MenuItemSelect[];
  menuVariants: MenuVariantSelect[];
  onMenuUpdated: () => void;
}

type MenuSortField = 'price' | 'margin' | 'name' | 'category' | 'stock';
type SortOrder = 'desc' | 'asc';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Coffee: <Coffee className="w-4 h-4" />,
  GlassWater: <GlassWater className="w-4 h-4" />,
  Leaf: <Leaf className="w-4 h-4" />,
  Cake: <Cake className="w-4 h-4" />,
  Utensils: <Utensils className="w-4 h-4" />
};

const COLOR_PALETTES = [
  { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', gradient: 'bg-gradient-to-r from-amber-500 to-amber-400' },
  { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', gradient: 'bg-gradient-to-r from-emerald-500 to-teal-400' },
  { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', gradient: 'bg-gradient-to-r from-sky-500 to-cyan-400' },
  { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', gradient: 'bg-gradient-to-r from-purple-500 to-pink-400' },
  { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', gradient: 'bg-gradient-to-r from-orange-500 to-rose-400' },
  { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', gradient: 'bg-gradient-to-r from-indigo-500 to-violet-400' },
  { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', gradient: 'bg-gradient-to-r from-fuchsia-500 to-pink-500' }
];

const CATEGORY_COLORS_BY_ICON: Record<string, (typeof COLOR_PALETTES)[0]> = {
  Coffee: COLOR_PALETTES[0],
  Leaf: COLOR_PALETTES[1],
  GlassWater: COLOR_PALETTES[2],
  Cake: COLOR_PALETTES[3],
  Utensils: COLOR_PALETTES[4]
};

const getCategoryColor = (icon?: string | null, index: number = 0) => {
  if (icon && CATEGORY_COLORS_BY_ICON[icon]) {
    return CATEGORY_COLORS_BY_ICON[icon];
  }
  return COLOR_PALETTES[index % COLOR_PALETTES.length];
};

export const MenuAdmin: React.FC<MenuAdminProps> = ({
  settings,
  categories,
  menuItems,
  menuVariants,
  onMenuUpdated
}) => {
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Coffee');

  // Form Validation & Feedback
  const [formError, setFormError] = useState('');

  // Add Item State
  const [itemName, setItemName] = useState('');
  const [itemCatId, setItemCatId] = useState(categories[0]?.id || '');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemProfitMargin, setItemProfitMargin] = useState('');
  const [itemBadge, setItemBadge] = useState('');

  // Export Modal & Filter States
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCategoryId, setExportCategoryId] = useState<string>('all');
  const [exportStockStatus, setExportStockStatus] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [exportBadge, setExportBadge] = useState<string>('all');
  const [exportSortBy, setExportSortBy] = useState<MenuSortField>('price');
  const [exportSortOrder, setExportSortOrder] = useState<SortOrder>('desc');
  const [exportIncludeMargin, setExportIncludeMargin] = useState(true);
  const [exportIncludeCost, setExportIncludeCost] = useState(true);
  const [exportIncludeDescription, setExportIncludeDescription] = useState(true);
  const [showPreviewTable, setShowPreviewTable] = useState(true);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Keep itemCatId valid when categories load or change
  React.useEffect(() => {
    if ((!itemCatId || !categories.some((c) => c.id === itemCatId)) && categories.length > 0) {
      setItemCatId(categories[0].id);
    }
  }, [categories, itemCatId]);

  // Edit Item State
  const [editingItem, setEditingItem] = useState<MenuItemSelect | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCatId, setEditItemCatId] = useState('');
  const [editItemDesc, setEditItemDesc] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemProfitMargin, setEditItemProfitMargin] = useState('');
  const [editItemBadge, setEditItemBadge] = useState('');

  // Edit Category State
  const [editingCategory, setEditingCategory] = useState<CategorySelect | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('Coffee');

  const openEditCategory = (cat: CategorySelect) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon || 'Coffee');
  };

  const handleUpdateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCatName.trim()) return;

    store.updateCategory(editingCategory.id, {
      name: editCatName.trim(),
      icon: editCatIcon
    });

    setEditingCategory(null);
    onMenuUpdated();
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newCatName.trim()) {
      setFormError('Category name cannot be empty');
      return;
    }

    store.createCategory(newCatName.trim(), newCatIcon);
    setNewCatName('');
    setNewCatIcon('Coffee');
    setAddCatOpen(false);
    onMenuUpdated();
  };

  // Recipe Linking Modal State
  const [recipeModalItem, setRecipeModalItem] = useState<MenuItemSelect | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ stockItemId: string; quantityRequired: number }>>([]);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [ingredientQty, setIngredientQty] = useState('');

  const openRecipeModal = (item: MenuItemSelect) => {
    setRecipeModalItem(item);
    const existing = store.getMenuItemRecipe(item.id);
    setRecipeIngredients(existing.map((r) => ({ stockItemId: r.stockItemId, quantityRequired: r.quantityRequired })));
    const stock = store.getStockItems();
    if (stock.length > 0) {
      setSelectedStockId(stock[0].id);
    }
    setIngredientQty('');
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockId) return;
    const qty = parseFloat(ingredientQty);
    if (isNaN(qty) || qty <= 0) return;

    setRecipeIngredients((prev) => {
      const idx = prev.findIndex((i) => i.stockItemId === selectedStockId);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { stockItemId: selectedStockId, quantityRequired: qty };
        return next;
      }
      return [...prev, { stockItemId: selectedStockId, quantityRequired: qty }];
    });
    setIngredientQty('');
  };

  const handleRemoveIngredient = (stockItemId: string) => {
    setRecipeIngredients((prev) => prev.filter((i) => i.stockItemId !== stockItemId));
  };

  const handleSaveRecipe = () => {
    if (recipeModalItem) {
      store.saveMenuItemRecipe(recipeModalItem.id, recipeIngredients);
      // Recalculate profit margin based on recipe ingredients cost
      const stock = store.getStockItems();
      const totalRecipeCost = recipeIngredients.reduce((acc, ing) => {
        const mat = stock.find((s) => s.id === ing.stockItemId);
        return acc + (mat ? ing.quantityRequired * mat.unitCost : 0);
      }, 0);
      const newMargin = Math.max(0, Number((recipeModalItem.basePrice - totalRecipeCost).toFixed(2)));
      store.updateMenuItem(recipeModalItem.id, { profitMargin: newMargin });
      setRecipeModalItem(null);
      onMenuUpdated();
    }
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const targetCatId = itemCatId || categories[0]?.id;
    if (!itemName.trim()) {
      setFormError('Item name is required');
      return;
    }
    if (!itemPrice || isNaN(parseFloat(itemPrice))) {
      setFormError('Valid base selling price is required');
      return;
    }
    if (!targetCatId) {
      setFormError('Please select or create a category first');
      return;
    }

    store.createMenuItem(
      {
        categoryId: targetCatId,
        name: itemName.trim(),
        description: itemDesc.trim(),
        basePrice: parseFloat(itemPrice) || 0,
        profitMargin: parseFloat(itemProfitMargin) || 0,
        isInStock: true,
        badge: itemBadge.trim(),
        imageUrl: ''
      },
      []
    );

    setItemName('');
    setItemDesc('');
    setItemPrice('');
    setItemProfitMargin('');
    setItemBadge('');
    setFormError('');
    setAddItemOpen(false);
    onMenuUpdated();
  };

  const openEditItem = (item: MenuItemSelect) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemCatId(item.categoryId);
    setEditItemDesc(item.description || '');
    setEditItemPrice(item.basePrice ? item.basePrice.toString() : '0');
    setEditItemProfitMargin((item.profitMargin ?? 0).toString());
    setEditItemBadge(item.badge || '');
  };

  const handleUpdateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editItemName.trim() || !editItemPrice || !editItemCatId) return;

    store.updateMenuItem(editingItem.id, {
      name: editItemName.trim(),
      categoryId: editItemCatId,
      description: editItemDesc.trim(),
      basePrice: parseFloat(editItemPrice) || 0,
      profitMargin: parseFloat(editItemProfitMargin) || 0,
      badge: editItemBadge.trim()
    });

    setEditingItem(null);
    onMenuUpdated();
  };

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'item' | 'category';
    id: string;
    name: string;
    itemCount?: number;
  } | null>(null);

  const promptDeleteItem = (id: string, name: string) => {
    setDeleteConfirmTarget({ type: 'item', id, name });
  };

  const promptDeleteCategory = (id: string, name: string, itemCount: number) => {
    setDeleteConfirmTarget({ type: 'category', id, name, itemCount });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    if (deleteConfirmTarget.type === 'item') {
      store.deleteMenuItem(deleteConfirmTarget.id);
    } else if (deleteConfirmTarget.type === 'category') {
      store.deleteCategory(deleteConfirmTarget.id);
    }
    setDeleteConfirmTarget(null);
    onMenuUpdated();
  };

  const handleToggleStock = (id: string) => {
    store.toggleStock(id);
    onMenuUpdated();
  };

  const inStockCount = menuItems.filter((i) => i.isInStock).length;
  const outOfStockCount = menuItems.length - inStockCount;
  const stockRatioPct = menuItems.length > 0 ? Math.round((inStockCount / menuItems.length) * 100) : 0;

  // Filtered & Sorted menu items for export
  const filteredExportMenuItems = useMemo(() => {
    const list = menuItems.filter((item) => {
      if (exportCategoryId !== 'all' && item.categoryId !== exportCategoryId) return false;
      if (exportStockStatus === 'in_stock' && !item.isInStock) return false;
      if (exportStockStatus === 'out_of_stock' && item.isInStock) return false;
      if (exportBadge === 'has_badge' && !item.badge) return false;
      if (exportBadge === 'no_badge' && item.badge) return false;
      if (exportBadge !== 'all' && exportBadge !== 'has_badge' && exportBadge !== 'no_badge' && item.badge !== exportBadge) return false;
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (exportSortBy === 'price') {
        cmp = a.basePrice - b.basePrice;
      } else if (exportSortBy === 'margin') {
        cmp = (a.profitMargin || 0) - (b.profitMargin || 0);
      } else if (exportSortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (exportSortBy === 'category') {
        const catA = categories.find((c) => c.id === a.categoryId)?.name || '';
        const catB = categories.find((c) => c.id === b.categoryId)?.name || '';
        cmp = catA.localeCompare(catB);
      } else if (exportSortBy === 'stock') {
        cmp = (a.isInStock ? 1 : 0) - (b.isInStock ? 1 : 0);
      }
      return exportSortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [menuItems, categories, exportCategoryId, exportStockStatus, exportBadge, exportSortBy, exportSortOrder]);

  // Export summary metrics
  const exportInStockCount = filteredExportMenuItems.filter((i) => i.isInStock).length;
  const exportOutOfStockCount = filteredExportMenuItems.length - exportInStockCount;
  const exportAvgPrice = filteredExportMenuItems.length > 0
    ? filteredExportMenuItems.reduce((sum, i) => sum + i.basePrice, 0) / filteredExportMenuItems.length
    : 0;
  const exportAvgMargin = filteredExportMenuItems.length > 0
    ? filteredExportMenuItems.reduce((sum, i) => sum + (i.profitMargin || 0), 0) / filteredExportMenuItems.length
    : 0;

  // Build export data
  const buildMenuExportData = (records: MenuItemSelect[]) => {
    const headers = ['Item ID', 'Item Name', 'Category', `Base Price (${settings.currency})`];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['left', 'left', 'left', 'right'];

    if (exportIncludeMargin) {
      headers.push(`Profit Margin (${settings.currency})`, 'Margin %');
      columnAlignments.push('right', 'right');
    }
    if (exportIncludeCost) {
      headers.push(`Estimated Cost (${settings.currency})`);
      columnAlignments.push('right');
    }
    headers.push('Stock Availability', 'Badge Tag');
    columnAlignments.push('center', 'center');

    if (exportIncludeDescription) {
      headers.push('Description');
      columnAlignments.push('left');
    }

    const rows = records.map((item) => {
      const catName = categories.find((c) => c.id === item.categoryId)?.name || 'General';
      const margin = item.profitMargin ?? 0;
      const cost = Math.max(0, item.basePrice - margin);
      const marginPct = item.basePrice > 0 ? `${((margin / item.basePrice) * 100).toFixed(1)}%` : '0%';

      const row: (string | number)[] = [
        item.id,
        item.name,
        catName,
        parseFloat(item.basePrice.toFixed(2))
      ];

      if (exportIncludeMargin) {
        row.push(parseFloat(margin.toFixed(2)), marginPct);
      }
      if (exportIncludeCost) {
        row.push(parseFloat(cost.toFixed(2)));
      }
      row.push(item.isInStock ? 'In Stock' : 'Sold Out', item.badge || 'None');

      if (exportIncludeDescription) {
        row.push(item.description || '');
      }

      return row;
    });

    return { headers, rows, columnAlignments };
  };

  // Export Styled Excel Handler
  const handleExportExcel = (records = filteredExportMenuItems) => {
    const { headers, rows, columnAlignments } = buildMenuExportData(records);
    const totalsRow: (string | number)[] = [
      'AVERAGES / TOTAL',
      `${records.length} Menu Items`,
      '',
      parseFloat(exportAvgPrice.toFixed(2))
    ];
    if (exportIncludeMargin) {
      totalsRow.push(parseFloat(exportAvgMargin.toFixed(2)), '');
    }
    if (exportIncludeCost) {
      totalsRow.push(parseFloat((exportAvgPrice - exportAvgMargin).toFixed(2)));
    }
    totalsRow.push(`${exportInStockCount} In Stock / ${exportOutOfStockCount} Out`, '');
    if (exportIncludeDescription) {
      totalsRow.push('');
    }

    const dateSuffix = new Date().toISOString().slice(0, 10);
    const catObj = exportCategoryId !== 'all' ? categories.find((c) => c.id === exportCategoryId) : null;
    const catSuffix = catObj ? `_${catObj.name.toLowerCase().replace(/\s+/g, '_')}` : '';

    downloadStyledExcel({
      filename: `menu_catalogue${catSuffix}_${dateSuffix}.xls`,
      title: 'CHTH Cafe — Menu Items & Pricing Catalogue',
      subtitle: `Export Date: ${new Date().toLocaleDateString()} | Category: ${catObj?.name || 'ALL CATEGORIES'} | Items: ${records.length}`,
      themeColor: 'amber',
      metadata: {
        'Category Filter': catObj?.name || 'All Categories',
        'Stock Filter': exportStockStatus.toUpperCase(),
        'Badge Filter': exportBadge.toUpperCase(),
        'Sort Order': `${exportSortBy.toUpperCase()} (${exportSortOrder.toUpperCase()})`,
        'Store Currency': settings.currency
      },
      summaryCards: [
        { label: 'Total Items', value: records.length },
        { label: 'In Stock', value: `${exportInStockCount} (${records.length > 0 ? Math.round((exportInStockCount / records.length) * 100) : 0}%)` },
        { label: 'Avg Base Price', value: `${settings.currency}${exportAvgPrice.toFixed(2)}` },
        { label: 'Avg Margin', value: `${settings.currency}${exportAvgMargin.toFixed(2)}` }
      ],
      headers,
      rows,
      columnAlignments,
      totalsRow
    });
  };

  const handleExportCSV = (records = filteredExportMenuItems) => {
    const { headers, rows } = buildMenuExportData(records);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const catObj = exportCategoryId !== 'all' ? categories.find((c) => c.id === exportCategoryId) : null;
    const catSuffix = catObj ? `_${catObj.name.toLowerCase().replace(/\s+/g, '_')}` : '';
    downloadCSV(`menu_catalogue${catSuffix}_${dateSuffix}.csv`, headers, rows);
  };

  const handleExportJSON = (records = filteredExportMenuItems) => {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const catObj = exportCategoryId !== 'all' ? categories.find((c) => c.id === exportCategoryId) : null;
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        currency: settings.currency,
        totalItems: records.length,
        filters: {
          category: catObj?.name || 'all',
          stockStatus: exportStockStatus,
          badge: exportBadge,
          sortBy: exportSortBy,
          sortOrder: exportSortOrder
        },
        summary: {
          inStockCount: exportInStockCount,
          outOfStockCount: exportOutOfStockCount,
          averageBasePrice: exportAvgPrice,
          averageProfitMargin: exportAvgMargin
        }
      },
      items: records.map((i) => ({
        id: i.id,
        name: i.name,
        category: categories.find((c) => c.id === i.categoryId)?.name || 'General',
        basePrice: i.basePrice,
        profitMargin: i.profitMargin,
        estimatedCost: Math.max(0, i.basePrice - (i.profitMargin || 0)),
        isInStock: i.isInStock,
        badge: i.badge,
        description: i.description
      }))
    };
    downloadJSON(`menu_catalogue_${dateSuffix}.json`, data);
  };

  const handleCopyCSV = async (records = filteredExportMenuItems) => {
    const { headers, rows } = buildMenuExportData(records);
    const ok = await copyCSVToClipboard(headers, rows);
    if (ok) {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    }
  };

  const handleResetExportFilters = () => {
    setExportCategoryId('all');
    setExportStockStatus('all');
    setExportBadge('all');
    setExportSortBy('price');
    setExportSortOrder('desc');
    setExportIncludeMargin(true);
    setExportIncludeCost(true);
    setExportIncludeDescription(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in font-sans">
      {/* Header Banner */}
      <div className="glass-panel-classy p-5 rounded-3xl border border-zinc-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center brand-glow">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-2">
              Menu & Inventory Control
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Manage categories, item selling prices, profit margins & stock availability</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title="Open Menu Export & Filter Dialog"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export Menu
          </button>
          <button
            onClick={() => setAddCatOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-400" /> New Category
          </button>
          <button
            onClick={() => setAddItemOpen(true)}
            className="px-4 py-2 rounded-xl btn-brand text-zinc-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Menu Item
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MENU HEALTH & STOCK INFOGRAPHIC                                          */}
      {/* ========================================================================= */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-zinc-800/80 space-y-4 shadow-lg">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2 text-zinc-200">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Menu Stock Health & Category Distribution</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {inStockCount} In Stock ({stockRatioPct}%)
            </span>
            {outOfStockCount > 0 && (
              <span className="text-rose-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {outOfStockCount} Sold Out
              </span>
            )}
          </div>
        </div>

        {/* Category Stack Ratio Bar Infographic */}
        <div className="w-full h-3.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800 flex">
          {categories.map((c, idx) => {
            const count = menuItems.filter((i) => i.categoryId === c.id).length;
            const pct = menuItems.length > 0 ? (count / menuItems.length) * 100 : 0;
            const palette = getCategoryColor(c.icon, idx);
            return pct > 0 ? (
              <div
                key={c.id}
                className={`h-full ${palette.gradient} border-r border-zinc-950 transition-all hover:brightness-125`}
                style={{ width: `${pct}%` }}
                title={`${c.name}: ${count} items (${Math.round(pct)}%)`}
              />
            ) : null;
          })}
        </div>

        {/* Category Badges Grid */}
        <div className="flex flex-wrap gap-2 text-xs">
          {categories.map((c, idx) => {
            const count = menuItems.filter((i) => i.categoryId === c.id).length;
            const palette = getCategoryColor(c.icon, idx);
            return (
              <span
                key={c.id}
                className={`px-3 py-1.5 rounded-xl bg-zinc-900/90 border ${palette.border} text-zinc-300 font-bold flex items-center gap-2`}
              >
                <span className={palette.text}>
                  {CATEGORY_ICONS[c.icon || 'Coffee'] || <Coffee className="w-3.5 h-3.5" />}
                </span>
                <span>{c.name}</span>
                <span className={`px-1.5 py-0.5 rounded-md ${palette.bg} ${palette.text} text-[10px] font-extrabold`}>
                  {count}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CATEGORIES & ITEMS MANAGEMENT GRID                                         */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {categories.map((cat, catIdx) => {
          const itemsInCat = menuItems.filter((i) => i.categoryId === cat.id);
          const palette = getCategoryColor(cat.icon, catIdx);

          return (
            <div key={cat.id} className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl bg-zinc-900 border ${palette.border} ${palette.text}`}>
                    {CATEGORY_ICONS[cat.icon || 'Coffee'] || <Coffee className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-100 text-base">{cat.name}</h3>
                    <span className="text-[11px] text-zinc-400 font-medium">Category ID: {cat.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-400 text-xs font-bold border border-zinc-800">
                    {itemsInCat.length} Items
                  </span>
                  <button
                    onClick={() => openEditCategory(cat)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-950/40 cursor-pointer transition-colors border border-transparent hover:border-amber-900/40"
                    title="Edit Category"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => promptDeleteCategory(cat.id, cat.name, itemsInCat.length)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer transition-colors border border-transparent hover:border-rose-900/40"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {itemsInCat.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">No items in this category yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {itemsInCat.map((item) => {
                    const margin = item.profitMargin ?? 0;
                    const marginPct = item.basePrice > 0 ? ((margin / item.basePrice) * 100).toFixed(1) : '0';
                    const estimatedCost = Math.max(0, item.basePrice - margin);

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                          item.isInStock
                            ? 'bg-zinc-900/80 border-zinc-800/80 hover:border-amber-500/30'
                            : 'bg-rose-950/20 border-rose-900/40 opacity-75'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-extrabold text-sm text-zinc-100 block truncate">{item.name}</span>
                            <div className="text-right">
                              <span className="font-black text-sm text-amber-400 font-mono block">
                                {settings.currency}{item.basePrice.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-zinc-400 uppercase font-semibold">Selling Price</span>
                            </div>
                          </div>

                          {item.description && (
                            <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{item.description}</p>
                          )}

                          {/* Profit Margin (Second Price) Card Indicator */}
                          <div className="mt-2.5 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/90 space-y-1 profit-margin-highlight-box">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-zinc-400 font-medium flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-emerald-400" /> Profit Margin:
                              </span>
                              <span className="font-bold font-mono text-emerald-400">
                                {settings.currency}{margin.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-zinc-900 text-zinc-400">
                              <span>Est. Cost: <strong className="text-zinc-300 font-mono">{settings.currency}{estimatedCost.toFixed(2)}</strong></span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold font-mono">
                                {marginPct}% margin
                              </span>
                            </div>
                          </div>

                          {item.badge && (
                            <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                              {item.badge}
                            </span>
                          )}
                        </div>

                        {/* Stock Toggle, Edit & Delete Action */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                          <button
                            onClick={() => handleToggleStock(item.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 cursor-pointer ${
                              item.isInStock
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>{item.isInStock ? 'In Stock' : 'Sold Out'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openRecipeModal(item)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-sky-400 hover:bg-sky-950/40 cursor-pointer transition-colors"
                              title="Configure Recipe Ingredients"
                            >
                              <Boxes className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditItem(item)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-amber-950/40 cursor-pointer transition-colors"
                              title="Edit Menu Item & Profit Margin"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => promptDeleteItem(item.id, item.name)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* CREATE CATEGORY MODAL                                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={addCatOpen}
        onClose={() => setAddCatOpen(false)}
        title="Create New Category"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleCreateCategory} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Category Title
            </label>
            <input
              type="text"
              placeholder="e.g. Specialty Cold Brews"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Category Icon
            </label>
            <select
              value={newCatIcon}
              onChange={(e) => setNewCatIcon(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer focus:outline-none focus:border-amber-500"
            >
              <option value="Coffee">Coffee / Espresso</option>
              <option value="Leaf">Leaf / Tea</option>
              <option value="GlassWater">Cold Refreshment</option>
              <option value="Cake">Bakery & Pastries</option>
              <option value="Utensils">Brunch & Food</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer"
          >
            Add Category
          </button>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* CREATE MENU ITEM MODAL                                                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={addItemOpen}
        onClose={() => {
          setFormError('');
          setAddItemOpen(false);
        }}
        title="Add New Menu Item"
      >
        <form onSubmit={handleCreateItem} className="space-y-3.5 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={itemCatId}
              onChange={(e) => setItemCatId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Item Name
            </label>
            <input
              type="text"
              placeholder="e.g. Vanilla Cloud Latte"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
              required
            />
          </div>

          {/* Price Inputs Grid: Base Price (1st Price) + Profit Margin (2nd Price) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Base Selling Price ({settings.currency})
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="6.75"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Profit Margin ({settings.currency})
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="3.50"
                value={itemProfitMargin}
                onChange={(e) => setItemProfitMargin(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-emerald-500/40 text-emerald-300 font-mono focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Live Calculation Preview Banner */}
          {itemPrice && (
            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-[11px] text-zinc-300 font-mono profit-margin-highlight-box">
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase">Est. Cost Price</span>
                <span className="font-bold text-zinc-200">
                  {settings.currency}
                  {Math.max(0, (parseFloat(itemPrice) || 0) - (parseFloat(itemProfitMargin) || 0)).toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-zinc-500 text-[10px] block uppercase">Margin %</span>
                <span className="font-bold text-emerald-400">
                  {parseFloat(itemPrice) > 0
                    ? (((parseFloat(itemProfitMargin) || 0) / parseFloat(itemPrice)) * 100).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Badge Tag (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Signature, Chef Special, Bestseller"
              value={itemBadge}
              onChange={(e) => setItemBadge(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              placeholder="Short description of taste, roast level, or ingredients..."
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 h-20"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer"
          >
            Create Menu Item
          </button>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT MENU ITEM MODAL                                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit Menu Item & Profit Margin"
      >
        <form onSubmit={handleUpdateItem} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={editItemCatId}
              onChange={(e) => setEditItemCatId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Item Name
            </label>
            <input
              type="text"
              value={editItemName}
              onChange={(e) => setEditItemName(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
              required
            />
          </div>

          {/* Edit Prices: Base Selling Price + Profit Margin */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Base Selling Price ({settings.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={editItemPrice}
                onChange={(e) => setEditItemPrice(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Profit Margin ({settings.currency})
              </label>
              <input
                type="number"
                step="0.01"
                value={editItemProfitMargin}
                onChange={(e) => setEditItemProfitMargin(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-emerald-500/40 text-emerald-300 font-mono focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Edit Calculation Live Preview */}
          <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-[11px] text-zinc-300 font-mono profit-margin-highlight-box">
            <div>
              <span className="text-zinc-500 text-[10px] block uppercase">Est. Cost Price</span>
              <span className="font-bold text-zinc-200">
                {settings.currency}
                {Math.max(0, (parseFloat(editItemPrice) || 0) - (parseFloat(editItemProfitMargin) || 0)).toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 text-[10px] block uppercase">Margin %</span>
              <span className="font-bold text-emerald-400">
                {parseFloat(editItemPrice) > 0
                  ? (((parseFloat(editItemProfitMargin) || 0) / parseFloat(editItemPrice)) * 100).toFixed(1)
                  : '0.0'}%
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Badge Tag (Optional)
            </label>
            <input
              type="text"
              value={editItemBadge}
              onChange={(e) => setEditItemBadge(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              value={editItemDesc}
              onChange={(e) => setEditItemDesc(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 h-20"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer"
          >
            Save Changes
          </button>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={!!deleteConfirmTarget}
        onClose={() => setDeleteConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
        title={deleteConfirmTarget?.type === 'category' ? 'Delete Category' : 'Delete Menu Item'}
        description={
          deleteConfirmTarget?.type === 'category' ? (
            <span>
              Are you sure you want to delete category <strong className="text-zinc-100 font-bold">{deleteConfirmTarget.name}</strong>?
              {deleteConfirmTarget.itemCount && deleteConfirmTarget.itemCount > 0 ? (
                <span className="block mt-1 text-rose-400 font-semibold">
                  Warning: This will also delete all {deleteConfirmTarget.itemCount} menu items under this category.
                </span>
              ) : null}
            </span>
          ) : (
            <span>
              Are you sure you want to delete menu item <strong className="text-zinc-100 font-bold">{deleteConfirmTarget?.name}</strong>? This action cannot be undone.
            </span>
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* ========================================================================= */}
      {/* RECIPE CONFIGURATION MODAL                                                */}
      {/* ========================================================================= */}
      {recipeModalItem && (
        <Modal
          isOpen={!!recipeModalItem}
          onClose={() => setRecipeModalItem(null)}
          title={`Configure Recipe: ${recipeModalItem.name}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <p className="text-zinc-400 text-xs">
              Assign raw materials and specific quantities consumed for each portion of this dish or drink.
            </p>

            {/* Current Ingredients List */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Recipe Ingredients ({recipeIngredients.length})
              </span>

              {recipeIngredients.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-zinc-500">
                  No raw materials assigned to this recipe yet.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {recipeIngredients.map((ing) => {
                    const material = store.getStockItems().find((s) => s.id === ing.stockItemId);
                    const cost = material ? (ing.quantityRequired * material.unitCost).toFixed(2) : '0.00';

                    return (
                      <div
                        key={ing.stockItemId}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold text-zinc-100 block">
                            {material ? material.name : ing.stockItemId}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {ing.quantityRequired} {material?.unit || 'units'} required per portion (Est. {settings.currency || '₹'}{cost})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(ing.stockItemId)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Ingredient Form */}
            <form onSubmit={handleAddIngredient} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                Add Raw Material Ingredient
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Select Material</label>
                  <select
                    value={selectedStockId}
                    onChange={(e) => setSelectedStockId(e.target.value)}
                    className="w-full p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none"
                  >
                    {store.getStockItems().map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.name} ({mat.quantity} {mat.unit} in stock)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Qty Required Per Portion</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 0.015"
                    value={ingredientQty}
                    onChange={(e) => setIngredientQty(e.target.value)}
                    className="w-full p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-500/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Ingredient to Recipe
              </button>
            </form>

            {/* Calculated Recipe Summary */}
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-400 block">Estimated Recipe Cost:</span>
                <span className="text-[10px] text-zinc-400">Calculated from unit costs of raw materials</span>
              </div>
              <span className="text-base font-black text-emerald-400">
                {settings.currency || '₹'}
                {recipeIngredients
                  .reduce((acc, ing) => {
                    const mat = store.getStockItems().find((s) => s.id === ing.stockItemId);
                    return acc + (mat ? ing.quantityRequired * mat.unitCost : 0);
                  }, 0)
                  .toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecipeModalItem(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRecipe}
                className="px-5 py-2 rounded-xl btn-brand text-zinc-950 font-bold text-xs cursor-pointer shadow-md"
              >
                Save Recipe Config
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* EXPORT MENU CATALOGUE MODAL */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-amber-400" />
            <span>Export Menu Catalogue & Price List</span>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Context Banner */}
          <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-400 flex items-start gap-2.5">
            <Filter className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="leading-relaxed text-[11px]">
              Export filtered beverage and bakery menu items, profit margin analyses, cost calculations, and inventory availability rosters.
            </p>
          </div>

          {/* 1. Category & Stock Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" /> 1. Category Filter
              </label>
              <select
                value={exportCategoryId}
                onChange={(e) => setExportCategoryId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-amber-500"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                2. Stock Status
              </label>
              <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'in_stock', label: 'In Stock' },
                  { id: 'out_of_stock', label: 'Sold Out' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setExportStockStatus(s.id as any)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer text-center ${
                      exportStockStatus === s.id
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Sorting & Column Inclusions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" /> 3. Sort By
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={exportSortBy}
                  onChange={(e) => setExportSortBy(e.target.value as MenuSortField)}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] cursor-pointer focus:border-amber-500"
                >
                  <option value="price">Base Price</option>
                  <option value="margin">Profit Margin</option>
                  <option value="name">Item Name</option>
                  <option value="category">Category</option>
                  <option value="stock">Stock Status</option>
                </select>

                <select
                  value={exportSortOrder}
                  onChange={(e) => setExportSortOrder(e.target.value as SortOrder)}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] cursor-pointer focus:border-amber-500"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                4. Columns Included
              </label>
              <div className="space-y-1 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeMargin}
                    onChange={(e) => setExportIncludeMargin(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Profit Margin & Margin %</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeCost}
                    onChange={(e) => setExportIncludeCost(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Estimated Cost ({settings.currency})</span>
                </label>
              </div>
            </div>
          </div>

          {/* 3. Live Summary Card */}
          <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
              <span>Menu Export Summary</span>
              <button
                type="button"
                onClick={() => setShowPreviewTable((prev) => !prev)}
                className="text-[10px] text-amber-300 hover:text-amber-200 underline cursor-pointer flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> {showPreviewTable ? 'Hide Records Preview' : 'Show Records Preview'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Total Items</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {filteredExportMenuItems.length}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">In Stock</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {exportInStockCount}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Avg Price</span>
                <span className="text-base font-black text-zinc-100 font-mono">
                  {settings.currency}{exportAvgPrice.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Avg Margin</span>
                <span className="text-base font-black text-emerald-300 font-mono">
                  {settings.currency}{exportAvgMargin.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Live Mini Preview */}
            {showPreviewTable && (
              <div className="pt-2 animate-fade-in">
                {filteredExportMenuItems.length === 0 ? (
                  <p className="text-center py-4 text-zinc-500 italic text-[11px]">
                    No menu items match the selected filter criteria.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/90 text-[10px]">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-900/90 text-zinc-400 uppercase font-bold sticky top-0 border-b border-zinc-800">
                        <tr>
                          <th className="p-2">Item Name</th>
                          <th className="p-2">Category</th>
                          <th className="p-2 text-right">Price</th>
                          {exportIncludeMargin && <th className="p-2 text-right">Margin</th>}
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        {filteredExportMenuItems.slice(0, 5).map((item) => {
                          const catName = categories.find((c) => c.id === item.categoryId)?.name || 'General';
                          return (
                            <tr key={item.id} className="hover:bg-zinc-900/50">
                              <td className="p-2 font-bold text-zinc-100">{item.name}</td>
                              <td className="p-2 text-zinc-400">{catName}</td>
                              <td className="p-2 text-right font-mono text-zinc-200">{settings.currency}{item.basePrice.toFixed(2)}</td>
                              {exportIncludeMargin && (
                                <td className="p-2 text-right font-mono text-emerald-400">
                                  +{settings.currency}{(item.profitMargin || 0).toFixed(2)}
                                </td>
                              )}
                              <td className="p-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                  item.isInStock ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                  {item.isInStock ? 'In Stock' : 'Out'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredExportMenuItems.length > 5 && (
                      <div className="p-1.5 bg-zinc-900/50 text-center text-zinc-500 text-[9px] border-t border-zinc-800/60">
                        + {filteredExportMenuItems.length - 5} more items will be exported (sorted by {exportSortBy})
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleResetExportFilters}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-zinc-800"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={filteredExportMenuItems.length === 0}
                onClick={() => handleCopyCSV()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-xs font-bold border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copy CSV to clipboard"
              >
                {copiedFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-amber-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" /> Copy CSV
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={filteredExportMenuItems.length === 0}
                onClick={() => handleExportJSON()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 text-xs font-bold border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download JSON format"
              >
                <FileCode className="w-3.5 h-3.5" /> JSON
              </button>

              <button
                type="button"
                disabled={filteredExportMenuItems.length === 0}
                onClick={() => handleExportCSV()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download raw CSV file"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" /> CSV
              </button>

              <button
                type="button"
                disabled={filteredExportMenuItems.length === 0}
                onClick={() => handleExportExcel()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                title="Download Styled Excel (.xls) price list with colors, headers & margin totals"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Styled Excel ({filteredExportMenuItems.length})
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
