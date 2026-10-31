import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
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
  Users,
  Contact,
  CalendarDays
} from 'lucide-react';
import { store } from './db/store';
import { api } from './services/api';
import { applyAppearance } from './utils/appearance';
import { applyFavicon, brandTitle } from './utils/branding';
import { PublicMenu } from './components/PublicMenu';
import { SETTINGS_SECTIONS, SettingsPanel } from './components/SettingsPanel';
import { TimeTracker } from './components/TimeTracker';
import { FinancialTracker } from './components/FinancialTracker';
import { MenuAdmin } from './components/MenuAdmin';
import { TaskManager } from './components/TaskManager';
import { PanelManager, PanelSection } from './components/PanelManager';
import { StockManagement } from './components/StockManagement';
import { CustomerClub } from './components/CustomerClub';
import { EventManager } from './components/EventManager';
import { Button, Field, Input, Notice, NavItem, WorkspaceShell } from './ui';
import { currentWorkspace, workspaceHome } from './utils/workspace';
import { useT } from './i18n';

/** The page footer's text, in the menu's language. */
function CafeFooterText({ cafeName }: { cafeName: string }) {
  const t = useT();
  return <>
    <p>© {new Date().getFullYear()} {cafeName}. {t('All rights reserved.')}</p>
    <span className="cafe-footer-note">{t('See you at the café.')}</span>
  </>;
}

type AdminTab = 'financials' | 'customers' | 'events' | 'tasks' | 'menu_admin' | 'stock' | 'staff' | 'settings';
const ADMIN_TABS: AdminTab[] = ['financials', 'customers', 'events', 'tasks', 'menu_admin', 'stock', 'staff', 'settings'];
const PANEL_SECTIONS: PanelSection[] = ['orders', 'pos', 'customers', 'events', 'tasks', 'shifts'];

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

// Remembers that this device was signed in, so the workspace still opens without a connection.
// The server checks the session on every request; this only decides which screen to show offline.
const SIGNED_IN_KEY = 'chth_workspace_signed_in';
function rememberSignIn(signedIn: boolean) {
  try { if (signedIn) localStorage.setItem(SIGNED_IN_KEY, '1'); else localStorage.removeItem(SIGNED_IN_KEY); } catch { /* storage unavailable */ }
}
function wasSignedIn() {
  try { return localStorage.getItem(SIGNED_IN_KEY) === '1'; } catch { return false; }
}

