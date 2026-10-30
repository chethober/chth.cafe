import { html } from 'hono/html';
import { CLOUD, notice, page, type View } from './design';

const STYLES = `
main.app{width:100%;max-width:960px;margin:0 auto;padding:48px 20px 72px;display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-content:start}
@media (max-width:560px){main.app{padding-top:32px}}
main.narrow{max-width:720px}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:6px}
.head h1{font-size:clamp(34px,5vw,52px);line-height:1.05;margin:8px 0 6px}
.head p{margin:0}
.rise{animation:rise 300ms var(--ease-out) backwards;animation-delay:calc(var(--i,0) * 50ms)}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
.card h2{margin:0 0 6px;font-size:19px;letter-spacing:-.01em}
.card p{margin:0 0 12px}.card p:last-child{margin-bottom:0}
.account-card{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.account-card .cf-mark{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;flex:none;color:#f38020;background:color-mix(in srgb,#f38020 14%,transparent)}
.account-card .cf-mark svg{width:24px;height:24px}
.account-card .who{flex:1;min-width:min(100%,220px)}.account-card .who b{display:block;font-size:17px}
.account-card .who span{color:var(--muted);font-size:14px}
.account-card .actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.account-card select{font:inherit;font-size:14px;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--field);color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr));gap:16px;align-items:start}
.cafe{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:14px;transition:border-color 200ms ease,transform 200ms var(--ease-out)}
.cafe .top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.cafe .top>div{min-width:0}
.cafe h2{font-family:var(--serif);font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-.02em;margin:0;overflow-wrap:anywhere}
.cafe .meta{color:var(--dim);font-size:13.5px;overflow-wrap:anywhere}
.links{display:grid;grid-template-columns:minmax(0,1fr);gap:6px}
.links a{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:12px;background:var(--soft);border:1px solid var(--line);text-decoration:none;color:var(--ink);font-size:14px;transition:border-color 150ms ease,background-color 150ms ease}
.links a span{width:52px;color:var(--dim);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;flex:none}
.links a code{flex:1;min-width:0;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.links a i{font-style:normal;color:var(--accent);transition:transform 160ms var(--ease-out)}
.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.uptodate{display:inline-flex;align-items:center;gap:6px;color:var(--mint);font-size:14px;font-weight:600;padding:0 6px}
.empty{text-align:center;padding:48px 24px;border-style:dashed}
.empty .cup{width:56px;height:56px;margin:0 auto 14px;display:block}
.empty h2{font-family:var(--serif);font-size:26px}
form.stack{display:grid;gap:18px}
.setup-link{display:block;padding:12px 14px;border-radius:12px;background:var(--field);border:1px solid var(--line);font:13px/1.6 var(--mono);overflow-wrap:anywhere;color:var(--muted)}
.big-ok{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;color:var(--mint);background:color-mix(in srgb,var(--mint) 14%,transparent);font-size:28px;animation:pop 400ms var(--spring) backwards}
@keyframes pop{from{opacity:0;transform:scale(.6)}}
.danger-zone{border-color:color-mix(in srgb,var(--red) 40%,var(--line))}
.back{font-size:15px}
@media (hover:hover) and (pointer:fine){
  .cafe:hover{border-color:var(--line2);transform:translateY(-2px)}
  .links a:hover{border-color:var(--line2);background:var(--soft2)}
  .links a:hover i{transform:translate(2px,-2px)}
}
@media (prefers-reduced-motion:reduce){.cafe:hover{transform:none}}
`;

/** A signed-in page; the admin adds its own styles. */
export function layout(title: string, body: View, options: { account?: string; csrf?: string; narrow?: boolean; themeToggle?: boolean; styles?: string } = {}) {
  return page(html`<main class="app ${options.narrow ? 'narrow' : ''}">${body}</main>`, { title, styles: STYLES + (options.styles || ''), account: options.account, csrf: options.csrf, themeToggle: options.themeToggle });
}

export interface ConnectionView { method: 'token' | 'oauth'; accountId: string; accountName: string }
export interface CafeView {
  id: string; name: string; scriptName: string; url: string | null; adminUrl: string | null; customDomain: string | null;
  version: string | null; status: 'deploying' | 'live' | 'failed'; lastError: string | null; setupPending: boolean | null;
}

/** Opens Cloudflare's token page with the permissions a café needs already selected. */
export function tokenTemplateUrl(withDomains: boolean) {
  const permissions = [
    { key: 'workers_scripts', type: 'edit' },
    { key: 'workers_kv_storage', type: 'edit' },
    { key: 'd1', type: 'edit' },
    { key: 'account_settings', type: 'read' },
    ...(withDomains ? [{ key: 'zone', type: 'read' }, { key: 'workers_routes', type: 'edit' }] : [])
  ];
  return `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=${encodeURIComponent(JSON.stringify(permissions))}&name=${encodeURIComponent('CHTH Café Cloud')}`;
}

