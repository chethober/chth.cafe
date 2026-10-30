export type Workspace = 'admin' | 'panel';

/**
 * The admin and panel open on their own subdomains (admin.example.com) or, on hosts
 * without subdomains such as workers.dev, at /admin and /panel.
 */
export function currentWorkspace(): Workspace | null {
  if (typeof window === 'undefined') return null;
  const { hostname, pathname } = window.location;
  if (hostname.startsWith('admin.')) return 'admin';
  if (hostname.startsWith('panel.')) return 'panel';
  const match = /^\/(admin|panel)(\/|$)/.exec(pathname);
  return match ? match[1] as Workspace : null;
}

/** True when the workspace comes from the path, so the admin and panel share one origin. */
export const pathWorkspace = () => typeof window !== 'undefined' && currentWorkspace() !== null && !/^(admin|panel)\./.test(window.location.hostname);

/** Where the workspace starts, used after signing out. */
export const workspaceHome = () => pathWorkspace() ? `/${currentWorkspace()}` : '/';

/**
 * On a shared origin, every API request names its workspace so the Worker checks the right session.
 * Wrapping fetch covers the store, the offline queue and the settings screens alike.
 */
export function installWorkspaceHeader() {
  if (!pathWorkspace()) return;
  const workspace = currentWorkspace()!;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('X-Cafe-Workspace', workspace);
    return original(input, { ...init, headers });
  };
}
