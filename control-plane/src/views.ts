import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';

type View = HtmlEscapedString | Promise<HtmlEscapedString>;

const STYLES = `
:root{--paper:#faf7f2;--card:#fff;--ink:#1f1a14;--muted:#6b6257;--line:#e7e0d6;--accent:#8a4b1f;--accent-ink:#fff;--danger:#b42318;--ok:#1d7a46;--warn:#9a6700;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#15120f;--card:#1e1a16;--ink:#f3ede4;--muted:#a89d90;--line:#332c25;--accent:#e0a370;--accent-ink:#1b130c;--danger:#f97066;--ok:#47cd89;--warn:#f5c451;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#15120f;--card:#1e1a16;--ink:#f3ede4;--muted:#a89d90;--line:#332c25;--accent:#e0a370;--accent-ink:#1b130c;--danger:#f97066;--ok:#47cd89;--warn:#f5c451;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}main{max-width:760px;margin:0 auto;padding:32px 16px 64px}
header.top{display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:760px;margin:0 auto;padding:20px 16px 0}
.brand{font-weight:700;text-decoration:none;color:var(--ink);font-size:18px}
h1{font-size:28px;line-height:1.2;margin:8px 0 12px}h2{font-size:19px;margin:0 0 8px}p{margin:0 0 12px}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin:16px 0}
form.stack{display:grid;gap:14px}label{display:grid;gap:6px;font-weight:600;font-size:14px}label .hint{font-weight:400;color:var(--muted)}
input[type=text],input[type=email],input[type=password],input[type=url],select{font:inherit;width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink)}
.check{display:flex;gap:10px;align-items:flex-start;font-weight:400}.check input{margin-top:4px}
button,.button{font:inherit;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:999px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);cursor:pointer;text-decoration:none}
button.ghost,.button.ghost{background:transparent;color:var(--accent)}button.danger{background:var(--danger);border-color:var(--danger);color:#fff}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.spread{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}
.notice{border-radius:10px;padding:12px 14px;margin:12px 0;border:1px solid var(--line)}.notice.error{border-color:var(--danger);color:var(--danger)}.notice.ok{border-color:var(--ok)}
.pill{display:inline-block;font-size:12px;font-weight:700;padding:2px 10px;border-radius:999px;border:1px solid currentColor}.pill.live{color:var(--ok)}.pill.failed{color:var(--danger)}.pill.deploying,.pill.setup{color:var(--warn)}
code,.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;overflow-wrap:anywhere}.code{display:block;padding:12px;border-radius:10px;background:var(--paper);border:1px solid var(--line)}
ol{padding-left:20px}li{margin:4px 0}details summary{cursor:pointer;font-weight:600}
form.inline{display:inline}
`;

export function layout(title: string, body: View, options: { signedIn?: boolean; csrf?: string } = {}) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="same-origin">
<title>${title} · CHTH Café Cloud</title>
<style>${raw(STYLES)}</style>
</head>
<body>
<header class="top">
  <a class="brand" href="/">CHTH Café Cloud</a>
  ${options.signedIn ? html`<form class="inline" method="post" action="/signout"><input type="hidden" name="csrf" value="${options.csrf}"><button class="ghost" type="submit">Sign out</button></form>` : ''}
