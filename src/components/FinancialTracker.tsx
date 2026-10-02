import { Reconciliation } from './Reconciliation';
import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Plus,
  PieChart,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Trash2,
  X,
  BarChart3,
  Percent,
  Layers,
  Sparkles,
  CreditCard,
  Building,
  CheckCircle2,
  Tag,
  Calendar,
  Filter,
  CreditCard as CardIcon,
  Coins,
  QrCode,
  Download,
  SlidersHorizontal,
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  RotateCcw,
  Eye,
  ArrowUpDown
} from 'lucide-react';
import { OrderSelect, ExpenseSelect, SettingsSelect, MenuItemSelect } from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import { ManualLogModal } from './ManualLogModal';
import { QuickPOSModal } from './QuickPOSModal';
import {
  downloadStyledExcel,
  downloadCSV,
  downloadJSON,
  copyCSVToClipboard
} from '../utils/exportUtils';

interface FinancialTrackerProps {
  settings: SettingsSelect;
  orders: OrderSelect[];
  expenses: ExpenseSelect[];
  menuItems: MenuItemSelect[];
  onFinancialsUpdated: () => void;
}

type DatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';
type FinancialSortField = 'date' | 'amount' | 'type' | 'name';
type SortOrder = 'desc' | 'asc';

const EXPENSE_CATEGORIES = [
  'Tea & Coffee Supplies',
  'Packaging & Cups',
  'Utilities & Power',
  'Equipment & Repairs',
  'Rent & Lease',
  'Labor Wages (Staff)',
  'Marketing & Other'
];

const INCOME_CATEGORIES = [
  'Catering & Corporate',
  'Wholesale Tea & Coffee',
  'Event & Space Rental',
  'Merchandise & Retail',
  'Consulting & Services',
  'General Manual Revenue'
];

const CATEGORY_COLORS: Record<string, string> = {
  'Tea & Coffee Supplies': 'bg-emerald-500',
  'Packaging & Cups': 'bg-teal-400',
  'Utilities & Power': 'bg-amber-400',
  'Equipment & Repairs': 'bg-rose-400',
  'Rent & Lease': 'bg-purple-400',
  'Labor Wages (Staff)': 'bg-blue-500',
  'Marketing & Other': 'bg-indigo-400'
};

