import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { BRAND_CSS } from '../../src/chth-kit/brand.js';
import { footerHtml } from '../../src/chth-kit/footer.js';
import { appSwitcherHtml, themeToggleModel } from '../../src/chth-kit/shell.js';
import { SHELL_JS } from '../../src/chth-kit/shell-script.js';

/**
 * The page shell every control plane page shares: tokens for both themes, the nav with the CHTH
 * theme toggle, and the motion. The CSP allows one script, the CHTH shell (by its hash). The theme
 * toggle is still a form, so it works without it, and page changes animate with cross-document
 * View Transitions, which browsers without them simply skip.
 */
export type View = HtmlEscapedString | Promise<HtmlEscapedString>;

/** The theme cookie every CHTH site uses (the shell sets it too). */
export const THEME_COOKIE = 'chth_theme';
/** The cookie this control plane used before the shared one. */
export const OLD_THEME_COOKIE = 'cp_theme';

/** The brand fonts, as the café app loads them: Plus Jakarta Sans, Fraunces, JetBrains Mono and Vazirmatn for Persian and Arabic. */
export const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300..800&family=Fraunces:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400..600&family=Vazirmatn:wght@300..800&display=swap';
/** Set for one page load after the theme changes, so that page reveals itself in a circle. */
export const THEME_SWITCH_COOKIE = 'cp_theme_switch';
export const THEME_COLORS = { dark: '#100b08', light: '#f7f1e8' } as const;

const DARK = '--bg:#100b08;--bg2:#17110c;--panel:#1d1610;--panel2:#241b14;--line:#3a2d22;--line2:#5a4635;--ink:#f6efe6;--muted:#b3a495;--dim:#8a7a6b;--accent:#e7a96b;--accent2:#f3c993;--em1:#f3c993;--em2:#e7a96b;--em3:#c9773a;--mint:#5fd3a0;--red:#ff7a6b;--warn:#ffd28a;--field:#100b08;--shadow:rgba(0,0,0,.8);--glass:rgba(16,11,8,.72);--soft:rgba(255,255,255,.035);--soft2:rgba(255,255,255,.07);--chat:#20303f;--chat-line:#2d4357;--chat-meta:#8fb3d1;color-scheme:dark';
const LIGHT = '--bg:#f7f1e8;--bg2:#efe6d8;--panel:#fffaf3;--panel2:#fbf3e8;--line:#e3d5c2;--line2:#cdb9a0;--ink:#23180f;--muted:#6b5848;--dim:#86715e;--accent:#b4612a;--accent2:#9a4f1d;--em1:#c87a3c;--em2:#a2531f;--em3:#7a3a14;--mint:#1d8a5a;--red:#c2412f;--warn:#8a5a00;--field:#fffdf9;--shadow:rgba(80,50,20,.28);--glass:rgba(247,241,232,.78);--soft:rgba(60,35,15,.035);--soft2:rgba(60,35,15,.07);--chat:#e6f1fb;--chat-line:#c3dcf0;--chat-meta:#4f7799;color-scheme:light';