</header>
<main>${body}</main>
</body>
</html>`;
}

const notice = (message?: string, tone: 'error' | 'ok' = 'error') => message ? html`<div class="notice ${tone}" role="${tone === 'error' ? 'alert' : 'status'}">${message}</div>` : '';

export function landing() {
  return layout('Your café, on your Cloudflare account', html`
    <h1>Your café, on your own Cloudflare account</h1>
    <p>Menu, orders, stock, staff and finances for your café, deployed in one click to a Cloudflare account you own. Your data and your bill stay with you; we only keep the link to update it.</p>
    <div class="row" style="margin:20px 0">
      <a class="button" href="/signup">Create an account</a>
      <a class="button ghost" href="/signin">Sign in</a>
    </div>
    <div class="card">
      <h2>How it works</h2>
      <ol>
        <li>Create an account here and connect your Cloudflare account, with Cloudflare's own consent screen or an API token.</li>
        <li>Name your café and deploy. We create its database, storage and Worker in your account.</li>
        <li>Open the setup link, choose your admin and staff passwords, and start taking orders.</li>
      </ol>
      <p class="muted">We never see your café's passwords. A free Cloudflare plan is enough for one café.</p>
    </div>`);
}

export function authPage(mode: 'signin' | 'signup', error?: string, email = '') {
  const signup = mode === 'signup';
  return layout(signup ? 'Create an account' : 'Sign in', html`
    <h1>${signup ? 'Create an account' : 'Sign in'}</h1>
    ${notice(error)}
    <form class="stack card" method="post" action="/${mode}">
      <label>Email<input type="email" name="email" autocomplete="email" required maxlength="200" value="${email}"></label>
      <label>Password ${signup ? html`<span class="hint">At least 12 characters.</span>` : ''}
        <input type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="${signup ? 12 : 1}" maxlength="200"></label>
      <div><button type="submit">${signup ? 'Create account' : 'Sign in'}</button></div>
    </form>
    <p class="muted">${signup ? html`Already have an account? <a href="/signin">Sign in</a>.` : html`New here? <a href="/signup">Create an account</a>.`}</p>`);
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

export function dashboard(params: { email: string; csrf: string; connection: ConnectionView | null; accounts?: { id: string; name: string }[]; cafes: CafeView[]; currentVersion: string; oauth: boolean; message?: string; error?: string }) {
  const { csrf, connection, cafes, currentVersion } = params;
  const hidden = html`<input type="hidden" name="csrf" value="${csrf}">`;
  const connect = html`
    <div class="card">
      <h2>Connect your Cloudflare account</h2>
      <p>Your café runs in your own account. Connect it once; we use the access only to deploy and update your cafés.</p>
      ${params.oauth ? html`<p><a class="button" href="/connect/oauth">Connect with Cloudflare</a></p>` : ''}
      <details ${params.oauth ? '' : 'open'}>
        <summary>${params.oauth ? 'Or use an API token' : 'Use an API token'}</summary>
        <ol>
          <li><a href="${tokenTemplateUrl(false)}" target="_blank" rel="noopener">Create a token on Cloudflare</a> with the permissions already filled in: Workers Scripts, Workers KV Storage and D1 set to Edit, and Account Settings set to Read. For your own domain, use <a href="${tokenTemplateUrl(true)}" target="_blank" rel="noopener">this link</a> instead, which adds Zone: Read and Workers Routes: Edit.</li>
          <li>Paste the token here. It is stored encrypted, and you can disconnect at any time.</li>
        </ol>
        <form class="stack" method="post" action="/connect/token">${hidden}
          <label>API token<input type="password" name="token" autocomplete="off" required maxlength="200"></label>
          <label>Account ID <span class="hint">Optional. Needed only when the token reaches more than one account.</span><input type="text" name="accountId" autocomplete="off" maxlength="64" pattern="[0-9a-f]{32}"></label>
          <div><button type="submit">Connect</button></div>
        </form>
      </details>
    </div>`;
  const accountSwitch = connection && params.accounts && params.accounts.length > 1 ? html`
    <form class="row" method="post" action="/connect/account">${hidden}
      <select name="accountId" aria-label="Cloudflare account">${params.accounts.map(account => html`<option value="${account.id}" ${account.id === connection.accountId ? 'selected' : ''}>${account.name}</option>`)}</select>
      <button class="ghost" type="submit">Use this account</button>
    </form>` : '';
  const cafeCard = (cafe: CafeView) => html`
    <div class="card">
      <div class="spread">
        <div>
          <h2>${cafe.name}</h2>
          <p class="muted"><code>${cafe.scriptName}</code> · ${cafe.version ? `version ${cafe.version}` : 'not deployed yet'}</p>
        </div>
        <span class="pill ${cafe.setupPending ? 'setup' : cafe.status}">${cafe.status === 'live' ? (cafe.setupPending ? 'Waiting for setup' : 'Live') : cafe.status === 'failed' ? 'Failed' : 'Deploying'}</span>
      </div>
      ${cafe.lastError ? notice(cafe.lastError) : ''}
      ${cafe.url ? html`<p>Menu: <a href="${cafe.url}" target="_blank" rel="noopener">${cafe.url}</a><br>Admin: <a href="${cafe.adminUrl}" target="_blank" rel="noopener">${cafe.adminUrl}</a></p>` : ''}
      <div class="row">
        ${cafe.status !== 'live' || cafe.version !== currentVersion ? html`<form class="inline" method="post" action="/cafes/${cafe.id}/deploy">${hidden}<button type="submit">${cafe.status === 'live' ? `Update to ${currentVersion}` : 'Retry deploy'}</button></form>` : html`<span class="muted">Up to date</span>`}
        ${cafe.setupPending ? html`<form class="inline" method="post" action="/cafes/${cafe.id}/setup-link">${hidden}<button class="ghost" type="submit">New setup link</button></form>` : ''}
        <a class="button ghost" href="/cafes/${cafe.id}/delete">Remove…</a>
      </div>
    </div>`;
  return layout('Your cafés', html`
    <div class="spread"><h1>Your cafés</h1>${connection ? html`<a class="button" href="/cafes/new">New café</a>` : ''}</div>
    <p class="muted">Signed in as ${params.email}. Latest version: ${currentVersion}.</p>
    ${notice(params.error)}${notice(params.message, 'ok')}
    ${connection ? html`
      <div class="card">
        <div class="spread">
          <div><h2>Cloudflare account</h2><p>${connection.accountName} <span class="muted">(${connection.method === 'oauth' ? 'connected with Cloudflare' : 'API token'})</span></p></div>
          <form class="inline" method="post" action="/disconnect">${hidden}<button class="ghost" type="submit">Disconnect</button></form>
        </div>
        ${accountSwitch}
        <p class="muted">Disconnecting keeps your cafés running; you only lose one-click updates until you connect again.</p>
      </div>` : connect}
    ${cafes.length ? cafes.map(cafeCard) : connection ? html`<div class="card"><p>No cafés yet. <a href="/cafes/new">Deploy your first café</a>.</p></div>` : ''}`, { signedIn: true, csrf });
}

export function newCafe(params: { csrf: string; error?: string; values?: Record<string, string> }) {
  const v = params.values || {};
  return layout('New café', html`
    <h1>Deploy a new café</h1>
    ${notice(params.error)}
    <form class="stack card" method="post" action="/cafes">
      <input type="hidden" name="csrf" value="${params.csrf}">
      <label>Café name<input type="text" name="name" required maxlength="100" value="${v.name || ''}"></label>
      <label>Worker name <span class="hint">Lowercase letters, digits and dashes. It becomes part of the workers.dev address. Leave empty to use the café name.</span>
        <input type="text" name="scriptName" maxlength="54" pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" value="${v.scriptName || ''}"></label>
      <label>Custom domain <span class="hint">Optional, such as mycafe.com, on a zone in your Cloudflare account. The admin opens at admin.mycafe.com and the panel at panel.mycafe.com. Leave empty to use workers.dev.</span>
        <input type="text" name="customDomain" maxlength="200" placeholder="mycafe.com" value="${v.customDomain || ''}"></label>
      <label class="check"><input type="checkbox" name="demo" value="1" ${v.demo ? 'checked' : ''}> <span>Start with the demo menu, staff and stock, to try things out. You can delete them later.</span></label>
      <div><button type="submit">Deploy café</button></div>
      <p class="muted">Deploying takes up to a minute. Keep this page open.</p>
    </form>`, { signedIn: true, csrf: params.csrf });
}

export function deployed(params: { csrf: string; name: string; url: string; setupUrl: string | null; kind: 'deployed' | 'updated' | 'setup-link' }) {
  const title = { deployed: `${params.name} is live`, updated: `${params.name} is updated`, 'setup-link': `New setup link for ${params.name}` }[params.kind];
  return layout(title, html`
    <h1>${title}</h1>
    <p>Menu: <a href="${params.url}" target="_blank" rel="noopener">${params.url}</a></p>
    ${params.setupUrl ? html`
      <div class="card">
        <h2>Finish setup</h2>
        <p>Open this link to choose your admin and panel passwords. It works only until setup is finished, and any earlier link stops working. We do not keep a copy, so open it now or ask for a new one from your dashboard.</p>
        <p><a class="button" href="${params.setupUrl}" target="_blank" rel="noopener">Open setup</a></p>
        <span class="code">${params.setupUrl}</span>
        ${params.kind === 'deployed' ? html`<p class="muted" style="margin-top:12px">A new workers.dev address can take a minute to start answering.</p>` : ''}
      </div>` : ''}
    <p><a href="/dashboard">Back to your cafés</a></p>`, { signedIn: true, csrf: params.csrf });
}

export function confirmDelete(params: { csrf: string; id: string; name: string; scriptName: string; error?: string }) {
  const hidden = html`<input type="hidden" name="csrf" value="${params.csrf}">`;
  return layout(`Remove ${params.name}`, html`
    <h1>Remove ${params.name}</h1>
    ${notice(params.error)}
    <div class="card">
      <h2>Stop managing it here</h2>
      <p>The café keeps running in your Cloudflare account with all its data. You lose one-click updates for it.</p>
      <form method="post" action="/cafes/${params.id}/forget">${hidden}<button class="ghost" type="submit">Remove from this dashboard</button></form>
    </div>
    <div class="card">
      <h2>Delete it from Cloudflare</h2>
      <p>Deletes the Worker <code>${params.scriptName}</code>, its database and its storage from your account. Orders, menu, staff and finances are gone for good. Download a backup from the café's Settings first.</p>
      <form class="stack" method="post" action="/cafes/${params.id}/delete">${hidden}
        <label>Type the Worker name to confirm<input type="text" name="confirm" autocomplete="off" required></label>
        <div><button class="danger" type="submit">Delete café and its data</button></div>
      </form>
    </div>
    <p><a href="/dashboard">Back to your cafés</a></p>`, { signedIn: true, csrf: params.csrf });
}

export function errorPage(message: string) {
  return layout('Something went wrong', html`<h1>Something went wrong</h1>${notice(message)}<p><a href="/dashboard">Back to your cafés</a></p>`);
}
