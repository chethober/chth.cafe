import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { BRAND_CSS } from '../../src/chth-kit/brand.js';
import { cookieNoticeHtml, navbarHtml } from '../../src/chth-kit/shell.js';
import type { Locale } from '../../src/chth-kit/locales.js';
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
export const THEME_COLORS = { dark: '#0c0a09', light: '#fafaf9' } as const;

const DARK = '--bg:#0c0a09;--bg2:#141210;--panel:#1c1917;--panel2:#232120;--line:#2e2a27;--line2:#44403c;--ink:#fafaf9;--muted:#a8a29e;--dim:#78716c;--accent:var(--chth-cafe-accent);--accent2:var(--chth-cafe-accent-hover);--em1:#e7e5e4;--em2:#d6d3d1;--em3:#a8a29e;--mint:#5fd3a0;--red:#ff7a6b;--warn:#ffd28a;--field:#0c0a09;--shadow:rgba(0,0,0,.8);--glass:rgba(12,10,9,.72);--soft:rgba(255,255,255,.035);--soft2:rgba(255,255,255,.07);--chat:#20303f;--chat-line:#2d4357;--chat-meta:#8fb3d1;color-scheme:dark';
const LIGHT = '--bg:#fafaf9;--bg2:#f5f5f4;--panel:#ffffff;--panel2:#fafaf9;--line:#e7e5e4;--line2:#d6d3d1;--ink:#1c1917;--muted:#57534e;--dim:#78716c;--accent:var(--chth-cafe-accent);--accent2:var(--chth-cafe-accent-hover);--em1:#57534e;--em2:#44403c;--em3:#292524;--mint:#1d8a5a;--red:#c2412f;--warn:#8a5a00;--field:#ffffff;--shadow:rgba(28,25,23,.2);--glass:rgba(250,250,249,.8);--soft:rgba(28,25,23,.035);--soft2:rgba(28,25,23,.07);--chat:#e6f1fb;--chat-line:#c3dcf0;--chat-meta:#4f7799;color-scheme:light';

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

form.inline{display:inline-flex;align-items:center;gap:10px;margin:0}

/* The CHTH navbar and footer in this page's accent */
.chth-nav .chth-theme__sun{color:var(--accent)}

.btn{font:inherit;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:12px 20px;border-radius:999px;border:1px solid transparent;cursor:pointer;text-decoration:none;white-space:nowrap;color:var(--ink);background:var(--soft);transition:transform 160ms var(--ease-out),box-shadow 200ms ease,background-color 150ms ease,border-color 150ms ease,color 150ms ease}
.btn:active:not(:disabled){transform:scale(.97)}
.btn.cf{background:var(--accent);color:var(--chth-cafe-on-accent);box-shadow:0 10px 30px -14px color-mix(in srgb,var(--accent) 70%,transparent),inset 0 1px 0 rgba(255,255,255,.25)}
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
  .btn.cf:hover{background:var(--accent2);box-shadow:0 14px 40px -12px color-mix(in srgb,var(--accent) 80%,transparent),inset 0 1px 0 rgba(255,255,255,.25)}
  .btn.ghost:hover{border-color:var(--line2);background:var(--soft)}
  .btn.danger:hover{background:#ad2c21}
  .chth-theme:hover{background:var(--soft2);border-color:var(--line2)}
}

/* Page changes crossfade; a theme change spreads out of the toggle, in the navbar's right end. */
@view-transition{navigation:auto}
::view-transition-old(root){animation:vt-out 150ms ease-out both}
::view-transition-new(root){animation:vt-in 220ms var(--ease-out) both}
@keyframes vt-out{to{opacity:0}}@keyframes vt-in{from{opacity:0}}
:root[data-theme-switch]::view-transition-old(root),.chth-theme-switching::view-transition-old(root),.chth-theme-switching::view-transition-new(root){animation:none}
:root[data-theme-switch]::view-transition-new(root){animation:vt-reveal 400ms var(--ease-out) both}
@keyframes vt-reveal{from{clip-path:circle(0 at calc(50% + min(50%,32rem) - 60px) 40px)}to{clip-path:circle(150vmax at calc(50% + min(50%,32rem) - 60px) 40px)}}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:1ms!important}
  html{scroll-behavior:auto}
  :root[data-theme-switch]::view-transition-new(root){animation:vt-in 200ms ease both!important}
}
`;

const CUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="9" fill="#d6d3d1"/><path d="M8 13h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-5Z" fill="#0c0a09"/><path d="M21 15h1.5a2.5 2.5 0 0 1 0 5H21" stroke="#0c0a09" stroke-width="2"/><path d="M12 6c0 1.5 1.5 1.5 1.5 3M16 6c0 1.5 1.5 1.5 1.5 3" stroke="#0c0a09" stroke-width="1.6" stroke-linecap="round"/></svg>`;
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
  signInHref?: string;
  /** Signed in: the account name and the CSRF token for signing out. */
  account?: string;
  csrf?: string;
  /** Off on pages that come from a form, such as a one-time setup link, which reloading would lose. */
  themeToggle?: boolean;
  /** The navbar's language menu, on the pages that are translated (the landing). */
  languageMenu?: boolean;
}

/** What the navbar needs from a page, carried in a comment until the page's language is known. */
export interface NavSpec { signIn?: string; account?: string; csrf?: string; theme: boolean; language: boolean }

const LOGOUT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>';
const escAttr = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * The shared CHTH navbar for a page: the café words on the left (to How it works), the CHTH
 * mark in the middle, then the account (your cafés, or sign in), theme and language. Signed in,
 * a sign-out button comes first. The theme toggle is a form, so it works without the script.
 */
export function cafeNav(locale: Locale, spec: NavSpec) {
  const signOut = spec.csrf
    ? `<form class="chth-theme-form" method="post" action="/signout"><input type="hidden" name="csrf" value="${escAttr(spec.csrf)}"><button class="chth-nav__icon" type="submit" aria-label="Sign out" title="Sign out">${LOGOUT}</button></form>`
    : '';
  return navbarHtml(locale, 'cafe', {
    leadHref: '/#how',
    account: spec.csrf ? { href: '/dashboard', label: spec.account || 'Your cafés' } : { href: spec.signIn || '/#start', label: 'Sign in' },
    extra: signOut,
    theme: spec.theme,
    themeFormAction: '/theme',
    language: spec.language,
  });
}

/** Pages carry their navbar as <!--chth-nav …-->; the themed middleware renders it in the page's language. */
export const navSlot = (spec: NavSpec) => `<!--chth-nav ${encodeURIComponent(JSON.stringify(spec))}-->`;
export function fillNav(page: string, locale: Locale) {
  return page.replace(/<!--chth-nav ([^>]*?)-->/, (_, spec: string) => cafeNav(locale, JSON.parse(decodeURIComponent(spec)) as NavSpec));
}

export function page(body: View, options: PageOptions) {
  const nav: NavSpec = {
    signIn: options.signInHref, account: options.account, csrf: options.csrf,
    theme: options.themeToggle !== false, language: Boolean(options.languageMenu),
  };
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
${raw(navSlot(nav))}
${body}
${raw(cookieNoticeHtml('en'))}
<script>${raw(PAGE_SCRIPT)}</script>
<!--chth-footer-->
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
