import { html } from 'hono/html';
import { notice } from './design';
import { layout } from './views';
import type { CafeRow } from './shared';

const STYLES = `
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stat{padding:18px 20px}.stat b{display:block;font:600 34px/1.1 var(--serif);letter-spacing:-.02em}.stat span{color:var(--muted);font-size:14px}
.rows{display:grid;gap:0;margin:0 -24px -24px}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 24px;border-top:1px solid var(--line);color:var(--ink);text-decoration:none;transition:background-color 150ms ease}
.row b{display:block;overflow-wrap:anywhere}.row small{color:var(--dim);font-size:13px;overflow-wrap:anywhere}
.acct-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
.acct-head h2{margin:0}.acct-head small{display:block;color:var(--dim);font-size:13px}
.preview{display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:12px;border:1px dashed var(--line2);color:var(--muted);font-size:14px}
.preview b{font:600 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
dl.facts{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 18px;margin:0;font-size:14.5px}
dl.facts dt{color:var(--dim)}dl.facts dd{margin:0;overflow-wrap:anywhere}
.radios{display:grid;gap:10px}
table.log{width:100%;border-collapse:collapse;font-size:14px}
table.log td{padding:8px 0;border-top:1px solid var(--line);vertical-align:top}
table.log td:first-child{color:var(--dim);white-space:nowrap;padding-right:16px;font:12.5px/1.8 var(--mono)}
table.log code{color:var(--accent)}
@media (hover:hover) and (pointer:fine){.row:hover{background:var(--soft)}}
`;

const page = (title: string, body: ReturnType<typeof html>, csrf?: string, narrow = false) => layout(title, body, { csrf, account: csrf ? 'Platform admin' : undefined, narrow, styles: STYLES });
const hidden = (csrf: string) => html`<input type="hidden" name="csrf" value="${csrf}">`;
const day = (iso: string) => iso.slice(0, 16).replace('T', ' ');
const statusPill = (status: CafeRow['status']) => status === 'live' ? html`<span class="pill live"><i class="dot"></i>Live</span>`
  : status === 'failed' ? html`<span class="pill red"><i class="dot"></i>Failed</span>` : html`<span class="pill warn"><i class="dot"></i>Deploying</span>`;
const noticePreview = (n: { text: string; url: string | null } | null) => n?.text
  ? html`<div class="preview"><b>Shown</b><span>${n.text}${n.url ? html` · <a href="${n.url}" target="_blank" rel="noopener">${n.url}</a>` : ''}</span></div>`
  : html`<div class="preview"><b>Off</b><span>No line is shown.</span></div>`;

export function signIn(params: { error?: string }) {
  return page('Platform admin', html`
    <div class="head rise"><div><div class="kicker">Platform admin</div><h1 class="display">Sign <em>in</em></h1><p class="muted">Use the password printed by the last deploy. Every deploy prints a new one.</p></div></div>
    ${notice(params.error)}
    <form class="stack card rise" style="--i:1" method="post" action="/login">
      <label class="field">Admin password<input type="password" name="password" required autocomplete="current-password" autofocus></label>
      <div><button class="btn cf" type="submit">Sign in</button></div>
    </form>`, undefined, true);
}

export function notConfigured() {
  return page('Platform admin', html`
    <div class="head rise"><div><div class="kicker">Platform admin</div><h1 class="display">Not set <em>up</em></h1></div></div>
    <div class="card rise" style="--i:1"><p>No admin password is set. Deploy with <code>npm run deploy:control-plane</code>: it sets a new password and prints it.</p></div>`, undefined, true);
}

export function errorPage(message: string) {
  return page('Something went wrong', html`
    <div class="head rise"><div><div class="kicker">Error</div><h1 class="display">Something went <em>sideways</em></h1></div></div>
    ${notice(message)}
    <p class="back"><a href="/">← Back to the admin</a></p>`, undefined, true);
}

interface AccountSummary { id: string; name: string; method: string | null; connectedAt: string; cafes: CafeRow[] }

