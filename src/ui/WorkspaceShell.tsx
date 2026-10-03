import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Coffee, LogOut, Moon, RefreshCw, Sun } from 'lucide-react';
import { IconButton, Notice, Button } from './primitives';

export interface NavItem<T extends string> {
  id: T;
  label: string;
  short?: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
  badge?: number;
  /** Shown in the mobile tab bar (others are reachable from the top bar). */
  tab?: boolean;
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
  /** Mobile-only extra top bar actions (e.g. a Settings shortcut). */
  mobileActions?: React.ReactNode;
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

/**
 * The frame both dashboards share: a sidebar on desktop, a translucent tab bar on
 * phones, and a sticky top bar that always says where you are and whether work is saved.
 */
export function WorkspaceShell<T extends string>(props: WorkspaceShellProps<T>) {
  const { kind, cafeName, logoUrl, nav, active, onNavigate, theme, onToggleTheme, onSignOut, pendingSaves, saveError, onDismissError, mobileActions, children } = props;
  const current = nav.find(item => item.id === active);
  const groups = nav.reduce<Record<string, NavItem<T>[]>>((acc, item) => {
    const key = item.group || '';
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
  const tabs = nav.filter(item => item.tab !== false);
  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  return (
    <div className="ws ws-shell" data-kind={kind.toLowerCase()}>
      <aside className="ws-sidebar" aria-label={`${kind} navigation`}>
        <div className="ws-sidebar-brand"><Brand cafeName={cafeName} logoUrl={logoUrl} kind={kind} /></div>
        <nav>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group || 'main'} className="ws-nav-group">
              {group && <div className="ws-nav-label">{group}</div>}
              {items.map(({ id, label, icon: Icon, badge }) => (
                <button key={id} type="button" className="ws-nav-item" aria-current={active === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
                  <Icon />
                  <span>{label}</span>
                  {!!badge && <span className="ws-nav-count">{badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="ws-sidebar-footer">
          <span className="ws-live"><span className="ws-live-dot" aria-hidden="true" />Live · syncs every 15s</span>
          <button type="button" className="ws-nav-item" onClick={onToggleTheme}><ThemeIcon /><span>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span></button>
          <button type="button" className="ws-nav-item" onClick={onSignOut}><LogOut /><span>Sign out</span></button>
        </div>
      </aside>

      <div className="ws-main">
        <header className="ws-topbar">
          <span className="ws-hide-desktop"><Brand cafeName={cafeName} logoUrl={logoUrl} kind={kind} /></span>
          <div className="ws-topbar-title ws-hide-mobile">
            <strong>{current?.label}</strong>
            <span>{cafeName} · {kind}</span>
          </div>
          <span className="ws-hide-desktop" style={{ flex: 1 }} />
          <div className="ws-topbar-actions">
            <SyncStatus pendingSaves={pendingSaves} saveError={saveError} />
            {mobileActions && <span className="ws-hide-desktop" style={{ display: 'contents' }}>{mobileActions}</span>}
            <span className="ws-hide-desktop" style={{ display: 'contents' }}>
              <IconButton label={theme === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'} onClick={onToggleTheme}><ThemeIcon /></IconButton>
              <IconButton label="Sign out" onClick={onSignOut}><LogOut /></IconButton>
            </span>
          </div>
        </header>

        <main id="workspace-main" className="ws-content">
          {saveError && (
            <div style={{ marginBottom: 20 }}>
              <Notice tone="danger" action={<Button size="sm" variant="ghost" onClick={onDismissError}>Dismiss</Button>}>{saveError}</Notice>
            </div>
          )}
          {children}
        </main>
      </div>

      <nav className="ws-tabbar" aria-label={`${kind} sections`}>
        {tabs.map(({ id, label, short, icon: Icon, badge }) => (
          <button key={id} type="button" className="ws-tab" aria-current={active === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
            <Icon className="w-5 h-5" />
            <span>{short || label}</span>
            {!!badge && <span className="ws-tab-badge">{badge > 99 ? '99+' : badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
