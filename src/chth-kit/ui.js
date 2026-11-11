// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Content pieces: what goes inside a site's pages, as opposed to the shell around them. Like the
// shell, each comes as *Html() for server-rendered pages and *Model() for React, with the same
// classes. Styles are in brand.css. Each works without a script (a ring by --chth-ring, a stepper
// as a number field, an upload area as a file field); the shell's script, already on every CHTH
// page, adds the rest (stepping, drag and drop, the file list) through data-chth-* attributes, so
// React markup gets it too. Milestones are toast.milestone() in shell.js.

import { translator } from './locales.js';
import { UI_STRINGS } from './ui-strings.js';

export { UI_STRINGS };

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

// ---- Stepper ----

const MINUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

/**
 * A number field with − and + on either side: reps, weight, servings, quantity. It is a real
 * <input type="number">, so it types, submits and validates like one. The shell's script makes
 * the buttons step by `step` (Shift: ten steps), repeat while held, stop at `min`/`max`, and fire
 * the input's own `input` and `change` events, so a React onChange sees every step.
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ value?: number|string, min?: number, max?: number, step?: number, name?: string, id?: string, label?: string, unit?: string, size?: 'sm'|'md', disabled?: boolean, className?: string }} opts
 */
export function stepperModel(locale, opts = {}) {
  const t = translator(UI_STRINGS, locale);
  const value = opts.value ?? '';
  const n = Number(value);
  const has = value !== '' && Number.isFinite(n);
  const what = opts.label ? ` ${opts.label}` : '';
  return {
    className: cls(`chth-stepper${opts.size === 'sm' ? ' chth-stepper--sm' : ''}`, opts.className),
    input: { type: 'number', inputMode: Number.isInteger(opts.step ?? 1) ? 'numeric' : 'decimal', value: has ? String(value) : '', min: opts.min ?? null, max: opts.max ?? null, step: opts.step ?? 1, name: opts.name ?? null, id: opts.id ?? null, disabled: !!opts.disabled, label: opts.label ?? null },
    label: opts.label ?? null,
    unit: opts.unit ?? null,
    decrease: { label: `${t('decrease')}${what}`, disabled: !!opts.disabled || (has && opts.min != null && n <= opts.min), svg: MINUS_SVG },
    increase: { label: `${t('increase')}${what}`, disabled: !!opts.disabled || (has && opts.max != null && n >= opts.max), svg: PLUS_SVG },
  };
}

export function stepperHtml(locale, opts = {}) {
  const m = stepperModel(locale, opts);
  const i = m.input;
  const attr = (k, v) => (v == null || v === false ? '' : v === true ? ` ${k}` : ` ${k}="${esc(v)}"`);
  const btn = (dir, b) => `<button type="button" class="chth-stepper__btn" data-chth-step="${dir}" aria-label="${esc(b.label)}"${b.disabled ? ' disabled' : ''}>${b.svg}</button>`;
  return `<div class="${m.className}" data-chth-stepper>`
    + btn(-1, m.decrease)
    + `<span class="chth-stepper__field"><input class="chth-stepper__input"${attr('type', i.type)}${attr('inputmode', i.inputMode)}${attr('value', i.value)}${attr('min', i.min)}${attr('max', i.max)}${attr('step', i.step)}${attr('name', i.name)}${attr('id', i.id)}${attr('aria-label', i.label)}${attr('disabled', i.disabled)}>`
    + (m.unit ? `<span class="chth-stepper__unit" aria-hidden="true">${esc(m.unit)}</span>` : '') + '</span>'
    + btn(1, m.increase) + '</div>';
}

// ---- Upload area ----

const UPLOAD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/></svg>';

/** "1.5 MB" for a byte count, in the page's digits. */
export function formatBytes(bytes, locale = 'en') {
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = Math.max(0, Number(bytes) || 0);
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: n < 10 && u > 0 ? 1 : 0 }).format(n);
  return `${num} ${units[u]}`;
}

/**
 * An upload area: drop files on it or click it to pick them. It is a <label> around a real
 * <input type="file">, so picking works without a script and the files submit with the form.
 * The shell's script adds dragging, checks `accept`, `maxSize` (bytes) and `maxFiles`, and lists
 * what was chosen (a thumbnail for images, the size, a remove button). The input keeps exactly
 * the accepted files and fires `change`; the area also fires `chth:files` with { files }.
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ name?: string, id?: string, accept?: string, multiple?: boolean, maxSize?: number, maxFiles?: number, title?: string, hint?: string, icon?: string, disabled?: boolean, className?: string }} opts
 */
export function dropzoneModel(locale, opts = {}) {
  const t = translator(UI_STRINGS, locale);
  const multiple = !!opts.multiple;
  const maxFiles = multiple ? opts.maxFiles ?? null : 1;
  const sizeText = opts.maxSize ? formatBytes(opts.maxSize, locale) : null;
  const kinds = (opts.accept || '').split(',').map((a) => a.trim()).filter(Boolean)
    .map((a) => (a.endsWith('/*') ? a.slice(0, -2) : a.replace(/^\./, '').replace(/^[a-z]+\//, '')).toUpperCase());
  const hint = opts.hint ?? [kinds.join(', '), sizeText && t('upTo', { size: sizeText })].filter(Boolean).join(' · ');
  const [before, after] = (opts.title ?? t(multiple ? 'dropMany' : 'dropOne')).split('{browse}');
  return {
    className: cls('chth-drop', opts.className),
    input: { type: 'file', name: opts.name ?? null, id: opts.id ?? null, accept: opts.accept ?? null, multiple, disabled: !!opts.disabled },
    maxSize: opts.maxSize ?? null,
    maxFiles,
    title: { before, browse: after === undefined ? '' : t('browse'), after: after ?? '' },
    hint,
    icon: opts.icon ?? UPLOAD_SVG,
    // What the script says about files, in the page's language
    strings: { remove: t('remove'), tooBig: t('tooBig'), wrongType: t('wrongType'), tooMany: t('tooMany') },
  };
}

export function dropzoneHtml(locale, opts = {}) {
  const m = dropzoneModel(locale, opts);
  const i = m.input;
  const attr = (k, v) => (v == null || v === false ? '' : v === true ? ` ${k}` : ` ${k}="${esc(v)}"`);
  return `<div class="${m.className}" data-chth-drop${attr('data-chth-max-size', m.maxSize)}${attr('data-chth-max-files', m.maxFiles)} data-chth-i18n="${esc(JSON.stringify(m.strings))}">`
    + `<label class="chth-drop__zone"><input class="chth-drop__input"${attr('type', i.type)}${attr('name', i.name)}${attr('id', i.id)}${attr('accept', i.accept)}${attr('multiple', i.multiple)}${attr('disabled', i.disabled)}>`
    + `<span class="chth-drop__icon" aria-hidden="true">${m.icon}</span>`
    + `<span class="chth-drop__title">${esc(m.title.before)}${m.title.browse ? `<u>${esc(m.title.browse)}</u>` : ''}${esc(m.title.after)}</span>`
    + (m.hint ? `<span class="chth-drop__hint">${esc(m.hint)}</span>` : '')
    + '</label><ul class="chth-drop__files" hidden></ul><p class="chth-drop__error" role="alert" hidden></p></div>';
}

// The other pieces live in their own modules; ui.js is the one import for all of them.
export * from './controls.js';
export * from './overlays.js';
export * from './display.js';
export * from './datepicker.js';