export function overview(params: {
  csrf: string; currentVersion: string; message?: string; notice: { text: string; url: string | null } | null; customNotices: Set<string>;
  accounts: AccountSummary[]; cafeCount: number; liveCount: number;
}) {
  const { csrf, currentVersion } = params;
  const outdated = params.accounts.flatMap(a => a.cafes).filter(cafe => cafe.status === 'live' && cafe.version !== currentVersion).length;
  return page('Platform admin', html`
    <div class="head rise"><div><div class="kicker">Platform admin</div><h1 class="display">The <em>platform</em></h1><p class="muted">Latest release: <code>${currentVersion}</code></p></div></div>
    ${notice(params.message, 'ok')}
    <div class="stats rise" style="--i:1">
      <div class="card stat"><b>${params.accounts.filter(a => a.method).length}</b><span>connected accounts</span></div>
      <div class="card stat"><b>${params.cafeCount}</b><span>cafés</span></div>
      <div class="card stat"><b>${params.liveCount}</b><span>live</span></div>
      <div class="card stat"><b>${outdated}</b><span>behind the latest release</span></div>
    </div>
    <section class="card rise" style="--i:2">
      <h2>Notice line</h2>
      <p class="muted">One line shown at the top of every café’s admin and panel, for an announcement or an advert. A café can have its own line instead, from its page. Leave the text empty to show nothing. Cafés deployed or updated before this feature show it after their next update.</p>
      <form class="stack" method="post" action="/notice">${hidden(csrf)}
        ${noticePreview(params.notice)}
        <label class="field">Text <span class="hint">Up to 200 characters, plain text.</span><input type="text" name="text" maxlength="200" value="${params.notice?.text || ''}" placeholder="Try CHTH Pro: daily backups and Telegram reports"></label>
        <label class="field">Link <span class="hint">Optional, https:// only.</span><input type="url" name="url" maxlength="500" value="${params.notice?.url || ''}" placeholder="https://chth.cafe/pro"></label>
        <div><button class="btn cf" type="submit">Save notice</button></div>
      </form>
    </section>
    ${params.accounts.length ? params.accounts.map((account, i) => html`
      <section class="card rise" style="--i:${i + 3}">
        <div class="acct-head">
          <div><h2>${account.name}</h2><small><code>${account.id}</code> · ${account.method ? `${account.method === 'oauth' ? 'Cloudflare sign-in' : 'API token'} since ${day(account.connectedAt)}` : 'not connected'}</small></div>
          <a class="btn ghost small" href="/accounts/${account.id}">Manage account</a>
        </div>
        ${account.cafes.length ? html`<div class="rows">${account.cafes.map(cafe => html`
          <a class="row" href="/cafes/${cafe.id}">
            <span><b>${cafe.name}</b><small><code>${cafe.script_name}</code> · ${cafe.version || 'never deployed'}${cafe.version && cafe.version !== currentVersion ? ' · update available' : ''}${params.customNotices.has(cafe.id) ? ' · own notice' : ''}${cafe.url ? ` · ${cafe.url.replace(/^https:\/\//, '')}` : ''}</small></span>
            ${statusPill(cafe.status)}
          </a>`)}</div>` : html`<p class="muted">No cafés.</p>`}
      </section>`) : html`<div class="card empty rise" style="--i:3"><h2>No accounts yet</h2><p class="muted">Owners appear here once they sign in at the main site.</p></div>`}`, csrf);
}

