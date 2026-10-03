import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Trash2,
  Filter,
  X,
  Sparkles,
  Circle,
  PlayCircle,
  Check,
  Sun,
  Moon,
  Boxes,
  Wrench,
  BarChart2,
  Download,
  SlidersHorizontal,
  FileSpreadsheet,
  FileCode,
  Copy,
  RotateCcw,
  Eye,
  ArrowUpDown
} from 'lucide-react';
import { TaskSelect, StaffSelect } from '../db/schema';
import { store } from '../db/store';
import { Modal } from './Modal';
import { ConfirmModal } from './ConfirmModal';
import {
  downloadStyledExcel,
  downloadCSV,
  downloadJSON,
  copyCSVToClipboard
} from '../utils/exportUtils';

interface TaskManagerProps {
  tasks: TaskSelect[];
  staffList: StaffSelect[];
  onTasksUpdated: () => void;
}

type TaskSortField = 'dueDate' | 'priority' | 'title' | 'status' | 'category';
type SortOrder = 'desc' | 'asc';

const CATEGORY_OPTIONS = ['Opening', 'Closing', 'Inventory', 'Cleaning', 'Maintenance'];
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Opening: <Sun className="w-3.5 h-3.5 text-amber-400" />,
  Closing: <Moon className="w-3.5 h-3.5 text-indigo-400" />,
  Inventory: <Boxes className="w-3.5 h-3.5 text-blue-400" />,
  Cleaning: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
  Maintenance: <Wrench className="w-3.5 h-3.5 text-rose-400" />
};

