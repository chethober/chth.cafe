// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Content pieces: what goes inside a site's pages, as opposed to the shell around them. Like the
// shell, each comes as *Html() for server-rendered pages and *Model() for React, with the same
// classes. Styles are in brand.css. Nothing here needs a script: a site updates a ring by
// setting --chth-ring (ringStyle()), and milestones are toast.milestone() in shell.js.

import { translator } from './locales.js';

export const UI_STRINGS = {
  loading: { en: 'Loading…', fa: 'در حال بارگذاری…', ar: 'جارٍ التحميل…', ru: 'Загрузка…', es: 'Cargando…' },
  progress: { en: 'Progress', fa: 'پیشرفت', ar: 'التقدّم', ru: 'Прогресс', es: 'Progreso' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cls = (base, extra) => (extra ? `${base} ${esc(extra)}` : base);

// ---- Empty state ----

/**
 * What to show where a list has nothing in it yet: an icon, a title, a line of help and one way
 * forward. `icon` is an emoji or inline SVG (trusted markup, like the kit's own icons); the
 * action is a link (`href`) or, without one, a button the page wires itself (`id`).
 * @param {{ icon?: string, title: string, text?: string, action?: { label: string, href?: string, id?: string } | null, compact?: boolean, className?: string }} opts
 */
export function emptyStateModel(opts) {
  return {
    className: cls(`chth-empty${opts.compact ? ' chth-empty--compact' : ''}`, opts.className),
    icon: opts.icon ?? '',
    title: opts.title,
    text: opts.text ?? '',
    action: opts.action?.label ? { label: opts.action.label, href: opts.action.href ?? null, id: opts.action.id ?? null } : null,
  };
}

export function emptyStateHtml(opts) {
  const m = emptyStateModel(opts);
  let action = '';
  if (m.action) {
    const id = m.action.id ? ` id="${esc(m.action.id)}"` : '';
    action = m.action.href
      ? `<a class="chth-empty__action" href="${esc(m.action.href)}"${id}>${esc(m.action.label)}</a>`
      : `<button type="button" class="chth-empty__action"${id}>${esc(m.action.label)}</button>`;
  }
  return `<div class="${m.className}">`
    + (m.icon ? `<div class="chth-empty__icon" aria-hidden="true">${m.icon}</div>` : '')
    + `<p class="chth-empty__title">${esc(m.title)}</p>`
    + (m.text ? `<p class="chth-empty__text">${esc(m.text)}</p>` : '')
    + action + '</div>';
}

// ---- Skeleton ----

/**
 * Placeholder shapes while content loads. `lines` text lines (the last one shorter), or one
 * `circle` or `block`. Screen readers hear "Loading…" once instead of the shapes; put
 * aria-busy="true" on the container being filled and drop it when the content arrives.
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ lines?: number, shape?: 'text'|'circle'|'block', width?: string, height?: string, className?: string }} [opts]
 */
export function skeletonHtml(locale, opts = {}) {
  const t = translator(UI_STRINGS, locale);
  const size = [opts.width && `width:${esc(opts.width)}`, opts.height && `height:${esc(opts.height)}`].filter(Boolean).join(';');
  const style = size ? ` style="${size}"` : '';
  const label = `<span class="chth-sr-only">${esc(t('loading'))}</span>`;
  if (opts.shape === 'circle' || opts.shape === 'block') {
    return `<span class="${cls(`chth-skeleton chth-skeleton--${opts.shape}`, opts.className)}"${style} role="status">${label}</span>`;
  }
  const n = Math.max(1, Math.min(12, Math.floor(opts.lines ?? 3)));
  return `<div class="${cls('chth-skeleton-lines', opts.className)}"${style} role="status">${label}`
    + '<span class="chth-skeleton" aria-hidden="true"></span>'.repeat(n) + '</div>';
}

// ---- Progress ring ----

/** The style that draws a ring at `value` of `max` (0–1 when max is left out). */
export function ringStyle(value, max = 1) {
  const v = max > 0 ? Math.min(1, Math.max(0, Number(value) / max)) : 0;
  return `--chth-ring:${Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0}`;
}

/**
 * A progress ring: a week's training days, the steps of a first menu, a goal. `label` sits in the
 * middle (the number, by default `value`); `title` is what a screen reader hears it as. A full
 * ring turns the success colour unless `done: false`.
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ value: number, max?: number, label?: string, title?: string, size?: 'sm'|'md'|'lg', done?: boolean, className?: string }} opts
 */
export function ringModel(locale, opts) {
  const max = opts.max ?? 1;
  const value = Math.min(max, Math.max(0, Number(opts.value) || 0));
  const full = value >= max && max > 0;
  const size = opts.size && opts.size !== 'md' ? ` chth-ring--${opts.size}` : '';
  return {
    className: cls(`chth-ring${size}${full && opts.done !== false ? ' chth-ring--done' : ''}`, opts.className),
    style: ringStyle(value, max),
    value, max,
    label: opts.label ?? String(value),
    title: opts.title ?? translator(UI_STRINGS, locale)('progress'),
    // pathLength=100 lets the CSS draw the arc from --chth-ring alone, at any size.
    svg: '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="chth-ring__track" cx="50" cy="50" r="42" pathLength="100"/>'
      + '<circle class="chth-ring__arc" cx="50" cy="50" r="42" pathLength="100"/></svg>',
  };
}

export function ringHtml(locale, opts) {
  const m = ringModel(locale, opts);
  return `<div class="${m.className}" style="${m.style}" role="progressbar" aria-valuemin="0" aria-valuemax="${m.max}" aria-valuenow="${m.value}" aria-label="${esc(m.title)}">`
    + `${m.svg}<span class="chth-ring__label" aria-hidden="true">${esc(m.label)}</span></div>`;
}