const BASE = `
:root{${DARK};--serif:"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
--ease-out:cubic-bezier(0.23,1,0.32,1);--ease-in-out:cubic-bezier(0.77,0,0.175,1);--spring:cubic-bezier(0.34,1.56,0.64,1);interpolate-size:allow-keywords}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){${LIGHT}}}
:root[data-theme="light"]{${LIGHT}}
.force-dark{${DARK}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font:16px/1.6 var(--chth-font-sans,system-ui,sans-serif);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:var(--accent);text-underline-offset:3px;text-decoration-thickness:1px;transition:color 150ms ease}
.wrap{max-width:1160px;margin:0 auto;padding:0 20px;width:100%}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

nav.top{position:sticky;top:0;z-index:10;backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);background:var(--glass);border-bottom:1px solid var(--line)}
nav.top .wrap{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.brand svg{width:28px;height:28px;flex:none;transition:transform 300ms var(--spring)}
.nav-end{display:flex;align-items:center;gap:18px;font-size:14px;min-width:0}
.nav-end>a:not(.btn){color:var(--muted);text-decoration:none}
.account{color:var(--muted);max-width:22ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:760px){.nav-end>a:not(.btn),.account{display:none}.brand span{display:none}}
form.inline{display:inline-flex;align-items:center;gap:10px;margin:0}

/* Theme toggle: shows the sun in dark and the moon in light, like the café's. */
.theme{display:inline-flex;margin:0}
.chth-apps>summary{background:var(--soft);color:var(--ink);border-color:var(--line)}
.chth-theme{background:var(--soft);color:var(--ink);border-color:var(--line)}.chth-theme .chth-theme__sun{color:var(--accent)}

.btn{font:inherit;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:12px 20px;border-radius:999px;border:1px solid transparent;cursor:pointer;text-decoration:none;white-space:nowrap;color:var(--ink);background:var(--soft);transition:transform 160ms var(--ease-out),box-shadow 200ms ease,background-color 150ms ease,border-color 150ms ease,color 150ms ease}
.btn:active:not(:disabled){transform:scale(.97)}
.btn.cf{background:linear-gradient(180deg,#f6a24c,#f38020);color:#1a0f05;box-shadow:0 10px 30px -12px rgba(243,128,32,.7),inset 0 1px 0 rgba(255,255,255,.35)}
.btn.ghost{border-color:var(--line);background:transparent}
.btn.danger{background:#c8372a;color:#fff}
.btn.small{padding:8px 14px;font-size:14px}
.btn svg{width:20px;height:20px;flex:none}

.kicker{font:600 13px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.display{font-family:var(--serif);font-weight:600;letter-spacing:-.025em;text-wrap:balance}
.display em{font-style:italic;background:linear-gradient(100deg,var(--em1),var(--em2) 45%,var(--em3));-webkit-background-clip:text;background-clip:text;color:transparent}
.muted{color:var(--muted)}
code{font-family:var(--mono);font-size:.9em;overflow-wrap:anywhere}

.card{border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,var(--panel2),var(--panel));padding:24px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font:600 12px system-ui,sans-serif;white-space:nowrap}
.pill.live{color:var(--mint);background:color-mix(in srgb,var(--mint) 14%,transparent)}.pill.warn{color:var(--warn);background:color-mix(in srgb,var(--warn) 14%,transparent)}.pill.red{color:var(--red);background:color-mix(in srgb,var(--red) 13%,transparent)}
.dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}
.dot.ping{box-shadow:0 0 0 0 color-mix(in srgb,currentColor 60%,transparent);animation:ping 2s infinite}
@keyframes ping{70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}

.notice{border-radius:14px;padding:12px 16px;font-size:15px;border:1px solid var(--line);animation:drop 260ms var(--ease-out) backwards}
.notice.error{border-color:color-mix(in srgb,var(--red) 50%,transparent);color:var(--red);background:color-mix(in srgb,var(--red) 7%,transparent)}
.notice.ok{border-color:color-mix(in srgb,var(--mint) 50%,transparent);color:var(--mint);background:color-mix(in srgb,var(--mint) 7%,transparent)}
@keyframes drop{from{opacity:0;transform:translateY(-6px)}}

.field{display:grid;gap:6px;font-size:14px;font-weight:600}.field .hint{font-weight:400;color:var(--dim)}
.field input,.field select{font:inherit;font-weight:400;width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--field);color:var(--ink);outline:none;transition:border-color 150ms ease,box-shadow 150ms ease}
.field input:focus,.field select:focus{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}
.check{display:flex;gap:12px;align-items:flex-start;font-size:15px;cursor:pointer}.check input{margin-top:5px;accent-color:var(--accent);width:16px;height:16px}

details>summary{cursor:pointer}
details::details-content{height:0;overflow:clip;transition:height 250ms var(--ease-out),content-visibility 250ms allow-discrete}
details[open]::details-content{height:auto}

/* The shared CHTH footer and navbar language menu, in this page's colors */
:root[data-chth-product]{--chth-product-accent:var(--accent);--chth-line:var(--line);--chth-menu-bg:var(--panel);--chth-menu-ink:var(--ink)}
.chth-footer{margin-top:auto;color:var(--muted)}
.chth-lang-menu>summary{background:var(--soft);color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}

@media (hover:hover) and (pointer:fine){
  a:hover{color:var(--accent2)}
  .nav-end>a:not(.btn):hover{color:var(--ink)}
  .brand:hover svg{transform:rotate(-8deg) scale(1.06)}
  .btn.cf:hover{box-shadow:0 14px 40px -10px rgba(243,128,32,.9),inset 0 1px 0 rgba(255,255,255,.35)}
  .btn.ghost:hover{border-color:var(--line2);background:var(--soft)}
  .btn.danger:hover{background:#ad2c21}
  .chth-theme:hover{background:var(--soft2);border-color:var(--line2)}
}

/* Page changes crossfade; a theme change spreads out of the toggle, which sits at the right end of the nav. */
@view-transition{navigation:auto}
::view-transition-old(root){animation:vt-out 150ms ease-out both}
::view-transition-new(root){animation:vt-in 220ms var(--ease-out) both}
@keyframes vt-out{to{opacity:0}}@keyframes vt-in{from{opacity:0}}
:root[data-theme-switch]::view-transition-old(root),.chth-theme-switching::view-transition-old(root),.chth-theme-switching::view-transition-new(root){animation:none}
:root[data-theme-switch]::view-transition-new(root){animation:vt-reveal 400ms var(--ease-out) both}
@keyframes vt-reveal{from{clip-path:circle(0 at calc(50% + min(50%,580px) - 40px) 32px)}to{clip-path:circle(150vmax at calc(50% + min(50%,580px) - 40px) 32px)}}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:1ms!important}
  html{scroll-behavior:auto}
  :root[data-theme-switch]::view-transition-new(root){animation:vt-in 200ms ease both!important}
}
`;

const CUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="9" fill="#e7a96b"/><path d="M8 13h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-5Z" fill="#100b08"/><path d="M21 15h1.5a2.5 2.5 0 0 1 0 5H21" stroke="#100b08" stroke-width="2"/><path d="M12 6c0 1.5 1.5 1.5 1.5 3M16 6c0 1.5 1.5 1.5 1.5 3" stroke="#100b08" stroke-width="1.6" stroke-linecap="round"/></svg>`;
/** Served at /favicon.svg and /favicon.ico. */
export const FAVICON = CUP_SVG;
export const CUP = raw(CUP_SVG.replace('<svg ', '<svg aria-hidden="true" '));
export const CLOUD = raw(`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 18.5H6.2a4.2 4.2 0 0 1-.6-8.36A6 6 0 0 1 17.1 8.6a4.95 4.95 0 0 1 .5 9.9Z"/></svg>`);

/**
 * The one script the CSP allows, pinned by its hash: switches the theme in place, without the reload
 * the form falls back to, and spreads it out from the toggle like the café's. It saves the same cookie.
 */
/** The pages' only script: the CHTH shell (theme toggle, and later the banner and notices). */
export const PAGE_SCRIPT = SHELL_JS;

let scriptHash: Promise<string> | null = null;
/** The CSP source that allows PAGE_SCRIPT and nothing else. */
export function themeScriptSource() {
  scriptHash ??= crypto.subtle.digest('SHA-256', new TextEncoder().encode(PAGE_SCRIPT))
    .then(digest => `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`);
  return scriptHash;
}

export const notice = (message?: string, tone: 'error' | 'ok' = 'error') =>
  message ? html`<div class="notice ${tone}" role="${tone === 'error' ? 'alert' : 'status'}">${message}</div>` : '';

export interface PageOptions {
  title: string;
  description?: string;
  styles?: string;
  /** Links shown before the sign-in button, for the landing page. */
  links?: View;
  signInHref?: string;
  /** Signed in: the account name and the CSRF token for signing out. */
  account?: string;
  csrf?: string;
  /** Off on pages that come from a form, such as a one-time setup link, which reloading would lose. */
  themeToggle?: boolean;
}

const TOGGLE = themeToggleModel('en');

export function page(body: View, options: PageOptions) {
  const end = options.csrf
    ? html`${options.account ? html`<span class="account">${options.account}</span>` : ''}<form class="inline" method="post" action="/signout"><input type="hidden" name="csrf" value="${options.csrf}"><button class="btn ghost small" type="submit">Sign out</button></form>`
    : options.signInHref ? html`<a class="btn cf small" href="${options.signInHref}">${CLOUD} Sign in</a>` : '';
  return html`<!doctype html>
<html lang="en" data-chth-product="cafe">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="same-origin">
${options.description ? html`<meta name="description" content="${options.description}">` : ''}
<meta name="theme-color" content="${THEME_COLORS.dark}" media="(prefers-color-scheme: dark)" data-chth-dark="${THEME_COLORS.dark}" data-chth-light="${THEME_COLORS.light}">
<meta name="theme-color" content="${THEME_COLORS.light}" media="(prefers-color-scheme: light)" data-chth-dark="${THEME_COLORS.dark}" data-chth-light="${THEME_COLORS.light}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_URL}">
<title>${options.title} · CHTH Café Cloud</title>
<style>${raw(BRAND_CSS)}${raw(BASE)}${raw(options.styles || '')}</style>
</head>
<body>
<nav class="top" aria-label="Main">
  <div class="wrap">
    <a class="brand" href="/">${CUP}<span>CHTH Café Cloud</span></a>
    <div class="nav-end">
      ${options.links || ''}${end}
      <!--chth-lang-->
      ${options.themeToggle === false ? '' : html`<form class="theme" method="post" action="/theme">
        <button class="chth-theme" data-chth-theme-toggle type="submit" name="theme" value="toggle" aria-label="${TOGGLE.label}" title="${TOGGLE.label}">${raw(TOGGLE.iconsSvg)}</button>
      </form>`}
      ${raw(appSwitcherHtml('en', 'cafe'))}
    </div>
  </div>
</nav>
${body}
<script>${raw(PAGE_SCRIPT)}</script>
${raw(footerHtml('en', 'cafe'))}
</body>
</html>`;
}

/** Applies the saved theme to a rendered page; without one, the page follows the system. */
export function applyTheme(document: string, theme: string | undefined, switched: boolean) {
  if (theme !== 'light' && theme !== 'dark') return document;
  return document
    .replace(/<html lang="([a-z]{2})"/, `<html lang="$1" data-theme="${theme}"${switched ? ' data-theme-switch' : ''}`)
    .replace(/<meta name="theme-color"[^>]*>\s*<meta name="theme-color"[^>]*>/, `<meta name="theme-color" content="${THEME_COLORS[theme]}" data-chth-dark="${THEME_COLORS.dark}" data-chth-light="${THEME_COLORS.light}">`);
}
