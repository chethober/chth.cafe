// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Controls: buttons, text fields and selects, segmented controls, switches, ratings, and copy
// and share buttons. Each is a real form control (or a link), so it works and submits without a
// script; the shell's script adds the character counter and copying and sharing.

import { translator } from './locales.js';
import { UI_STRINGS } from './ui-strings.js';
import { ICON, attr, attrs, cls, esc, uid } from './html.js';

// ---- Button ----

/**
 * A button (or a link styled as one). `variant`: primary (the product accent), secondary
 * (outlined), ghost (no frame) or danger. `icon` is trusted inline SVG; with `iconOnly` the
 * label becomes its accessible name. `loading` shows a spinner, keeps the width and sets
 * aria-busy; a loading or disabled button can't be pressed.
 * @param {{ label: string, variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md'|'lg', icon?: string, iconEnd?: boolean, iconOnly?: boolean, href?: string, type?: 'button'|'submit'|'reset', loading?: boolean, disabled?: boolean, block?: boolean, id?: string, name?: string, value?: string, className?: string, attrs?: Record<string, string|boolean> }} opts
 */
export function buttonModel(opts) {
  const variant = opts.variant ?? 'secondary';
  const size = opts.size ?? 'md';
  return {
    tag: opts.href && !opts.disabled ? 'a' : 'button',
    className: cls(`chth-btn chth-btn--${variant} chth-btn--${size}${opts.iconOnly ? ' chth-btn--icon' : ''}${opts.block ? ' chth-btn--block' : ''}${opts.loading ? ' is-loading' : ''}`, opts.className),
    label: opts.label,
    icon: opts.icon ?? null,
    iconEnd: !!opts.iconEnd,
    iconOnly: !!opts.iconOnly,
    href: opts.href ?? null,
    type: opts.type ?? 'button',
    disabled: !!opts.disabled || !!opts.loading,
    loading: !!opts.loading,
    id: opts.id ?? null, name: opts.name ?? null, value: opts.value ?? null,
    attrs: opts.attrs ?? {},
  };
}

export function buttonHtml(opts) {
  const m = buttonModel(opts);
  const icon = m.icon ? `<span class="chth-btn__icon" aria-hidden="true">${m.icon}</span>` : '';
  const label = m.iconOnly ? '' : `<span class="chth-btn__label">${esc(m.label)}</span>`;
  const inner = m.iconEnd ? label + icon : icon + label;
  const common = `${attr('id', m.id)} class="${m.className}"${m.iconOnly ? attr('aria-label', m.label) + attr('title', m.label) : ''}${m.loading ? ' aria-busy="true"' : ''}${attrs(m.attrs)}`;
  if (m.tag === 'a') return `<a${common} href="${esc(m.href)}">${inner}</a>`;
  return `<button type="${esc(m.type)}"${common}${attr('name', m.name)}${attr('value', m.value)}${attr('disabled', m.disabled)}>${inner}</button>`;
}

// ---- Field (text, email, password, number, url, search, tel, textarea, select) ----

/**
 * A labelled field: the label, the control, a hint, an error and, with `maxLength`, a live
 * character counter. The hint and error are tied to the control (aria-describedby) and an error
 * sets aria-invalid. Optional fields say so after the label unless `required` is set.
 * `options` makes it a select: [{ value, label, disabled? }].
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ label: string, name: string, id?: string, type?: 'text'|'email'|'password'|'number'|'url'|'search'|'tel'|'textarea'|'select', value?: string, placeholder?: string, hint?: string, error?: string, required?: boolean, showOptional?: boolean, maxLength?: number, rows?: number, options?: { value: string, label: string, disabled?: boolean }[], autocomplete?: string, inputMode?: string, disabled?: boolean, readOnly?: boolean, className?: string }} opts
 */
export function fieldModel(locale, opts) {
  const t = translator(UI_STRINGS, locale);
  const id = opts.id ?? uid('chth-f', opts.name);
  const type = opts.options ? 'select' : opts.type ?? 'text';
  const value = String(opts.value ?? '');
  return {
    className: cls(`chth-field${opts.error ? ' is-invalid' : ''}`, opts.className),
    id, type, value,
    label: opts.label,
    optional: !opts.required && opts.showOptional !== false ? t('optional') : null,
    hint: opts.hint ? { id: `${id}-hint`, text: opts.hint } : null,
    error: opts.error ? { id: `${id}-error`, text: opts.error } : null,
    count: opts.maxLength ? { id: `${id}-count`, max: opts.maxLength, text: `${value.length}/${opts.maxLength}` } : null,
    control: {
      name: opts.name, placeholder: opts.placeholder ?? null, required: !!opts.required, maxLength: opts.maxLength ?? null,
      rows: opts.rows ?? 4, autocomplete: opts.autocomplete ?? null, inputMode: opts.inputMode ?? null,
      disabled: !!opts.disabled, readOnly: !!opts.readOnly, options: opts.options ?? null,
    },
  };
}

