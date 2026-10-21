import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Coffee, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, Sun, X } from 'lucide-react';
import { IconButton, Notice, Button, PageContext } from './primitives';

export interface NavSection {
  /** Element id on the page to scroll to. */
  anchor: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
  badge?: number;
  /** Parts of the page, listed under the item while it is open; each jumps to its anchor. */
  sections?: NavSection[];
}

interface WorkspaceShellProps<T extends string> {
  kind: 'Admin' | 'Panel';
  cafeName: string;
  logoUrl?: string | null;
  nav: NavItem<T>[];
  active: T;
  onNavigate: (id: T) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSignOut: () => void;
  pendingSaves: number;
  saveError: string;
  onDismissError: () => void;
  children: React.ReactNode;
}

function Brand({ cafeName, logoUrl, kind }: { cafeName: string; logoUrl?: string | null; kind: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="ws-brand">
      <span className="ws-brand-mark">
        {logoUrl && failed !== logoUrl ? <img src={logoUrl} alt="" onError={() => setFailed(logoUrl)} /> : <Coffee width={18} height={18} />}
      </span>
      <span className="ws-brand-text"><strong>{cafeName}</strong><span>{kind}</span></span>
    </div>
  );
}

function SyncStatus({ pendingSaves, saveError }: { pendingSaves: number; saveError: string }) {
  if (saveError) return <span className="ws-sync" data-state="error"><AlertCircle width={14} height={14} />Not saved</span>;
  if (pendingSaves > 0) return <span className="ws-sync" data-state="saving" role="status"><RefreshCw width={14} height={14} className="ws-spin" />Saving {pendingSaves}…</span>;
  return <span className="ws-sync" role="status"><CheckCircle2 width={14} height={14} />Saved</span>;
}

const MOBILE = '(max-width: 1023px)';

/**
 * The frame both dashboards share: a sidebar (docked on desktop, a slide-in drawer on
 * phones) holding every page and control, and a sticky top bar that always says where
 * you are and whether work is saved.
 */
export function WorkspaceShell<T extends string>(props: WorkspaceShellProps<T>) {
  const { kind, cafeName, logoUrl, nav, active, onNavigate, theme, onToggleTheme, onSignOut, pendingSaves, saveError, onDismissError, children } = props;
  const current = nav.find(item => item.id === active);
  const groups = nav.reduce<Record<string, NavItem<T>[]>>((acc, item) => {
    const key = item.group || '';
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
  const navBadge = nav.reduce((sum, item) => sum + (item.badge || 0), 0);
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const storageKey = `chth_sidebar_collapsed_${kind.toLowerCase()}`;
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem(storageKey, collapsed ? '1' : '0'); } catch { /* storage unavailable */ } }, [collapsed, storageKey]);
  // ⌘B / Ctrl+B toggles the sidebar, as in most desktop editors.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); setCollapsed(c => !c); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const SidebarIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  // Phones: the sidebar is a drawer. Escape closes it and focus returns to the menu button.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(open => {
      if (open) requestAnimationFrame(() => menuButton.current?.focus());
      return false;
    });
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    sidebar.current?.querySelector<HTMLElement>('[aria-current="page"], .ws-nav-item')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    const media = window.matchMedia(MOBILE);
    const onResize = () => { if (!media.matches) setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    media.addEventListener('change', onResize);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      media.removeEventListener('change', onResize);
      document.documentElement.style.overflow = '';
    };
  }, [drawerOpen, closeDrawer]);

  const go = (id: T, anchor?: string) => {
    onNavigate(id);
    closeDrawer();
    if (anchor) {
      // Wait for the page to render before jumping to its section.
      setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else if (id !== active) {
      window.scrollTo({ top: 0 });
    }
  };
  // Admin pages are labelled by their nav group; the daily panel by the day it is running.
  const page = current && {
    icon: current.icon,
    eyebrow: current.group || new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  };

  return (
    <div className="ws ws-shell" data-kind={kind.toLowerCase()} data-collapsed={collapsed || undefined} data-drawer={drawerOpen || undefined}>
      <div className="ws-scrim" aria-hidden="true" onClick={closeDrawer} />
      <aside id="ws-sidebar" ref={sidebar} className="ws-sidebar" aria-label={`${kind} navigation`}>
        <div className="ws-sidebar-brand">
          <Brand cafeName={cafeName} logoUrl={logoUrl} kind={kind} />
          <span className="ws-hide-desktop"><IconButton label="Close menu" onClick={closeDrawer}><X /></IconButton></span>
        </div>
        <nav>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group || 'main'} className="ws-nav-group">
              {group && <div className="ws-nav-label">{group}</div>}
              {items.map(({ id, label, icon: Icon, badge, sections }) => (
                <React.Fragment key={id}>
                  <button type="button" className="ws-nav-item" aria-current={active === id ? 'page' : undefined} onClick={() => go(id)} title={collapsed ? label : undefined} aria-label={collapsed ? `${label}${badge ? `, ${badge}` : ''}` : undefined}>
                    <Icon />
                    <span className="ws-nav-text">{label}</span>
                    {!!badge && <span className="ws-nav-count">{badge}</span>}
                  </button>
                  {active === id && sections && sections.length > 0 && (
                    <div className="ws-nav-sub" role="group" aria-label={`${label} sections`}>
                      {sections.map(({ anchor, label: sectionLabel, icon: SectionIcon }) => (
                        <button key={anchor} type="button" className="ws-nav-subitem" onClick={() => go(id, anchor)}>
                          <SectionIcon />
                          <span>{sectionLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          ))}
        </nav>
        <div className="ws-sidebar-footer">
          <span className="ws-live" title="Live · syncs every 15s"><span className="ws-live-dot" aria-hidden="true" /><span className="ws-nav-text">Live · syncs every 15s</span></span>
          <button type="button" className="ws-nav-item" onClick={onToggleTheme} title={collapsed ? (theme === 'dark' ? 'Light appearance' : 'Dark appearance') : undefined}><ThemeIcon /><span className="ws-nav-text">{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span></button>
          <button type="button" className="ws-nav-item" onClick={onSignOut} title={collapsed ? 'Sign out' : undefined}><LogOut /><span className="ws-nav-text">Sign out</span></button>
        </div>
      </aside>

      <div className="ws-main">
        <header className="ws-topbar">
          <span className="ws-hide-desktop">
            <IconButton ref={menuButton} label="Menu" aria-expanded={drawerOpen} aria-controls="ws-sidebar" onClick={() => setDrawerOpen(true)}>
              <Menu />
              {navBadge > 0 && <span className="ws-menu-dot" aria-hidden="true" />}
            </IconButton>
          </span>
          <span className="ws-hide-mobile">
            <IconButton label={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'} aria-expanded={!collapsed} aria-controls="ws-sidebar" onClick={() => setCollapsed(c => !c)}><SidebarIcon /></IconButton>
          </span>
          <div className="ws-topbar-title">
            <strong>{current?.label}</strong>
            <span>{cafeName} · {kind}</span>
          </div>
          <div className="ws-topbar-actions">
            <SyncStatus pendingSaves={pendingSaves} saveError={saveError} />
          </div>
        </header>

        <main id="workspace-main" className="ws-content">
          {saveError && (
            <div style={{ marginBottom: 20 }}>
              <Notice tone="danger" action={<Button size="sm" variant="ghost" onClick={onDismissError}>Dismiss</Button>}>{saveError}</Notice>
            </div>
          )}
          <PageContext.Provider value={page || null}>{children}</PageContext.Provider>
        </main>
      </div>

    </div>
  );
}
