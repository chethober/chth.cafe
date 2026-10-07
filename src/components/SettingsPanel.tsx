import { ImageUpload } from './ImageUpload';
import React, { useEffect, useRef, useState } from 'react';
import { Boxes, CalendarClock, CheckSquare, Clock, Database, Download, Eye, EyeOff, Palette, RefreshCw, Send, ShoppingCart, Store, UserCheck } from 'lucide-react';
import { SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { AppearanceEditor } from './AppearanceEditor';
import { OpeningHoursEditor, openingHoursErrors, parseOpeningHours } from './OpeningHoursEditor';
import { AppearanceSettings, parseAppearance } from '../utils/appearance';
import { Button, Card, ConfirmDialog, Field, IconButton, Input, Notice, Page, PageHeader, Segmented, ToggleRow, localDateKey } from '../ui';

interface SettingsPanelProps {
  settings: SettingsSelect;
  onSettingsUpdated: (newSettings: SettingsSelect) => void;
}

const PRESET_ACCENTS = [
  { name: 'Warm amber', hex: '#F59E0B' },
  { name: 'Emerald tea', hex: '#10B981' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Rose coral', hex: '#F43F5E' },
  { name: 'Espresso gold', hex: '#D97706' },
  { name: 'Teal', hex: '#14B8A6' }
];
const SECTIONS = [
  { id: 'details', label: 'Café details', icon: Store },
  { id: 'hours', label: 'Opening hours', icon: CalendarClock },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Send },
  { id: 'data', label: 'Data', icon: Database }
];
type Feedback = { success: boolean; message: string } | null;

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsUpdated }) => {
  const [formData, setFormData] = useState<SettingsSelect>({
    ...settings,
    telegramBotToken: settings.telegramBotToken || '',
    telegramChatId: settings.telegramChatId || '',
    notifySales: settings.notifySales ?? true,
    notifyShifts: settings.notifyShifts ?? true,
    notifyTasks: settings.notifyTasks ?? true,
    notifyDailyReport: settings.notifyDailyReport ?? true,
    notifyLowStock: settings.notifyLowStock ?? true
  });
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const edit = (next: Partial<SettingsSelect> | ((prev: SettingsSelect) => SettingsSelect)) => {
    dirtyRef.current = true;
    setDirty(true);
    setSaved(false);
    setSaveError('');
    setFormData(prev => (typeof next === 'function' ? next(prev) : { ...prev, ...next }));
  };
  // Pick up synced settings unless the admin is mid-edit.
  useEffect(() => { if (!dirtyRef.current) setFormData({ ...settings }); }, [settings]);

  const appearance = parseAppearance(formData.appearance);
  const updateAppearance = (partial: Partial<AppearanceSettings>) =>
    edit(prev => ({ ...prev, appearance: JSON.stringify({ ...parseAppearance(prev.appearance), ...partial }) }));
  const openingHours = parseOpeningHours(formData.openHours);
  const hoursInvalid = Object.keys(openingHoursErrors(openingHours)).length > 0;

  const [showToken, setShowToken] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testFeedback, setTestFeedback] = useState<Feedback>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<Feedback>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (hoursInvalid) { setSaveError('Fix the opening hours before saving.'); return; }
    setSaving(true); setSaved(false); setSaveError('');
    try {
      const updated = await store.saveSettings(formData);
      setFormData(updated);
      dirtyRef.current = false;
      setDirty(false);
      onSettingsUpdated(updated);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const postTelegram = async (path: string, body: object | undefined, ok: string, set: (f: Feedback) => void, setLoading: (b: boolean) => void) => {
    setLoading(true); set(null);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = (await res.json()) as { success?: boolean; error?: string };
      set(data.success ? { success: true, message: ok } : { success: false, message: data.error || 'Telegram did not accept the request.' });
    } catch (err) {
      set({ success: false, message: err instanceof Error ? err.message : 'Could not reach the Telegram API.' });
    } finally { setLoading(false); }
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(store.getState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chth_store_backup_${localDateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const telegramReady = !!formData.telegramBotToken && !!formData.telegramChatId;

  return (
    <Page>
      <PageHeader title="Settings" description="Café details, the shared look of the menu and workspace, and Telegram alerts." />

      <div className="ws-settings-layout">
        <nav className="ws-settings-nav" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#settings-${id}`} className="ws-nav-item" style={{ whiteSpace: 'nowrap', width: 'auto' }}><Icon /><span>{label}</span></a>
          ))}
        </nav>

        <div className="ws-page" style={{ animation: 'none' }}>
          <form onSubmit={handleSubmit} className="ws-page" style={{ animation: 'none' }} aria-busy={saving}>
            <fieldset disabled={saving} className="ws-fieldset ws-page" style={{ animation: 'none' }}>
              <legend className="sr-only">Café settings</legend>

              <section id="settings-details" className="ws-section" aria-label="Café details">
                <Card title="Café details" description="Shown on the public menu and receipts.">
                  <div className="ws-form">
                    <ImageUpload label="Logo" value={formData.logoUrl || ''} disabled={saving} onChange={logoUrl => edit({ logoUrl })} />
                    <Field label="Café name">{id => <Input id={id} required value={formData.cafeName} onChange={e => edit({ cafeName: e.target.value })} />}</Field>
                    <div className="ws-form-row cols-2">
                      <Field label="Address" optional>{id => <Input id={id} value={formData.address || ''} onChange={e => edit({ address: e.target.value })} />}</Field>
                      <Field label="Phone" optional>{id => <Input id={id} type="tel" value={formData.contactPhone || ''} onChange={e => edit({ contactPhone: e.target.value })} />}</Field>
                    </div>
                  </div>
                </Card>
                <Card title="Money and time" description="Used for prices, tax, opening hours, and closing the day.">
                  <div className="ws-form">
                    <Field label="Currency symbol" aside={
                      <Segmented label="Common currencies" value={['₹', '$', '€', '£'].includes(formData.currency) ? formData.currency : ''} onChange={currency => edit({ currency })}
                        options={['₹', '$', '€', '£'].map(c => ({ value: c, label: c }))} />
                    }>{id => <Input id={id} className="mono" required maxLength={4} value={formData.currency} onChange={e => edit({ currency: e.target.value })} style={{ maxWidth: 120 }} />}</Field>
                    <div className="ws-form-row cols-2">
                      <Field label="Tax rate (%)">{id => <Input id={id} type="number" inputMode="decimal" step="0.1" min="0" value={formData.taxRate} onChange={e => edit({ taxRate: parseFloat(e.target.value) || 0 })} />}</Field>
                      <Field label="Time zone" hint="IANA name, e.g. Asia/Tehran">{(id, hint) => <Input id={id} aria-describedby={hint} value={formData.timeZone || 'Asia/Tehran'} onChange={e => edit({ timeZone: e.target.value })} placeholder="Asia/Tehran" />}</Field>
                    </div>
                  </div>
                </Card>
              </section>

              <section id="settings-hours" className="ws-section" aria-label="Opening hours">
                <OpeningHoursEditor hours={openingHours} disabled={saving} onChange={hours => edit({ openHours: JSON.stringify(hours) })} />
              </section>

              <section id="settings-appearance" className="ws-section" aria-label="Appearance">
                <AppearanceEditor appearance={appearance} cafeName={formData.cafeName} currency={formData.currency} accent={formData.brandPrimary} disabled={saving}
                  onChange={updateAppearance}
                  onPreset={preset => edit(prev => ({ ...prev, brandPrimary: preset.accent, appearance: JSON.stringify({ ...parseAppearance(prev.appearance), ...preset.appearance }) }))} />
                <Card title="Accent color" description="Used for highlights, links, and the selected state across the café.">
                  <div className="ws-form">
                    <div className="ws-chips" role="group" aria-label="Preset accents" style={{ flexWrap: 'wrap', mask: 'none', WebkitMask: 'none', paddingRight: 2 }}>
                      {PRESET_ACCENTS.map(c => (
                        <button key={c.hex} type="button" className="ws-chip" aria-pressed={formData.brandPrimary.toLowerCase() === c.hex.toLowerCase()} onClick={() => edit({ brandPrimary: c.hex })}>
                          <span className="ws-swatch" style={{ background: c.hex, borderRadius: '50%' }} aria-hidden="true" />{c.name}
                        </button>
                      ))}
                    </div>
                    <Field label="Custom color">{id => (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input id={id} className="mono" value={formData.brandPrimary} onChange={e => edit({ brandPrimary: e.target.value })} style={{ maxWidth: 180 }} />
                        <input type="color" aria-label="Pick accent color" value={/^#[0-9a-f]{6}$/i.test(formData.brandPrimary) ? formData.brandPrimary : '#059669'} onChange={e => edit({ brandPrimary: e.target.value })}
                          style={{ width: 'var(--ws-control)', height: 'var(--ws-control)', border: '1px solid var(--ws-rule-strong)', borderRadius: 'var(--ws-radius)', padding: 2, background: 'var(--ws-bg)', cursor: 'pointer' }} />
                      </div>
                    )}</Field>
                  </div>
                </Card>
              </section>

              <section id="settings-notifications" className="ws-section" aria-label="Notifications">
                <Card title="Telegram" description="Get sales, shifts, checklist and stock alerts, plus a financial summary at midnight.">
                  <div className="ws-form">
                    <div className="ws-form-row cols-2">
                      <Field label="Bot token" hint="Create a bot with @BotFather">{(id, hint) => (
                        <div className="ws-input-wrap">
                          <Input id={id} aria-describedby={hint} className="mono" type={showToken ? 'text' : 'password'} autoComplete="off" value={formData.telegramBotToken || ''} onChange={e => edit({ telegramBotToken: e.target.value })} placeholder="123456789:ABC…" style={{ paddingLeft: 12, paddingRight: 44 }} />
                          <span className="ws-input-suffix"><IconButton label={showToken ? 'Hide bot token' : 'Show bot token'} onClick={() => setShowToken(v => !v)}>{showToken ? <EyeOff /> : <Eye />}</IconButton></span>
                        </div>
                      )}</Field>
                      <Field label="Chat or channel ID" hint="Your user, group, or channel ID">{(id, hint) => <Input id={id} aria-describedby={hint} className="mono" value={formData.telegramChatId || ''} onChange={e => edit({ telegramChatId: e.target.value })} placeholder="-100123456789" />}</Field>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button size="sm" icon={<Send />} loading={testLoading} disabled={!telegramReady}
                        onClick={() => postTelegram('/api/telegram/test', { botToken: formData.telegramBotToken, chatId: formData.telegramChatId }, 'Test message sent.', setTestFeedback, setTestLoading)}>
                        {testLoading ? 'Sending…' : 'Send test message'}
                      </Button>
                      <Button size="sm" icon={<Clock />} loading={reportLoading} disabled={!telegramReady}
                        onClick={() => postTelegram('/api/telegram/daily-report', undefined, 'Daily report sent.', setReportFeedback, setReportLoading)}>
                        {reportLoading ? 'Sending…' : 'Send daily report now'}
                      </Button>
                    </div>
                    {testFeedback && <Notice tone={testFeedback.success ? 'positive' : 'danger'}>{testFeedback.message}</Notice>}
                    {reportFeedback && <Notice tone={reportFeedback.success ? 'positive' : 'danger'}>{reportFeedback.message}</Notice>}
                    {!telegramReady && <Notice tone="neutral">Add a bot token and chat ID to send tests. Saved credentials are used by the server.</Notice>}
                  </div>
                </Card>
                <Card title="What to send">
                  <ToggleRow icon={<ShoppingCart width={18} height={18} />} title="Sales" description="Order number, items, total, and payment method" checked={!!formData.notifySales} onChange={v => edit({ notifySales: v })} />
                  <ToggleRow icon={<UserCheck width={18} height={18} />} title="Clock in and out" description="Who, how long, and the wage for the shift" checked={!!formData.notifyShifts} onChange={v => edit({ notifyShifts: v })} />
                  <ToggleRow icon={<CheckSquare width={18} height={18} />} title="Checklist completed" description="Task, priority, category, and assignee" checked={!!formData.notifyTasks} onChange={v => edit({ notifyTasks: v })} />
                  <ToggleRow icon={<Clock width={18} height={18} />} title="Daily summary at midnight" description="Revenue, expenses, profit, and payment mix" checked={!!formData.notifyDailyReport} onChange={v => edit({ notifyDailyReport: v })} />
                  <ToggleRow icon={<Boxes width={18} height={18} />} title="Low stock" description="When a material reaches its reorder level" checked={!!formData.notifyLowStock} onChange={v => edit({ notifyLowStock: v })} />
                </Card>
              </section>
            </fieldset>

            <div className="ws-savebar" role="region" aria-label="Save settings">
              <div role="status" className="ws-hint" style={{ fontSize: 13 }}>
                {saving ? 'Saving…' : saveError ? <span className="ws-error-text">{saveError}</span> : dirty ? <strong style={{ color: 'var(--ws-ink)' }}>Unsaved changes</strong> : saved ? 'Saved. The menu, admin, and panel now share this look.' : 'Everything is up to date.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {dirty && <Button variant="ghost" onClick={() => { dirtyRef.current = false; setDirty(false); setFormData({ ...settings }); }} disabled={saving}>Discard</Button>}
                <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </div>
          </form>

          <section id="settings-data" className="ws-section" aria-label="Data">
            <Card title="Data" description="Download everything as JSON, or start over.">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button icon={<Download />} onClick={exportBackup}>Download backup</Button>
                <Button variant="danger-ghost" icon={<RefreshCw />} onClick={() => setResetOpen(true)}>Reset to factory defaults</Button>
              </div>
            </Card>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => { store.resetToDefaults(); onSettingsUpdated(store.getSettings()); }}
        title="Reset everything?"
        confirmLabel="Reset to defaults"
        description="Orders, tasks, and menu changes return to the initial demo state. Download a backup first if you might need them."
      />
    </Page>
  );
};