export function cafe(params: {
  csrf: string; cafe: CafeRow; currentVersion: string; error?: string; message?: string;
  owner: { id: string; name: string | null; reachable: boolean };
  notice: { text: string; url: string | null } | null; globalNotice: { text: string; url: string | null } | null;
  history: { action: string; detail: string; created_at: string }[];
}) {
  const { csrf, cafe, owner } = params;
  const mode = !params.notice ? 'global' : params.notice.text ? 'custom' : 'none';
  return page(cafe.name, html`
    <div class="head rise"><div><div class="kicker">Café</div><h1 class="display">${cafe.name}</h1><p class="muted">${statusPill(cafe.status)} <code>${cafe.script_name}</code></p></div></div>
    ${notice(params.error)}${notice(params.message, 'ok')}
    ${cafe.last_error ? notice(`Last deploy error: ${cafe.last_error}`) : ''}
    <section class="card rise" style="--i:1">
      <dl class="facts">
        <dt>Owner</dt><dd><a href="/accounts/${owner.id}">${owner.name ?? 'Disconnected account'}</a> <code>${owner.id}</code></dd>
        <dt>Account</dt><dd><code>${cafe.account_id}</code></dd>
        <dt>Version</dt><dd>${cafe.version || 'never deployed'}${cafe.version && cafe.version !== params.currentVersion ? html` · <b>${params.currentVersion}</b> available` : ''}</dd>
        <dt>Menu</dt><dd>${cafe.url ? html`<a href="${cafe.url}" target="_blank" rel="noopener">${cafe.url}</a>` : '—'}</dd>
        <dt>Admin</dt><dd>${cafe.admin_url ? html`<a href="${cafe.admin_url}" target="_blank" rel="noopener">${cafe.admin_url}</a>` : '—'}</dd>
        <dt>Domain</dt><dd>${cafe.custom_domain || 'workers.dev'}</dd>
        <dt>Database</dt><dd><code>${cafe.database_id || '—'}</code></dd>
        <dt>KV</dt><dd><code>${cafe.kv_namespace_id || '—'}</code></dd>
        <dt>Created</dt><dd>${day(cafe.created_at)} · updated ${day(cafe.updated_at)}</dd>
      </dl>
    </section>
    <section class="card rise" style="--i:2">
      <h2>Details</h2>
      <form class="stack" method="post" action="/cafes/${cafe.id}">${hidden(csrf)}
        <label class="field">Name <span class="hint">As listed here and on the owner’s dashboard. The café’s own name is set in its admin.</span><input type="text" name="name" required maxlength="100" value="${cafe.name}"></label>
        <div><button class="btn ghost" type="submit">Save</button></div>
      </form>
    </section>
    <section class="card rise" style="--i:3">
      <h2>Notice line</h2>
      <form class="stack" method="post" action="/cafes/${cafe.id}/notice">${hidden(csrf)}
        <div class="radios">
          <label class="check"><input type="radio" name="mode" value="global" ${mode === 'global' ? 'checked' : ''}> <span>Platform notice ${params.globalNotice?.text ? html`<span class="muted">(“${params.globalNotice.text}”)</span>` : html`<span class="muted">(none set)</span>`}</span></label>
          <label class="check"><input type="radio" name="mode" value="custom" ${mode === 'custom' ? 'checked' : ''}> <span>Its own notice, below</span></label>
          <label class="check"><input type="radio" name="mode" value="none" ${mode === 'none' ? 'checked' : ''}> <span>No notice for this café</span></label>
        </div>
        <label class="field">Text<input type="text" name="text" maxlength="200" value="${params.notice?.text || ''}"></label>
        <label class="field">Link <span class="hint">Optional, https:// only.</span><input type="url" name="url" maxlength="500" value="${params.notice?.url || ''}"></label>
        <div><button class="btn ghost" type="submit">Save notice</button></div>
      </form>
    </section>
    <section class="card rise" style="--i:4">
      <h2>Update</h2>
      <p class="muted">Deploys the latest release with the owner’s saved Cloudflare access. The café keeps its data and passwords.</p>
      ${owner.reachable ? html`<form method="post" action="/cafes/${cafe.id}/deploy">${hidden(csrf)}<button class="btn cf" type="submit">${cafe.version === params.currentVersion ? 'Redeploy' : `Update to ${params.currentVersion}`}</button></form>`
        : notice('The owner’s saved access does not reach this café’s account, so it cannot be updated or deleted from here.')}
    </section>
    <section class="card rise" style="--i:5">
      <h2>Remove from the platform</h2>
      <p class="muted">Forgets the café here. It keeps running in the owner’s account, without one-click updates or the notice line updates.</p>
      <form method="post" action="/cafes/${cafe.id}/forget">${hidden(csrf)}<button class="btn ghost" type="submit">Remove from the platform</button></form>
    </section>
    ${owner.reachable ? html`<section class="card danger-zone rise" style="--i:6">
      <h2>Delete from Cloudflare</h2>
      <p class="muted">Deletes the Worker, its database and its storage from the owner’s account. The café’s orders, menu, staff and finances are gone for good.</p>
      <form class="stack" method="post" action="/cafes/${cafe.id}/delete">${hidden(csrf)}
        <label class="field"><span>Type <code>${cafe.script_name}</code> to confirm</span><input type="text" name="confirm" autocomplete="off" required></label>
        <div><button class="btn danger" type="submit">Delete café and its data</button></div>
      </form>
    </section>` : ''}
    ${history(params.history)}
    <p class="back"><a href="/">← Back to the admin</a></p>`, csrf, true);
}

function history(rows: { action: string; detail: string; created_at: string }[]) {
  return rows.length ? html`<section class="card rise" style="--i:7"><h2>History</h2>
    <table class="log">${rows.map(row => html`<tr><td>${day(row.created_at)}</td><td><code>${row.action}</code> ${row.detail}</td></tr>`)}</table></section>` : '';
}

export function account(params: {
  csrf: string; id: string; sessions: number; cafes: CafeRow[];
  connection: { name: string; method: string; accountId: string; connectedAt: string; updatedAt: string } | null;
  history: { action: string; detail: string; created_at: string }[];
}) {
  const { csrf, connection } = params;
  return page(connection?.name || 'Account', html`
    <div class="head rise"><div><div class="kicker">Account</div><h1 class="display">${connection?.name || 'Disconnected account'}</h1><p class="muted"><code>${params.id}</code></p></div></div>
    <section class="card rise" style="--i:1">
      <dl class="facts">
        <dt>Access</dt><dd>${connection ? (connection.method === 'oauth' ? 'Signed in with Cloudflare' : 'API token') : 'None saved'}</dd>
        ${connection ? html`<dt>Connected</dt><dd>${day(connection.connectedAt)} · refreshed ${day(connection.updatedAt)}</dd>` : ''}
        <dt>Signed in</dt><dd>${params.sessions} browser${params.sessions === 1 ? '' : 's'}</dd>
        <dt>Cafés</dt><dd>${params.cafes.length ? params.cafes.map((cafe, i) => html`${i ? ', ' : ''}<a href="/cafes/${cafe.id}">${cafe.name}</a>`) : 'none'}</dd>
      </dl>
    </section>
    <section class="card danger-zone rise" style="--i:2">
      <h2>Remove from the platform</h2>
      <p class="muted">Revokes the saved Cloudflare access, signs the account out everywhere and forgets its cafés here. The cafés keep running in the owner’s account; the owner can sign in again later and start over.</p>
      <form method="post" action="/accounts/${params.id}/remove">${hidden(csrf)}<button class="btn danger" type="submit">Remove account</button></form>
    </section>
    ${history(params.history)}
    <p class="back"><a href="/">← Back to the admin</a></p>`, csrf, true);
}