export const App: React.FC = () => {
  // Each SPA is selected by its subdomain, or by its path on hosts with CAFE_WORKSPACE_PATHS.
  const workspace = currentWorkspace();
  const isAdminView = workspace === 'admin';
  const isPanelView = workspace === 'panel';
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

  // The new theme spreads out from the button in a circle. Without View Transitions,
  // or with reduced motion, it switches at once.
  const toggleTheme = (button: HTMLElement) => {
    const next = theme === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTheme(next); return; }
    const { left, top, width, height } = button.getBoundingClientRect();
    const x = left + width / 2, y = top + height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next));
      document.documentElement.classList.toggle('light', next === 'light');
      document.documentElement.classList.toggle('dark', next === 'dark');
    });
    void transition.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 400, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::view-transition-new(root)' }
    )).catch(() => {});
  };

  const [, setStateVersion] = useState(0);
  const refresh = () => setStateVersion((v) => v + 1);

  // Admin authentication state
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  // A fresh deployment has no passwords yet; the owner chooses them with the setup code it was deployed with.
  const [setupRequired, setSetupRequired] = useState(false);
  useEffect(() => {
    const checkSession = () => fetch('/api/auth/session').then(
      res => res.json().then(data => {
        const session = data as { authenticated?: boolean; setupRequired?: boolean };
        const signedIn = session.authenticated === true;
        setIsAdminAuthed(signedIn); rememberSignIn(signedIn); setSetupRequired(session.setupRequired === true);
      }).catch(() => {}),
      () => { if (wasSignedIn()) setIsAdminAuthed(true); }
    );
    void checkSession().finally(() => setAuthLoading(false));
    // Hidden tabs stop polling and catch up as soon as they are shown again.
    const poll = () => { if (document.visibilityState === 'visible') { void store.syncFromAPI(); void checkSession(); } };
    const timer = window.setInterval(poll, 15000);
    document.addEventListener('visibilitychange', poll);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, []);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  // The deploy link carries the setup code in the fragment, which never reaches the server or its logs.
  const [setupForm, setSetupForm] = useState(() => {
    const token = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.slice(1)).get('setup') || '' : '';
    if (token) window.history.replaceState({}, '', window.location.pathname + window.location.search);
    return { token, cafeName: '', adminPassword: '', panelPassword: '' };
  });

  useEffect(() => {
    const unsubscribe = store.subscribe(refresh);
    return () => { unsubscribe(); };
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError(null);
    try {
      const result = await api<{ success?: boolean }>('/api/auth/login', { password: passwordInput });
      if (result.success !== true) throw new Error('The sign-in response was invalid. Check the café API.');
      setIsAdminAuthed(true); rememberSignIn(true); setPasswordInput(''); await store.syncFromAPI();
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Sign-in failed.'); }
    finally { setAuthLoading(false); }
  };
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError(null);
    try {
      const result = await api<{ success?: boolean }>('/api/auth/setup', setupForm);
      if (result.success !== true) throw new Error('The setup response was invalid. Check the café API.');
      setSetupRequired(false); setIsAdminAuthed(true); rememberSignIn(true);
      setSetupForm({ token: '', cafeName: '', adminPassword: '', panelPassword: '' });
      await store.syncFromAPI();
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Setup failed.'); }
    finally { setAuthLoading(false); }
  };
  const handleAdminLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign-out failed. Please try again.');
      setIsAdminAuthed(false); rememberSignIn(false); store.clearPrivateData(); window.history.replaceState({}, '', workspaceHome());
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
  const customers = store.getCustomers();

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
    if (!isAdminAuthed && setupRequired && isAdminView) {
      const updateSetup = (field: keyof typeof setupForm) => (e: React.ChangeEvent<HTMLInputElement>) => setSetupForm(form => ({ ...form, [field]: e.target.value }));
      return (
        <div className="ws ws-auth">
          <form className="ws-auth-card" aria-busy={authLoading} onSubmit={handleSetup}>
            <div>
              <span className="ws-brand-mark" style={{ width: 48, height: 48, marginBottom: 20 }}><Lock width={22} height={22} /></span>
              <h1>Set up your café</h1>
              <p>Choose the passwords for the admin and the daily panel. Staff use the panel password on the café's devices.</p>
            </div>
            {authError && <Notice tone="danger">{authError}</Notice>}
            <Field label="Setup code" hint="From your deploy link, or the SETUP_TOKEN secret you set on the Worker.">{(id, hint) => (
              <Input id={id} aria-describedby={hint} autoComplete="off" required value={setupForm.token} onChange={updateSetup('token')} />
            )}</Field>
            <Field label="Café name" optional>{id => (
              <Input id={id} autoComplete="organization" maxLength={100} value={setupForm.cafeName} onChange={updateSetup('cafeName')} />
            )}</Field>
            <Field label="Admin password" hint="At least 10 characters.">{(id, hint) => (
              <Input id={id} aria-describedby={hint} type="password" autoComplete="new-password" required minLength={10} value={setupForm.adminPassword} onChange={updateSetup('adminPassword')} />
            )}</Field>
            <Field label="Panel password" hint="At least 10 characters, different from the admin password.">{(id, hint) => (
              <Input id={id} aria-describedby={hint} type="password" autoComplete="new-password" required minLength={10} value={setupForm.panelPassword} onChange={updateSetup('panelPassword')} />
            )}</Field>
            <Button type="submit" variant="primary" size="lg" block loading={authLoading}>{authLoading ? 'Setting up…' : 'Finish setup'}</Button>
          </form>
        </div>
      );
    }
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
            {setupRequired && isPanelView && <Notice tone="info">This café is not set up yet. Open the admin to choose the passwords first.</Notice>}
            <Field label={isPanelView ? 'Panel password' : 'Admin password'}>{id => (
              <Input id={id} type="password" autoComplete="current-password" autoFocus required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
            )}</Field>
            <Button type="submit" variant="primary" size="lg" block loading={authLoading}>{authLoading ? 'Checking…' : 'Sign in'}</Button>
            <Button variant="ghost" size="sm" onClick={e => toggleTheme(e.currentTarget)} icon={theme === 'dark' ? <Sun /> : <Moon />}>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</Button>
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
      onDismissError: () => store.dismissSaveError(),
      offline: store.offline,
      queuedChanges: store.queuedCount,
      rejectedChanges: store.getRejectedChanges(),
      onDismissRejected: () => { void store.dismissRejectedChanges(); }
    };

    if (isPanelView) {
      const liveOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length;
      const openTasks = tasksList.filter(t => t.status !== 'completed').length;
      const panelNav: NavItem<PanelSection>[] = [
        { id: 'orders', label: 'Orders', icon: ShoppingBag, badge: liveOrders },
        { id: 'pos', label: 'New order', icon: Plus },
        { id: 'customers', label: 'Customer club', icon: Contact },
        { id: 'events', label: 'Events', icon: CalendarDays },
        { id: 'tasks', label: 'Checklist', icon: CheckSquare, badge: openTasks },
        { id: 'shifts', label: 'Clock in / out', icon: Clock }
      ];
      return (
        <WorkspaceShell kind="Panel" nav={panelNav} active={panelSection} onNavigate={setPanelSection} {...shellProps}>
          {panelSection === 'events' ? <EventManager settings={settings} mode="panel" /> : <PanelManager
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
            customers={customers}
            onStateChange={refresh}
          />}
        </WorkspaceShell>
      );
    }

    const lowStock = stockItems.filter(i => i.quantity <= i.minThreshold).length;
    const adminNav: NavItem<AdminTab>[] = [
      { id: 'financials', label: 'Finances', icon: TrendingUp, group: 'Business' },
      { id: 'customers', label: 'Customer club', icon: Contact, group: 'Business' },
      { id: 'events', label: 'Events', icon: CalendarDays, group: 'Business' },
      { id: 'menu_admin', label: 'Menu', icon: UtensilsCrossed, group: 'Catalogue' },
      { id: 'stock', label: 'Stock', icon: Boxes, group: 'Catalogue', badge: lowStock },
      { id: 'staff', label: 'Staff & shifts', icon: Users, group: 'Team' },
      { id: 'tasks', label: 'Checklist', icon: CheckSquare, group: 'Team' },
      { id: 'settings', label: 'Settings', icon: Settings, group: 'Café', sections: SETTINGS_SECTIONS.map(({ id, label, icon }) => ({ anchor: `settings-${id}`, label, icon })) }
    ];
    return (
      <WorkspaceShell
        kind="Admin"
        nav={adminNav}
        active={adminTab}
        onNavigate={setAdminTab}
        {...shellProps}
      >
        {adminTab === 'financials' && <FinancialTracker settings={settings} orders={orders} expenses={expenses} categories={categories} menuItems={menuItems} onFinancialsUpdated={refresh} />}
        {adminTab === 'customers' && <CustomerClub settings={settings} customers={customers} orders={orders} orderItems={orderItems} canDelete onChanged={refresh} />}
        {adminTab === 'events' && <EventManager settings={settings} mode="admin" />}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full">
        {store.pendingSaves > 0 && <p role="status" className="mb-4 rounded-xl border border-amber-500/30 p-3 text-amber-400">Saving {store.pendingSaves} change(s)…</p>}
        {store.saveError && <div role="alert" className="mb-4 rounded-xl border border-rose-500/40 p-4 text-rose-300">{store.saveError}<button type="button" onClick={() => store.dismissSaveError()} className="ml-4 underline">Dismiss</button></div>}
        <PublicMenu settings={settings} categories={categories} menuItems={menuItems} menuVariants={menuVariants} onOrderCreated={refresh} theme={theme} onToggleTheme={toggleTheme} />
      </main>

      <footer className="bg-zinc-950 border-t border-zinc-900 py-5 text-center text-xs text-zinc-500 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <CafeFooterText cafeName={settings.cafeName} />
        </div>
      </footer>
    </div>
  );
};
