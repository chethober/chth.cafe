import { ImageUpload } from './ImageUpload';
import React, { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Palette,
  Store,
  CheckCircle,
  Database,
  RefreshCw,
  Download,
  Send,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  CheckSquare,
  ShoppingCart,
  UserCheck,
  Boxes
} from 'lucide-react';
import { SettingsSelect } from '../db/schema';
import { store } from '../db/store';
import { ConfirmModal } from './ConfirmModal';
import { AppearanceEditor } from './AppearanceEditor';
import { AppearanceSettings, parseAppearance } from '../utils/appearance';

interface SettingsPanelProps {
  settings: SettingsSelect;
  onSettingsUpdated: (newSettings: SettingsSelect) => void;
}

const PRESET_PRIMARY_COLORS = [
  { name: 'Warm Amber', hex: '#F59E0B' },
  { name: 'Emerald Tea', hex: '#10B981' },
  { name: 'Indigo Violet', hex: '#6366F1' },
  { name: 'Rose Coral', hex: '#F43F5E' },
  { name: 'Espresso Gold', hex: '#D97706' },
  { name: 'Obsidian Teal', hex: '#14B8A6' }
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsUpdated
}) => {
  const [formData, setFormData] = useState<SettingsSelect>({
    ...settings,
    telegramBotToken: settings.telegramBotToken || '',
    telegramChatId: settings.telegramChatId || '',
    notifySales: settings.notifySales ?? true,
    notifyShifts: settings.notifyShifts ?? true,
    notifyTasks: settings.notifyTasks ?? true,
    notifyDailyReport: settings.notifyDailyReport ?? true,
    notifyLowStock: settings.notifyLowStock ?? true,
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const dirtyRef = useRef(false);
  const editFormData: typeof setFormData = (next) => {
    dirtyRef.current = true;
    setSavedSuccess(false);
    setSaveError('');
    setFormData(next);
  };
  useEffect(() => {
    if (!dirtyRef.current) setFormData({ ...settings });
  }, [settings]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const appearance = parseAppearance(formData.appearance);
  const updateAppearance = (partial: Partial<AppearanceSettings>) => {
    editFormData(previous => ({ ...previous, appearance: JSON.stringify({ ...parseAppearance(previous.appearance), ...partial }) }));
    setSavedSuccess(false);
    setSaveError('');
  };
  const [showToken, setShowToken] = useState(false);

  const [testLoading, setTestLoading] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSavedSuccess(false);
    setSaveError('');
    try {
      const updated = await store.saveSettings(formData);
      setFormData(updated);
      dirtyRef.current = false;
      onSettingsUpdated(updated);
      setSavedSuccess(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestLoading(true);
    setTestFeedback(null);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: formData.telegramBotToken,
          chatId: formData.telegramChatId,
        }),
      });
      const data = (await res.json()) as any;
      if (data.success) {
        setTestFeedback({ success: true, message: 'Test message sent successfully to Telegram!' });
      } else {
        setTestFeedback({ success: false, message: data.error || 'Failed to send Telegram test message.' });
      }
    } catch (err: any) {
      setTestFeedback({ success: false, message: err.message || 'Connection error testing Telegram API.' });
    } finally {
      setTestLoading(false);
    }
  };

  const handleTriggerDailyReport = async () => {
    setReportLoading(true);
    setReportFeedback(null);
    try {
      const res = await fetch('/api/telegram/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as any;
      if (data.success) {
        setReportFeedback({ success: true, message: '12 AM Daily Financial Report sent to Telegram!' });
      } else {
        setReportFeedback({ success: false, message: data.error || 'Failed to send Daily Financial Report.' });
      }
    } catch (err: any) {
      setReportFeedback({ success: false, message: err.message || 'Connection error sending daily report.' });
    } finally {
      setReportLoading(false);
    }
  };

  const [resetModalOpen, setResetModalOpen] = useState(false);

  const handleResetData = () => {
    setResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    store.resetToDefaults();
    onSettingsUpdated(store.getSettings());
    setResetModalOpen(false);
  };

  const handleExportFullBackup = () => {
    const fullState = store.getState();
    const jsonStr = JSON.stringify(fullState, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chth_store_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in font-sans">


      {/* Header Banner */}
      <div className="glass-panel-classy p-5 rounded-3xl border border-zinc-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center brand-glow">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-100 tracking-tight flex items-center gap-2">
              Café settings
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Manage your café details, shared appearance, and alerts.</p>
          </div>
        </div>


      </div>

      {savedSuccess && (
        <div role="status" className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg animate-scale-up">
          <CheckCircle className="w-5 h-5 text-emerald-400" /> Settings saved. The menu, admin, and daily panel share this appearance.
        </div>
      )}

      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        {[
          { id: 'details', label: 'Café details', icon: Store },
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'notifications', label: 'Notifications', icon: Send },
          { id: 'data', label: 'Data management', icon: Database },
        ].map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#settings-${id}`} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:border-amber-500/50 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"><Icon className="h-4 w-4" />{label}</a>
        ))}
      </nav>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={saving} className="space-y-6 min-w-0">
          <legend className="sr-only">Café settings</legend>
        <section id="settings-details" aria-labelledby="settings-details-title" className="space-y-4 scroll-mt-6">
          <div><h2 id="settings-details-title" className="text-lg font-bold text-zinc-100">Café details</h2><p className="mt-1 text-sm text-zinc-400">Your public information and everyday operating preferences.</p></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Cafe Information Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80 space-y-4 text-xs shadow-md">
            <div className="flex items-center gap-2 text-zinc-100 font-extrabold border-b border-zinc-800/80 pb-3 text-sm">
              <Store className="w-4 h-4 text-amber-400" /> Store Identity & Details
            </div>

            <div className="space-y-3.5">
              <ImageUpload label="Store image / logo" value={formData.logoUrl || ''} disabled={saving} onChange={logoUrl => { editFormData(previous => ({ ...previous, logoUrl })); setSavedSuccess(false); }} />
              <div>
                <label className="text-zinc-400 font-bold block mb-1">Store Name</label>
                <input
                  type="text"
                  value={formData.cafeName}
                  onChange={(e) => editFormData({ ...formData, cafeName: e.target.value })}
                  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500 font-bold text-sm"
                  required
                />
              </div>


              <div>
                <label className="text-zinc-400 font-bold block mb-1">Store Address</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => editFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={formData.contactPhone || ''}
                  onChange={(e) => editFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80 space-y-5 text-xs shadow-md">
            <h3 className="flex items-center gap-2 text-zinc-100 font-extrabold border-b border-zinc-800/80 pb-3 text-sm"><Clock className="w-4 h-4 text-amber-400" /> Operating preferences</h3>
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-8">
                  <label className="text-zinc-400 font-bold block mb-1">Currency Symbol</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={formData.currency}
                      onChange={(e) => editFormData({ ...formData, currency: e.target.value })}
                      className="w-16 sm:w-20 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400 font-mono text-center font-black text-base sm:text-lg focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex items-center gap-1 flex-1">
                      {['₹', '$', '€', '£'].map((curr) => (
                        <button
                          key={curr}
                          type="button"
                          onClick={() => editFormData({ ...formData, currency: curr })}
                          className={`flex-1 py-2 rounded-xl text-sm font-black border cursor-pointer transition-colors ${
                            formData.currency === curr
                              ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-md'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-span-4">
                  <label className="text-zinc-400 font-bold block mb-1 text-[11px] truncate">Tax Rate (%)</label>
                  <input
                    type="number" inputMode="decimal"
                    step="0.1"
                    value={formData.taxRate}
                    onChange={(e) => editFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

            <label className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm">Café timezone<input value={formData.timeZone || 'Asia/Tehran'} onChange={e=>editFormData(previous=>({...previous,timeZone:e.target.value}))} placeholder="Asia/Tehran" className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /><span className="block mt-2 text-xs text-zinc-400">IANA timezone used for opening hours and daily reconciliation. Save settings to apply.</span></label>
          </div>
        </div>
        </section>

        <section id="settings-appearance" aria-labelledby="settings-appearance-title" className="space-y-4 scroll-mt-6">
          <div><h2 id="settings-appearance-title" className="text-lg font-bold text-zinc-100">Appearance</h2><p className="mt-1 text-sm text-zinc-400">Themes, typography, and brand colors for the whole café.</p></div>
        <AppearanceEditor appearance={appearance} cafeName={formData.cafeName} currency={formData.currency} accent={formData.brandPrimary} disabled={saving}
          onChange={updateAppearance} onPreset={preset => {
            editFormData(previous => ({ ...previous, brandPrimary: preset.accent, appearance: JSON.stringify({ ...parseAppearance(previous.appearance), ...preset.appearance }) }));
            setSavedSuccess(false);
          }} />
          {/* Brand Theme Palette */}
          <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80 space-y-4 text-xs shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-zinc-100 font-extrabold border-b border-zinc-800/80 pb-3 text-sm">
                <Palette className="w-4 h-4 text-amber-400" /> Brand Theme Accent
              </div>

              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="text-zinc-400 font-bold block mb-2">Preset Accent Swatches</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_PRIMARY_COLORS.map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => editFormData({ ...formData, brandPrimary: color.hex })}
                        className={`p-2.5 rounded-xl font-bold border flex items-center gap-2 cursor-pointer transition ${
                          formData.brandPrimary === color.hex
                            ? 'bg-zinc-900 border-amber-500 text-zinc-100'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: color.hex }} />
                        <span className="truncate text-[11px]">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="brand-primary" className="text-zinc-400 font-bold block mb-1">Ink accent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      id="brand-primary"
                      value={formData.brandPrimary}
                      onChange={(e) => editFormData({ ...formData, brandPrimary: e.target.value })}
                      className="flex-1 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <input type="color" aria-label="Pick ink accent color" value={/^#[0-9a-f]{6}$/i.test(formData.brandPrimary) ? formData.brandPrimary : '#059669'} onChange={event => editFormData({ ...formData, brandPrimary: event.target.value })} className="w-11 h-11 border border-zinc-800 flex-shrink-0 cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="settings-notifications" aria-labelledby="settings-notifications-title" className="space-y-4 scroll-mt-6">
          <div><h2 id="settings-notifications-title" className="text-lg font-bold text-zinc-100">Notifications</h2><p className="mt-1 text-sm text-zinc-400">Connect Telegram and choose which updates to receive.</p></div>
        {/* Telegram Notifications Integration Panel */}
        <div className="glass-panel p-6 rounded-3xl border border-blue-500/20 space-y-5 text-xs shadow-xl bg-zinc-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2.5 text-zinc-100 font-black text-sm">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              Telegram connection
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
              Real-time Alerts & Scheduled 12 AM Summary
            </span>
          </div>

          <p className="text-zinc-400 text-xs">
            Connect your Telegram Bot to receive instant notifications for POS sales, employee clock in/out, checklist completion, and automated 12:00 AM daily financial reports.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Credentials */}
            <div className="space-y-3.5 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80">
              <div>
                <label className="text-zinc-300 font-bold block mb-1">Telegram Bot Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrsTUVwxyZ"
                    value={formData.telegramBotToken || ''}
                    onChange={(e) => editFormData({ ...formData, telegramBotToken: e.target.value })}
                    className="w-full p-2.5 pr-10 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    aria-label={showToken ? 'Hide bot token' : 'Show bot token'}
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">Created via Telegram @BotFather</span>
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">Telegram Chat ID / Channel ID</label>
                <input
                  type="text"
                  placeholder="e.g. 987654321 or -100123456789"
                  value={formData.telegramChatId || ''}
                  onChange={(e) => editFormData({ ...formData, telegramChatId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">Your personal Telegram ID or Group/Channel ID</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={testLoading || !formData.telegramBotToken || !formData.telegramChatId}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testLoading ? 'Sending Test...' : 'Send Test Notification'}
                </button>

                <button
                  type="button"
                  onClick={handleTriggerDailyReport}
                  disabled={reportLoading || !formData.telegramBotToken || !formData.telegramChatId}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {reportLoading ? 'Generating Report...' : 'Test 12 AM Report'}
                </button>
              </div>

              {testFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  testFeedback.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {testFeedback.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                  {testFeedback.message}
                </div>
              )}

              {reportFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  reportFeedback.success
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {reportFeedback.success ? <CheckCircle className="w-4 h-4 text-purple-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                  {reportFeedback.message}
                </div>
              )}
            </div>

            {/* Notification Event Toggles */}
            <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
              <span className="text-zinc-300 font-bold block border-b border-zinc-800/80 pb-2 text-xs">
                Active Notification Events
              </span>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-bold text-zinc-200 block text-xs">Any Sales (POS Orders)</span>
                      <span className="text-[10px] text-zinc-400">Order number, items, total price & payment method</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.notifySales}
                    onChange={(e) => editFormData({ ...formData, notifySales: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-blue-400" />
                    <div>
                      <span className="font-bold text-zinc-200 block text-xs">Employee In/Out (Clock Shifts)</span>
                      <span className="text-[10px] text-zinc-400">Staff name, shift duration & calculated wage</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.notifyShifts}
                    onChange={(e) => editFormData({ ...formData, notifyShifts: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <CheckSquare className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="font-bold text-zinc-200 block text-xs">Task Completion</span>
                      <span className="text-[10px] text-zinc-400">Checklist title, priority, category & staff assignee</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.notifyTasks}
                    onChange={(e) => editFormData({ ...formData, notifyTasks: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="font-bold text-zinc-200 block text-xs">Daily Financial Record (12:00 AM)</span>
                      <span className="text-[10px] text-zinc-400">Total revenue, expenses, net profit & payment breakdown</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.notifyDailyReport}
                    onChange={(e) => editFormData({ ...formData, notifyDailyReport: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Boxes className="w-4 h-4 text-rose-400" />
                    <div>
                      <span className="font-bold text-zinc-200 block text-xs">Low Stock Inventory Warning</span>
                      <span className="text-[10px] text-zinc-400">Triggers when material stock drops to or below minimum threshold</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.notifyLowStock}
                    onChange={(e) => editFormData({ ...formData, notifyLowStock: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        </section>
        </fieldset>
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-xl backdrop-blur">
          <div className="text-xs text-zinc-400" role="status">{saving ? 'Saving your changes…' : dirtyRef.current ? 'You have unsaved changes.' : 'All settings are up to date.'}</div>
        {saveError && <p role="alert" className="text-sm text-rose-400">{saveError}</p>}
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="w-full sm:w-auto px-6 py-3 rounded-xl btn-brand text-zinc-950 font-bold text-sm cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving settings…' : 'Save café settings'}
        </button>
        </div>
      </form>

      <section id="settings-data" aria-labelledby="settings-data-title" className="glass-panel rounded-3xl border border-zinc-800 p-6 space-y-4 scroll-mt-6">
        <div><h2 id="settings-data-title" className="text-lg font-bold text-zinc-100">Data management</h2><p className="mt-1 text-sm text-zinc-400">Download a backup of your café data or restore factory defaults.</p></div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportFullBackup}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4 text-amber-400" /> Export Full Backup (JSON)
          </button>
          <button
            onClick={handleResetData}
            className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs border border-rose-900/40 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reset Factory Defaults
          </button>
        </div>
      </section>

      <ConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        title="Reset Store Data"
        description="Are you sure you want to reset all store data to factory defaults? All orders, tasks, and custom catalog changes will be restored to initial state."
        confirmText="Reset to Defaults"
        cancelText="Cancel"
      />
    </div>
  );
};
