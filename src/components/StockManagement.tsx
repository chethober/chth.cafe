import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  DollarSign,
  Package,
  Pencil,
  Trash2,
  RefreshCw,
  Layers,
  Sparkles,
  Zap,
  Tag,
  Download,
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
import { StockItemSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import {
  downloadStyledExcel,
  downloadCSV,
  downloadJSON,
  copyCSVToClipboard
} from '../utils/exportUtils';

interface StockManagementProps {
  settings: SettingsSelect;
  stockItems: StockItemSelect[];
  onStockUpdated: () => void;
}

type StockSortField = 'quantity' | 'unitCost' | 'totalValuation' | 'name' | 'category';
type SortOrder = 'desc' | 'asc';

const STOCK_CATEGORIES = [
  'All',
  'Tea & Coffee',
  'Dairy & Milk',
  'Syrups & Flavors',
  'Bakery & Flour',
  'Produce',
  'Packaging',
  'Other'
];

const MEASUREMENT_UNITS = ['kg', 'g', 'liters', 'ml', 'units', 'bags', 'packs'];

export const StockManagement: React.FC<StockManagementProps> = ({
  settings,
  stockItems,
  onStockUpdated
}) => {
  const currency = settings.currency || '₹';

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Export Modal & Filter States
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCategory, setExportCategory] = useState<string>('all');
  const [exportStatus, setExportStatus] = useState<'all' | 'normal' | 'low_stock' | 'out_of_stock'>('all');
  const [exportSortBy, setExportSortBy] = useState<StockSortField>('totalValuation');
  const [exportSortOrder, setExportSortOrder] = useState<SortOrder>('desc');
  const [exportIncludeThreshold, setExportIncludeThreshold] = useState(true);
  const [exportIncludeUnitCost, setExportIncludeUnitCost] = useState(true);
  const [showPreviewTable, setShowPreviewTable] = useState(true);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItemSelect | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Tea & Coffee');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnit, setFormUnit] = useState('kg');
  const [formUnitCost, setFormUnitCost] = useState('');
  const [formMinThreshold, setFormMinThreshold] = useState('5.0');
  const [formError, setFormError] = useState('');

  const openAddModal = () => {
    setFormName('');
    setFormCategory('Tea & Coffee');
    setFormQuantity('');
    setFormUnit('kg');
    setFormUnitCost('');
    setFormMinThreshold('5.0');
    setFormError('');
    setIsAddOpen(true);
  };

  const openEditModal = (item: StockItemSelect) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormQuantity(item.quantity.toString());
    setFormUnit(item.unit);
    setFormUnitCost(item.unitCost.toString());
    setFormMinThreshold(item.minThreshold.toString());
    setFormError('');
  };

  const handleSaveStockItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Raw Material Name is required.');
      return;
    }
    const qty = parseFloat(formQuantity);
    if (isNaN(qty) || qty < 0) {
      setFormError('Please enter a valid non-negative quantity.');
      return;
    }
    const cost = parseFloat(formUnitCost);
    if (isNaN(cost) || cost < 0) {
      setFormError('Please enter a valid unit cost.');
      return;
    }
    const threshold = parseFloat(formMinThreshold);
    if (isNaN(threshold) || threshold < 0) {
      setFormError('Please enter a valid minimum threshold.');
      return;
    }

    if (editingItem) {
      store.updateStockItem(editingItem.id, {
        name: formName.trim(),
        category: formCategory,
        quantity: qty,
        unit: formUnit,
        unitCost: cost,
        minThreshold: threshold
      });
      setEditingItem(null);
    } else {
      store.addStockItem({
        name: formName.trim(),
        category: formCategory,
        quantity: qty,
        unit: formUnit,
        unitCost: cost,
        minThreshold: threshold
      });
      setIsAddOpen(false);
    }

    onStockUpdated();
  };

  const handleQuickAdjust = (id: string, delta: number) => {
    store.adjustStockQuantity(id, delta);
    onStockUpdated();
  };

  const handleDeleteConfirm = () => {
    if (deletingId) {
      store.deleteStockItem(deletingId);
      setDeletingId(null);
      onStockUpdated();
    }
  };

  // Metrics calculation
  const totalValuation = stockItems.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);
  const lowStockCount = stockItems.filter((i) => i.quantity > 0 && i.quantity <= i.minThreshold).length;
  const outOfStockCount = stockItems.filter((i) => i.quantity <= 0).length;

  // Filtered & Sorted stock items for export
  const filteredExportStockItems = useMemo(() => {
    const list = stockItems.filter((item) => {
      if (exportCategory !== 'all' && item.category !== exportCategory) return false;
      if (exportStatus === 'normal' && (item.quantity <= item.minThreshold || item.quantity <= 0)) return false;
      if (exportStatus === 'low_stock' && (item.quantity <= 0 || item.quantity > item.minThreshold)) return false;
      if (exportStatus === 'out_of_stock' && item.quantity > 0) return false;
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (exportSortBy === 'totalValuation') {
        cmp = (a.quantity * a.unitCost) - (b.quantity * b.unitCost);
      } else if (exportSortBy === 'quantity') {
        cmp = a.quantity - b.quantity;
      } else if (exportSortBy === 'unitCost') {
        cmp = a.unitCost - b.unitCost;
      } else if (exportSortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (exportSortBy === 'category') {
        cmp = a.category.localeCompare(b.category);
      }
      return exportSortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [stockItems, exportCategory, exportStatus, exportSortBy, exportSortOrder]);

  // Export summary metrics
  const exportTotalValuation = useMemo(() => {
    return filteredExportStockItems.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);
  }, [filteredExportStockItems]);

  const exportLowStockCount = filteredExportStockItems.filter((i) => i.quantity > 0 && i.quantity <= i.minThreshold).length;
  const exportOutOfStockCount = filteredExportStockItems.filter((i) => i.quantity <= 0).length;
  const exportInStockCount = filteredExportStockItems.length - exportLowStockCount - exportOutOfStockCount;

  // Build export rows helper
  const buildStockExportData = (records: StockItemSelect[]) => {
    const headers = ['Material ID', 'Material Name', 'Category', 'Quantity Available', 'Unit'];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['left', 'left', 'left', 'right', 'center'];

    if (exportIncludeUnitCost) {
      headers.push(`Unit Cost (${currency})`);
      columnAlignments.push('right');
    }
    headers.push(`Total Valuation (${currency})`);
    columnAlignments.push('right');

    if (exportIncludeThreshold) {
      headers.push('Min Threshold', 'Stock Status');
      columnAlignments.push('right', 'center');
    }

    const rows = records.map((item) => {
      const val = item.quantity * item.unitCost;
      let statusStr = 'Normal';
      if (item.quantity <= 0) statusStr = 'OUT OF STOCK';
      else if (item.quantity <= item.minThreshold) statusStr = 'LOW STOCK ALERT';

      const row: (string | number)[] = [
        item.id,
        item.name,
        item.category,
        parseFloat(item.quantity.toFixed(3)),
        item.unit
      ];

      if (exportIncludeUnitCost) {
        row.push(parseFloat(item.unitCost.toFixed(2)));
      }
      row.push(parseFloat(val.toFixed(2)));

      if (exportIncludeThreshold) {
        row.push(parseFloat(item.minThreshold.toFixed(2)), statusStr);
      }

      return row;
    });

    return { headers, rows, columnAlignments };
  };

  // Export Styled Excel Handler
  const handleExportExcel = (records = filteredExportStockItems) => {
    const { headers, rows, columnAlignments } = buildStockExportData(records);
    const totalsRow: (string | number)[] = [
      'TOTAL VALUATION',
      `${records.length} Raw Materials`,
      '',
      '',
      ''
    ];
    if (exportIncludeUnitCost) {
      totalsRow.push('');
    }
    totalsRow.push(parseFloat(exportTotalValuation.toFixed(2)));
    if (exportIncludeThreshold) {
      totalsRow.push('', `${exportLowStockCount} Low / ${exportOutOfStockCount} Out`);
    }

    const dateSuffix = new Date().toISOString().slice(0, 10);
    const catSuffix = exportCategory !== 'all' ? `_${exportCategory.toLowerCase().replace(/\s+/g, '_')}` : '';

    downloadStyledExcel({
      filename: `stock_inventory${catSuffix}_${dateSuffix}.xls`,
      title: 'CHTH Cafe — Stock & Raw Material Inventory Report',
      subtitle: `Export Date: ${new Date().toLocaleDateString()} | Category: ${exportCategory.toUpperCase()} | Total Asset Value: ${currency}${exportTotalValuation.toFixed(2)}`,
      themeColor: exportLowStockCount > 0 ? 'amber' : 'emerald',
      metadata: {
        'Category Filter': exportCategory.toUpperCase(),
        'Stock Alert Filter': exportStatus.toUpperCase(),
        'Sort Order': `${exportSortBy.toUpperCase()} (${exportSortOrder.toUpperCase()})`,
        'Store Currency': currency
      },
      summaryCards: [
        { label: 'Total Valuation', value: `${currency}${exportTotalValuation.toFixed(2)}` },
        { label: 'Total Materials', value: records.length },
        { label: 'Low Stock Alerts', value: exportLowStockCount },
        { label: 'Out of Stock', value: exportOutOfStockCount }
      ],
      headers,
      rows,
      columnAlignments,
      totalsRow
    });
  };

  const handleExportCSV = (records = filteredExportStockItems) => {
    const { headers, rows } = buildStockExportData(records);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const catSuffix = exportCategory !== 'all' ? `_${exportCategory.toLowerCase().replace(/\s+/g, '_')}` : '';
    downloadCSV(`stock_inventory${catSuffix}_${dateSuffix}.csv`, headers, rows);
  };

  const handleExportJSON = (records = filteredExportStockItems) => {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        currency: currency,
        totalItems: records.length,
        filters: {
          category: exportCategory,
          status: exportStatus,
          sortBy: exportSortBy,
          sortOrder: exportSortOrder
        },
        summary: {
          totalValuation: exportTotalValuation,
          inStockCount: exportInStockCount,
          lowStockCount: exportLowStockCount,
          outOfStockCount: exportOutOfStockCount
        }
      },
      stockItems: records.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit: i.unit,
        unitCost: i.unitCost,
        minThreshold: i.minThreshold,
        totalValuation: i.quantity * i.unitCost,
        status: i.quantity <= 0 ? 'out_of_stock' : i.quantity <= i.minThreshold ? 'low_stock' : 'in_stock'
      }))
    };
    downloadJSON(`stock_inventory_${dateSuffix}.json`, data);
  };

  const handleCopyCSV = async (records = filteredExportStockItems) => {
    const { headers, rows } = buildStockExportData(records);
    const ok = await copyCSVToClipboard(headers, rows);
    if (ok) {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    }
  };

  const handleResetExportFilters = () => {
    setExportCategory('all');
    setExportStatus('all');
    setExportSortBy('totalValuation');
    setExportSortOrder('desc');
    setExportIncludeThreshold(true);
    setExportIncludeUnitCost(true);
  };

  // Filtered List
  const filteredItems = stockItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

    let matchesStatus = true;
    if (statusFilter === 'in_stock') matchesStatus = item.quantity > item.minThreshold;
    if (statusFilter === 'low_stock') matchesStatus = item.quantity > 0 && item.quantity <= item.minThreshold;
    if (statusFilter === 'out_of_stock') matchesStatus = item.quantity <= 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/90 p-5 sm:p-6 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight">
                Stock & Inventory Management
              </h1>
            </div>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              Manage raw materials, track unit costs, total valuation, and set up automated low-stock alerts.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs sm:text-sm border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title="Open Stock Inventory Export & Filter Dialog"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export Stock
          </button>
          <button
            onClick={openAddModal}
            className="btn-brand px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-zinc-950 flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Raw Material
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Valuation Card */}
        <div className="bg-zinc-900/80 p-4 sm:p-5 rounded-2xl border border-zinc-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Total Inventory Valuation
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
              {currency}{totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Total asset value across all materials
            </p>
          </div>
        </div>

        {/* Total Raw Materials Card */}
        <div className="bg-zinc-900/80 p-4 sm:p-5 rounded-2xl border border-zinc-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Total Material SKUs
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
              {stockItems.length}
            </span>
            <p className="text-[11px] text-zinc-400 font-medium mt-1">
              Active raw materials cataloged
            </p>
          </div>
        </div>

        {/* Low Stock Alerts Card */}
        <div className="bg-zinc-900/80 p-4 sm:p-5 rounded-2xl border border-zinc-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Low Stock Warnings
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
              {lowStockCount}
            </span>
            <p className="text-[11px] text-amber-400/90 font-medium mt-1">
              At or below minimum threshold
            </p>
          </div>
        </div>

        {/* Out of Stock Card */}
        <div className="bg-zinc-900/80 p-4 sm:p-5 rounded-2xl border border-zinc-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Out of Stock Items
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight">
              {outOfStockCount}
            </span>
            <p className="text-[11px] text-rose-400/90 font-medium mt-1">
              Requires immediate reordering
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by material name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              All Items ({stockItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('in_stock')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'in_stock'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/40'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              In Stock ({stockItems.filter((i) => i.quantity > i.minThreshold).length})
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'low_stock'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/40'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Low Stock ({lowStockCount})
            </button>
            <button
              onClick={() => setStatusFilter('out_of_stock')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'out_of_stock'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/40'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Out of Stock ({outOfStockCount})
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-zinc-800/60">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 mr-1">
            Category:
          </span>
          {STOCK_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'btn-brand text-zinc-950 shadow-sm'
                  : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Items Grid / Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
          <Boxes className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-300">No Raw Materials Found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            No stock items matched your search query or filter criteria. Add a new material or clear filters.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2 rounded-xl btn-brand text-zinc-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isOutOfStock = item.quantity <= 0;
            const isLowStock = !isOutOfStock && item.quantity <= item.minThreshold;
            const totalPrice = (item.quantity * item.unitCost).toFixed(2);
            const stockPct = Math.min(100, Math.round((item.quantity / (item.minThreshold * 2.5)) * 100));

            return (
              <div
                key={item.id}
                className={`bg-zinc-900/90 rounded-2xl border p-5 transition-all flex flex-col justify-between gap-4 shadow-lg hover:border-zinc-700 ${
                  isOutOfStock
                    ? 'border-rose-900/50 bg-gradient-to-b from-zinc-900 to-rose-950/20'
                    : isLowStock
                    ? 'border-amber-900/50 bg-gradient-to-b from-zinc-900 to-amber-950/20'
                    : 'border-zinc-800'
                }`}
              >
                <div>
                  {/* Category & Status Badge Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {item.category}
                    </span>

                    {isOutOfStock ? (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Out of Stock
                      </span>
                    ) : isLowStock ? (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> Low Stock Warning
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> In Stock
                      </span>
                    )}
                  </div>

                  {/* Title & Quantity */}
                  <h3 className="text-base font-black text-zinc-100 tracking-tight leading-snug">
                    {item.name}
                  </h3>

                  {/* Quantity Display */}
                  <div className="mt-3 flex items-baseline justify-between bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                    <div>
                      <span className="text-xs text-zinc-400 font-semibold block">Current Quantity</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span
                          className={`text-2xl font-black ${
                            isOutOfStock
                              ? 'text-rose-400'
                              : isLowStock
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {item.quantity}
                        </span>
                        <span className="text-xs font-bold text-zinc-400">{item.unit}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-zinc-400 font-semibold block">Min Threshold</span>
                      <span className="text-sm font-bold text-zinc-300 mt-0.5 block">
                        {item.minThreshold} {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Progress Indicator Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full transition-all ${
                          isOutOfStock
                            ? 'bg-rose-500'
                            : isLowStock
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(5, stockPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800/60 text-xs">
                    <div>
                      <span className="text-zinc-500 font-medium block text-[10px]">Unit Cost</span>
                      <span className="font-bold text-zinc-200">
                        {currency}{item.unitCost.toFixed(2)} / {item.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-500 font-medium block text-[10px]">Total Price</span>
                      <span className="font-extrabold text-amber-400">
                        {currency}{totalPrice}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Adjust & Actions Footer */}
                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
                  {/* Quick +/- Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuickAdjust(item.id, item.unit === 'g' || item.unit === 'ml' ? -100 : -1)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black transition-colors border border-zinc-700 cursor-pointer"
                      title="Reduce stock"
                    >
                      {item.unit === 'g' || item.unit === 'ml' ? '-100' : '-1'}
                    </button>
                    <button
                      onClick={() => handleQuickAdjust(item.id, item.unit === 'g' || item.unit === 'ml' ? 100 : 1)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black transition-colors border border-zinc-700 cursor-pointer"
                      title="Increase stock"
                    >
                      {item.unit === 'g' || item.unit === 'ml' ? '+100' : '+1'}
                    </button>
                  </div>

                  {/* Edit & Delete Action Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 transition-colors border border-zinc-700 hover:border-amber-500/30 cursor-pointer"
                      title="Edit item"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingId(item.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 transition-colors border border-zinc-700 hover:border-rose-500/30 cursor-pointer"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Raw Material Modal */}
      {(isAddOpen || editingItem) && (
        <Modal
          isOpen={isAddOpen || !!editingItem}
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
          title={editingItem ? 'Edit Raw Material' : 'Add New Raw Material'}
        >
          <form onSubmit={handleSaveStockItem} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Raw Material Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Ceremonial Uji Matcha Powder"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50"
                >
                  {STOCK_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Measurement Unit
                </label>
                <select
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50"
                >
                  {MEASUREMENT_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.0"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Unit Cost ({currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={formUnitCost}
                  onChange={(e) => setFormUnitCost(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Min Threshold *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="5.0"
                  value={formMinThreshold}
                  onChange={(e) => setFormMinThreshold(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
            </div>

            {/* Calculated Total Valuation Preview */}
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-semibold">Calculated Total Valuation:</span>
              <span className="text-sm font-black text-amber-400">
                {currency}
                {(
                  (parseFloat(formQuantity) || 0) * (parseFloat(formUnitCost) || 0)
                ).toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingItem(null);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl btn-brand text-zinc-950 font-bold text-xs shadow-md cursor-pointer"
              >
                {editingItem ? 'Save Changes' : 'Add Material'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <ConfirmModal
          isOpen={!!deletingId}
          onClose={() => setDeletingId(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Raw Material"
          description="Are you sure you want to delete this raw material from stock inventory? Any recipes using this material will also be updated."
        />
      )}

      {/* EXPORT STOCK & INVENTORY MODAL */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
            <span>Export Stock & Raw Material Inventory</span>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Context Banner */}
          <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-400 flex items-start gap-2.5">
            <Filter className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="leading-relaxed text-[11px]">
              Export filtered raw material levels, asset valuations, unit cost registries, and low-stock threshold warning lists.
            </p>
          </div>

          {/* 1. Category & Stock Alert Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-emerald-400" /> 1. Material Category
              </label>
              <select
                value={exportCategory}
                onChange={(e) => setExportCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-emerald-500"
              >
                <option value="all">All Categories ({STOCK_CATEGORIES.length - 1})</option>
                {STOCK_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                2. Stock Alert Level
              </label>
              <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'low_stock', label: 'Low' },
                  { id: 'out_of_stock', label: 'Out' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setExportStatus(s.id as any)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer text-center ${
                      exportStatus === s.id
                        ? 'bg-emerald-500 text-zinc-950 shadow-sm'
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
                  onChange={(e) => setExportSortBy(e.target.value as StockSortField)}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] cursor-pointer focus:border-emerald-500"
                >
                  <option value="totalValuation">Total Valuation</option>
                  <option value="quantity">Stock Quantity</option>
                  <option value="unitCost">Unit Cost</option>
                  <option value="name">Material Name</option>
                  <option value="category">Category</option>
                </select>

                <select
                  value={exportSortOrder}
                  onChange={(e) => setExportSortOrder(e.target.value as SortOrder)}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] cursor-pointer focus:border-emerald-500"
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
                    checked={exportIncludeUnitCost}
                    onChange={(e) => setExportIncludeUnitCost(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Unit Cost & Unit of Measure</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeThreshold}
                    onChange={(e) => setExportIncludeThreshold(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Min Threshold & Alert Status</span>
                </label>
              </div>
            </div>
          </div>

          {/* 3. Live Summary Card */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
              <span>Stock Inventory Summary</span>
              <button
                type="button"
                onClick={() => setShowPreviewTable((prev) => !prev)}
                className="text-[10px] text-emerald-300 hover:text-emerald-200 underline cursor-pointer flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> {showPreviewTable ? 'Hide Records Preview' : 'Show Records Preview'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Total Valuation</span>
                <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                  {currency}{exportTotalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Total Materials</span>
                <span className="text-sm sm:text-base font-black text-zinc-200 font-mono">
                  {filteredExportStockItems.length}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Low Stock Alerts</span>
                <span className="text-sm sm:text-base font-black text-amber-400 font-mono">
                  {exportLowStockCount}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Out of Stock</span>
                <span className="text-sm sm:text-base font-black text-rose-400 font-mono">
                  {exportOutOfStockCount}
                </span>
              </div>
            </div>

            {/* Live Mini Preview */}
            {showPreviewTable && (
              <div className="pt-2 animate-fade-in">
                {filteredExportStockItems.length === 0 ? (
                  <p className="text-center py-4 text-zinc-500 italic text-[11px]">
                    No raw materials match the selected filter criteria.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/90 text-[10px]">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-900/90 text-zinc-400 uppercase font-bold sticky top-0 border-b border-zinc-800">
                        <tr>
                          <th className="p-2">Material Name</th>
                          <th className="p-2">Category</th>
                          <th className="p-2 text-right">Available Qty</th>
                          <th className="p-2 text-right">Valuation</th>
                          <th className="p-2 text-center">Alert</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        {filteredExportStockItems.slice(0, 5).map((item) => {
                          const val = item.quantity * item.unitCost;
                          return (
                            <tr key={item.id} className="hover:bg-zinc-900/50">
                              <td className="p-2 font-bold text-zinc-100">{item.name}</td>
                              <td className="p-2 text-zinc-400">{item.category}</td>
                              <td className="p-2 text-right font-mono text-zinc-200">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="p-2 text-right font-mono text-emerald-400 font-bold">
                                {currency}{val.toFixed(2)}
                              </td>
                              <td className="p-2 text-center">
                                {item.quantity <= 0 ? (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    Out
                                  </span>
                                ) : item.quantity <= item.minThreshold ? (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    Low
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredExportStockItems.length > 5 && (
                      <div className="p-1.5 bg-zinc-900/50 text-center text-zinc-500 text-[9px] border-t border-zinc-800/60">
                        + {filteredExportStockItems.length - 5} more items will be exported (sorted by {exportSortBy})
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
                disabled={filteredExportStockItems.length === 0}
                onClick={() => handleCopyCSV()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-xs font-bold border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copy CSV to clipboard"
              >
                {copiedFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" /> Copy CSV
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={filteredExportStockItems.length === 0}
                onClick={() => handleExportJSON()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 text-xs font-bold border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download JSON format"
              >
                <FileCode className="w-3.5 h-3.5" /> JSON
              </button>

              <button
                type="button"
                disabled={filteredExportStockItems.length === 0}
                onClick={() => handleExportCSV()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download raw CSV file"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" /> CSV
              </button>

              <button
                type="button"
                disabled={filteredExportStockItems.length === 0}
                onClick={() => handleExportExcel()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                title="Download Styled Excel (.xls) inventory valuation report with colors, headers & totals"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Styled Excel ({filteredExportStockItems.length})
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
