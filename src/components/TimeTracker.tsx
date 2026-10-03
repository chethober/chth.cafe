import React, { useState, useMemo } from 'react';
import {
  Clock,
  UserCheck,
  UserX,
  KeyRound,
  Plus,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  DollarSign,
  BarChart3,
  Calendar,
  ShieldCheck,
  Download,
  Trash2,
  Edit3,
  GripVertical,
  Pencil,
  Filter,
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Search,
  Eye,
  ArrowUpDown
} from 'lucide-react';
import { StaffSelect, ShiftSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import {
  downloadStyledExcel,
  downloadCSV,
  downloadJSON,
  copyCSVToClipboard
} from '../utils/exportUtils';

interface TimeTrackerProps {
  settings: SettingsSelect;
  staffList: StaffSelect[];
  shifts: ShiftSelect[];
  onShiftUpdated: () => void;
}

type DatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';
type ShiftSortField = 'date' | 'hours' | 'wages' | 'name';
type SortOrder = 'desc' | 'asc';

export const TimeTracker: React.FC<TimeTrackerProps> = ({
  settings,
  staffList,
  shifts,
  onShiftUpdated
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [pinMode, setPinMode] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Barista');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRate, setNewStaffRate] = useState('18.50');

  // Export Modal & Filter States
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDatePreset, setExportDatePreset] = useState<DatePreset>('all');
  const [exportCustomStart, setExportCustomStart] = useState('');
  const [exportCustomEnd, setExportCustomEnd] = useState('');
  const [exportStaffId, setExportStaffId] = useState<string>('');
  const [exportRole, setExportRole] = useState<string>('');
  const [exportStatus, setExportStatus] = useState<'all' | 'completed' | 'active'>('all');
  const [exportSortBy, setExportSortBy] = useState<ShiftSortField>('date');
  const [exportSortOrder, setExportSortOrder] = useState<SortOrder>('desc');
  const [exportIncludeWages, setExportIncludeWages] = useState(true);
  const [exportIncludeNotes, setExportIncludeNotes] = useState(true);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [showPreviewTable, setShowPreviewTable] = useState(true);

  // In-table search & filter for Shift Attendance Records
  const [recordsSearch, setRecordsSearch] = useState('');
  const [recordsStaffFilter, setRecordsStaffFilter] = useState('');
  const [recordsStatusFilter, setRecordsStatusFilter] = useState<'all' | 'completed' | 'active'>('all');

  const handleKeypadPress = (val: string) => {
    if (val === 'CLEAR') {
      setPinInput('');
      return;
    }
    if (val === 'BACK') {
      setPinInput((prev) => prev.slice(0, -1));
      return;
    }
    if (pinInput.length < 9) {
      setPinInput((prev) => prev + val);
    }
  };

  const handlePinAction = () => {
    if (!pinInput.trim()) {
      setFeedback({ success: false, message: 'Enter assigned PIN' });
      return;
    }

    const res = pinMode === 'clock_in' ? store.clockIn(pinInput, '') : store.clockOut(pinInput, '');
    setFeedback(res);
    if (res.success) {
      setPinInput('');
      onShiftUpdated();
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPin.trim()) return;

    store.createStaff({
      name: newStaffName.trim(),
      role: newStaffRole,
      pin: newStaffPin.trim(),
      hourlyRate: parseFloat(newStaffRate) || 18.5,
      status: 'active'
    });

    setNewStaffName('');
    setNewStaffPin('');
    setAddStaffOpen(false);
    onShiftUpdated();
  };

  // Staff Edit & Delete State
  const [editingPinStaffId, setEditingPinStaffId] = useState<string | null>(null);
  const [changePinInput, setChangePinInput] = useState('');
  const [editingWageStaffId, setEditingWageStaffId] = useState<string | null>(null);
  const [changeWageInput, setChangeWageInput] = useState('');

  // Manual Shift Insert State
  const [addManualShiftOpen, setAddManualShiftOpen] = useState(false);
  const [manualShiftStaffId, setManualShiftStaffId] = useState('');
  const [manualClockIn, setManualClockIn] = useState('');
  const [manualClockOut, setManualClockOut] = useState('');
  const [manualShiftNotes, setManualShiftNotes] = useState('');

  // Shift Edit State
  const [editingShift, setEditingShift] = useState<ShiftSelect | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'staff' | 'shift';
    id: string;
    label?: string;
  } | null>(null);

  const handleDeleteStaff = (staffId: string, name: string) => {
    setDeleteConfirmTarget({ type: 'staff', id: staffId, label: name });
  };

  const handleDeleteShift = (shiftId: string) => {
    setDeleteConfirmTarget({ type: 'shift', id: shiftId });
  };

  const handleConfirmDeleteTimeTracker = () => {
    if (!deleteConfirmTarget) return;
    if (deleteConfirmTarget.type === 'staff') {
      store.deleteStaff(deleteConfirmTarget.id);
    } else {
      store.deleteShift(deleteConfirmTarget.id);
    }
    setDeleteConfirmTarget(null);
    onShiftUpdated();
  };

  const handleSaveStaffPin = (staffId: string) => {
    if (!changePinInput.trim()) return;
    store.updateStaff(staffId, { pin: changePinInput.trim() });
    setEditingPinStaffId(null);
    setChangePinInput('');
    onShiftUpdated();
  };

  const handleSaveStaffWage = (staffId: string) => {
    const rate = parseFloat(changeWageInput);
    if (isNaN(rate) || rate < 0) return;
    store.updateStaff(staffId, { hourlyRate: rate });
    setEditingWageStaffId(null);
    setChangeWageInput('');
    onShiftUpdated();
  };

  const handleCreateManualShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualShiftStaffId || !manualClockIn) return;

    store.createShift({
      staffId: manualShiftStaffId,
      clockIn: new Date(manualClockIn).toISOString(),
      clockOut: manualClockOut ? new Date(manualClockOut).toISOString() : null,
      notes: manualShiftNotes.trim()
    });

    setAddManualShiftOpen(false);
    setManualShiftStaffId('');
    setManualClockIn('');
    setManualClockOut('');
    setManualShiftNotes('');
    onShiftUpdated();
  };

  const handleOpenEditShift = (sh: ShiftSelect) => {
    setEditingShift(sh);
    setEditClockIn(sh.clockIn ? sh.clockIn.slice(0, 16) : '');
    setEditClockOut(sh.clockOut ? sh.clockOut.slice(0, 16) : '');
    setEditNotes(sh.notes || '');
  };

  const handleSaveShiftEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    store.updateShift(editingShift.id, {
      clockIn: editClockIn ? new Date(editClockIn).toISOString() : editingShift.clockIn,
      clockOut: editClockOut ? new Date(editClockOut).toISOString() : null,
      notes: editNotes.trim()
    });

    setEditingShift(null);
    onShiftUpdated();
  };

  const activeShifts = shifts.filter((s) => !s.clockOut);
  const totalLaborCost = shifts.reduce((acc, s) => acc + (s.totalPay || 0), 0);
  const totalHoursWorked = shifts.reduce((acc, s) => acc + (s.totalHours || 0), 0);

  // Available unique roles
  const availableRoles = useMemo(() => {
    const defaultRoles = ['Store Manager', 'Head Barista', 'Barista', 'Shift Supervisor', 'Cashier'];
    const staffRoles = staffList.map((st) => st.role).filter(Boolean);
    return Array.from(new Set([...defaultRoles, ...staffRoles]));
  }, [staffList]);

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

  // Reset export filters
  const handleResetExportFilters = () => {
    setExportDatePreset('all');
    setExportCustomStart('');
    setExportCustomEnd('');
    setExportStaffId('');
    setExportRole('');
    setExportStatus('all');
    setExportSortBy('date');
    setExportSortOrder('desc');
    setExportIncludeWages(true);
    setExportIncludeNotes(true);
  };

  // Filtered & Sorted shifts for export
  const filteredExportShifts = useMemo(() => {
    const { start, end } = getDateRangeBounds(exportDatePreset, exportCustomStart, exportCustomEnd);

    const list = shifts.filter((s) => {
      const shiftTime = new Date(s.clockIn).getTime();
      if (start && shiftTime < start.getTime()) return false;
      if (end && shiftTime > end.getTime()) return false;

      if (exportStaffId && s.staffId !== exportStaffId) return false;

      if (exportRole) {
        const staffMember = staffList.find((st) => st.id === s.staffId);
        if (staffMember?.role !== exportRole) return false;
      }

      if (exportStatus === 'completed' && !s.clockOut) return false;
      if (exportStatus === 'active' && s.clockOut) return false;

      return true;
    });

    list.sort((a, b) => {
      let comparison = 0;
      if (exportSortBy === 'date') {
        comparison = new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime();
      } else if (exportSortBy === 'hours') {
        comparison = (a.totalHours || 0) - (b.totalHours || 0);
      } else if (exportSortBy === 'wages') {
        const rateA = staffList.find((st) => st.id === a.staffId)?.hourlyRate || 0;
        const rateB = staffList.find((st) => st.id === b.staffId)?.hourlyRate || 0;
        const payA = a.totalPay != null ? a.totalPay : (a.totalHours || 0) * rateA;
        const payB = b.totalPay != null ? b.totalPay : (b.totalHours || 0) * rateB;
        comparison = payA - payB;
      } else if (exportSortBy === 'name') {
        const nameA = staffList.find((st) => st.id === a.staffId)?.name || '';
        const nameB = staffList.find((st) => st.id === b.staffId)?.name || '';
        comparison = nameA.localeCompare(nameB);
      }
      return exportSortOrder === 'desc' ? -comparison : comparison;
    });

    return list;
  }, [shifts, staffList, exportDatePreset, exportCustomStart, exportCustomEnd, exportStaffId, exportRole, exportStatus, exportSortBy, exportSortOrder]);

  // Export summary metrics
  const exportTotalHours = useMemo(() => {
    return filteredExportShifts.reduce((acc, s) => acc + (s.totalHours || 0), 0);
  }, [filteredExportShifts]);

  const exportTotalLaborCost = useMemo(() => {
    return filteredExportShifts.reduce((acc, s) => {
      if (s.totalPay != null) return acc + s.totalPay;
      const staffMember = staffList.find((st) => st.id === s.staffId);
      const rate = staffMember?.hourlyRate || 0;
      return acc + (s.totalHours || 0) * rate;
    }, 0);
  }, [filteredExportShifts, staffList]);

  const exportUniqueStaffCount = useMemo(() => {
    return new Set(filteredExportShifts.map((s) => s.staffId)).size;
  }, [filteredExportShifts]);

  // Build export rows helper
  const buildExportData = (recordsToExport: ShiftSelect[]) => {
    const headers = ['Shift ID', 'Staff ID', 'Staff Name', 'Role', 'Clock In', 'Clock Out', 'Status', 'Total Hours'];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['left', 'left', 'left', 'left', 'center', 'center', 'center', 'right'];

    if (exportIncludeWages) {
      headers.push(`Hourly Rate (${settings.currency})`, `Total Pay (${settings.currency})`);
      columnAlignments.push('right', 'right');
    }
    if (exportIncludeNotes) {
      headers.push('Notes / Remarks');
      columnAlignments.push('left');
    }

    const rows = recordsToExport.map((s) => {
      const staffMember = staffList.find((st) => st.id === s.staffId);
      const clockInFmt = new Date(s.clockIn).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      const clockOutFmt = s.clockOut ? new Date(s.clockOut).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Active On Clock';
      const row: (string | number)[] = [
        s.id,
        s.staffId,
        staffMember?.name || 'Unknown',
        staffMember?.role || 'Staff',
        clockInFmt,
        clockOutFmt,
        s.clockOut ? 'Completed' : 'Active',
        s.totalHours != null ? parseFloat(s.totalHours.toFixed(2)) : 0
      ];

      if (exportIncludeWages) {
        const hourlyRate = staffMember?.hourlyRate || 0;
        const totalPay = s.totalPay != null ? s.totalPay : (s.totalHours || 0) * hourlyRate;
        row.push(parseFloat(hourlyRate.toFixed(2)), parseFloat(totalPay.toFixed(2)));
      }

      if (exportIncludeNotes) {
        row.push(s.notes || '');
      }

      return row;
    });

    return { headers, rows, columnAlignments };
  };

  // Export Styled Excel (.xls) Handler
  const handleExportExcel = (recordsToExport: ShiftSelect[] = filteredExportShifts) => {
    const { headers, rows, columnAlignments } = buildExportData(recordsToExport);
    const totalsRow: (string | number)[] = ['TOTALS', '', '', '', '', '', `${recordsToExport.length} Shifts`, parseFloat(exportTotalHours.toFixed(2))];
    if (exportIncludeWages) {
      totalsRow.push('', parseFloat(exportTotalLaborCost.toFixed(2)));
    }
    if (exportIncludeNotes) {
      totalsRow.push('');
    }

    const staffObj = exportStaffId ? staffList.find((st) => st.id === exportStaffId) : null;
    const staffSuffix = staffObj ? `_${staffObj.name.toLowerCase().replace(/\s+/g, '_')}` : '';
    const dateSuffix = new Date().toISOString().slice(0, 10);

    downloadStyledExcel({
      filename: `staff_shifts${staffSuffix}_${exportDatePreset}_${dateSuffix}.xls`,
      title: 'CHTH Cafe — Employee Shift Attendance & Wage Ledger',
      subtitle: `Export Date: ${new Date().toLocaleDateString()} | Filter: ${exportDatePreset.toUpperCase()} | Staff: ${staffObj?.name || 'ALL TEAM MEMBERS'}`,
      themeColor: 'emerald',
      metadata: {
        'Period': exportDatePreset.replace('_', ' ').toUpperCase(),
        'Staff Filter': staffObj?.name || 'All Team Members',
        'Role Filter': exportRole || 'All Roles',
        'Shift Status': exportStatus.toUpperCase(),
        'Sort Field': `${exportSortBy.toUpperCase()} (${exportSortOrder.toUpperCase()})`,
        'Currency': settings.currency
      },
      summaryCards: [
        { label: 'Total Shifts', value: recordsToExport.length },
        { label: 'Total Hours', value: `${exportTotalHours.toFixed(1)} hrs` },
        { label: 'Total Labor Wages', value: `${settings.currency}${exportTotalLaborCost.toFixed(2)}` },
        { label: 'Employees On Roster', value: exportUniqueStaffCount }
      ],
      headers,
      rows,
      columnAlignments,
      totalsRow
    });
  };

  // Export CSV Handler
  const handleExportCSV = (recordsToExport: ShiftSelect[] = filteredExportShifts) => {
    const { headers, rows } = buildExportData(recordsToExport);
    const staffObj = exportStaffId ? staffList.find((st) => st.id === exportStaffId) : null;
    const staffSuffix = staffObj ? `_${staffObj.name.toLowerCase().replace(/\s+/g, '_')}` : '';
    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadCSV(`staff_shifts${staffSuffix}_${exportDatePreset}_${dateSuffix}.csv`, headers, rows);
  };

  // Export JSON Handler
  const handleExportJSON = (recordsToExport: ShiftSelect[] = filteredExportShifts) => {
    const staffMap = new Map(staffList.map((st) => [st.id, st]));
    const exportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        currency: settings.currency,
        totalRecords: recordsToExport.length,
        filtersApplied: {
          datePreset: exportDatePreset,
          customStart: exportCustomStart || null,
          customEnd: exportCustomEnd || null,
          staffId: exportStaffId || 'all',
          role: exportRole || 'all',
          status: exportStatus,
          sortBy: exportSortBy,
          sortOrder: exportSortOrder,
          includeWages: exportIncludeWages,
          includeNotes: exportIncludeNotes
        },
        summary: {
          totalHours: exportTotalHours,
          totalWages: exportTotalLaborCost,
          uniqueStaffCount: exportUniqueStaffCount,
          activeShiftsCount: recordsToExport.filter((s) => !s.clockOut).length,
          completedShiftsCount: recordsToExport.filter((s) => !!s.clockOut).length
        }
      },
      shifts: recordsToExport.map((s) => {
        const staffMember = staffMap.get(s.staffId);
        const hourlyRate = staffMember?.hourlyRate || 0;
        const totalPay = s.totalPay != null ? s.totalPay : (s.totalHours || 0) * hourlyRate;

        return {
          id: s.id,
          staffId: s.staffId,
          staffName: staffMember?.name || 'Unknown',
          role: staffMember?.role || 'Staff',
          clockIn: s.clockIn,
          clockOut: s.clockOut || null,
          status: s.clockOut ? 'completed' : 'active',
          totalHours: s.totalHours || 0,
          ...(exportIncludeWages && {
            hourlyRate,
            totalPay
          }),
          ...(exportIncludeNotes && {
            notes: s.notes || ''
          })
        };
      })
    };

    const staffObj = exportStaffId ? staffList.find((st) => st.id === exportStaffId) : null;
    const staffSuffix = staffObj ? `_${staffObj.name.toLowerCase().replace(/\s+/g, '_')}` : '';
    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadJSON(`staff_shifts${staffSuffix}_${exportDatePreset}_${dateSuffix}.json`, exportData);
  };

  // Copy CSV to Clipboard
  const handleCopyCSV = async (recordsToExport: ShiftSelect[] = filteredExportShifts) => {
    const { headers, rows } = buildExportData(recordsToExport);
    const ok = await copyCSVToClipboard(headers, rows);
    if (ok) {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    }
  };

  // Filtered list for the in-page shift records view
  const displayedAttendanceRecords = useMemo(() => {
    return shifts.filter((sh) => {
      const staff = staffList.find((s) => s.id === sh.staffId);
      const staffName = staff?.name.toLowerCase() || '';
      const notes = (sh.notes || '').toLowerCase();
      const q = recordsSearch.trim().toLowerCase();

      if (q && !staffName.includes(q) && !notes.includes(q)) return false;
      if (recordsStaffFilter && sh.staffId !== recordsStaffFilter) return false;
      if (recordsStatusFilter === 'completed' && !sh.clockOut) return false;
      if (recordsStatusFilter === 'active' && sh.clockOut) return false;

      return true;
    });
  }, [shifts, staffList, recordsSearch, recordsStaffFilter, recordsStatusFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in font-sans">
      {/* Header Banner */}
      <div className="glass-panel-classy p-5 rounded-3xl border border-zinc-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center brand-glow">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-2">
              Staff Attendance & Shift Labor Tracker
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Clock-in PIN terminal, shift rosters, hours & wage calculations</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setAddManualShiftOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
          >
            <Clock className="w-4 h-4" /> Log Shift
          </button>
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title="Open Shift Export & Filter Dialog"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export Shifts
          </button>
          <button
            onClick={() => setAddStaffOpen(true)}
            className="px-4 py-2 rounded-xl btn-brand text-zinc-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Team Member
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SHIFT TIMELINE & HOURS INFOGRAPHIC                                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* KPI Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-2 shadow-md">
            <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">Currently Clocked In</span>
            <span className="text-2xl font-black text-emerald-400 font-mono block">{activeShifts.length} Staff On Floor</span>
            <span className="text-[11px] text-zinc-500 font-medium block">Active store shift coverage</span>
          </div>

          <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-2 shadow-md">
            <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">Total Labor Wages Logged</span>
            <span className="text-2xl font-black text-zinc-100 font-mono block">
              {settings.currency}{totalLaborCost.toFixed(2)}
            </span>
            <span className="text-[11px] text-zinc-500 font-medium block">
              {totalHoursWorked.toFixed(1)} hours logged across all shifts
            </span>
          </div>
        </div>

        {/* Staff Hours Infographic Progress Chart (8 cols) */}
        <div className="lg:col-span-8 glass-panel p-5 sm:p-6 rounded-3xl border border-zinc-800/80 space-y-4 shadow-lg">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-zinc-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" /> Team Member Shift Hours Infographic
            </span>
            <span className="text-zinc-400 text-[11px] font-semibold">{staffList.length} Team Members</span>
          </div>

          <div className="space-y-3 pt-1">
            {staffList.map((m) => {
              const staffShifts = shifts.filter((s) => s.staffId === m.id);
              const hours = staffShifts.reduce((acc, s) => acc + (s.totalHours || 0), 0);
              const isCurrentlyIn = activeShifts.some((s) => s.staffId === m.id);
              const maxH = Math.max(
                ...staffList.map((st) => shifts.filter((s) => s.staffId === st.id).reduce((a, b) => a + (b.totalHours || 0), 0)),
                1
              );
              const pct = (hours / maxH) * 100;

              return (
                <div key={m.id} className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-zinc-300">
                    <span className="flex items-center gap-2">
                      <span className="font-extrabold">{m.name}</span>
                      <span className="text-[10px] text-zinc-500 font-medium">({m.role})</span>
                      {isCurrentlyIn && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Clocked In
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-zinc-400">{hours.toFixed(1)} hrs</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                    <div
                      className={`h-full transition-[width] duration-300 ${
                        isCurrentlyIn ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-amber-400'
                      }`}
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STAFF DIRECTORY & RECENT SHIFT LOGS                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff Directory */}
        <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> Active Roster & Staff Directory
            </h3>
            <span className="text-xs text-zinc-400 font-bold">{staffList.length} Active</span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {staffList.map((st) => (
              <div
                key={st.id}
                className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-zinc-100">{st.name}</span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-zinc-800 text-zinc-400">
                        {st.role}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      PIN Key: <span className="font-mono text-amber-400">{st.pin}</span> • Rate:{' '}
                      <span className="font-mono">{settings.currency}{st.hourlyRate.toFixed(2)}/hr</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (editingWageStaffId === st.id) {
                          setEditingWageStaffId(null);
                        } else {
                          setEditingWageStaffId(st.id);
                          setChangeWageInput(st.hourlyRate.toString());
                          setEditingPinStaffId(null);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 cursor-pointer transition-colors"
                      title="Edit Hourly Wage Rate"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingPinStaffId === st.id) {
                          setEditingPinStaffId(null);
                        } else {
                          setEditingPinStaffId(st.id);
                          setChangePinInput(st.pin);
                          setEditingWageStaffId(null);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 cursor-pointer transition-colors"
                      title="Change PIN Key / Password"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(st.id, st.name)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-900/60 text-rose-400 cursor-pointer transition-colors"
                      title="Remove Staff Member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Change Wage Rate Input */}
                {editingWageStaffId === st.id && (
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">New Rate ({settings.currency}):</span>
                    <input
                      type="number" inputMode="decimal"
                      step="0.50"
                      placeholder="18.50"
                      value={changeWageInput}
                      onChange={(e) => setChangeWageInput(e.target.value)}
                      className="px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-xs flex-1"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveStaffWage(st.id)}
                      className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-[10px] uppercase cursor-pointer"
                    >
                      Save Wage
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingWageStaffId(null)}
                      className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Inline Change PIN Input */}
                {editingPinStaffId === st.id && (
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="New PIN / Password..."
                      value={changePinInput}
                      onChange={(e) => setChangePinInput(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-amber-400 font-mono text-xs flex-1"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveStaffPin(st.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-[10px] uppercase cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPinStaffId(null)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Shift Attendance Logs with Search & In-line Filter */}
        <div className="glass-panel p-5 rounded-3xl border border-zinc-800/80 space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-zinc-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" /> Shift Attendance Records
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-bold">
                {displayedAttendanceRecords.length}/{shifts.length}
              </span>
            </div>

            <button
              onClick={() => setExportModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Download className="w-3 h-3" /> Export
            </button>
          </div>

          {/* Search & Quick Status Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-0.5">
            <div className="sm:col-span-6 relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search staff or notes..."
                value={recordsSearch}
                onChange={(e) => setRecordsSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-[11px] placeholder:text-zinc-500 focus:border-emerald-500/50"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={recordsStaffFilter}
                onChange={(e) => setRecordsStaffFilter(e.target.value)}
                className="w-full py-1.5 px-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
              >
                <option value="">All Staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={recordsStatusFilter}
                onChange={(e) => setRecordsStatusFilter(e.target.value as any)}
                className="w-full py-1.5 px-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active Now</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {displayedAttendanceRecords.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-6 text-center">No matching shift records found.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {displayedAttendanceRecords.map((sh) => {
                const staff = staffList.find((s) => s.id === sh.staffId);
                const clockInTime = new Date(sh.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const clockOutTime = sh.clockOut
                  ? new Date(sh.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Active Now';

                return (
                  <div
                    key={sh.id}
                    className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-2 text-xs transition"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-zinc-100">{staff?.name || 'Staff'}</span>
                        {!sh.clockOut && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ON SHIFT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {new Date(sh.clockIn).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {clockInTime} → {clockOutTime}
                      </span>
                      {sh.notes && (
                        <p className="text-[10px] text-zinc-500 italic truncate max-w-[200px] mt-0.5">{sh.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-bold text-emerald-400 font-mono block">
                          {sh.totalHours ? `${sh.totalHours.toFixed(1)} hrs` : 'Active'}
                        </span>
                        {sh.totalPay != null && sh.totalPay > 0 && (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {settings.currency}{sh.totalPay.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditShift(sh)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-indigo-400 cursor-pointer"
                          title="Edit Shift Log"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteShift(sh.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-900/60 text-rose-400 cursor-pointer"
                          title="Delete Shift Log"
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
        </div>
      </div>

      {/* CREATE STAFF MEMBER MODAL */}
      <Modal
        isOpen={addStaffOpen}
        onClose={() => setAddStaffOpen(false)}
        title="Add New Team Member"
      >
        <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              placeholder="e.g. Hasti"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Role
              </label>
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              >
                <option value="Store Manager">Store Manager</option>
                <option value="Head Barista">Head Barista</option>
                <option value="Barista">Barista</option>
                <option value="Shift Supervisor">Shift Supervisor</option>
                <option value="Cashier">Cashier</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Clock-in PIN
              </label>
              <input
                type="text"
                placeholder="1234"
                value={newStaffPin}
                onChange={(e) => setNewStaffPin(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Hourly Wage Rate ({settings.currency})
            </label>
            <input
              type="number" inputMode="decimal"
              step="0.50"
              placeholder="18.50"
              value={newStaffRate}
              onChange={(e) => setNewStaffRate(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer"
          >
            Register Staff Member
          </button>
        </form>
      </Modal>

      {/* EDIT SHIFT LOG RECORD MODAL */}
      <Modal
        isOpen={!!editingShift}
        onClose={() => setEditingShift(null)}
        title="Edit Shift Attendance Log"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleSaveShiftEdit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Clock In Date & Time
            </label>
            <input
              type="datetime-local"
              value={editClockIn}
              onChange={(e) => setEditClockIn(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-emerald-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Clock Out Date & Time
            </label>
            <input
              type="datetime-local"
              value={editClockOut}
              onChange={(e) => setEditClockOut(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Shift Notes
            </label>
            <input
              type="text"
              placeholder="Optional shift notes..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingShift(null)}
              className="py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2.5 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* MANUAL SHIFT INSERT MODAL */}
      <Modal
        isOpen={addManualShiftOpen}
        onClose={() => setAddManualShiftOpen(false)}
        title="Log Manual Staff Shift"
      >
        <form onSubmit={handleCreateManualShift} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Select Staff Member
            </label>
            <select
              value={manualShiftStaffId}
              onChange={(e) => setManualShiftStaffId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              required
            >
              <option value="">-- Choose Team Member --</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.role} • {settings.currency}{st.hourlyRate.toFixed(2)}/hr)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Clock In Date & Time
              </label>
              <input
                type="datetime-local"
                value={manualClockIn}
                onChange={(e) => setManualClockIn(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Clock Out (Optional)
              </label>
              <input
                type="datetime-local"
                value={manualClockOut}
                onChange={(e) => setManualClockOut(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Shift Notes / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Manual shift entry for morning barista coverage"
              value={manualShiftNotes}
              onChange={(e) => setManualShiftNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer"
          >
            Insert Shift Record
          </button>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteConfirmTarget}
        onClose={() => setDeleteConfirmTarget(null)}
        onConfirm={handleConfirmDeleteTimeTracker}
        title={deleteConfirmTarget?.type === 'staff' ? 'Remove Staff Member' : 'Delete Shift Log'}
        description={
          deleteConfirmTarget?.type === 'staff' ? (
            <span>
              Are you sure you want to remove staff member <strong className="text-zinc-100 font-bold">{deleteConfirmTarget.label}</strong> from the directory?
            </span>
          ) : (
            <span>
              Are you sure you want to delete this shift log entry?
            </span>
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* EXPORT EMPLOYEE SHIFTS MODAL */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
            <span>Export Employee Shift Reports</span>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Subtitle / Context */}
          <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-400 flex items-start gap-2.5">
            <Filter className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="leading-relaxed text-[11px]">
              Apply date ranges, employee, role, and shift status filters below to generate custom shift logs, payroll rosters, and attendance records.
            </p>
          </div>

          {/* 1. Date Range Filter */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> 1. Date Period Filter
              </label>
              <span className="text-[10px] text-zinc-500 font-medium">Preset or custom range</span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
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
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
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

          {/* 2. Employee & Role Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" /> 2. Team Member
              </label>
              <select
                value={exportStaffId}
                onChange={(e) => setExportStaffId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-emerald-500"
              >
                <option value="">All Team Members ({staffList.length})</option>
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} — {st.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> 3. Staff Role
              </label>
              <select
                value={exportRole}
                onChange={(e) => setExportRole(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-emerald-500"
              >
                <option value="">All Roles</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Shift Status, Sorting & Column Inclusions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                4. Shift Status
              </label>
              <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {(['all', 'completed', 'active'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setExportStatus(st)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase transition cursor-pointer text-center ${
                      exportStatus === st
                        ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {st === 'all' ? 'All' : st === 'completed' ? 'Done' : 'Active'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sorting Controls */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-amber-400" /> 5. Sort By
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={exportSortBy}
                  onChange={(e) => setExportSortBy(e.target.value as ShiftSortField)}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] cursor-pointer focus:border-emerald-500"
                >
                  <option value="date">Date & Time</option>
                  <option value="hours">Hours Worked</option>
                  <option value="wages">Total Pay</option>
                  <option value="name">Staff Name</option>
                </select>

                <select
                  value={exportSortOrder}
                  onChange={(e) => setExportSortOrder(e.target.value as SortOrder)}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] cursor-pointer focus:border-emerald-500"
                >
                  <option value="desc">Desc (High / New)</option>
                  <option value="asc">Asc (Low / Old)</option>
                </select>
              </div>
            </div>

            {/* Column Options */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                6. Columns Included
              </label>
              <div className="space-y-1.5 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeWages}
                    onChange={(e) => setExportIncludeWages(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Hourly Wage & Pay ({settings.currency})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={exportIncludeNotes}
                    onChange={(e) => setExportIncludeNotes(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Shift Remarks & Notes</span>
                </label>
              </div>
            </div>
          </div>

          {/* 4. Live Summary Card */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
              <span>Matching Export Summary</span>
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
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Shifts Count</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {filteredExportShifts.length}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Total Hours</span>
                <span className="text-base font-black text-zinc-100 font-mono">
                  {exportTotalHours.toFixed(1)} hrs
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Labor Cost</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {settings.currency}{exportTotalLaborCost.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Employees</span>
                <span className="text-base font-black text-zinc-200 font-mono">
                  {exportUniqueStaffCount}
                </span>
              </div>
            </div>

            {/* Live Mini Preview */}
            {showPreviewTable && (
              <div className="pt-2 animate-fade-in">
                {filteredExportShifts.length === 0 ? (
                  <p className="text-center py-4 text-zinc-500 italic text-[11px]">
                    No shift logs match the selected filter criteria.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/90 text-[10px]">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-900/90 text-zinc-400 uppercase font-bold sticky top-0 border-b border-zinc-800">
                        <tr>
                          <th className="p-2">Employee</th>
                          <th className="p-2">Role</th>
                          <th className="p-2">Clock In</th>
                          <th className="p-2">Clock Out</th>
                          <th className="p-2 text-right">Hours</th>
                          {exportIncludeWages && <th className="p-2 text-right">Pay</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        {filteredExportShifts.slice(0, 5).map((s) => {
                          const staff = staffList.find((st) => st.id === s.staffId);
                          const rate = staff?.hourlyRate || 0;
                          const pay = s.totalPay != null ? s.totalPay : (s.totalHours || 0) * rate;
                          return (
                            <tr key={s.id} className="hover:bg-zinc-900/50">
                              <td className="p-2 font-bold text-zinc-100">{staff?.name || 'Unknown'}</td>
                              <td className="p-2 text-zinc-400">{staff?.role || 'Staff'}</td>
                              <td className="p-2 font-mono">{new Date(s.clockIn).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="p-2 font-mono">{s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-emerald-400 font-bold">Active</span>}</td>
                              <td className="p-2 text-right font-mono font-bold text-emerald-400">{(s.totalHours || 0).toFixed(1)}h</td>
                              {exportIncludeWages && <td className="p-2 text-right font-mono text-zinc-200">{settings.currency}{pay.toFixed(2)}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredExportShifts.length > 5 && (
                      <div className="p-1.5 bg-zinc-900/50 text-center text-zinc-500 text-[9px] border-t border-zinc-800/60">
                        + {filteredExportShifts.length - 5} more records will be exported (sorted by {exportSortBy})
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
                disabled={filteredExportShifts.length === 0}
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
                disabled={filteredExportShifts.length === 0}
                onClick={() => handleExportJSON()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 text-xs font-bold border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download JSON format"
              >
                <FileCode className="w-3.5 h-3.5" /> JSON
              </button>

              <button
                type="button"
                disabled={filteredExportShifts.length === 0}
                onClick={() => handleExportCSV()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download raw CSV file"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" /> CSV
              </button>

              <button
                type="button"
                disabled={filteredExportShifts.length === 0}
                onClick={() => handleExportExcel()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                title="Download Styled Excel (.xls) spreadsheet with colors, headers & totals"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Styled Excel ({filteredExportShifts.length})
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
