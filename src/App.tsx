import React, { useState, useEffect } from 'react';
import {
  Coffee,
  Settings,
  Clock,
  TrendingUp,
  UtensilsCrossed,
  Lock,
  CheckSquare,
  Sun,
  Moon,
  Boxes,
  ShoppingBag,
  Plus,
  Users
} from 'lucide-react';
import { store } from './db/store';
import { api } from './services/api';
import { applyAppearance } from './utils/appearance';
import { applyFavicon, brandTitle } from './utils/branding';
import { PublicMenu } from './components/PublicMenu';
import { SettingsPanel } from './components/SettingsPanel';
import { TimeTracker } from './components/TimeTracker';
import { FinancialTracker } from './components/FinancialTracker';
import { MenuAdmin } from './components/MenuAdmin';
import { TaskManager } from './components/TaskManager';
import { PanelManager, PanelSection } from './components/PanelManager';
import { StockManagement } from './components/StockManagement';
import { Button, Field, IconButton, Input, Notice, NavItem, WorkspaceShell } from './ui';

type AdminTab = 'financials' | 'tasks' | 'menu_admin' | 'stock' | 'staff' | 'settings';
const ADMIN_TABS: AdminTab[] = ['financials', 'tasks', 'menu_admin', 'stock', 'staff', 'settings'];
const PANEL_SECTIONS: PanelSection[] = ['orders', 'pos', 'tasks', 'shifts'];

function usePersistentState<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
    } catch { /* storage unavailable */ }
    return fallback;
  });
  useEffect(() => { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } }, [key, value]);
  return [value, setValue] as const;
}