export function fieldHtml(locale, opts) {
  const m = fieldModel(locale, opts);
  const c = m.control;
  const described = [m.hint?.id, m.error?.id].filter(Boolean).join(' ') || null;
  const common = `class="chth-${m.type === 'select' ? 'select' : m.type === 'textarea' ? 'textarea' : 'input'}" id="${esc(m.id)}"${attr('name', c.name)}${attr('required', c.required)}${attr('disabled', c.disabled)}${attr('aria-describedby', described)}${attr('aria-invalid', m.error ? 'true' : null)}`;
  let control;
  if (m.type === 'select') {
    control = `<span class="chth-select-wrap"><select ${common}>${(c.options || []).map((o) => `<option value="${esc(o.value)}"${o.value === m.value ? ' selected' : ''}${o.disabled ? ' disabled' : ''}>${esc(o.label)}</option>`).join('')}</select></span>`;
  } else if (m.type === 'textarea') {
    control = `<textarea ${common}${attr('rows', c.rows)}${attr('maxlength', c.maxLength)}${attr('placeholder', c.placeholder)}${attr('readonly', c.readOnly)}${m.count ? ' data-chth-count' : ''}>${esc(m.value)}</textarea>`;
  } else {
    control = `<input ${common} type="${esc(m.type)}"${attr('value', m.value || null)}${attr('maxlength', c.maxLength)}${attr('placeholder', c.placeholder)}${attr('autocomplete', c.autocomplete)}${attr('inputmode', c.inputMode)}${attr('readonly', c.readOnly)}${m.count ? ' data-chth-count' : ''}>`;
  }
  return `<div class="${m.className}">`
    + `<label class="chth-field__label" for="${esc(m.id)}">${esc(m.label)}${m.optional ? ` <span class="chth-field__optional">(${esc(m.optional)})</span>` : ''}</label>`
    + control
    + (m.hint || m.count ? `<div class="chth-field__meta">${m.hint ? `<p class="chth-field__hint" id="${esc(m.hint.id)}">${esc(m.hint.text)}</p>` : '<span></span>'}${m.count ? `<span class="chth-field__count" id="${esc(m.count.id)}" aria-hidden="true">${esc(m.count.text)}</span>` : ''}</div>` : '')
    + (m.error ? `<p class="chth-field__error" id="${esc(m.error.id)}">${esc(m.error.text)}</p>` : '')
    + '</div>';
}

// ---- Segmented control ----

/**
 * A row of mutually exclusive choices (week | month | year, list | grid). Radio buttons under
 * the hood, so it submits and works with arrow keys without a script.
 * @param {{ name: string, label: string, options: { value: string, label: string, icon?: string }[], value?: string, size?: 'sm'|'md', block?: boolean, className?: string }} opts
 */
export function segmentedModel(opts) {
  const value = opts.value ?? opts.options[0]?.value;
  return {
    className: cls(`chth-seg${opts.size === 'sm' ? ' chth-seg--sm' : ''}${opts.block ? ' chth-seg--block' : ''}`, opts.className),
    name: opts.name, label: opts.label,
    options: opts.options.map((o) => ({ ...o, icon: o.icon ?? null, checked: o.value === value })),
  };
}

export function segmentedHtml(opts) {
  const m = segmentedModel(opts);
  return `<div class="${m.className}" role="radiogroup" aria-label="${esc(m.label)}">`
    + m.options.map((o) => `<label class="chth-seg__item"><input type="radio" name="${esc(m.name)}" value="${esc(o.value)}"${o.checked ? ' checked' : ''}>`
      + `<span>${o.icon ? `<span class="chth-seg__icon" aria-hidden="true">${o.icon}</span>` : ''}${esc(o.label)}</span></label>`).join('')
    + '</div>';
}

// ---- Switch ----

/**
 * An on/off switch for a setting that applies straight away. A checkbox with role="switch",
 * so screen readers say on/off and forms submit it.
 * @param {{ label: string, name?: string, id?: string, checked?: boolean, disabled?: boolean, hint?: string, value?: string, className?: string }} opts
 */
export function switchModel(opts) {
  const id = opts.id ?? uid('chth-sw', opts.name ?? opts.label);
  return {
    className: cls('chth-switch', opts.className), id,
    label: opts.label, hint: opts.hint ? { id: `${id}-hint`, text: opts.hint } : null,
    name: opts.name ?? null, value: opts.value ?? null, checked: !!opts.checked, disabled: !!opts.disabled,
  };
}

export function switchHtml(opts) {
  const m = switchModel(opts);
  return `<label class="${m.className}" for="${esc(m.id)}">`
    + `<span class="chth-switch__text"><span class="chth-switch__label">${esc(m.label)}</span>${m.hint ? `<span class="chth-switch__hint" id="${esc(m.hint.id)}">${esc(m.hint.text)}</span>` : ''}</span>`
    + `<input type="checkbox" role="switch" class="chth-switch__input" id="${esc(m.id)}"${attr('name', m.name)}${attr('value', m.value)}${attr('checked', m.checked)}${attr('disabled', m.disabled)}${attr('aria-describedby', m.hint?.id)}>`
    + '<span class="chth-switch__track" aria-hidden="true"><span class="chth-switch__thumb"></span></span></label>';
}

// ---- Rating ----

