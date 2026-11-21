import React, { useMemo, useState } from 'react';
import { CheckSquare, Download, Plus } from 'lucide-react';
import { TaskSelect, StaffSelect } from '../db/schema';
import { store } from '../db/store';
import { copyCSVToClipboard, downloadCSV, downloadJSON, downloadStyledExcel } from '../utils/exportUtils';
import {
  Badge, Button, Card, Chips, ConfirmDialog, EmptyState, ExportDialog, Field, List, Meter, Page, PageHeader, Segmented, Select, SortFilter,
  Stat, StatGrid, localDateKey, slug
} from '../ui';
import { TaskFormDialog, TaskRow, TASK_CATEGORIES, TASK_CATEGORY_ICONS, TASK_STATUS_LABELS, TaskStatus, nextTaskStatus } from './shared';
import { intlTag, tr } from '../i18n';

interface TaskManagerProps {
  tasks: TaskSelect[];
  staffList: StaffSelect[];
  onTasksUpdated: () => void;
}

type SortField = 'dueDate' | 'priority' | 'title' | 'status' | 'category';
const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const STATUS_WEIGHT: Record<string, number> = { pending: 1, in_progress: 2, completed: 3 };

export const TaskManager: React.FC<TaskManagerProps> = ({ tasks, staffList, onTasksUpdated }) => {
  const [status, setStatus] = useState<'all' | TaskStatus>('all');
  const [category, setCategory] = useState('all');
  const [assignee, setAssignee] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskSelect | null>(null);
  const staffName = (id?: string | null) => staffList.find(s => s.id === id)?.name;

  const counts = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length
  };
  const pct = tasks.length ? Math.round((counts.completed / tasks.length) * 100) : 0;
  // Open work first, high priority on top; finished tasks sink to the bottom.
  const visible = tasks
    .filter(t => (status === 'all' || t.status === status) && (category === 'all' || t.category === category) && (!assignee || t.assignedStaffId === assignee))
    .sort((a, b) => (STATUS_WEIGHT[a.status] === 3 ? 1 : 0) - (STATUS_WEIGHT[b.status] === 3 ? 1 : 0) || (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0));

  /* ------------------------------------------------------------ Export */
  const [xStatus, setXStatus] = useState('all');
  const [xPriority, setXPriority] = useState('all');
  const [xCategory, setXCategory] = useState('all');
  const [xStaff, setXStaff] = useState('');
  const [xSort, setXSort] = useState<SortField>('priority');
  const [xOrder, setXOrder] = useState<'asc' | 'desc'>('desc');
  const records = useMemo(() => tasks
    .filter(t => (xStatus === 'all' || t.status === xStatus) && (xPriority === 'all' || t.priority === xPriority) && (xCategory === 'all' || t.category === xCategory) && (!xStaff || t.assignedStaffId === xStaff))
    .sort((a, b) => {
      const cmp = xSort === 'priority' ? (PRIORITY_WEIGHT[a.priority] || 0) - (PRIORITY_WEIGHT[b.priority] || 0)
        : xSort === 'status' ? (STATUS_WEIGHT[a.status] || 0) - (STATUS_WEIGHT[b.status] || 0)
        : xSort === 'dueDate' ? (a.dueDate || '').localeCompare(b.dueDate || '')
        : xSort === 'title' ? a.title.localeCompare(b.title)
        : a.category.localeCompare(b.category);
      return xOrder === 'desc' ? -cmp : cmp;
    }), [tasks, xStatus, xPriority, xCategory, xStaff, xSort, xOrder]);
  const xDone = records.filter(t => t.status === 'completed').length;
  const xRate = records.length ? Math.round((xDone / records.length) * 100) : 0;
  const xStaffObj = staffList.find(s => s.id === xStaff);
  const fileBase = `tasks_report${xStaffObj ? `_${slug(xStaffObj.name)}` : ''}_${localDateKey()}`;
  const build = () => ({
    headers: ['Task ID', 'Task Title', 'Category', 'Priority', 'Status', 'Assigned Staff', 'Due Date', 'Completed At'],
    columnAlignments: ['left', 'left', 'center', 'center', 'center', 'left', 'center', 'center'] as ('left' | 'center' | 'right')[],
    rows: records.map(t => [t.id, t.title, t.category, t.priority.toUpperCase(), TASK_STATUS_LABELS[t.status as TaskStatus] || t.status, staffName(t.assignedStaffId) || 'Unassigned', t.dueDate || 'N/A',
      t.completedAt ? new Date(t.completedAt).toLocaleString(intlTag(), { dateStyle: 'short', timeStyle: 'short' }) : tr('Pending')])
  });

  return (
    <Page>
      <PageHeader
        title={tr('Checklist')}
        description={tr('Opening, closing, inventory, and cleaning duties for the team.')}
        actions={<>
          <Button icon={<Download />} onClick={() => setExportOpen(true)}>{tr('Export')}</Button>
          <Button variant="primary" icon={<Plus />} onClick={() => setFormOpen(true)}>{tr('New task')}</Button>
        </>}
      />

      <StatGrid>
        <Stat label={tr('Completion')} value={`${pct}%`} tone={pct === 100 && tasks.length ? 'positive' : 'neutral'} hint={tr('{completed} of {length} done', { completed: counts.completed, length: tasks.length })} />
        <Stat label={tr('To do')} value={counts.pending} onClick={() => setStatus('pending')} active={status === 'pending'} />
        <Stat label={tr('In progress')} value={counts.in_progress} tone={counts.in_progress ? 'accent' : 'neutral'} onClick={() => setStatus('in_progress')} active={status === 'in_progress'} />
        <Stat label={tr('High priority open')} value={tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length} tone="danger" />
      </StatGrid>

      <Meter size="lg" label={tr('{completed} done, {in_progress} in progress, {pending} to do', { completed: counts.completed, in_progress: counts.in_progress, pending: counts.pending })} segments={[
        { value: counts.completed, tone: 'positive', label: tr('Done') },
        { value: counts.in_progress, tone: 'accent', label: tr('In progress') },
        { value: counts.pending, tone: 'muted', label: tr('To do') }
      ]} />

      <div className="ws-toolbar-stack">
        <div className="ws-toolbar">
          <Segmented label={tr('Task status')} value={status} onChange={setStatus} options={[
            { value: 'all', label: tr('All'), count: tasks.length },
            { value: 'pending', label: tr('To do'), count: counts.pending },
            { value: 'in_progress', label: tr('In progress'), count: counts.in_progress },
            { value: 'completed', label: tr('Done'), count: counts.completed }
          ]} />
          <Select aria-label={tr('Assigned to')} value={assignee} onChange={e => setAssignee(e.target.value)} style={{ width: 'auto' }}>
            <option value="">{tr('Everyone')}</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <Chips label={tr('Category')} value={category} onChange={setCategory} options={[
          { value: 'all', label: tr('All categories') },
          ...TASK_CATEGORIES.map(c => ({ value: c, label: tr(c), icon: TASK_CATEGORY_ICONS[c], count: tasks.filter(t => t.category === c).length }))
        ]} />
      </div>

      <Card flush>
        {visible.length === 0 ? (
          <EmptyState icon={<CheckSquare />} title={tasks.length ? tr('No tasks match') : tr('No tasks yet')} description={tasks.length ? tr('Try a different filter.') : tr('Create the first item on the checklist.')}
            action={!tasks.length && <Button variant="primary" icon={<Plus />} onClick={() => setFormOpen(true)}>{tr('New task')}</Button>} />
        ) : (
          <List label={tr('Tasks')}>
            {visible.map(task => (
              <TaskRow key={task.id} task={task} staffName={staffName(task.assignedStaffId)}
                onCycle={() => { store.updateTaskStatus(task.id, nextTaskStatus(task.status)); onTasksUpdated(); }}
                onDelete={() => setDeleteTarget(task)} />
            ))}
          </List>
        )}
      </Card>

      <TaskFormDialog open={formOpen} onClose={() => setFormOpen(false)} staffList={staffList} onCreated={onTasksUpdated} />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { store.deleteTask(deleteTarget.id); onTasksUpdated(); } }}
        title={tr('Delete this task?')}
        description={<>{tr('“{title}” is removed from the checklist. This cannot be undone.', { title: deleteTarget?.title })}</>}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={tr('Export checklist')}
        description={tr('Tasks with status, priority, and who they\'re assigned to.')}
        records={records}
        rowKey={t => t.id}
        summary={[
          { label: tr('Tasks'), value: records.length },
          { label: tr('Done'), value: `${xDone} (${xRate}%)`, tone: 'positive' },
          { label: tr('In progress'), value: records.filter(t => t.status === 'in_progress').length },
          { label: tr('To do'), value: records.filter(t => t.status === 'pending').length }
        ]}
        previewColumns={[
          { key: 'title', header: tr('Task'), render: t => t.title },
          { key: 'category', header: tr('Category'), render: t => t.category },
          { key: 'priority', header: tr('Priority'), render: t => <Badge tone={t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'neutral'}>{t.priority}</Badge> },
          { key: 'status', header: tr('Status'), render: t => TASK_STATUS_LABELS[t.status as TaskStatus] || t.status },
          { key: 'who', header: tr('Assignee'), render: t => staffName(t.assignedStaffId) || 'Unassigned' }
        ]}
        onReset={() => { setXStatus('all'); setXPriority('all'); setXCategory('all'); setXStaff(''); setXSort('priority'); setXOrder('desc'); }}
        onCopy={() => { const d = build(); return copyCSVToClipboard(d.headers, d.rows); }}
        onCSV={() => { const d = build(); downloadCSV(`${fileBase}.csv`, d.headers, d.rows); }}
        onJSON={() => downloadJSON(`${fileBase}.json`, {
          metadata: { generatedAt: new Date().toISOString(), totalTasks: records.length, completionRatePct: xRate, filters: { status: xStatus, priority: xPriority, category: xCategory, staffId: xStaff || 'all', sortBy: xSort, sortOrder: xOrder } },
          tasks: records.map(t => ({ id: t.id, title: t.title, category: t.category, priority: t.priority, status: t.status, assignedStaff: staffName(t.assignedStaffId) || 'Unassigned', dueDate: t.dueDate, completedAt: t.completedAt }))
        })}
        onExcel={() => {
          const d = build();
          downloadStyledExcel({
            filename: `${fileBase}.xls`,
            title: tr('CHTH Cafe — Operations Checklist & Task Roster'),
            subtitle: tr('Export Date: {value} | Assigned: {value2} | Completion Rate: {xRate}%', { value: new Date().toLocaleDateString(intlTag()), value2: xStaffObj?.name || 'ALL STAFF', xRate }),
            themeColor: 'blue',
            metadata: { 'Status Filter': xStatus.toUpperCase(), 'Priority Filter': xPriority.toUpperCase(), 'Category Filter': xCategory.toUpperCase(), 'Staff Assignee': xStaffObj?.name || 'All Team Members', 'Sort Order': `${xSort.toUpperCase()} (${xOrder.toUpperCase()})` },
            summaryCards: [
              { label: tr('Total Tasks'), value: records.length },
              { label: tr('Completed'), value: `${xDone} (${xRate}%)` },
              { label: tr('In Progress'), value: records.filter(t => t.status === 'in_progress').length },
              { label: tr('Pending Action'), value: records.filter(t => t.status === 'pending').length }
            ],
            ...d,
            totalsRow: ['SUMMARY', `${records.length} Tasks Total`, '', '', `${xDone} Completed (${xRate}%)`, '', '', '']
          });
        }}
        filters={<>
          <div className="ws-form-row cols-2">
            <Field label={tr('Status')}>{id => (
              <Select id={id} value={xStatus} onChange={e => setXStatus(e.target.value)}>
                <option value="all">{tr('All statuses')}</option>
                {(['pending', 'in_progress', 'completed'] as TaskStatus[]).map(s => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </Select>
            )}</Field>
            <Field label={tr('Priority')}>{id => (
              <Select id={id} value={xPriority} onChange={e => setXPriority(e.target.value)}>
                <option value="all">{tr('All priorities')}</option><option value="high">{tr('High')}</option><option value="medium">{tr('Medium')}</option><option value="low">{tr('Low')}</option>
              </Select>
            )}</Field>
            <Field label={tr('Category')}>{id => (
              <Select id={id} value={xCategory} onChange={e => setXCategory(e.target.value)}>
                <option value="all">{tr('All categories')}</option>
                {TASK_CATEGORIES.map(c => <option key={c} value={c}>{tr(c)}</option>)}
              </Select>
            )}</Field>
            <Field label={tr('Assigned to')}>{id => (
              <Select id={id} value={xStaff} onChange={e => setXStaff(e.target.value)}>
                <option value="">{tr('Everyone')}</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}</Field>
          </div>
          <SortFilter value={xSort} onChange={setXSort} order={xOrder} onOrder={setXOrder} options={[
            { value: 'priority', label: tr('Priority') }, { value: 'status', label: tr('Status') }, { value: 'dueDate', label: tr('Due date') }, { value: 'title', label: tr('Title') }, { value: 'category', label: tr('Category') }
          ]} />
        </>}
      />
    </Page>
  );
};
