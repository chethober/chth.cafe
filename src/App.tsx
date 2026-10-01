import React, { useState, useEffect } from 'react';
import {
  Coffee,
  Settings,
  Clock,
  TrendingUp,
  UtensilsCrossed,
  LogOut,
  Lock,
  AlertCircle,
  CheckSquare,
  Sparkles,
  ShieldCheck,
  LayoutDashboard,
  Sun,
  Moon,
  Boxes
} from 'lucide-react';
import { store } from './db/store';
import { PublicMenu } from './components/PublicMenu';
import { SettingsPanel } from './components/SettingsPanel';
import { TimeTracker } from './components/TimeTracker';
import { FinancialTracker } from './components/FinancialTracker';
import { MenuAdmin } from './components/MenuAdmin';
import { TaskManager } from './components/TaskManager';
import { PanelManager } from './components/PanelManager';
import { StockManagement } from './components/StockManagement';

type AdminTab = 'financials' | 'tasks' | 'menu_admin' | 'stock' | 'staff' | 'settings';

export const App: React.FC = () => {
  // Client-side routing state
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  // Hostname subdomain detection (chth.cafe & subdomains)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isDomainAdmin = hostname === 'admin.chth.cafe' || hostname.startsWith('admin.');
  const isDomainPanel = hostname === 'panel.chth.cafe' || hostname.startsWith('panel.');

  const [adminTab, setAdminTab] = useState<AdminTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chth_admin_last_tab');
      if (saved && ['financials', 'tasks', 'menu_admin', 'staff', 'settings'].includes(saved)) {
        return saved as AdminTab;
      }
    }
    return 'financials';
  });

  // Save last opened admin tab to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chth_admin_last_tab', adminTab);
    }
  }, [adminTab]);

  // Theme (Light/Dark mode) state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chth_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  // Sync theme class on <html> element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
      }
      localStorage.setItem('chth_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [, setStateVersion] = useState(0);

  // Admin authentication state
  const [isAdminAuthed, setIsAdminAuthed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('chth_admin_authed') === 'true';
    }
    return false;
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync state mutations from store
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setStateVersion((v) => v + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Listen to browser forward/back navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string, tab?: AdminTab) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      if (tab) {
        setAdminTab(tab);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const expectedPass = import.meta.env.VITE_ADMIN_PASSWORD || 'chth2026';
    const input = passwordInput.trim();
    if (input === expectedPass) {
      sessionStorage.setItem('chth_admin_authed', 'true');
      setIsAdminAuthed(true);
      setAuthError(null);
      setPasswordInput('');
    } else {
      setAuthError('Incorrect Admin Password. Access Denied.');
    }
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('chth_admin_authed');
    setIsAdminAuthed(false);
    navigateTo('/');
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
    if (settings.brandPrimary) {
      document.documentElement.style.setProperty('--brand-primary', settings.brandPrimary);
    }
    if (settings.brandSecondary) {
      document.documentElement.style.setProperty('--brand-secondary', settings.brandSecondary);
    }
  }, [settings.brandPrimary, settings.brandSecondary]);

  // Determine active view context:
  // 1) panel.chth.cafe OR /panel => Daily Manager Panel View (CHTH Management)
  // 2) admin.chth.cafe OR /admin => Admin Workspace View (CHTH Admin)
  // 3) chth.cafe / default => Public Customer View (CHTH Cafe)
  const isPanelView = isDomainPanel || currentPath === '/panel' || currentPath.startsWith('/panel');
  const isAdminView = !isPanelView && (isDomainAdmin || currentPath === '/admin' || currentPath.startsWith('/admin'));

  // Update Website Document Titles dynamically
  useEffect(() => {
    if (isAdminView) {
      document.title = 'CHTH Admin';
    } else if (isPanelView) {
      document.title = 'CHTH Management';
    } else {
      document.title = 'CHTH Cafe';
    }
  }, [isAdminView, isPanelView]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-zinc-950 font-sans antialiased">
      {/* Header Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-2xl border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand Title */}
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.cafeName}
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-amber-500/30 shadow-md"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold shadow-lg brand-bg"
              >
                <Coffee className="w-5 h-5 text-zinc-950" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base text-zinc-100 block leading-tight tracking-tight">
                  {settings.cafeName}
                </span>
                {isDomainAdmin && (
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                    Admin
                  </span>
                )}
                {isDomainPanel && (
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                    Panel
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 font-medium block">
                {isAdminView
                  ? 'Executive Portal'
                  : isPanelView
                  ? 'Daily Operations Command'
                  : 'Artisan Tea & Specialty Store'}
              </span>
            </div>
          </div>

          {/* Header Action Controls & Theme Toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Navigation Actions for Admin View */}
            {isAdminView && isAdminAuthed && (
              <>
                <div className="hidden md:flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => setAdminTab('financials')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      adminTab === 'financials'
                        ? 'btn-brand text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Financials
                  </button>

                  <button
                    onClick={() => setAdminTab('tasks')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      adminTab === 'tasks'
                        ? 'btn-brand text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Tasks
                  </button>

                  <button
                    onClick={() => setAdminTab('menu_admin')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      adminTab === 'menu_admin'
                        ? 'btn-brand text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    Menu Editor
                  </button>

                  <button
                    onClick={() => setAdminTab('stock')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      adminTab === 'stock'
                        ? 'btn-brand text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    Stock Inventory
                  </button>

                  <button
                    onClick={() => setAdminTab('staff')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      adminTab === 'staff'
                        ? 'btn-brand text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Staff Shifting
                  </button>

                  <button
                    onClick={() => setAdminTab('settings')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      adminTab === 'settings'
                        ? 'btn-brand text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                </div>

                {/* Mobile Top Header Settings Button */}
                <button
                  onClick={() => setAdminTab('settings')}
                  className={`md:hidden px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                    adminTab === 'settings'
                      ? 'btn-brand text-zinc-950 shadow-md border-amber-500'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Settings</span>
                </button>

                <button
                  onClick={handleAdminLogout}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs flex items-center gap-1 border border-rose-800/40 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Exit
                </button>
              </>
            )}

            {/* Public Customer View Header Notification & Bag Trigger */}
            {!isAdminView && !isPanelView && (
              <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
                {orders.length} Active Orders
              </span>
            )}

            {/* Universal Light/Dark Mode Toggle for All 3 Websites */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border border-zinc-800 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-bold text-zinc-300 hidden md:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-[11px] font-bold text-zinc-300 hidden md:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full">
        {isPanelView ? (
          /* Daily Manager Operational Panel (panel.chth.cafe or /panel) */
          <PanelManager
            settings={settings}
            orders={orders}
            orderItems={orderItems}
            tasks={tasksList}
            staffList={staffList}
            shifts={shifts}
            menuItems={menuItems}
            categories={categories}
            menuVariants={menuVariants}
            onStateChange={() => setStateVersion((v) => v + 1)}
          />
        ) : !isAdminView ? (
          /* Public Customer Page (chth.cafe) - Menu & Ordering */
          <PublicMenu
            settings={settings}
            categories={categories}
            menuItems={menuItems}
            menuVariants={menuVariants}
            onOrderCreated={() => setStateVersion((v) => v + 1)}
          />
        ) : !isAdminAuthed ? (
          /* Admin Password Authentication Gate */
          <div className="max-w-md mx-auto py-16 animate-scale-up">
            <div className="glass-panel-classy p-8 rounded-3xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto mb-3 shadow-lg brand-glow">
                  <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-black text-zinc-100">{settings.cafeName} Portal</h2>
                <p className="text-zinc-400 text-xs max-w-xs mx-auto">
                  Protected executive management space. Enter your administrator key to continue.
                </p>
              </div>

              {authError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Admin Security Key
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-amber-500 transition-all"
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl btn-brand font-extrabold text-zinc-950 text-xs uppercase tracking-wider shadow-xl cursor-pointer"
                >
                  Unlock Workspace
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Admin Dashboard Workspace Views (Authenticated) */
          <div className="pb-20 md:pb-0">
            {/* Fixed Mobile Admin Navigation Bar (Bottom Docked) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 p-1.5 shadow-2xl grid grid-cols-5 gap-1">
              <button
                onClick={() => setAdminTab('financials')}
                className={`py-2 px-1 rounded-xl font-bold text-[10px] text-center flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  adminTab === 'financials' ? 'btn-brand text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Finances
              </button>
              <button
                onClick={() => setAdminTab('tasks')}
                className={`py-2 px-1 rounded-xl font-bold text-[10px] text-center flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  adminTab === 'tasks' ? 'btn-brand text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                Tasks
              </button>
              <button
                onClick={() => setAdminTab('menu_admin')}
                className={`py-2 px-1 rounded-xl font-bold text-[10px] text-center flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  adminTab === 'menu_admin' ? 'btn-brand text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                Menu
              </button>
              <button
                onClick={() => setAdminTab('stock')}
                className={`py-2 px-1 rounded-xl font-bold text-[10px] text-center flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  adminTab === 'stock' ? 'btn-brand text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Boxes className="w-4 h-4" />
                Stock
              </button>
              <button
                onClick={() => setAdminTab('staff')}
                className={`py-2 px-1 rounded-xl font-bold text-[10px] text-center flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
                  adminTab === 'staff' ? 'btn-brand text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                Staff
              </button>
            </div>

            {adminTab === 'financials' && (
              <FinancialTracker
                settings={settings}
                orders={orders}
                expenses={expenses}
                menuItems={menuItems}
                onFinancialsUpdated={() => setStateVersion((v) => v + 1)}
              />
            )}

            {adminTab === 'tasks' && (
              <TaskManager
                tasks={tasksList}
                staffList={staffList}
                onTasksUpdated={() => setStateVersion((v) => v + 1)}
              />
            )}

            {adminTab === 'menu_admin' && (
              <MenuAdmin
                settings={settings}
                categories={categories}
                menuItems={menuItems}
                menuVariants={menuVariants}
                onMenuUpdated={() => setStateVersion((v) => v + 1)}
              />
            )}

            {adminTab === 'stock' && (
              <StockManagement
                settings={settings}
                stockItems={stockItems}
                onStockUpdated={() => setStateVersion((v) => v + 1)}
              />
            )}

            {adminTab === 'staff' && (
              <TimeTracker
                settings={settings}
                staffList={staffList}
                shifts={shifts}
                onShiftUpdated={() => setStateVersion((v) => v + 1)}
              />
            )}

            {adminTab === 'settings' && (
              <SettingsPanel
                settings={settings}
                onSettingsUpdated={() => setStateVersion((v) => v + 1)}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-5 text-center text-xs text-zinc-500 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {settings.cafeName}. All rights reserved.</p>
          <div className="flex items-center gap-4 text-zinc-500 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live System Active
            </span>
            <span>Cloudflare Workers & D1</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