export function dashboard(params: { accountName: string; csrf: string; connection: ConnectionView | null; accounts?: { id: string; name: string }[]; cafes: CafeView[]; currentVersion: string; oauth: boolean; message?: string; error?: string }) {
  const { csrf, connection, cafes, currentVersion } = params;
  const hidden = html`<input type="hidden" name="csrf" value="${csrf}">`;
  const accountSwitch = connection && params.accounts && params.accounts.length > 1 ? html`
    <form class="inline" method="post" action="/connect/account">${hidden}
      <select name="accountId" aria-label="Cloudflare account">${params.accounts.map(account => html`<option value="${account.id}" ${account.id === connection.accountId ? 'selected' : ''}>${account.name}</option>`)}</select>
      <button class="btn ghost small" type="submit">Switch</button>
    </form>` : '';
  const status = (cafe: CafeView) => cafe.status === 'live'
    ? (cafe.setupPending ? html`<span class="pill warn"><i class="dot ping"></i>Waiting for setup</span>` : html`<span class="pill live"><i class="dot"></i>Live</span>`)
    : cafe.status === 'failed' ? html`<span class="pill red"><i class="dot"></i>Failed</span>` : html`<span class="pill warn"><i class="dot ping"></i>Deploying</span>`;
  const cafeCard = (cafe: CafeView, i: number) => html`
    <article class="card cafe rise" style="--i:${i + 2}">
      <div class="top">
        <div><h2>${cafe.name}</h2><div class="meta"><code>${cafe.scriptName}</code> · ${cafe.version ? `version ${cafe.version}` : 'not deployed yet'}</div></div>
        ${status(cafe)}
      </div>
      ${cafe.lastError ? notice(cafe.lastError) : ''}
      ${cafe.url ? html`<div class="links">
        <a href="${cafe.url}" target="_blank" rel="noopener"><span>Menu</span><code>${cafe.url.replace(/^https:\/\//, '')}</code><i aria-hidden="true">↗</i></a>
        <a href="${cafe.adminUrl}" target="_blank" rel="noopener"><span>Admin</span><code>${(cafe.adminUrl || '').replace(/^https:\/\//, '')}</code><i aria-hidden="true">↗</i></a>
      </div>` : ''}
      <div class="actions">
        ${cafe.status !== 'live' || cafe.version !== currentVersion ? html`<form class="inline" method="post" action="/cafes/${cafe.id}/deploy">${hidden}<button class="btn cf small" type="submit">${cafe.status === 'live' ? `Update to ${currentVersion}` : 'Retry deploy'}</button></form>` : html`<span class="uptodate">✓ Up to date</span>`}
        ${cafe.setupPending ? html`<form class="inline" method="post" action="/cafes/${cafe.id}/setup-link">${hidden}<button class="btn ghost small" type="submit">New setup link</button></form>` : ''}
        <a class="btn ghost small" href="/cafes/${cafe.id}/delete">Remove…</a>
      </div>
    </article>`;
  return layout('Your cafés', html`
    <div class="head rise">
      <div><div class="kicker">Dashboard</div><h1 class="display">Your <em>cafés</em></h1><p class="muted">Latest release: <code>${currentVersion}</code></p></div>
      ${connection ? html`<a class="btn cf" href="/cafes/new">+ New café</a>` : ''}
    </div>
    ${notice(params.error)}${notice(params.message, 'ok')}
    ${connection ? html`
      <section class="card account-card rise" style="--i:1" aria-label="Cloudflare account">
        <span class="cf-mark">${CLOUD}</span>
        <div class="who"><b>${connection.accountName}</b><span>${connection.method === 'oauth' ? 'Signed in with Cloudflare' : 'Signed in with an API token'} · disconnecting signs you out everywhere and forgets the access. Your cafés keep running.</span></div>
        <div class="actions">${accountSwitch}<form class="inline" method="post" action="/disconnect">${hidden}<button class="btn ghost small" type="submit">Disconnect</button></form></div>
      </section>` : ''}
    ${cafes.length ? html`<div class="grid">${cafes.map(cafeCard)}</div>` : connection ? html`
      <div class="card empty rise" style="--i:2">
        <svg class="cup" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="9" fill="currentColor" opacity=".12"/><path d="M8 13h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-5Z" fill="var(--accent)"/><path d="M21 15h1.5a2.5 2.5 0 0 1 0 5H21" stroke="var(--accent)" stroke-width="2"/></svg>
        <h2>No cafés yet</h2>
        <p class="muted">Deploy one to your Cloudflare account. It takes about a minute.</p>
        <a class="btn cf" href="/cafes/new">Deploy your first café</a>
      </div>` : ''}`, { account: params.accountName, csrf });
}

export function newCafe(params: { csrf: string; error?: string; values?: Record<string, string> }) {
  const v = params.values || {};
  return layout('New café', html`
    <div class="head rise"><div><div class="kicker">New café</div><h1 class="display">Deploy a <em>café</em></h1><p class="muted">It goes into your Cloudflare account, with its own Worker, database and storage.</p></div></div>
    ${notice(params.error)}
    <form class="stack card rise" style="--i:1" method="post" action="/cafes">
      <input type="hidden" name="csrf" value="${params.csrf}">
      <label class="field">Café name<input type="text" name="name" required maxlength="100" placeholder="Corner Beans" value="${v.name || ''}"></label>
      <label class="field">Worker name <span class="hint">Lowercase letters, digits and dashes. It becomes part of the workers.dev address. Leave empty to use the café name.</span>
        <input type="text" name="scriptName" maxlength="54" pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" placeholder="cafe-corner-beans" value="${v.scriptName || ''}"></label>
      <label class="field">Custom domain <span class="hint">Optional, on a zone in your Cloudflare account. The admin opens at admin.<i>domain</i> and the panel at panel.<i>domain</i>. Leave empty to use workers.dev.</span>
        <input type="text" name="customDomain" maxlength="200" placeholder="mycafe.com" value="${v.customDomain || ''}"></label>
      <label class="check"><input type="checkbox" name="demo" value="1" ${v.demo ? 'checked' : ''}> <span>Start with the demo menu, staff and stock, to try things out. You can delete them later.</span></label>
      <div class="actions"><button class="btn cf" type="submit">Deploy café</button><a class="btn ghost" href="/dashboard">Cancel</a></div>
      <p class="muted" style="margin:0;font-size:14px">Deploying takes up to a minute. Keep this page open.</p>
    </form>`, { csrf: params.csrf, narrow: true });
}

export function deployed(params: { csrf: string; name: string; url: string; setupUrl: string | null; kind: 'deployed' | 'updated' | 'setup-link' }) {
  const title = { deployed: `${params.name} is live`, updated: `${params.name} is updated`, 'setup-link': `New setup link for ${params.name}` }[params.kind];
  return layout(title, html`
    <div class="head rise"><div><div class="big-ok" aria-hidden="true">✓</div><h1 class="display">${title}</h1><p>Menu: <a href="${params.url}" target="_blank" rel="noopener">${params.url}</a></p></div></div>
    ${params.setupUrl ? html`
      <section class="card rise" style="--i:1">
        <h2>Finish setup</h2>
        <p class="muted">Open this link to choose your admin and panel passwords. It works only until setup is finished, and any earlier link stops working. We do not keep a copy, so open it now or ask for a new one from your dashboard.</p>
        <p><a class="btn cf" href="${params.setupUrl}" target="_blank" rel="noopener">Open setup ↗</a></p>
        <span class="setup-link">${params.setupUrl}</span>
        ${params.kind === 'deployed' ? html`<p class="muted" style="margin-top:12px;font-size:14px">A new workers.dev address can take a minute to start answering.</p>` : ''}
      </section>` : ''}
    <p class="back"><a href="/dashboard">← Back to your cafés</a></p>`, { csrf: params.csrf, narrow: true, themeToggle: false });
}

export function confirmDelete(params: { csrf: string; id: string; name: string; scriptName: string; error?: string }) {
  const hidden = html`<input type="hidden" name="csrf" value="${params.csrf}">`;
  return layout(`Remove ${params.name}`, html`
    <div class="head rise"><div><div class="kicker">Remove</div><h1 class="display">${params.name}</h1></div></div>
    ${notice(params.error)}
    <section class="card rise" style="--i:1">
      <h2>Stop managing it here</h2>
      <p class="muted">The café keeps running in your Cloudflare account with all its data. You lose one-click updates for it.</p>
      <form method="post" action="/cafes/${params.id}/forget">${hidden}<button class="btn ghost" type="submit">Remove from this dashboard</button></form>
    </section>
    <section class="card danger-zone rise" style="--i:2">
      <h2>Delete it from Cloudflare</h2>
      <p class="muted">Deletes the Worker <code>${params.scriptName}</code>, its database and its storage from your account. Orders, menu, staff and finances are gone for good. Download a backup from the café's Settings first.</p>
      <form class="stack" method="post" action="/cafes/${params.id}/delete">${hidden}
        <label class="field"><span>Type <code>${params.scriptName}</code> to confirm</span><input type="text" name="confirm" autocomplete="off" required></label>
        <div><button class="btn danger" type="submit">Delete café and its data</button></div>
      </form>
    </section>
    <p class="back"><a href="/dashboard">← Back to your cafés</a></p>`, { csrf: params.csrf, narrow: true });
}

export function errorPage(message: string) {
  return layout('Something went wrong', html`
    <div class="head rise"><div><div class="kicker">Error</div><h1 class="display">Something went <em>sideways</em></h1></div></div>
    ${notice(message)}
    <p class="back"><a href="/">← Back to your cafés</a></p>`, { narrow: true, themeToggle: false });
}

export { landing } from './landing';