export const FinancialTracker: React.FC<FinancialTrackerProps> = ({
  settings,
  orders,
  expenses,
  menuItems,
  onFinancialsUpdated
}) => {
  // Manual Log Modal State
  const [manualLogOpen, setManualLogOpen] = useState(false);

  // Quick POS Modal State
  const [quickPOSOpen, setQuickPOSOpen] = useState(false);

  // Trend Chart Time Filter State ('7d' | '30d' | '12m')
  const [trendFilter, setTrendFilter] = useState<'7d' | '30d' | '12m'>('7d');

  // Selected Order Details Modal State
  const [viewOrderModal, setViewOrderModal] = useState<OrderSelect | null>(null);

  // Export Modal & Filter States
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'all' | 'orders' | 'expenses'>('all');
  const [exportDatePreset, setExportDatePreset] = useState<DatePreset>('all');
  const [exportCustomStart, setExportCustomStart] = useState('');
  const [exportCustomEnd, setExportCustomEnd] = useState('');
  const [exportPaymentMethod, setExportPaymentMethod] = useState<string>('all');
  const [exportCategory, setExportCategory] = useState<string>('');
  const [exportSortBy, setExportSortBy] = useState<FinancialSortField>('date');
  const [exportSortOrder, setExportSortOrder] = useState<SortOrder>('desc');
  const [exportIncludeCustomer, setExportIncludeCustomer] = useState(true);
  const [exportIncludePaymentMethod, setExportIncludePaymentMethod] = useState(true);
  const [showPreviewTable, setShowPreviewTable] = useState(true);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const analytics = store.getFinancialAnalytics();

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'order' | 'expense';
    id: string;
    label: string;
  } | null>(null);

  const handleDeleteOrder = (orderId: string, orderNumber: string) => {
    setDeleteConfirmTarget({ type: 'order', id: orderId, label: orderNumber });
  };

  const handleDeleteExpense = (expenseId: string, desc: string) => {
    setDeleteConfirmTarget({ type: 'expense', id: expenseId, label: desc });
  };

  const handleConfirmDeleteFinancial = () => {
    if (!deleteConfirmTarget) return;
    if (deleteConfirmTarget.type === 'order') {
      store.deleteOrder(deleteConfirmTarget.id);
    } else {
      store.deleteExpense(deleteConfirmTarget.id);
    }
    setDeleteConfirmTarget(null);
    onFinancialsUpdated();
  };

  // Payment Breakdown Calculations for 4 Channels
  const cashOrders = orders.filter((o) => o.status === 'completed' && o.paymentMethod === 'cash');
  const cardOrders = orders.filter((o) => o.status === 'completed' && o.paymentMethod === 'card');
  const gpayOrders = orders.filter((o) => o.status === 'completed' && o.paymentMethod === 'google_pay');
  const onlineOrders = orders.filter((o) => o.status === 'completed' && o.paymentMethod === 'online');

  const cashRevenue = cashOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const cardRevenue = cardOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const gpayRevenue = gpayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const onlineRevenue = onlineOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const totalRevForCalc = analytics.totalSalesRevenue || 1;
  const cashPct = Math.round((cashRevenue / totalRevForCalc) * 100);
  const cardPct = Math.round((cardRevenue / totalRevForCalc) * 100);
  const gpayPct = Math.round((gpayRevenue / totalRevForCalc) * 100);
  const onlinePct = Math.round((onlineRevenue / totalRevForCalc) * 100);

  // Sales by Product Breakdown
  const allOrderItems = store.getOrderItems();
  const productSalesMap: Record<string, { name: string; revenue: number; qty: number }> = {};
  allOrderItems.forEach((item) => {
    const key = item.itemName || 'Item';
    if (!productSalesMap[key]) {
      productSalesMap[key] = { name: key, revenue: 0, qty: 0 };
    }
    productSalesMap[key].revenue += item.quantity * item.unitPrice;
    productSalesMap[key].qty += item.quantity;
  });

  const productSalesList = Object.values(productSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const totalTopProductRev = productSalesList.reduce((sum, p) => sum + p.revenue, 1);
  const PRODUCT_COLORS = ['#10B981', '#F59E0B', '#6366F1', '#EC4899', '#3B82F6'];

  // Time-Series Aggregation for 3 Line Charts (Revenue, Expense, Net Profit)
  const getTimeSeriesData = () => {
    const points: Array<{ label: string; revenue: number; expense: number; profit: number }> = [];
    const now = new Date();

    if (trendFilter === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString([], { weekday: 'short' });

        const dayOrders = orders.filter((o) => o.status === 'completed' && o.createdAt.startsWith(dateStr));
        const dayExpenses = expenses.filter((e) => e.date.startsWith(dateStr));

        const revenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const expense = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
        const profit = revenue - expense;

        points.push({ label: dayLabel, revenue, expense, profit });
      }
    } else if (trendFilter === '30d') {
      for (let i = 4; i >= 0; i--) {
        const label = `W${5 - i}`;
        const startDay = i * 6;
        const endDay = (i + 1) * 6;

        const rev = orders.slice(startDay, endDay).reduce((sum, o) => sum + o.totalAmount, 0);
        const exp = expenses.slice(startDay, endDay).reduce((sum, e) => sum + e.amount, 0);
        points.push({ label, revenue: rev, expense: exp, profit: rev - exp });
      }
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 5; i >= 0; i--) {
        const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mLabel = monthNames[mDate.getMonth()];
        const yStr = mDate.toISOString().slice(0, 7);

        const mOrders = orders.filter((o) => o.status === 'completed' && o.createdAt.startsWith(yStr));
        const mExpenses = expenses.filter((e) => e.date.startsWith(yStr));

        const rev = mOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const exp = mExpenses.reduce((sum, e) => sum + e.amount, 0);

        points.push({ label: mLabel, revenue: rev, expense: exp, profit: rev - exp });
      }
    }

    // Ensure non-zero visual curves for smooth line rendering
    const maxVal = Math.max(
      ...points.flatMap((p) => [p.revenue, p.expense, Math.abs(p.profit)]),
      100
    );

    return { points, maxVal };
  };

  const trendData = getTimeSeriesData();

  // Date range bounds calculation
  const getDateRangeBounds = (preset: DatePreset, customStart: string, customEnd: string) => {
    const now = new Date();
    if (preset === 'all') return { start: null, end: null };

    if (preset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
      const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }

    if (preset === 'custom') {
      const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
      const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
      return { start, end };
    }

    return { start: null, end: null };
  };

  interface ExportTransactionRow {
    id: string;
    type: 'Order' | 'Expense';
    refNumber: string;
    name: string;
    categoryOrType: string;
    description: string;
    amount: number;
    paymentMethod: string;
    date: string;
  }

  // Filtered & Sorted Transactions for export
  const filteredExportTransactions = useMemo(() => {
    const { start, end } = getDateRangeBounds(exportDatePreset, exportCustomStart, exportCustomEnd);
    const rows: ExportTransactionRow[] = [];

    // Include Orders
    if (exportType === 'all' || exportType === 'orders') {
      orders.forEach((o) => {
        const d = new Date(o.createdAt).getTime();
        if (start && d < start.getTime()) return;
        if (end && d > end.getTime()) return;

        if (exportPaymentMethod !== 'all' && o.paymentMethod?.toLowerCase() !== exportPaymentMethod.toLowerCase()) {
          return;
        }

        if (exportCategory && o.orderType !== exportCategory && o.customerName !== exportCategory) {
          return;
        }

        rows.push({
          id: o.id,
          type: 'Order',
          refNumber: o.orderNumber,
          name: o.customerName || 'Walk-in Customer',
          categoryOrType: `${o.orderType || 'Standard'} Order`,
          description: `${o.orderType || 'Walk-in'} Sale`,
          amount: o.totalAmount,
          paymentMethod: o.paymentMethod || 'cash',
          date: o.createdAt
        });
      });
    }

    // Include Expenses
    if (exportType === 'all' || exportType === 'expenses') {
      expenses.forEach((e) => {
        const d = new Date(e.date || e.createdAt).getTime();
        if (start && d < start.getTime()) return;
        if (end && d > end.getTime()) return;

        if (exportPaymentMethod !== 'all' && e.paymentMethod?.toLowerCase() !== exportPaymentMethod.toLowerCase()) {
          return;
        }

        if (exportCategory && e.category !== exportCategory) {
          return;
        }

        rows.push({
          id: e.id,
          type: 'Expense',
          refNumber: e.id,
          name: e.category,
          categoryOrType: e.category,
          description: e.description || e.category,
          amount: e.amount,
          paymentMethod: e.paymentMethod || 'cash',
          date: e.date || e.createdAt
        });
      });
    }

    // Sorting
    rows.sort((a, b) => {
      let cmp = 0;
      if (exportSortBy === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (exportSortBy === 'amount') {
        cmp = a.amount - b.amount;
      } else if (exportSortBy === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else if (exportSortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      }
      return exportSortOrder === 'desc' ? -cmp : cmp;
    });

    return rows;
  }, [orders, expenses, exportType, exportDatePreset, exportCustomStart, exportCustomEnd, exportPaymentMethod, exportCategory, exportSortBy, exportSortOrder]);

  // Export summary metrics
  const exportTotalRevenue = useMemo(() => {
    return filteredExportTransactions.filter((t) => t.type === 'Order').reduce((sum, t) => sum + t.amount, 0);
  }, [filteredExportTransactions]);

  const exportTotalExpenses = useMemo(() => {
    return filteredExportTransactions.filter((t) => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
  }, [filteredExportTransactions]);

  const exportNetProfit = exportTotalRevenue - exportTotalExpenses;

  // Build export rows helper
  const buildFinancialExportData = (records: ExportTransactionRow[]) => {
    const headers = ['Type', 'ID / Ref', 'Name / Category', 'Description', `Amount (${settings.currency})`];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['center', 'left', 'left', 'left', 'right'];

    if (exportIncludePaymentMethod) {
      headers.push('Payment Method');
      columnAlignments.push('center');
    }
    headers.push('Date & Time');
    columnAlignments.push('center');

    const rows = records.map((t) => {
      const dateFmt = new Date(t.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      const row: (string | number)[] = [
        t.type,
        t.refNumber,
        t.name,
        t.description,
        t.type === 'Order' ? parseFloat(t.amount.toFixed(2)) : -parseFloat(t.amount.toFixed(2))
      ];

      if (exportIncludePaymentMethod) {
        row.push(t.paymentMethod.toUpperCase());
      }
      row.push(dateFmt);
      return row;
    });

    return { headers, rows, columnAlignments };
  };

  // Export Styled Excel Handler
  const handleExportExcel = (records = filteredExportTransactions) => {
    const { headers, rows, columnAlignments } = buildFinancialExportData(records);
    const totalsRow: (string | number)[] = [
      'NET TOTALS',
      '',
      '',
      `${records.length} Transactions`,
      parseFloat(exportNetProfit.toFixed(2))
    ];
    if (exportIncludePaymentMethod) {
      totalsRow.push('');
    }
    totalsRow.push(exportNetProfit >= 0 ? 'NET PROFIT' : 'NET DEFICIT');

    const dateSuffix = new Date().toISOString().slice(0, 10);

    downloadStyledExcel({
      filename: `financial_ledger_${exportType}_${exportDatePreset}_${dateSuffix}.xls`,
      title: 'CHTH Cafe — Financial Ledger & P&L Statement',
      subtitle: `Generated: ${new Date().toLocaleDateString()} | Type: ${exportType.toUpperCase()} | Period: ${exportDatePreset.toUpperCase()}`,
      themeColor: exportNetProfit >= 0 ? 'emerald' : 'amber',
      metadata: {
        'Ledger Scope': exportType === 'all' ? 'All Transactions (Sales & Expenses)' : exportType === 'orders' ? 'Sales Revenue Only' : 'Operating Expenses Only',
        'Time Period': exportDatePreset.replace('_', ' ').toUpperCase(),
        'Payment Method Filter': exportPaymentMethod.toUpperCase(),
        'Sort Order': `${exportSortBy.toUpperCase()} (${exportSortOrder.toUpperCase()})`,
        'Store Currency': settings.currency
      },
      summaryCards: [
        { label: 'Total Revenue', value: `${settings.currency}${exportTotalRevenue.toFixed(2)}` },
        { label: 'Operating Expenses', value: `${settings.currency}${exportTotalExpenses.toFixed(2)}` },
        { label: 'Net Profit / Loss', value: `${settings.currency}${exportNetProfit.toFixed(2)}` },
        { label: 'Total Records', value: records.length }
      ],
      headers,
      rows,
      columnAlignments,
      totalsRow
    });
  };

  const handleExportCSV = (records = filteredExportTransactions) => {
    const { headers, rows } = buildFinancialExportData(records);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadCSV(`financial_report_${exportType}_${exportDatePreset}_${dateSuffix}.csv`, headers, rows);
  };

  const handleExportJSON = (records = filteredExportTransactions) => {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        currency: settings.currency,
        totalRecords: records.length,
        filters: {
          type: exportType,
          datePreset: exportDatePreset,
          customStart: exportCustomStart || null,
          customEnd: exportCustomEnd || null,
          paymentMethod: exportPaymentMethod,
          category: exportCategory || 'all',
          sortBy: exportSortBy,
          sortOrder: exportSortOrder
        },
        summary: {
          totalRevenue: exportTotalRevenue,
          totalExpenses: exportTotalExpenses,
          netProfit: exportNetProfit
        }
      },
      transactions: records
    };
    downloadJSON(`financial_report_${exportType}_${exportDatePreset}_${dateSuffix}.json`, data);
  };

  const handleCopyCSV = async (records = filteredExportTransactions) => {
    const { headers, rows } = buildFinancialExportData(records);
    const ok = await copyCSVToClipboard(headers, rows);
    if (ok) {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    }
  };

  const handleResetExportFilters = () => {
    setExportType('all');
    setExportDatePreset('all');
    setExportCustomStart('');
    setExportCustomEnd('');
    setExportPaymentMethod('all');
    setExportCategory('');
    setExportSortBy('date');
    setExportSortOrder('desc');
    setExportIncludeCustomer(true);
    setExportIncludePaymentMethod(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in font-sans">
      <Reconciliation settings={settings} />
      {/* Header Banner */}
      <div className="glass-panel-classy p-5 rounded-3xl border border-zinc-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center brand-glow">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-2">
              Financial Analytics & Profit & Loss
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Real-time sales revenue, cost ledger & profit metrics</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title="Open Financial Export & Filter Dialog"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export Financials
          </button>
          <button
            onClick={() => setManualLogOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> Log Income / Expense
          </button>
          <button
            onClick={() => setQuickPOSOpen(true)}
            className="px-4 py-2 rounded-xl btn-brand text-zinc-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" /> Quick POS Order
          </button>
        </div>
      </div>

      {/* EXECUTIVE FINANCIAL KPI METRIC SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-3xl border border-zinc-800/80 space-y-1.5 shadow-md">
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">Gross Sales Revenue</span>
          <span className="text-xl sm:text-2xl font-black text-zinc-100 font-mono block">
            {settings.currency}{analytics.totalSalesRevenue.toFixed(2)}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{analytics.totalOrdersCount} Completed Sales</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-3xl border border-zinc-800/80 space-y-1.5 shadow-md">
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">Combined Expenses</span>
          <span className="text-xl sm:text-2xl font-black text-rose-400 font-mono block">
            {settings.currency}{analytics.combinedExpenses.toFixed(2)}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-rose-400 font-semibold">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Inc. {settings.currency}{analytics.totalLaborWages.toFixed(2)} labor</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-3xl border border-zinc-800/80 space-y-1.5 shadow-md">
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">Net Operating Profit</span>
          <span className={`text-xl sm:text-2xl font-black font-mono block ${analytics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {settings.currency}{analytics.netProfit.toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-500 font-medium block">After COGS & Staff Wages</span>
        </div>

        <div className="glass-panel p-4 rounded-3xl border border-zinc-800/80 space-y-1.5 shadow-md">
          <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">Net Profit Margin</span>
          <span className="text-xl sm:text-2xl font-black text-indigo-400 font-mono block">
            {analytics.profitMargin}%
          </span>
          <span className="text-[10px] text-zinc-500 font-medium block">
            Avg Ticket: {settings.currency}{analytics.averageOrderValue.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INFOGRAPHICS SECTION: REVENUE TREND & SIDE-BY-SIDE PIE CHARTS             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* INFOGRAPHIC 1: 3 LINE CHARTS THROUGH TIME WITH FILTER (6 COLS) */}
        <div className="lg:col-span-6 glass-panel p-5 sm:p-6 rounded-3xl border border-zinc-800/80 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="font-black text-zinc-100 text-sm tracking-tight">Revenue vs Expense Line Trend</h3>
            </div>
            
            {/* Filter Buttons for 7 Days, 30 Days, 12 Months */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-[10px]">
              <button
                type="button"
                onClick={() => setTrendFilter('7d')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  trendFilter === '7d' ? 'btn-brand text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setTrendFilter('30d')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  trendFilter === '30d' ? 'btn-brand text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setTrendFilter('12m')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  trendFilter === '12m' ? 'btn-brand text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                12 Months
              </button>
            </div>
          </div>

          {/* SVG 3 Line Charts Through Time */}
          <div className="space-y-3 pt-1">
            <div className="h-44 bg-zinc-900/80 rounded-2xl border border-zinc-800 p-3 relative flex flex-col justify-between">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none opacity-15">
                <div className="border-b border-zinc-500 w-full" />
                <div className="border-b border-zinc-500 w-full" />
                <div className="border-b border-zinc-500 w-full" />
              </div>

              {/* Line Chart SVG */}
              <svg className="w-full h-32 overflow-visible relative z-10" viewBox="0 0 300 100" preserveAspectRatio="none">
                {(() => {
                  const pts = trendData.points;
                  const max = trendData.maxVal || 100;
                  const stepX = 300 / Math.max(pts.length - 1, 1);

                  const revCoords = pts.map((p, i) => `${i * stepX},${100 - (p.revenue / max) * 90}`);
                  const expCoords = pts.map((p, i) => `${i * stepX},${100 - (p.expense / max) * 90}`);
                  const prfCoords = pts.map((p, i) => `${i * stepX},${100 - (Math.max(p.profit, 0) / max) * 90}`);

                  return (
                    <>
                      {/* Line 1: Sales Revenue (Emerald) */}
                      <polyline
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={revCoords.join(' ')}
                        className="transition-all duration-500"
                      />
                      {/* Line 2: Expenses (Rose) */}
                      <polyline
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={expCoords.join(' ')}
                        className="transition-all duration-500"
                      />
                      {/* Line 3: Net Profit (Indigo) */}
                      <polyline
                        fill="none"
                        stroke="#6366F1"
                        strokeWidth="3"
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={prfCoords.join(' ')}
                        className="transition-all duration-500"
                      />

                      {/* Data Dots */}
                      {pts.map((p, i) => {
                        const cx = i * stepX;
                        const cyRev = 100 - (p.revenue / max) * 90;
                        const cyExp = 100 - (p.expense / max) * 90;
                        const cyPrf = 100 - (Math.max(p.profit, 0) / max) * 90;
                        return (
                          <g key={i}>
                            <circle cx={cx} cy={cyRev} r="3" fill="#10B981" />
                            <circle cx={cx} cy={cyExp} r="3" fill="#F43F5E" />
                            <circle cx={cx} cy={cyPrf} r="3" fill="#6366F1" />
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[10px] font-bold text-zinc-400 px-1 pt-1 z-10">
                {trendData.points.map((p, idx) => (
                  <span key={idx}>{p.label}</span>
                ))}
              </div>
            </div>

            {/* Line Legend */}
            <div className="flex items-center justify-center gap-4 text-xs font-bold pt-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-1 rounded-full bg-emerald-500" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-3 h-1 rounded-full bg-rose-500" /> Expenses
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="w-3 h-1 rounded-full bg-indigo-500 border border-dashed border-indigo-400" /> Net Profit
              </span>
            </div>
          </div>
        </div>

        {/* INFOGRAPHIC 2: SIDE-BY-SIDE PIE CHARTS (6 COLS) */}
        <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PIE CHART 1: PAYMENT CHANNEL SPLIT */}
          <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-zinc-800/80 space-y-3 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="w-4 h-4 text-amber-400" />
                <h3 className="font-black text-zinc-100 text-xs sm:text-sm tracking-tight">Payment Channel Split</h3>
              </div>

              {/* SVG Donut / Pie Chart for Payment Channels */}
              <div className="flex items-center justify-center py-2 relative">
                <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-zinc-900"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Cash Slice (Amber) */}
                  <path
                    className="text-amber-500 transition-all duration-500"
                    strokeDasharray={`${cashPct}, 100`}
                    strokeDashoffset="0"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Card Slice (Emerald) */}
                  <path
                    className="text-emerald-500 transition-all duration-500"
                    strokeDasharray={`${cardPct}, 100`}
                    strokeDashoffset={`-${cashPct}`}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* GPay Slice (Indigo) */}
                  <path
                    className="text-indigo-500 transition-all duration-500"
                    strokeDasharray={`${gpayPct}, 100`}
                    strokeDashoffset={`-${cashPct + cardPct}`}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Online Slice (Rose) */}
                  <path
                    className="text-rose-500 transition-all duration-500"
                    strokeDasharray={`${onlinePct}, 100`}
                    strokeDashoffset={`-${cashPct + cardPct + gpayPct}`}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-xs font-black text-zinc-100 font-mono">
                    {orders.length}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase">Orders</span>
                </div>
              </div>

              {/* Payment Legend */}
              <div className="space-y-1.5 pt-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Cash
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{cashPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Card
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{cardPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" /> GPay
                  </span>
                  <span className="font-mono text-indigo-400 font-bold">{gpayPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Online
                  </span>
                  <span className="font-mono text-rose-400 font-bold">{onlinePct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* PIE CHART 2: SALES BY PRODUCT */}
          <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-zinc-800/80 space-y-3 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                <h3 className="font-black text-zinc-100 text-xs sm:text-sm tracking-tight">Sales by Product</h3>
              </div>

              {/* SVG Donut / Pie Chart for Top Products */}
              {productSalesList.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-xs text-zinc-500 italic">
                  No sales data yet
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center py-2 relative">
                    <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-zinc-900"
                        strokeWidth="4"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {(() => {
                        let accumPct = 0;
                        return productSalesList.map((prod, idx) => {
                          const pct = Math.round((prod.revenue / totalTopProductRev) * 100);
                          const strokeColor = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
                          const pathEl = (
                            <path
                              key={prod.name}
                              strokeDasharray={`${pct}, 100`}
                              strokeDashoffset={`-${accumPct}`}
                              strokeWidth="4.5"
                              strokeLinecap="round"
                              stroke={strokeColor}
                              fill="none"
                              className="transition-all duration-500"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          );
                          accumPct += pct;
                          return pathEl;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        {productSalesList.reduce((sum, p) => sum + p.qty, 0)}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase">Items Sold</span>
                    </div>
                  </div>

                  {/* Product Legend */}
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    {productSalesList.slice(0, 4).map((prod, idx) => {
                      const pct = Math.round((prod.revenue / totalTopProductRev) * 100);
                      const color = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
                      return (
                        <div key={prod.name} className="flex items-center justify-between gap-1">
                          <span className="flex items-center gap-1.5 text-zinc-300 font-medium truncate max-w-[110px]" title={prod.name}>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="truncate">{prod.name}</span>
                          </span>
                          <span className="font-mono text-zinc-100 font-bold flex-shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPENSE LEDGER & RECENT SALES TRANSACTIONS                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Log Table */}
        <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-rose-400" /> Logged Operating Expenses
            </h3>
            <span className="text-xs text-zinc-400 font-bold">{expenses.length} Records</span>
          </div>

          {expenses.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-4">No expenses recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {expenses.map((e) => (
                <div
                  key={e.id}
                  className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-zinc-100 block">{e.description}</span>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {e.category} • {e.date}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-rose-400 font-mono">
                      -{settings.currency}{e.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleDeleteExpense(e.id, e.description)}
                      className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales Order Ledger */}
        <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" /> Recent Sales Transactions
            </h3>
            <span className="text-xs text-zinc-400 font-bold">{orders.length} Sales</span>
          </div>

          {orders.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-4">No sales recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {orders.slice(0, 10).map((o) => (
                <div
                  key={o.id}
                  onClick={() => setViewOrderModal(o)}
                  className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/50 flex items-center justify-between gap-3 text-xs transition-all cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-zinc-100 group-hover:text-amber-400">{o.orderNumber}</span>
                      <span className="text-[10px] text-zinc-400">({o.customerName || 'Walk-in'})</span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-400">
                      Payment: {o.paymentMethod === 'google_pay'
                        ? 'Google Pay'
                        : o.paymentMethod === 'online'
                        ? 'Swiggy / Zomato'
                        : o.paymentMethod}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-400 font-mono">
                      +{settings.currency}{o.totalAmount.toFixed(2)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOrder(o.id, o.orderNumber);
                      }}
                      className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ORDER DETAILS INSPECTOR MODAL */}
      <Modal
        isOpen={!!viewOrderModal}
        onClose={() => setViewOrderModal(null)}
        title={`Order Details • ${viewOrderModal?.orderNumber || ''}`}
        maxWidth="max-w-md"
      >
        {viewOrderModal && (
          <div className="space-y-4 text-xs">
            {/* Header summary */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-400">Customer:</span>
                <span className="font-extrabold text-zinc-100">{viewOrderModal.customerName || 'Walk-in'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-400">Order Type:</span>
                <span className="font-extrabold text-amber-400 uppercase">{viewOrderModal.orderType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-400">Payment Method:</span>
                <span className="font-extrabold text-emerald-400 capitalize">
                  {viewOrderModal.paymentMethod === 'google_pay'
                    ? 'Google Pay'
                    : viewOrderModal.paymentMethod === 'online'
                    ? 'Swiggy / Zomato'
                    : viewOrderModal.paymentMethod}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                <span className="font-bold text-zinc-400">Order Timestamp:</span>
                <span className="font-mono text-zinc-300">
                  {new Date(viewOrderModal.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Line items list */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Ordered Line Items</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {store.getOrderItems(viewOrderModal.id).length === 0 ? (
                  <p className="text-zinc-500 italic py-2">No individual line items registered for this order.</p>
                ) : (
                  store.getOrderItems(viewOrderModal.id).map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-zinc-100 block">{item.quantity}x {item.itemName}</span>
                        <span className="text-[10px] text-zinc-400">Unit Price: {settings.currency}{item.unitPrice.toFixed(2)}</span>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-xs">
                        {settings.currency}{(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Total calculation breakdown */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1 font-mono text-xs">
              {viewOrderModal.discountAmount > 0 && (
                <div className="flex items-center justify-between text-rose-400">
                  <span>Discount Applied:</span>
                  <span>-{settings.currency}{viewOrderModal.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-zinc-400">
                <span>Tax ({settings.taxRate}%):</span>
                <span>{settings.currency}{viewOrderModal.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-black text-amber-400 pt-1 border-t border-zinc-800">
                <span>Total Amount:</span>
                <span>{settings.currency}{viewOrderModal.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewOrderModal(null)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 font-bold text-zinc-200 cursor-pointer"
            >
              Close Details
            </button>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* LOG EXPENSE MODAL                                                          */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* LOG EXPENSE MODAL                                                          */}
      {/* ========================================================================= */}
      {/* Consolidated Manual Financial Log Entry Modal */}
      <ManualLogModal
        isOpen={manualLogOpen}
        onClose={() => setManualLogOpen(false)}
        settings={settings}
        onFinancialsUpdated={onFinancialsUpdated}
      />

      {/* Upgraded Multi-Item POS Walk-in Sale Modal with Date Picker */}
      <QuickPOSModal
        isOpen={quickPOSOpen}
        onClose={() => setQuickPOSOpen(false)}
        menuItems={menuItems}
        settings={settings}
        onOrderCreated={onFinancialsUpdated}
      />

      <ConfirmModal
        isOpen={!!deleteConfirmTarget}
        onClose={() => setDeleteConfirmTarget(null)}
        onConfirm={handleConfirmDeleteFinancial}
        title={deleteConfirmTarget?.type === 'order' ? 'Delete Order Record' : 'Delete Expense Log'}
        description={
          deleteConfirmTarget?.type === 'order' ? (
            <span>
              Are you sure you want to delete order <strong className="text-zinc-100 font-bold">{deleteConfirmTarget.label}</strong>? This financial record will be removed.
            </span>
          ) : (
            <span>
              Are you sure you want to delete expense <strong className="text-zinc-100 font-bold">"{deleteConfirmTarget?.label}"</strong>?
            </span>
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* EXPORT FINANCIAL TRANSACTIONS MODAL */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
            <span>Export Financial Ledger & P&L Statement</span>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Context Banner */}
          <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-400 flex items-start gap-2.5">
            <Filter className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="leading-relaxed text-[11px]">
              Export filtered transactions, sales revenue orders, and expense entries with customizable date ranges, payment methods, and automated P&L summaries.
            </p>
          </div>

          {/* 1. Transaction Type & Date Filter */}
          <div className="space-y-2.5 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-400" /> 1. Transaction Scope & Period
              </label>
              <span className="text-[10px] text-zinc-500 font-medium">Select type & date range</span>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              {[
                { id: 'all', label: 'All Transactions' },
                { id: 'orders', label: 'Sales Revenue Only' },
                { id: 'expenses', label: 'Expenses Only' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setExportType(t.id as any)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                    exportType === t.id
                      ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Date Presets Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 pt-1">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'custom', label: 'Custom Range...' }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setExportDatePreset(p.id as DatePreset)}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                    exportDatePreset === p.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-zinc-950/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs */}
            {exportDatePreset === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 animate-fade-in">
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 mb-1">Start Date</span>
                  <input
                    type="date"
                    value={exportCustomStart}
                    onChange={(e) => setExportCustomStart(e.target.value)}
                    className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono focus:border-emerald-500"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-zinc-400 mb-1">End Date</span>
                  <input
                    type="date"
                    value={exportCustomEnd}
                    onChange={(e) => setExportCustomEnd(e.target.value)}
                    className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Payment Method & Sorting Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-blue-400" /> 2. Payment Method Filter
              </label>
              <select
                value={exportPaymentMethod}
                onChange={(e) => setExportPaymentMethod(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-emerald-500"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI / QR Code</option>
                <option value="card">Card / POS</option>
                <option value="other">Other / Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" /> 3. Sort Order
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={exportSortBy}
                  onChange={(e) => setExportSortBy(e.target.value as FinancialSortField)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-emerald-500"
                >
                  <option value="date">Date & Time</option>
                  <option value="amount">Amount</option>
                  <option value="type">Type</option>
                  <option value="name">Customer / Category</option>
                </select>

                <select
                  value={exportSortOrder}
                  onChange={(e) => setExportSortOrder(e.target.value as SortOrder)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-emerald-500"
                >
                  <option value="desc">Desc (High / New)</option>
                  <option value="asc">Asc (Low / Old)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Live Summary Card */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
              <span>Financial Ledger Summary</span>
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
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Total Revenue</span>
                <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                  {settings.currency}{exportTotalRevenue.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Total Expenses</span>
                <span className="text-sm sm:text-base font-black text-rose-400 font-mono">
                  {settings.currency}{exportTotalExpenses.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Net Profit</span>
                <span className={`text-sm sm:text-base font-black font-mono ${exportNetProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {settings.currency}{exportNetProfit.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Entries</span>
                <span className="text-sm sm:text-base font-black text-zinc-200 font-mono">
                  {filteredExportTransactions.length}
                </span>
              </div>
            </div>

            {/* Live Mini Preview */}
            {showPreviewTable && (
              <div className="pt-2 animate-fade-in">
                {filteredExportTransactions.length === 0 ? (
                  <p className="text-center py-4 text-zinc-500 italic text-[11px]">
                    No financial records match the selected filter criteria.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/90 text-[10px]">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-900/90 text-zinc-400 uppercase font-bold sticky top-0 border-b border-zinc-800">
                        <tr>
                          <th className="p-2">Type</th>
                          <th className="p-2">Ref / ID</th>
                          <th className="p-2">Name / Category</th>
                          <th className="p-2">Method</th>
                          <th className="p-2 text-right">Amount</th>
                          <th className="p-2 text-center">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        {filteredExportTransactions.slice(0, 5).map((t) => (
                          <tr key={`${t.type}-${t.id}`} className="hover:bg-zinc-900/50">
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                t.type === 'Order' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="p-2 font-mono text-zinc-400">{t.refNumber}</td>
                            <td className="p-2 font-bold text-zinc-200">{t.name}</td>
                            <td className="p-2 uppercase text-zinc-400">{t.paymentMethod}</td>
                            <td className={`p-2 text-right font-mono font-bold ${t.type === 'Order' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {t.type === 'Order' ? '+' : '-'}{settings.currency}{t.amount.toFixed(2)}
                            </td>
                            <td className="p-2 text-center font-mono text-zinc-400">
                              {new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredExportTransactions.length > 5 && (
                      <div className="p-1.5 bg-zinc-900/50 text-center text-zinc-500 text-[9px] border-t border-zinc-800/60">
                        + {filteredExportTransactions.length - 5} more records will be exported (sorted by {exportSortBy})
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
                disabled={filteredExportTransactions.length === 0}
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
                disabled={filteredExportTransactions.length === 0}
                onClick={() => handleExportJSON()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 text-xs font-bold border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download JSON format"
              >
                <FileCode className="w-3.5 h-3.5" /> JSON
              </button>

              <button
                type="button"
                disabled={filteredExportTransactions.length === 0}
                onClick={() => handleExportCSV()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download raw CSV file"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" /> CSV
              </button>

              <button
                type="button"
                disabled={filteredExportTransactions.length === 0}
                onClick={() => handleExportExcel()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                title="Download Styled Excel (.xls) statement with P&L colors, headers & net totals"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Styled Excel ({filteredExportTransactions.length})
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
