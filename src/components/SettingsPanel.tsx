import { ImageUpload } from './ImageUpload';
import React, { useEffect, useRef, useState } from 'react';
import { QrCode, Bot, Boxes, CalendarClock, CalendarDays, CheckSquare, Clock, Database, Download, Eye, EyeOff, KeyRound, Link2Off, Palette, RefreshCw, Send, ShoppingCart, Store, UserCheck } from 'lucide-react';
import { SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { AppearanceEditor } from './AppearanceEditor';
import { PasswordSettings } from './PasswordSettings';
import { MenuQRCard } from './MenuQR';
import { COMMON_CURRENCIES } from '../utils/money';
import { OpeningHoursEditor, openingHoursErrors, parseOpeningHours } from './OpeningHoursEditor';
import { AppearanceSettings, parseAppearance } from '../utils/appearance';
import { Button, Card, ConfirmDialog, Field, IconButton, Input, Notice, Page, PageHeader, Segmented, Select, ToggleRow, localDateKey } from '../ui';
import { CALENDAR_SYSTEMS, calendarOf, cafeToday, formatDateKey } from '../utils/events';
import { PICKUP_INTERVALS, parsePickupSlots, type PickupSlotSettings } from '../utils/pickupSlots';
import { tr } from '../i18n';

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
/** The page's sections, listed under Settings in the sidebar. */
export const SETTINGS_SECTIONS = [
  { id: 'details', get label() { return tr('Café details'); }, icon: Store },
  { id: 'hours', get label() { return tr('Opening hours'); }, icon: CalendarClock },
  { id: 'appearance', get label() { return tr('Appearance'); }, icon: Palette },
  { id: 'notifications', get label() { return tr('Notifications'); }, icon: Send },
  { id: 'qr', get label() { return tr('Menu QR code'); }, icon: QrCode },
  { id: 'signin', get label() { return tr('Sign-in'); }, icon: KeyRound },
  { id: 'data', get label() { return tr('Data'); }, icon: Database }
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
    notifyLowStock: settings.notifyLowStock ?? true,
    notifyBookings: settings.notifyBookings ?? true
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
  const pickupSlots = parsePickupSlots(formData.pickupSlots);
  const updatePickup = (partial: Partial<PickupSlotSettings>) =>
    edit(prev => ({ ...prev, pickupSlots: JSON.stringify({ ...parsePickupSlots(prev.pickupSlots), ...partial }) }));
  const openingHours = parseOpeningHours(formData.openHours);
  const hoursInvalid = Object.keys(openingHoursErrors(openingHours)).length > 0;

  const [showToken, setShowToken] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testFeedback, setTestFeedback] = useState<Feedback>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<Feedback>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [botStatus, setBotStatus] = useState<{ connected: boolean; url: string; lastError: string } | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botFeedback, setBotFeedback] = useState<Feedback>(null);
  const savedBotToken = !!settings.telegramBotToken;
  const loadBotStatus = async () => {
    try {
      const res = await fetch('/api/telegram/webhook');
      const data = await res.json() as { success?: boolean; data?: { connected: boolean; url: string; lastError: string } };
      setBotStatus(data.success && data.data ? data.data : null);
    } catch { setBotStatus(null); }
  };
  useEffect(() => { if (savedBotToken) void loadBotStatus(); }, [savedBotToken]);
  const changeBotWebhook = async (method: 'POST' | 'DELETE') => {
    setBotLoading(true); setBotFeedback(null);
    try {
      const res = await fetch('/api/telegram/webhook', { method });
      const data = await res.json() as { success?: boolean; error?: string };
      setBotFeedback(data.success
        ? { success: true, message: method === 'POST' ? tr('Bot commands are on. Send /help to your bot.') : tr('Bot commands are off. Alerts still send.') }
        : { success: false, message: data.error || tr('Telegram did not accept the request.') });
      await loadBotStatus();
    } catch (err) {
      setBotFeedback({ success: false, message: err instanceof Error ? err.message : tr('Could not reach the Telegram API.') });
    } finally { setBotLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (hoursInvalid) { setSaveError(tr('Fix the opening hours before saving.')); return; }
    setSaving(true); setSaved(false); setSaveError('');
    try {
      const updated = await store.saveSettings(formData);
      setFormData(updated);
      dirtyRef.current = false;
      setDirty(false);
      onSettingsUpdated(updated);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : tr('Settings could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const postTelegram = async (path: string, body: object | undefined, ok: string, set: (f: Feedback) => void, setLoading: (b: boolean) => void) => {
    setLoading(true); set(null);
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = (await res.json()) as { success?: boolean; error?: string };
      set(data.success ? { success: true, message: ok } : { success: false, message: data.error || tr('Telegram did not accept the request.') });
    } catch (err) {
      set({ success: false, message: err instanceof Error ? err.message : tr('Could not reach the Telegram API.') });
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
      <PageHeader title={tr('Settings')} description={tr('Café details, the shared look of the menu and workspace, and Telegram alerts.')} />

      <div className="ws-settings-layout">
        <div className="ws-page" style={{ animation: 'none' }}>
          <form onSubmit={handleSubmit} className="ws-page" style={{ animation: 'none' }} aria-busy={saving}>
            <fieldset disabled={saving} className="ws-fieldset ws-page" style={{ animation: 'none' }}>
              <legend className="sr-only">{tr('Café settings')}</legend>

              <section id="settings-details" className="ws-section" aria-label={tr('Café details')}>
                <Card title={tr('Café details')} description={tr('Shown on the public menu and receipts.')}>
                  <div className="ws-form">
                    <ImageUpload label={tr('Logo')} value={formData.logoUrl || ''} disabled={saving} onChange={logoUrl => edit({ logoUrl })} />
                    <Field label={tr('Café name')}>{id => <Input id={id} required value={formData.cafeName} onChange={e => edit({ cafeName: e.target.value })} />}</Field>
                    <div className="ws-form-row cols-2">
                      <Field label={tr('Address')} optional>{id => <Input id={id} value={formData.address || ''} onChange={e => edit({ address: e.target.value })} />}</Field>
                      <Field label={tr('Phone')} optional>{id => <Input id={id} type="tel" value={formData.contactPhone || ''} onChange={e => edit({ contactPhone: e.target.value })} />}</Field>
                    </div>
                  </div>
                </Card>
                <Card title={tr('Money and time')} description={tr('Used for prices, tax, opening hours, and closing the day.')}>
                  <div className="ws-form">
                    <Field label={tr('Currency symbol')} aside={
                      <Segmented label={tr('Common currencies')} value={(COMMON_CURRENCIES as readonly string[]).includes(formData.currency) ? formData.currency : ''} onChange={currency => edit({ currency })}
                        options={COMMON_CURRENCIES.map(c => ({ value: c, label: c === 'تومان' ? tr('Toman') : c }))} />
                    }>{id => <Input id={id} className="mono" required maxLength={8} value={formData.currency} onChange={e => edit({ currency: e.target.value })} style={{ maxWidth: 120 }} />}</Field>
                    <div className="ws-form-row cols-2">
                      <Field label={tr('Tax rate (%)')}>{id => <Input id={id} type="number" inputMode="decimal" step="0.1" min="0" value={formData.taxRate} onChange={e => edit({ taxRate: parseFloat(e.target.value) || 0 })} />}</Field>
                      <Field label={tr('Time zone')} hint={tr('IANA name, e.g. Asia/Tehran')}>{(id, hint) => <Input id={id} aria-describedby={hint} value={formData.timeZone || 'Asia/Tehran'} onChange={e => edit({ timeZone: e.target.value })} placeholder={tr('Asia/Tehran')} />}</Field>
                    </div>
                    <div className="ws-form-row cols-2">
                      <Field label={tr('Calendar')} hint={`Event dates read like ${formatDateKey(cafeToday(formData.timeZone || 'Asia/Tehran'), calendarOf(formData.calendarSystem))}`}>{(id, hint) => (
                        <Select id={id} aria-describedby={hint} value={calendarOf(formData.calendarSystem)} onChange={e => edit({ calendarSystem: e.target.value, secondaryCalendar: formData.secondaryCalendar === e.target.value ? '' : formData.secondaryCalendar })}>
                          {CALENDAR_SYSTEMS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </Select>
                      )}</Field>
                      <Field label={tr('Second calendar')} optional hint={tr('Shown smaller beside each date')}>{(id, hint) => (
                        <Select id={id} aria-describedby={hint} value={formData.secondaryCalendar || ''} onChange={e => edit({ secondaryCalendar: e.target.value })}>
                          <option value="">{tr('None')}</option>
                          {CALENDAR_SYSTEMS.filter(c => c.id !== calendarOf(formData.calendarSystem)).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </Select>
                      )}</Field>
                    </div>
                  </div>
                </Card>
              </section>

              <section id="settings-hours" className="ws-section" aria-label={tr('Opening hours')}>
                <OpeningHoursEditor hours={openingHours} disabled={saving} onChange={hours => edit({ openHours: JSON.stringify(hours) })} />
                <Card title={tr('Pickup slots')} description={tr('Customers ordering for pickup choose a time within your opening hours. A slot closes once it holds as many orders as you allow.')}>
                  <div className="ws-form">
                    <ToggleRow icon={<Clock />} title={tr('Offer pickup times')} description={tr('Off: pickup orders are made as soon as possible.')} checked={pickupSlots.enabled} disabled={saving} onChange={enabled => updatePickup({ enabled })} />
                    {pickupSlots.enabled && <div className="ws-form-row cols-2">
                      <Field label={tr('Every')}>{id => (
                        <Select id={id} value={pickupSlots.intervalMinutes} disabled={saving} onChange={e => updatePickup({ intervalMinutes: Number(e.target.value) })}>
                          {PICKUP_INTERVALS.map(m => <option key={m} value={m}>{tr('{count} minutes', { count: m })}</option>)}
                        </Select>
                      )}</Field>
                      <Field label={tr('Orders per slot')}>{id => <Input id={id} type="number" inputMode="numeric" min="1" max="100" step="1" disabled={saving} value={pickupSlots.capacity} onChange={e => updatePickup({ capacity: Math.max(1, parseInt(e.target.value, 10) || 1) })} />}</Field>
                      <Field label={tr('Earliest slot')} hint={tr('How long you need after an order arrives.')}>{(id, hint) => (
                        <Select id={id} aria-describedby={hint} value={pickupSlots.leadMinutes} disabled={saving} onChange={e => updatePickup({ leadMinutes: Number(e.target.value) })}>
                          {[0, 5, 10, 15, 20, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m ? tr('{count} minutes from now', { count: m }) : tr('Right away')}</option>)}
                        </Select>
                      )}</Field>
                    </div>}
                  </div>
                </Card>
              </section>

              <section id="settings-appearance" className="ws-section" aria-label={tr('Appearance')}>
                <AppearanceEditor appearance={appearance} cafeName={formData.cafeName} currency={formData.currency} accent={formData.brandPrimary} disabled={saving}
                  onChange={updateAppearance}
                  onPreset={preset => edit(prev => ({ ...prev, brandPrimary: preset.accent, appearance: JSON.stringify({ ...parseAppearance(prev.appearance), ...preset.appearance }) }))} />
                <Card title={tr('Accent color')} description={tr('Used for highlights, links, and the selected state across the café.')}>
                  <div className="ws-form">
                    <div className="ws-chips" role="group" aria-label={tr('Preset accents')} style={{ flexWrap: 'wrap', mask: 'none', WebkitMask: 'none', paddingInlineEnd: 2 }}>
                      {PRESET_ACCENTS.map(c => (
                        <button key={c.hex} type="button" className="chth-chip" aria-pressed={formData.brandPrimary.toLowerCase() === c.hex.toLowerCase()} onClick={() => edit({ brandPrimary: c.hex })}>
                          <span className="ws-swatch" style={{ background: c.hex, borderRadius: '50%' }} aria-hidden="true" />{c.name}
                        </button>
                      ))}
                    </div>
                    <Field label={tr('Custom color')}>{id => (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input id={id} className="mono" value={formData.brandPrimary} onChange={e => edit({ brandPrimary: e.target.value })} style={{ maxWidth: 180 }} />
                        <input type="color" aria-label={tr('Pick accent color')} value={/^#[0-9a-f]{6}$/i.test(formData.brandPrimary) ? formData.brandPrimary : '#059669'} onChange={e => edit({ brandPrimary: e.target.value })}
                          style={{ width: 'var(--ws-control)', height: 'var(--ws-control)', border: '1px solid var(--ws-rule-strong)', borderRadius: 'var(--ws-radius)', padding: 2, background: 'var(--ws-bg)', cursor: 'pointer' }} />
                      </div>
                    )}</Field>
                  </div>
                </Card>
              </section>

              <section id="settings-notifications" className="ws-section" aria-label={tr('Notifications')}>
                <Card title={tr('Telegram')} description={tr('Get sales, shifts, checklist, booking and stock alerts, plus a financial summary at midnight. Event announcements go to a separate events chat.')}>
                  <div className="ws-form">
                    <div className="ws-form-row cols-2">
                      <Field label={tr('Bot token')} hint={tr('Create a bot with @BotFather')}>{(id, hint) => (
                        <div className="ws-input-wrap">
                          <Input id={id} aria-describedby={hint} className="mono" type={showToken ? 'text' : 'password'} autoComplete="off" value={formData.telegramBotToken || ''} onChange={e => edit({ telegramBotToken: e.target.value })} placeholder="123456789:ABC…" style={{ paddingInlineStart: 12, paddingInlineEnd: 44 }} />
                          <span className="ws-input-suffix"><IconButton label={showToken ? tr('Hide bot token') : tr('Show bot token')} onClick={() => setShowToken(v => !v)}>{showToken ? <EyeOff /> : <Eye />}</IconButton></span>
                        </div>
                      )}</Field>
                      <Field label={tr('Chat or channel ID')} hint={tr('Your user, group, or channel ID')}>{(id, hint) => <Input id={id} aria-describedby={hint} className="mono" value={formData.telegramChatId || ''} onChange={e => edit({ telegramChatId: e.target.value })} placeholder="-100123456789" />}</Field>
                    </div>
                    <Field label={tr('Events chat')} optional hint={tr('A customer group or channel for event announcements, with the bot as an admin. Staff alerts never go here.')}>{(id, hint) => (
                      <Input id={id} aria-describedby={hint} className="mono" value={formData.telegramEventsChatId || ''} onChange={e => edit({ telegramEventsChatId: e.target.value })} placeholder="@yourcafe or -100123456789" />
                    )}</Field>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button size="sm" icon={<Send />} loading={testLoading} disabled={!telegramReady}
                        onClick={() => postTelegram('/api/telegram/test', { botToken: formData.telegramBotToken, chatId: formData.telegramChatId }, 'Test message sent.', setTestFeedback, setTestLoading)}>
                        {testLoading ? tr('Sending…') : tr('Send test message')}
                      </Button>
                      <Button size="sm" icon={<Clock />} loading={reportLoading} disabled={!telegramReady}
                        onClick={() => postTelegram('/api/telegram/daily-report', undefined, 'Daily report sent.', setReportFeedback, setReportLoading)}>
                        {reportLoading ? tr('Sending…') : tr('Send daily report now')}
                      </Button>
                    </div>
                    {testFeedback && <Notice tone={testFeedback.success ? 'positive' : 'danger'}>{testFeedback.message}</Notice>}
                    {reportFeedback && <Notice tone={reportFeedback.success ? 'positive' : 'danger'}>{reportFeedback.message}</Notice>}
                    {!telegramReady && <Notice tone="neutral">{tr('Add a bot token and chat ID to send tests. Saved credentials are used by the server.')}</Notice>}
                  </div>
                </Card>
                <Card title={tr('Bot commands')} description={tr('Check sales, open orders, stock, shifts and tasks from Telegram, and act on them with buttons. Only the chat above can use them.')}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button size="sm" icon={<Bot />} loading={botLoading} disabled={!savedBotToken || dirty} onClick={() => changeBotWebhook('POST')}>
                        {botStatus?.connected ? tr('Reconnect bot commands') : tr('Connect bot commands')}
                      </Button>
                      {botStatus?.url && (
                        <Button size="sm" variant="ghost" icon={<Link2Off />} disabled={botLoading || dirty} onClick={() => changeBotWebhook('DELETE')}>{tr('Disconnect')}</Button>
                      )}
                    </div>
                    {botFeedback && <Notice tone={botFeedback.success ? 'positive' : 'danger'}>{botFeedback.message}</Notice>}
                    {!botFeedback && botStatus?.connected && <Notice tone="positive">{tr('Connected. Try /today, /orders, /stock, /menu or /help in the chat.')}</Notice>}
                    {!botFeedback && botStatus && !botStatus.connected && botStatus.url && <Notice tone="neutral">{tr('The bot sends updates to another address ({url}). Reconnect to use it here.', { url: botStatus.url })}</Notice>}
                    {botStatus?.lastError && <Notice tone="danger">{tr('Telegram’s last delivery error: {lastError}', { lastError: botStatus.lastError })}</Notice>}
                    {(!savedBotToken || dirty) && <Notice tone="neutral">{tr('Save a bot token and chat ID first. Send /chatid to the bot to find a chat’s ID once connected.')}</Notice>}
                  </div>
                </Card>
                <Card title={tr('What to send')}>
                  <ToggleRow icon={<ShoppingCart width={18} height={18} />} title={tr('Sales')} description={tr('Order number, items, total, and payment method')} checked={!!formData.notifySales} onChange={v => edit({ notifySales: v })} />
                  <ToggleRow icon={<UserCheck width={18} height={18} />} title={tr('Clock in and out')} description={tr('Who, how long, and the wage for the shift')} checked={!!formData.notifyShifts} onChange={v => edit({ notifyShifts: v })} />
                  <ToggleRow icon={<CheckSquare width={18} height={18} />} title={tr('Checklist completed')} description={tr('Task, priority, category, and assignee')} checked={!!formData.notifyTasks} onChange={v => edit({ notifyTasks: v })} />
                  <ToggleRow icon={<Clock width={18} height={18} />} title={tr('Daily summary at midnight')} description={tr('Yesterday’s revenue, expenses, profit, payment mix and top sellers')} checked={!!formData.notifyDailyReport} onChange={v => edit({ notifyDailyReport: v })} />
                  <ToggleRow icon={<CalendarDays width={18} height={18} />} title={tr('Event bookings')} description={tr('New and cancelled bookings, with the guest, seats and code')} checked={formData.notifyBookings !== false} onChange={v => edit({ notifyBookings: v })} />
                  <ToggleRow icon={<Boxes width={18} height={18} />} title={tr('Low stock')} description={tr('When a material reaches its reorder level, plus a 9:00 morning check')} checked={!!formData.notifyLowStock} onChange={v => edit({ notifyLowStock: v })} />
                </Card>
              </section>
            </fieldset>

            <div className="ws-savebar" role="region" aria-label={tr('Save settings')}>
              <div role="status" className="ws-hint" style={{ fontSize: 13 }}>
                {saving ? tr('Saving…') : saveError ? <span className="ws-error-text">{saveError}</span> : dirty ? <strong style={{ color: 'var(--ws-ink)' }}>{tr('Unsaved changes')}</strong> : saved ? tr('Saved. The menu, admin, and panel now share this look.') : tr('Everything is up to date.')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {dirty && <Button variant="ghost" onClick={() => { dirtyRef.current = false; setDirty(false); setFormData({ ...settings }); }} disabled={saving}>{tr('Discard')}</Button>}
                <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>{saving ? tr('Saving…') : tr('Save changes')}</Button>
              </div>
            </div>
          </form>

          <section id="settings-qr" className="ws-section" aria-label={tr('Menu QR code')}>
            <MenuQRCard cafeName={settings.cafeName} />
          </section>

          <section id="settings-signin" className="ws-section" aria-label={tr('Sign-in')}>
            <PasswordSettings />
          </section>

          <section id="settings-data" className="ws-section" aria-label={tr('Data')}>
            <Card title={tr('Data')} description={tr('Download everything as JSON, or start over.')}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button icon={<Download />} onClick={exportBackup}>{tr('Download backup')}</Button>
                <Button variant="danger-ghost" icon={<RefreshCw />} onClick={() => setResetOpen(true)}>{tr('Reset to factory defaults')}</Button>
              </div>
            </Card>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => { store.resetToDefaults(); onSettingsUpdated(store.getSettings()); }}
        title={tr('Reset everything?')}
        confirmLabel={tr('Reset to defaults')}
        description={tr('Orders, tasks, and menu changes return to the initial demo state. Download a backup first if you might need them.')}
      />
    </Page>
  );
};
