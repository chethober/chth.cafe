import React, { useMemo, useState } from 'react';
import { Clock, Download, Pencil, Plus, Timer, Trash2, UserPlus, Users, Wallet } from 'lucide-react';
import { StaffSelect, ShiftSelect, SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { copyCSVToClipboard, downloadCSV, downloadJSON, downloadStyledExcel } from '../utils/exportUtils';
import {
  AffixInput, Avatar, Badge, Button, Card, Checkbox, ConfirmDialog, DatePreset, DateRangeFilter, EmptyState, ExportDialog, Field, FormDialog,
  IconButton, Input, List, ListItem, Notice, Page, PageHeader, Progress, SearchInput, Segmented, Select, SortFilter, Stat, StatGrid,
  dateRangeBounds, formatDate, formatTime, inRange, localDateKey, money, plural, slug, toLocalInput
} from '../ui';

interface TimeTrackerProps {
  settings: SettingsSelect;
  staffList: StaffSelect[];
  shifts: ShiftSelect[];
  onShiftUpdated: () => void;
}

const DEFAULT_ROLES = ['Store Manager', 'Head Barista', 'Barista', 'Shift Supervisor', 'Cashier'];
type SortField = 'date' | 'hours' | 'wages' | 'name';
const hours = (v: number) => `${v.toFixed(1)} h`;

export const TimeTracker: React.FC<TimeTrackerProps> = ({ settings, staffList, shifts, onShiftUpdated }) => {
  const currency = settings.currency;
  const fmt = (v: number) => money(v, currency);
  const staffById = useMemo(() => new Map(staffList.map(s => [s.id, s])), [staffList]);
  const activeShifts = shifts.filter(s => !s.clockOut);
  const totalHours = shifts.reduce((a, s) => a + (s.totalHours || 0), 0);
  const totalPay = shifts.reduce((a, s) => a + (s.totalPay || 0), 0);
  const roles = useMemo(() => Array.from(new Set([...DEFAULT_ROLES, ...staffList.map(s => s.role).filter(Boolean)])), [staffList]);
  const hoursByStaff = useMemo(() => {
    const map = new Map<string, number>();
    shifts.forEach(s => map.set(s.staffId, (map.get(s.staffId) || 0) + (s.totalHours || 0)));
    return map;
  }, [shifts]);
  const maxHours = Math.max(1, ...hoursByStaff.values());
  const payFor = (s: ShiftSelect) => s.totalPay != null ? s.totalPay : (s.totalHours || 0) * (staffById.get(s.staffId)?.hourlyRate || 0);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'staff' | 'shift'; id: string; label: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  /* ---------------------------------------------------------- Staff form */
  const [staffOpen, setStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffSelect | null>(null);
  const [staffForm, setStaffForm] = useState({ name: '', role: 'Barista', pin: '', rate: '18.50' });
  const openStaff = (member?: StaffSelect) => {
    setEditingStaff(member || null);
    setStaffForm(member ? { name: member.name, role: member.role, pin: '', rate: String(member.hourlyRate) } : { name: '', role: 'Barista', pin: '', rate: '18.50' });
    setStaffOpen(true);
  };
  const saveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(staffForm.rate);
    if (!staffForm.name.trim() || Number.isNaN(rate) || rate < 0) return;
    if (editingStaff) {
      store.updateStaff(editingStaff.id, { name: staffForm.name.trim(), role: staffForm.role, hourlyRate: rate, ...(staffForm.pin.trim() ? { pin: staffForm.pin.trim() } : {}) });
    } else {
      if (!staffForm.pin.trim()) return;
      store.createStaff({ name: staffForm.name.trim(), role: staffForm.role, pin: staffForm.pin.trim(), hourlyRate: rate, status: 'active' });
    }
    setStaffOpen(false);
    onShiftUpdated();
  };

  /* ---------------------------------------------------------- Shift form */
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftSelect | null>(null);
  const [shiftForm, setShiftForm] = useState({ staffId: '', clockIn: '', clockOut: '', notes: '' });
  const [shiftError, setShiftError] = useState('');
  const openShift = (shift?: ShiftSelect) => {
    setEditingShift(shift || null);
    setShiftForm(shift
      ? { staffId: shift.staffId, clockIn: toLocalInput(shift.clockIn), clockOut: toLocalInput(shift.clockOut), notes: shift.notes || '' }
      : { staffId: '', clockIn: '', clockOut: '', notes: '' });
    setShiftError('');
    setShiftOpen(true);
  };
  const saveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.staffId || !shiftForm.clockIn) return;
    const clockIn = new Date(shiftForm.clockIn).toISOString();
    const clockOut = shiftForm.clockOut ? new Date(shiftForm.clockOut).toISOString() : null;
    if (clockOut && clockOut <= clockIn) return setShiftError('Clock out must be after clock in.');
    if (editingShift) store.updateShift(editingShift.id, { clockIn, clockOut, notes: shiftForm.notes.trim() });
    else store.createShift({ staffId: shiftForm.staffId, clockIn, clockOut, notes: shiftForm.notes.trim() });
    setShiftOpen(false);
    onShiftUpdated();
  };

  /* ------------------------------------------------------- Shift records */
  const [search, setSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [limit, setLimit] = useState(25);
  const records = shifts
    .filter(sh => {
      const q = search.trim().toLowerCase();
      const name = staffById.get(sh.staffId)?.name.toLowerCase() || '';
      return (!q || name.includes(q) || (sh.notes || '').toLowerCase().includes(q))
        && (!staffFilter || sh.staffId === staffFilter)
        && (statusFilter === 'all' || (statusFilter === 'active' ? !sh.clockOut : !!sh.clockOut));
    })
    .sort((a, b) => b.clockIn.localeCompare(a.clockIn));

  /* -------------------------------------------------------------- Export */
  const [xPreset, setXPreset] = useState<DatePreset>('all');
  const [xStart, setXStart] = useState('');
  const [xEnd, setXEnd] = useState('');
  const [xStaff, setXStaff] = useState('');
  const [xRole, setXRole] = useState('');
  const [xStatus, setXStatus] = useState<'all' | 'completed' | 'active'>('all');
  const [xSort, setXSort] = useState<SortField>('date');
  const [xOrder, setXOrder] = useState<'asc' | 'desc'>('desc');
  const [xWages, setXWages] = useState(true);
  const [xNotes, setXNotes] = useState(true);
  const exportRecords = useMemo(() => {
    const bounds = dateRangeBounds(xPreset, xStart, xEnd);
    return shifts
      .filter(s => inRange(s.clockIn, bounds) && (!xStaff || s.staffId === xStaff) && (!xRole || staffById.get(s.staffId)?.role === xRole)
        && (xStatus === 'all' || (xStatus === 'active' ? !s.clockOut : !!s.clockOut)))
      .sort((a, b) => {
        const cmp = xSort === 'date' ? a.clockIn.localeCompare(b.clockIn)
          : xSort === 'hours' ? (a.totalHours || 0) - (b.totalHours || 0)
          : xSort === 'wages' ? payFor(a) - payFor(b)
          : (staffById.get(a.staffId)?.name || '').localeCompare(staffById.get(b.staffId)?.name || '');
        return xOrder === 'desc' ? -cmp : cmp;
      });
  }, [shifts, staffById, xPreset, xStart, xEnd, xStaff, xRole, xStatus, xSort, xOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  const xHours = exportRecords.reduce((a, s) => a + (s.totalHours || 0), 0);
  const xPay = exportRecords.reduce((a, s) => a + payFor(s), 0);
  const xPeople = new Set(exportRecords.map(s => s.staffId)).size;
  const xStaffObj = staffById.get(xStaff);
  const fileBase = `staff_shifts${xStaffObj ? `_${slug(xStaffObj.name)}` : ''}_${xPreset}_${localDateKey()}`;
  const build = () => {
    const headers = ['Shift ID', 'Staff ID', 'Staff Name', 'Role', 'Clock In', 'Clock Out', 'Status', 'Total Hours'];
    const columnAlignments: ('left' | 'center' | 'right')[] = ['left', 'left', 'left', 'left', 'center', 'center', 'center', 'right'];
    if (xWages) { headers.push(`Hourly Rate (${currency})`, `Total Pay (${currency})`); columnAlignments.push('right', 'right'); }
    if (xNotes) { headers.push('Notes / Remarks'); columnAlignments.push('left'); }
    const short = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const rows = exportRecords.map(s => {
      const member = staffById.get(s.staffId);
      const row: (string | number)[] = [s.id, s.staffId, member?.name || 'Unknown', member?.role || 'Staff', short(s.clockIn), s.clockOut ? short(s.clockOut) : 'Active On Clock', s.clockOut ? 'Completed' : 'Active', Number((s.totalHours || 0).toFixed(2))];
      if (xWages) row.push(Number((member?.hourlyRate || 0).toFixed(2)), Number(payFor(s).toFixed(2)));
      if (xNotes) row.push(s.notes || '');
      return row;
    });
    return { headers, rows, columnAlignments };
  };

  return (
    <Page>
      <PageHeader
        title="Staff & shifts"
        description="Your team, their rates, and every clocked shift. Staff clock in from the daily panel."
        actions={<>
          <Button icon={<Download />} onClick={() => setExportOpen(true)}>Export</Button>
          <Button icon={<Clock />} onClick={() => openShift()} disabled={!staffList.length}>Log shift</Button>
          <Button variant="primary" icon={<UserPlus />} onClick={() => openStaff()}>Add team member</Button>
        </>}
      />

      <StatGrid>
        <Stat label="On shift now" icon={<Timer />} value={activeShifts.length} tone={activeShifts.length ? 'positive' : 'neutral'} onClick={() => setStatusFilter('active')} active={statusFilter === 'active'} />
        <Stat label="Hours logged" icon={<Clock />} value={hours(totalHours)} hint={plural(shifts.length, 'shift')} />
        <Stat label="Wages" icon={<Wallet />} value={fmt(totalPay)} hint="Across all shifts" />
        <Stat label="Team" icon={<Users />} value={staffList.length} />
      </StatGrid>

      <div className="ws-grid ws-grid-2" style={{ alignItems: 'start' }}>
        <Card flush title="Team" description="Hours are compared to the busiest team member.">
          {staffList.length === 0 ? (
            <EmptyState icon={<Users />} title="No team members yet" action={<Button variant="primary" icon={<UserPlus />} onClick={() => openStaff()}>Add team member</Button>} />
          ) : (
            <List label="Team">
              {staffList.map(member => {
                const shift = activeShifts.find(s => s.staffId === member.id);
                const h = hoursByStaff.get(member.id) || 0;
                return (
                  <ListItem
                    key={member.id}
                    onClick={() => openStaff(member)}
                    label={`Edit ${member.name}`}
                    lead={<Avatar name={member.name} tone={shift ? 'positive' : undefined} />}
                    title={<><span className="ws-truncate">{member.name}</span>{shift && <Badge tone="positive" dot>Since {formatTime(shift.clockIn)}</Badge>}</>}
                    subtitle={<><span>{member.role}</span><span className="tabular">{fmt(member.hourlyRate)}/h</span></>}
                    trail={<div style={{ width: 96 }}>
                      <div className="tabular" style={{ fontWeight: 600, marginBottom: 6 }}>{hours(h)}</div>
                      <Progress value={h / maxHours} tone={shift ? 'positive' : 'accent'} label={`${member.name} hours`} />
                    </div>}
                    actions={<IconButton label={`Remove ${member.name}`} variant="danger-ghost" onClick={() => setDeleteTarget({ type: 'staff', id: member.id, label: member.name })}><Trash2 /></IconButton>}
                  />
                );
              })}
            </List>
          )}
        </Card>

        <Card flush title="Shifts" description={`${records.length} of ${shifts.length}`}>
          <div className="ws-toolbar" style={{ padding: '0 var(--ws-pad) 12px' }}>
            <SearchInput className="ws-grow" value={search} onChange={setSearch} placeholder="Search name or notes" label="Search shifts" />
            <Select aria-label="Team member" value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Everyone</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Segmented label="Shift status" value={statusFilter} onChange={setStatusFilter} options={[
              { value: 'all', label: 'All' }, { value: 'active', label: 'Active', count: activeShifts.length }, { value: 'completed', label: 'Done' }
            ]} />
          </div>
          {records.length === 0 ? (
            <EmptyState icon={<Clock />} title="No shifts match" />
          ) : (
            <>
              <List label="Shifts">
                {records.slice(0, limit).map(sh => (
                  <ListItem
                    key={sh.id}
                    onClick={() => openShift(sh)}
                    label={`Edit shift for ${staffById.get(sh.staffId)?.name || 'staff'}`}
                    title={<><span className="ws-truncate">{staffById.get(sh.staffId)?.name || 'Former staff'}</span>{!sh.clockOut && <Badge tone="positive" dot>On shift</Badge>}</>}
                    subtitle={<>
                      <span className="tabular">{formatDate(sh.clockIn, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTime(sh.clockIn)}–{sh.clockOut ? formatTime(sh.clockOut) : 'now'}</span>
                      {sh.notes && <span className="ws-truncate" style={{ maxWidth: 200, display: 'block' }}>{sh.notes}</span>}
                    </>}
                    trail={sh.clockOut ? <><span className="ws-amount">{hours(sh.totalHours || 0)}</span><span className="ws-hint tabular">{fmt(sh.totalPay || 0)}</span></> : undefined}
                    actions={<>
                      <IconButton label="Edit shift" onClick={() => openShift(sh)}><Pencil /></IconButton>
                      <IconButton label="Delete shift" variant="danger-ghost" onClick={() => setDeleteTarget({ type: 'shift', id: sh.id, label: staffById.get(sh.staffId)?.name || 'this shift' })}><Trash2 /></IconButton>
                    </>}
                  />
                ))}
              </List>
              {records.length > limit && <div style={{ padding: 12, textAlign: 'center' }}><Button size="sm" variant="ghost" onClick={() => setLimit(l => l + 25)}>Show more</Button></div>}
            </>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------ Dialogs */}
      <FormDialog open={staffOpen} onClose={() => setStaffOpen(false)} title={editingStaff ? `Edit ${editingStaff.name}` : 'Add team member'}
        submitLabel={editingStaff ? 'Save changes' : 'Add to team'} submitDisabled={!staffForm.name.trim() || (!editingStaff && !staffForm.pin.trim())} onSubmit={saveStaff}>
        <Field label="Name">{id => <Input id={id} autoFocus required value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} />}</Field>
        <div className="ws-form-row cols-2">
          <Field label="Role">{id => (
            <Select id={id} value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          )}</Field>
          <Field label="Hourly rate">{id => <AffixInput id={id} affix={currency} type="number" inputMode="decimal" step="0.5" min="0" required value={staffForm.rate} onChange={e => setStaffForm({ ...staffForm, rate: e.target.value })} />}</Field>
        </div>
        <Field label={editingStaff ? 'New clock-in PIN' : 'Clock-in PIN'} optional={!!editingStaff} hint={editingStaff ? 'Leave empty to keep the current PIN.' : 'Used on the daily panel to clock in and out.'}>{(id, hint) => (
          <Input id={id} aria-describedby={hint} className="mono" type="password" inputMode="numeric" autoComplete="new-password" required={!editingStaff} value={staffForm.pin} onChange={e => setStaffForm({ ...staffForm, pin: e.target.value })} />
        )}</Field>
      </FormDialog>

      <FormDialog open={shiftOpen} onClose={() => setShiftOpen(false)} title={editingShift ? 'Edit shift' : 'Log a shift'} description="Hours and pay are calculated from the times and the hourly rate."
        submitLabel={editingShift ? 'Save shift' : 'Log shift'} submitDisabled={!shiftForm.staffId || !shiftForm.clockIn} onSubmit={saveShift}>
        {shiftError && <Notice tone="danger">{shiftError}</Notice>}
        <Field label="Team member">{id => (
          <Select id={id} required disabled={!!editingShift} value={shiftForm.staffId} onChange={e => setShiftForm({ ...shiftForm, staffId: e.target.value })}>
            <option value="">Choose a team member</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name} · {s.role} · {fmt(s.hourlyRate)}/h</option>)}
          </Select>
        )}</Field>
        <div className="ws-form-row cols-2">
          <Field label="Clock in">{id => <Input id={id} type="datetime-local" required value={shiftForm.clockIn} onChange={e => { setShiftForm({ ...shiftForm, clockIn: e.target.value }); setShiftError(''); }} />}</Field>
          <Field label="Clock out" optional hint="Leave empty if still on shift">{(id, hint) => <Input id={id} aria-describedby={hint} type="datetime-local" min={shiftForm.clockIn || undefined} value={shiftForm.clockOut} onChange={e => { setShiftForm({ ...shiftForm, clockOut: e.target.value }); setShiftError(''); }} />}</Field>
        </div>
        <Field label="Notes" optional>{id => <Input id={id} value={shiftForm.notes} onChange={e => setShiftForm({ ...shiftForm, notes: e.target.value })} placeholder="e.g. Covered the morning rush" />}</Field>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'staff') store.deleteStaff(deleteTarget.id);
          else store.deleteShift(deleteTarget.id);
          onShiftUpdated();
        }}
        title={deleteTarget?.type === 'staff' ? `Remove ${deleteTarget.label}?` : 'Delete this shift?'}
        description={deleteTarget?.type === 'staff' ? 'They can no longer clock in. This cannot be undone.' : `The shift for ${deleteTarget?.label} and its wages are removed. This cannot be undone.`}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export shifts"
        description="Attendance and wages for payroll."
        records={exportRecords}
        rowKey={s => s.id}
        summary={[
          { label: 'Shifts', value: exportRecords.length },
          { label: 'Hours', value: hours(xHours) },
          { label: 'Wages', value: fmt(xPay) },
          { label: 'People', value: xPeople }
        ]}
        previewColumns={[
          { key: 'name', header: 'Name', render: s => staffById.get(s.staffId)?.name || 'Unknown' },
          { key: 'date', header: 'Date', render: s => formatDate(s.clockIn) },
          { key: 'time', header: 'Time', render: s => `${formatTime(s.clockIn)}–${s.clockOut ? formatTime(s.clockOut) : 'now'}` },
          { key: 'hours', header: 'Hours', align: 'right', render: s => (s.totalHours || 0).toFixed(1) },
          { key: 'pay', header: 'Pay', align: 'right', render: s => fmt(payFor(s)) }
        ]}
        onReset={() => { setXPreset('all'); setXStart(''); setXEnd(''); setXStaff(''); setXRole(''); setXStatus('all'); setXSort('date'); setXOrder('desc'); setXWages(true); setXNotes(true); }}
        onCopy={() => { const d = build(); return copyCSVToClipboard(d.headers, d.rows); }}
        onCSV={() => { const d = build(); downloadCSV(`${fileBase}.csv`, d.headers, d.rows); }}
        onJSON={() => downloadJSON(`${fileBase}.json`, {
          metadata: {
            generatedAt: new Date().toISOString(), currency, totalRecords: exportRecords.length,
            filtersApplied: { datePreset: xPreset, customStart: xStart || null, customEnd: xEnd || null, staffId: xStaff || 'all', role: xRole || 'all', status: xStatus, sortBy: xSort, sortOrder: xOrder, includeWages: xWages, includeNotes: xNotes },
            summary: { totalHours: xHours, totalWages: xPay, uniqueStaffCount: xPeople, activeShiftsCount: exportRecords.filter(s => !s.clockOut).length, completedShiftsCount: exportRecords.filter(s => !!s.clockOut).length }
          },
          shifts: exportRecords.map(s => {
            const member = staffById.get(s.staffId);
            return {
              id: s.id, staffId: s.staffId, staffName: member?.name || 'Unknown', role: member?.role || 'Staff', clockIn: s.clockIn, clockOut: s.clockOut || null,
              status: s.clockOut ? 'completed' : 'active', totalHours: s.totalHours || 0,
              ...(xWages && { hourlyRate: member?.hourlyRate || 0, totalPay: payFor(s) }),
              ...(xNotes && { notes: s.notes || '' })
            };
          })
        })}
        onExcel={() => {
          const d = build();
          const totalsRow: (string | number)[] = ['TOTALS', '', '', '', '', '', `${exportRecords.length} Shifts`, Number(xHours.toFixed(2))];
          if (xWages) totalsRow.push('', Number(xPay.toFixed(2)));
          if (xNotes) totalsRow.push('');
          downloadStyledExcel({
            filename: `${fileBase}.xls`,
            title: 'CHTH Cafe — Employee Shift Attendance & Wage Ledger',
            subtitle: `Export Date: ${new Date().toLocaleDateString()} | Period: ${xPreset.replace('_', ' ').toUpperCase()} | Staff: ${xStaffObj?.name || 'ALL TEAM MEMBERS'}`,
            themeColor: 'emerald',
            metadata: { Period: xPreset.replace('_', ' ').toUpperCase(), 'Staff Filter': xStaffObj?.name || 'All Team Members', 'Role Filter': xRole || 'All Roles', 'Shift Status': xStatus.toUpperCase(), 'Sort Field': `${xSort.toUpperCase()} (${xOrder.toUpperCase()})`, Currency: currency },
            summaryCards: [
              { label: 'Total Shifts', value: exportRecords.length }, { label: 'Total Hours', value: `${xHours.toFixed(1)} hrs` },
              { label: 'Total Labor Wages', value: fmt(xPay) }, { label: 'Employees On Roster', value: xPeople }
            ],
            ...d,
            totalsRow
          });
        }}
        filters={<>
          <DateRangeFilter preset={xPreset} onPreset={setXPreset} start={xStart} end={xEnd} onStart={setXStart} onEnd={setXEnd} />
          <div className="ws-form-row cols-3">
            <Field label="Team member">{id => (
              <Select id={id} value={xStaff} onChange={e => setXStaff(e.target.value)}>
                <option value="">Everyone</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}</Field>
            <Field label="Role">{id => (
              <Select id={id} value={xRole} onChange={e => setXRole(e.target.value)}>
                <option value="">All roles</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            )}</Field>
            <Field label="Status">{id => (
              <Select id={id} value={xStatus} onChange={e => setXStatus(e.target.value as typeof xStatus)}>
                <option value="all">All shifts</option><option value="completed">Completed</option><option value="active">Active now</option>
              </Select>
            )}</Field>
          </div>
          <SortFilter value={xSort} onChange={setXSort} order={xOrder} onOrder={setXOrder} options={[
            { value: 'date', label: 'Date' }, { value: 'hours', label: 'Hours' }, { value: 'wages', label: 'Pay' }, { value: 'name', label: 'Name' }
          ]} />
          <Checkbox checked={xWages} onChange={setXWages}>Include hourly rate and pay</Checkbox>
          <Checkbox checked={xNotes} onChange={setXNotes}>Include notes</Checkbox>
        </>}
      />
    </Page>
  );
};