/**
 * Stars. With `name`, it's an input: radio buttons, one per star, that light up to the one
 * hovered or chosen, and submit the number. Without `name` (or `readOnly`), it shows a score,
 * halves included (4.5), and says "4.5 out of 5".
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ value?: number, max?: number, name?: string, readOnly?: boolean, label?: string, size?: 'sm'|'md'|'lg', count?: number, required?: boolean, className?: string }} opts
 */
export function ratingModel(locale, opts = {}) {
  const t = translator(UI_STRINGS, locale);
  const max = opts.max ?? 5;
  const value = Math.max(0, Math.min(max, Number(opts.value) || 0));
  const readOnly = opts.readOnly || !opts.name;
  const fmt = (n) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  return {
    className: cls(`chth-rating chth-rating--${opts.size ?? 'md'}${readOnly ? ' is-readonly' : ''}`, opts.className),
    readOnly, max, value, name: opts.name ?? null, required: !!opts.required,
    label: opts.label ?? null,
    summary: t('outOf', { value: fmt(value), max: fmt(max) }),
    fill: `${(value / max) * 100}%`,
    count: opts.count != null ? fmt(opts.count) : null,
    stars: Array.from({ length: max }, (_, i) => ({ value: i + 1, label: i === 0 ? t('star') : t('stars', { count: fmt(i + 1) }), checked: Math.round(value) === i + 1 })),
  };
}

export function ratingHtml(locale, opts = {}) {
  const m = ratingModel(locale, opts);
  const stars = ICON.star.repeat(m.max);
  if (m.readOnly) {
    return `<span class="${m.className}" role="img" aria-label="${esc(m.label ? `${m.label}: ${m.summary}` : m.summary)}">`
      + `<span class="chth-rating__stars" aria-hidden="true"><span class="chth-rating__base">${stars}</span><span class="chth-rating__fill" style="width:${m.fill}">${stars}</span></span>`
      + (m.count ? `<span class="chth-rating__count">(${esc(m.count)})</span>` : '') + '</span>';
  }
  // Highest first with row-reverse, so "this star and the ones before it" is a CSS sibling rule.
  return `<fieldset class="${m.className}"><legend class="chth-sr-only">${esc(m.label ?? m.summary)}</legend><span class="chth-rating__input">`
    + [...m.stars].reverse().map((s) => `<input type="radio" class="chth-sr-only" id="${esc(uid('chth-r', `${m.name}-${s.value}`))}" name="${esc(m.name)}" value="${s.value}"${s.checked ? ' checked' : ''}${m.required ? ' required' : ''}>`
      + `<label for="${esc(uid('chth-r', `${m.name}-${s.value}`))}" title="${esc(s.label)}"><span class="chth-sr-only">${esc(s.label)}</span>${ICON.star}</label>`).join('')
    + '</span></fieldset>';
}

// ---- Copy and share ----

/** `url` with ?ref=<ref> added, so a shared link is counted (the hub's campaign links). */
export function withRef(url, ref) {
  if (!ref) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('ref', ref);
    return u.toString();
  } catch {
    return url + (url.includes('?') ? '&' : '?') + 'ref=' + encodeURIComponent(ref);
  }
}

/**
 * A button that copies `text` (or the value or text of the element `from` points at, a CSS
 * selector), then shows a tick and says "Copied".
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ text?: string, from?: string, label?: string, iconOnly?: boolean, variant?: 'primary'|'secondary'|'ghost', size?: 'sm'|'md'|'lg', className?: string }} opts
 */
export function copyButtonHtml(locale, opts = {}) {
  const t = translator(UI_STRINGS, locale);
  return buttonHtml({
    label: opts.label ?? t('copy'), icon: ICON.copy, iconOnly: opts.iconOnly, variant: opts.variant ?? 'secondary', size: opts.size ?? 'sm',
    className: cls('chth-copy', opts.className),
    attrs: { 'data-chth-copy': opts.text ?? '', 'data-chth-copy-from': opts.from ?? null, 'data-chth-i18n': JSON.stringify({ copied: t('copied'), failed: t('copyFailed') }) },
  });
}

/**
 * A button that opens the device's share sheet for `url` (with ?ref= when `ref` is given), or
 * copies the link where there isn't one (most desktops) and says so.
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ url: string, title?: string, text?: string, ref?: string, label?: string, iconOnly?: boolean, variant?: 'primary'|'secondary'|'ghost', size?: 'sm'|'md'|'lg', className?: string }} opts
 */
export function shareButtonHtml(locale, opts) {
  const t = translator(UI_STRINGS, locale);
  return buttonHtml({
    label: opts.label ?? t('share'), icon: ICON.share, iconOnly: opts.iconOnly, variant: opts.variant ?? 'secondary', size: opts.size ?? 'sm',
    className: cls('chth-share', opts.className),
    attrs: { 'data-chth-share': withRef(opts.url, opts.ref), 'data-chth-share-title': opts.title ?? null, 'data-chth-share-text': opts.text ?? null, 'data-chth-i18n': JSON.stringify({ copied: t('linkCopied'), failed: t('copyFailed') }) },
  });
}