export const TaskManager: React.FC<TaskManagerProps> = ({
  tasks,
  staffList,
  onTasksUpdated
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('Opening');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskStaffId, setTaskStaffId] = useState('');

  // Export Modal & Filter States
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('all');
  const [exportPriority, setExportPriority] = useState<string>('all');
  const [exportCategory, setExportCategory] = useState<string>('all');
  const [exportStaffId, setExportStaffId] = useState<string>('');
  const [exportSortBy, setExportSortBy] = useState<TaskSortField>('priority');
  const [exportSortOrder, setExportSortOrder] = useState<SortOrder>('desc');
  const [showPreviewTable, setShowPreviewTable] = useState(true);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    store.createTask({
      title: taskTitle.trim(),
      description: '',
      category: taskCategory,
      priority: taskPriority,
      status: 'pending',
      assignedStaffId: taskStaffId || null,
      dueDate: new Date().toISOString().split('T')[0]
    });

    setTaskTitle('');
    setAddTaskOpen(false);
    onTasksUpdated();
  };

  const handleCycleStatus = (taskId: string, currentStatus: string) => {
    let nextStatus: 'pending' | 'in_progress' | 'completed' = 'pending';
    if (currentStatus === 'pending') nextStatus = 'in_progress';
    else if (currentStatus === 'in_progress') nextStatus = 'completed';

    store.updateTaskStatus(taskId, nextStatus);
    onTasksUpdated();
  };

  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const handleDeleteTask = (taskId: string) => {
    setDeleteTaskId(taskId);
  };

  const handleConfirmDeleteTask = () => {
    if (deleteTaskId) {
      store.deleteTask(deleteTaskId);
      onTasksUpdated();
      setDeleteTaskId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesCat = filterCategory === 'all' || t.category === filterCategory;
    return matchesStatus && matchesCat;
  });

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Filtered & Sorted tasks for export
  const filteredExportTasks = useMemo(() => {
    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const statusWeight: Record<string, number> = { pending: 1, in_progress: 2, completed: 3 };

    const list = tasks.filter((t) => {
      if (exportStatus !== 'all' && t.status !== exportStatus) return false;
      if (exportPriority !== 'all' && t.priority !== exportPriority) return false;
      if (exportCategory !== 'all' && t.category !== exportCategory) return false;
      if (exportStaffId && t.assignedStaffId !== exportStaffId) return false;
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (exportSortBy === 'priority') {
        cmp = (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0);
      } else if (exportSortBy === 'status') {
        cmp = (statusWeight[a.status] || 0) - (statusWeight[b.status] || 0);
      } else if (exportSortBy === 'dueDate') {
        cmp = (a.dueDate || '').localeCompare(b.dueDate || '');
      } else if (exportSortBy === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (exportSortBy === 'category') {
        cmp = a.category.localeCompare(b.category);
      }
      return exportSortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [tasks, exportStatus, exportPriority, exportCategory, exportStaffId, exportSortBy, exportSortOrder]);

  // Export summary metrics
  const exportPendingCount = filteredExportTasks.filter((t) => t.status === 'pending').length;
  const exportInProgressCount = filteredExportTasks.filter((t) => t.status === 'in_progress').length;
  const exportCompletedCount = filteredExportTasks.filter((t) => t.status === 'completed').length;
  const exportCompletionRate = filteredExportTasks.length > 0
    ? Math.round((exportCompletedCount / filteredExportTasks.length) * 100)
    : 0;

  // Build export rows helper
  const buildTaskExportData = (records: TaskSelect[]) => {
    const headers = ['Task ID', 'Task Title', 'Category', 'Priority', 'Status', 'Assigned Staff', 'Due Date', 'Completed At'];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['left', 'left', 'center', 'center', 'center', 'left', 'center', 'center'];

    const rows = records.map((t) => {
      const staffName = staffList.find((s) => s.id === t.assignedStaffId)?.name || 'Unassigned';
      return [
        t.id,
        t.title,
        t.category,
        t.priority.toUpperCase(),
        t.status.replace('_', ' ').toUpperCase(),
        staffName,
        t.dueDate || 'N/A',
        t.completedAt ? new Date(t.completedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pending'
      ];
    });

    return { headers, rows, columnAlignments };
  };

  // Export Styled Excel Handler
  const handleExportExcel = (records = filteredExportTasks) => {
    const { headers, rows, columnAlignments } = buildTaskExportData(records);
    const totalsRow: (string | number)[] = [
      'SUMMARY',
      `${records.length} Tasks Total`,
      '',
      '',
      `${exportCompletedCount} Completed (${exportCompletionRate}%)`,
      `${exportInProgressCount} In Progress`,
      `${exportPendingCount} Pending`,
      ''
    ];

    const dateSuffix = new Date().toISOString().slice(0, 10);
    const staffObj = exportStaffId ? staffList.find((st) => st.id === exportStaffId) : null;
    const staffSuffix = staffObj ? `_${staffObj.name.toLowerCase().replace(/\s+/g, '_')}` : '';

    downloadStyledExcel({
      filename: `tasks_report${staffSuffix}_${dateSuffix}.xls`,
      title: 'CHTH Cafe — Operations Checklist & Task Roster',
      subtitle: `Export Date: ${new Date().toLocaleDateString()} | Assigned: ${staffObj?.name || 'ALL STAFF'} | Completion Rate: ${exportCompletionRate}%`,
      themeColor: 'blue',
      metadata: {
        'Status Filter': exportStatus.toUpperCase(),
        'Priority Filter': exportPriority.toUpperCase(),
        'Category Filter': exportCategory.toUpperCase(),
        'Staff Assignee': staffObj?.name || 'All Team Members',
        'Sort Order': `${exportSortBy.toUpperCase()} (${exportSortOrder.toUpperCase()})`
      },
      summaryCards: [
        { label: 'Total Tasks', value: records.length },
        { label: 'Completed', value: `${exportCompletedCount} (${exportCompletionRate}%)` },
        { label: 'In Progress', value: exportInProgressCount },
        { label: 'Pending Action', value: exportPendingCount }
      ],
      headers,
      rows,
      columnAlignments,
      totalsRow
    });
  };

  const handleExportCSV = (records = filteredExportTasks) => {
    const { headers, rows } = buildTaskExportData(records);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const staffObj = exportStaffId ? staffList.find((st) => st.id === exportStaffId) : null;
    const staffSuffix = staffObj ? `_${staffObj.name.toLowerCase().replace(/\s+/g, '_')}` : '';
    downloadCSV(`tasks_report${staffSuffix}_${dateSuffix}.csv`, headers, rows);
  };

  const handleExportJSON = (records = filteredExportTasks) => {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    const staffObj = exportStaffId ? staffList.find((st) => st.id === exportStaffId) : null;
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalTasks: records.length,
        completionRatePct: exportCompletionRate,
        filters: {
          status: exportStatus,
          priority: exportPriority,
          category: exportCategory,
          staffId: exportStaffId || 'all',
          sortBy: exportSortBy,
          sortOrder: exportSortOrder
        },
        summary: {
          pendingCount: exportPendingCount,
          inProgressCount: exportInProgressCount,
          completedCount: exportCompletedCount
        }
      },
      tasks: records.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: t.status,
        assignedStaff: staffList.find((s) => s.id === t.assignedStaffId)?.name || 'Unassigned',
        dueDate: t.dueDate,
        completedAt: t.completedAt
      }))
    };
    downloadJSON(`tasks_report_${dateSuffix}.json`, data);
  };

  const handleCopyCSV = async (records = filteredExportTasks) => {
    const { headers, rows } = buildTaskExportData(records);
    const ok = await copyCSVToClipboard(headers, rows);
    if (ok) {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    }
  };

  const handleResetExportFilters = () => {
    setExportStatus('all');
    setExportPriority('all');
    setExportCategory('all');
    setExportStaffId('');
    setExportSortBy('priority');
    setExportSortOrder('desc');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in font-sans">
      {/* Header Banner */}
      <div className="glass-panel-classy p-5 rounded-3xl border border-zinc-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center brand-glow">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-2">
              Staff Operations Checklist & Tasks
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Daily opening, closing, inventory & sanitation checklists</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title="Open Task Export & Filter Dialog"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export Tasks
          </button>
          <button
            onClick={() => setAddTaskOpen(true)}
            className="px-4 py-2 rounded-xl btn-brand text-zinc-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Task
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TASK FUNNEL & PROGRESS INFOGRAPHIC                                       */}
      {/* ========================================================================= */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-zinc-800/80 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <h3 className="font-black text-zinc-100 text-sm tracking-tight">Shift Task Completion Funnel</h3>
          </div>
          <span className="text-xs text-blue-400 font-black">{progressPct}% Completed</span>
        </div>

        {/* Progress Ratio Bar Infographic */}
        <div className="w-full h-3 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800 flex">
          <div className="bg-emerald-500 h-full transition-[width] duration-300" style={{ width: `${(completedCount / Math.max(tasks.length, 1)) * 100}%` }} title="Completed" />
          <div className="bg-amber-500 h-full transition-[width] duration-300" style={{ width: `${(inProgressCount / Math.max(tasks.length, 1)) * 100}%` }} title="In Progress" />
          <div className="bg-zinc-700 h-full transition-[width] duration-300" style={{ width: `${(pendingCount / Math.max(tasks.length, 1)) * 100}%` }} title="Pending" />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-bold uppercase block">Pending</span>
            <span className="text-lg font-black text-zinc-300 font-mono">{pendingCount}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-bold uppercase block">In Progress</span>
            <span className="text-lg font-black text-amber-400 font-mono">{inProgressCount}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 font-bold uppercase block">Completed</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* FILTER BUTTONS & TASKS LIST */}
      <div className="space-y-4">
        {/* Category Filters Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
              filterCategory === 'all'
                ? 'btn-brand text-zinc-950 shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            All Categories ({tasks.length})
          </button>

          {CATEGORY_OPTIONS.map((cat) => {
            const count = tasks.filter((t) => t.category === cat).length;
            const isSelected = filterCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'btn-brand text-zinc-950 shadow-md'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {CATEGORY_ICONS[cat]}
                <span>{cat}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Task Cards Matrix */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-3xl border border-zinc-800">
            <CheckSquare className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-400 font-semibold">No tasks found for the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((task) => {
              const assignedStaff = staffList.find((s) => s.id === task.assignedStaffId);

              return (
                <div
                  key={task.id}
                  className="glass-card p-4 rounded-2xl border border-zinc-800/80 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => handleCycleStatus(task.id, task.status)}
                      className="mt-0.5 cursor-pointer"
                      title="Click to cycle status"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : task.status === 'in_progress' ? (
                        <PlayCircle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-zinc-500 hover:text-zinc-300" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-extrabold text-sm text-zinc-100 truncate">{task.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                            task.priority === 'high'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-medium">
                        <span className="flex items-center gap-1">
                          {CATEGORY_ICONS[task.category]} {task.category}
                        </span>
                        {assignedStaff && (
                          <span className="flex items-center gap-1 text-zinc-300">
                            <User className="w-3 h-3 text-amber-400" /> {assignedStaff.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      <Modal
        isOpen={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        title="Add Staff Checklist Task"
      >
        <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Task Title
            </label>
            <input
              type="text"
              placeholder="e.g. Calibrate Espresso Grinders & Purge Steam Wands"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Assign Staff Member (Optional)
            </label>
            <select
              value={taskStaffId}
              onChange={(e) => setTaskStaffId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 cursor-pointer"
            >
              <option value="">Unassigned</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl btn-brand text-zinc-950 font-black uppercase tracking-wider shadow-lg cursor-pointer"
          >
            Create Task
          </button>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTaskId}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={handleConfirmDeleteTask}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* EXPORT TASKS & CHECKLISTS MODAL */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-400" />
            <span>Export Operations Checklist & Tasks</span>
          </div>
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Context Banner */}
          <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-400 flex items-start gap-2.5">
            <Filter className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="leading-relaxed text-[11px]">
              Export filtered operations tasks, opening/closing checklists, maintenance duties, and staff assignment logs with live summaries and styled Excel reports.
            </p>
          </div>

          {/* 1. Status & Priority Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                1. Task Status Filter
              </label>
              <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'in_progress', label: 'In Prog' },
                  { id: 'completed', label: 'Done' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setExportStatus(s.id)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase transition cursor-pointer text-center ${
                      exportStatus === s.id
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                2. Priority Filter
              </label>
              <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'high', label: 'High' },
                  { id: 'medium', label: 'Med' },
                  { id: 'low', label: 'Low' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setExportPriority(p.id)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-extrabold uppercase transition cursor-pointer text-center ${
                      exportPriority === p.id
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Category, Staff & Sorting Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                3. Category
              </label>
              <select
                value={exportCategory}
                onChange={(e) => setExportCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                4. Assigned Staff
              </label>
              <select
                value={exportStaffId}
                onChange={(e) => setExportStaffId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs cursor-pointer focus:border-blue-500"
              >
                <option value="">All Team Members ({staffList.length})</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-amber-400" /> 5. Sort Order
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={exportSortBy}
                  onChange={(e) => setExportSortBy(e.target.value as TaskSortField)}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] cursor-pointer focus:border-blue-500"
                >
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                  <option value="dueDate">Due Date</option>
                  <option value="title">Title</option>
                  <option value="category">Category</option>
                </select>

                <select
                  value={exportSortOrder}
                  onChange={(e) => setExportSortOrder(e.target.value as SortOrder)}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] cursor-pointer focus:border-blue-500"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Live Summary Card */}
          <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/20 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-blue-400">
              <span>Task Roster Export Summary</span>
              <button
                type="button"
                onClick={() => setShowPreviewTable((prev) => !prev)}
                className="text-[10px] text-blue-300 hover:text-blue-200 underline cursor-pointer flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> {showPreviewTable ? 'Hide Records Preview' : 'Show Records Preview'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Total Tasks</span>
                <span className="text-base font-black text-blue-400 font-mono">
                  {filteredExportTasks.length}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Completed</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {exportCompletedCount} ({exportCompletionRate}%)
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">In Progress</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {exportInProgressCount}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold block">Pending</span>
                <span className="text-base font-black text-zinc-300 font-mono">
                  {exportPendingCount}
                </span>
              </div>
            </div>

            {/* Live Mini Preview */}
            {showPreviewTable && (
              <div className="pt-2 animate-fade-in">
                {filteredExportTasks.length === 0 ? (
                  <p className="text-center py-4 text-zinc-500 italic text-[11px]">
                    No task records match the selected filter criteria.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/90 text-[10px]">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-900/90 text-zinc-400 uppercase font-bold sticky top-0 border-b border-zinc-800">
                        <tr>
                          <th className="p-2">Task Title</th>
                          <th className="p-2">Category</th>
                          <th className="p-2">Priority</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Assignee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        {filteredExportTasks.slice(0, 5).map((t) => {
                          const staff = staffList.find((s) => s.id === t.assignedStaffId);
                          return (
                            <tr key={t.id} className="hover:bg-zinc-900/50">
                              <td className="p-2 font-bold text-zinc-100">{t.title}</td>
                              <td className="p-2 text-zinc-400">{t.category}</td>
                              <td className="p-2">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                  t.priority === 'high' ? 'bg-rose-500/20 text-rose-400' : t.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {t.priority}
                                </span>
                              </td>
                              <td className="p-2 font-mono text-zinc-300 uppercase text-[9px]">{t.status.replace('_', ' ')}</td>
                              <td className="p-2 text-zinc-400">{staff?.name || 'Unassigned'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredExportTasks.length > 5 && (
                      <div className="p-1.5 bg-zinc-900/50 text-center text-zinc-500 text-[9px] border-t border-zinc-800/60">
                        + {filteredExportTasks.length - 5} more tasks will be exported (sorted by {exportSortBy})
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
                disabled={filteredExportTasks.length === 0}
                onClick={() => handleCopyCSV()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-xs font-bold border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copy CSV to clipboard"
              >
                {copiedFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-blue-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" /> Copy CSV
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={filteredExportTasks.length === 0}
                onClick={() => handleExportJSON()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 text-xs font-bold border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download JSON format"
              >
                <FileCode className="w-3.5 h-3.5" /> JSON
              </button>

              <button
                type="button"
                disabled={filteredExportTasks.length === 0}
                onClick={() => handleExportCSV()}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Download raw CSV file"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" /> CSV
              </button>

              <button
                type="button"
                disabled={filteredExportTasks.length === 0}
                onClick={() => handleExportExcel()}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                title="Download Styled Excel (.xls) spreadsheet with colors, headers & totals"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Styled Excel ({filteredExportTasks.length})
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