export const App: React.FC = () => {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  // Each SPA is selected only by its subdomain, including local development.
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isAdminView = hostname.startsWith('admin.');
  const isPanelView = hostname.startsWith('panel.');
  const isWorkspace = isAdminView || isPanelView;

  const [adminTab, setAdminTab] = usePersistentState<AdminTab>('chth_admin_last_tab', ADMIN_TABS, 'financials');
  const [panelSection, setPanelSection] = usePersistentState<PanelSection>('chth_panel_last_tab', PANEL_SECTIONS, 'orders');

  // Theme (Light/Dark mode) state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('chth_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* storage unavailable */ }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    // Browser chrome and the status bar follow the page paper, not the OS scheme, because the theme is chosen in-app.
    const paper = getComputedStyle(root).getPropertyValue('--menu-paper').trim();
    if (paper) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
    try { localStorage.setItem('chth_theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const [, setStateVersion] = useState(0);
  const refresh = () => setStateVersion((v) => v + 1);

  // Admin authentication state
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    const checkSession = () => fetch('/api/auth/session').then(res => res.json()).then(data => setIsAdminAuthed((data as { authenticated?: boolean }).authenticated === true)).catch(() => {});
    void checkSession().finally(() => setAuthLoading(false));
    // Hidden tabs stop polling and catch up as soon as they are shown again.
    const poll = () => { if (document.visibilityState === 'visible') { void store.syncFromAPI(); void checkSession(); } };
    const timer = window.setInterval(poll, 15000);
    document.addEventListener('visibilitychange', poll);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, []);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(refresh);
    return () => { unsubscribe(); };
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError(null);
    try {
      const result = await api<{ success?: boolean }>('/api/auth/login', { password: passwordInput });
      if (result.success !== true) throw new Error('The sign-in response was invalid. Check the café API.');
      setIsAdminAuthed(true); setPasswordInput(''); await store.syncFromAPI();
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Sign-in failed.'); }
    finally { setAuthLoading(false); }
  };
  const handleAdminLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign-out failed. Please try again.');
      setIsAdminAuthed(false); store.clearPrivateData(); window.history.replaceState({}, '', '/');
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Sign-out failed.'); }
  };

  const settings = store.getSettings();
  const categories = store.getCategories();
  const menuItems = store.getMenuItems();
  const menuVariants = store.getMenuVariants();
  const staffList = store.getStaff();
  const shifts = store.getShifts();
  const orders = store.getOrders();
  const orderItems = store.getOrderItems();
  const expenses = store.getExpenses();
  const tasksList = store.getTasks();
  const stockItems = store.getStockItems();

  // Dynamically update CSS root variables for brand theme
  useEffect(() => {
    if (settings.brandPrimary) document.documentElement.style.setProperty('--brand-primary', settings.brandPrimary);
    if (settings.brandSecondary) document.documentElement.style.setProperty('--brand-secondary', settings.brandSecondary);
  }, [settings.brandPrimary, settings.brandSecondary]);

  useEffect(() => { applyAppearance(settings.appearance); }, [settings.appearance]);

  useEffect(() => {
    document.title = brandTitle(settings.cafeName, isAdminView ? 'Admin' : isPanelView ? 'Daily panel' : undefined);
  }, [settings.cafeName, isAdminView, isPanelView]);

  useEffect(() => { applyFavicon(settings.logoUrl); }, [settings.logoUrl]);

  /* ------------------------------------------------------------ Workspace */
  if (isWorkspace) {
    if (!isAdminAuthed) {
      return (
        <div className="ws ws-auth">
          <form className="ws-auth-card" aria-busy={authLoading} onSubmit={handleAdminLogin}>
            <div>
              <span className="ws-brand-mark" style={{ width: 48, height: 48, marginBottom: 20 }}><Lock width={22} height={22} /></span>
              <h1>{settings.cafeName} {isPanelView ? 'daily panel' : 'admin'}</h1>
              <p>{isPanelView ? 'Sign in to take orders, run the checklist, and clock the team in.' : 'Sign in to manage finances, menu, stock, staff, and settings.'}</p>
            </div>
            {authError && <Notice tone="danger">{authError}</Notice>}
            <Field label={isPanelView ? 'Panel password' : 'Admin password'}>{id => (
              <Input id={id} type="password" autoComplete="current-password" autoFocus required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
            )}</Field>
            <Button type="submit" variant="primary" size="lg" block loading={authLoading}>{authLoading ? 'Checking…' : 'Sign in'}</Button>
            <Button variant="ghost" size="sm" onClick={toggleTheme} icon={theme === 'dark' ? <Sun /> : <Moon />}>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</Button>
          </form>
        </div>
      );
    }

    const shellProps = {
      cafeName: settings.cafeName,
      logoUrl: settings.logoUrl,
      theme,
      onToggleTheme: toggleTheme,
      onSignOut: handleAdminLogout,
      pendingSaves: store.pendingSaves,
      saveError: store.saveError,
      onDismissError: () => store.dismissSaveError()
    };

    if (isPanelView) {
      const liveOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length;
      const openTasks = tasksList.filter(t => t.status !== 'completed').length;
      const panelNav: NavItem<PanelSection>[] = [
        { id: 'orders', label: 'Orders', icon: ShoppingBag, badge: liveOrders },
        { id: 'pos', label: 'New order', short: 'New', icon: Plus },
        { id: 'tasks', label: 'Checklist', icon: CheckSquare, badge: openTasks },
        { id: 'shifts', label: 'Clock in / out', short: 'Clock', icon: Clock }
      ];
      return (
        <WorkspaceShell kind="Panel" nav={panelNav} active={panelSection} onNavigate={setPanelSection} {...shellProps}>
          <PanelManager
            section={panelSection}
            onNavigate={setPanelSection}
            settings={settings}
            orders={orders}
            orderItems={orderItems}
            tasks={tasksList}
            staffList={staffList}
            shifts={shifts}
            menuItems={menuItems}
            categories={categories}
            menuVariants={menuVariants}
            onStateChange={refresh}
          />
        </WorkspaceShell>
      );
    }

    const lowStock = stockItems.filter(i => i.quantity <= i.minThreshold).length;
    const adminNav: NavItem<AdminTab>[] = [
      { id: 'financials', label: 'Finances', icon: TrendingUp, group: 'Business' },
      { id: 'menu_admin', label: 'Menu', icon: UtensilsCrossed, group: 'Catalogue' },
      { id: 'stock', label: 'Stock', icon: Boxes, group: 'Catalogue', badge: lowStock },
      { id: 'staff', label: 'Staff & shifts', short: 'Staff', icon: Users, group: 'Team' },
      { id: 'tasks', label: 'Checklist', short: 'Tasks', icon: CheckSquare, group: 'Team' },
      { id: 'settings', label: 'Settings', icon: Settings, group: 'Café', tab: false }
    ];
    return (
      <WorkspaceShell
        kind="Admin"
        nav={adminNav}
        active={adminTab}
        onNavigate={setAdminTab}
        mobileActions={<IconButton label="Settings" variant={adminTab === 'settings' ? 'tonal' : 'ghost'} onClick={() => setAdminTab('settings')}><Settings /></IconButton>}
        {...shellProps}
      >
        {adminTab === 'financials' && <FinancialTracker settings={settings} orders={orders} expenses={expenses} menuItems={menuItems} onFinancialsUpdated={refresh} />}
        {adminTab === 'tasks' && <TaskManager tasks={tasksList} staffList={staffList} onTasksUpdated={refresh} />}
        {adminTab === 'menu_admin' && <MenuAdmin settings={settings} categories={categories} menuItems={menuItems} menuVariants={menuVariants} onMenuUpdated={refresh} />}
        {adminTab === 'stock' && <StockManagement settings={settings} stockItems={stockItems} onStockUpdated={refresh} />}
        {adminTab === 'staff' && <TimeTracker settings={settings} staffList={staffList} shifts={shifts} onShiftUpdated={refresh} />}
        {adminTab === 'settings' && <SettingsPanel settings={settings} onSettingsUpdated={refresh} />}
      </WorkspaceShell>
    );
  }

  /* ---------------------------------------------------------- Public menu */
  return (
    <div className="app-shell app-menu min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-zinc-950 font-sans antialiased">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-2xl border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {settings.logoUrl && failedLogoUrl !== settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.cafeName}
                onError={() => setFailedLogoUrl(settings.logoUrl)}
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-amber-500/30 shadow-md"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold shadow-lg brand-bg">
                <Coffee className="w-5 h-5 text-zinc-950" />
              </div>
            )}
            <div>
              <span className="font-black text-sm sm:text-base text-zinc-100 block leading-tight tracking-tight">{settings.cafeName}</span>
              <span className="text-[10px] text-zinc-400 font-medium block">A little pause.</span>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border border-zinc-800 transition cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full">
        {store.pendingSaves > 0 && <p role="status" className="mb-4 rounded-xl border border-amber-500/30 p-3 text-amber-400">Saving {store.pendingSaves} change(s)…</p>}
        {store.saveError && <div role="alert" className="mb-4 rounded-xl border border-rose-500/40 p-4 text-rose-300">{store.saveError}<button type="button" onClick={() => store.dismissSaveError()} className="ml-4 underline">Dismiss</button></div>}
        <PublicMenu settings={settings} categories={categories} menuItems={menuItems} menuVariants={menuVariants} onOrderCreated={refresh} />
      </main>

      <footer className="bg-zinc-950 border-t border-zinc-900 py-5 text-center text-xs text-zinc-500 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {settings.cafeName}. All rights reserved.</p>
          <span className="cafe-footer-note">See you at the café.</span>
        </div>
      </footer>
    </div>
  );
};
