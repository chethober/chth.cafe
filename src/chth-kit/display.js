// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Display: badges, chips, avatars (and stacks of them), in-page tabs, and the onboarding
// checklist. The shell's script switches tabs (with the arrow keys too), removes chips, swaps a
// broken avatar photo for initials, and ticks checklist steps.

import { translator } from './locales.js';
import { UI_STRINGS } from './ui-strings.js';
import { ICON, cls, esc, uid } from './html.js';
import { ringHtml } from './ui.js';

// ---- Badge ----

/**
 * A small label for a status or a count: "Live", "Low stock", "PR", "3". `tone` colours it
 * (neutral, accent, success, warning, danger, info); `dot` puts a dot before the text.
 * @param {{ label: string|number, tone?: 'neutral'|'accent'|'success'|'warning'|'danger'|'info', dot?: boolean, solid?: boolean, className?: string }} opts
 */
export function badgeHtml(opts) {
  const tone = opts.tone ?? 'neutral';
  return `<span class="${cls(`chth-badge chth-badge--${tone}${opts.solid ? ' chth-badge--solid' : ''}`, opts.className)}">`
    + (opts.dot ? '<span class="chth-badge__dot" aria-hidden="true"></span>' : '') + `${esc(opts.label)}</span>`;
}

// ---- Chip ----

/**
 * A chip. With `name`, it's a filter you can toggle (a checkbox, so it submits and works
 * without a script). With `removable`, it has an × that removes it and fires `chth:chip-remove`
 * on its parent with { value } (tags, chosen filters, recipients).
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ label: string, value?: string, name?: string, selected?: boolean, removable?: boolean, icon?: string, count?: number, className?: string }} opts
 */
export function chipModel(locale, opts) {
  const t = translator(UI_STRINGS, locale);
  return {
    className: cls(`chth-chip${opts.removable ? ' chth-chip--removable' : ''}`, opts.className),
    label: opts.label, value: opts.value ?? opts.label, name: opts.name ?? null,
    selected: !!opts.selected, removable: !!opts.removable, icon: opts.icon ?? null,
    count: opts.count ?? null, removeLabel: t('remove', { name: opts.label }), removeSvg: ICON.x,
  };
}

export function chipHtml(locale, opts) {
  const m = chipModel(locale, opts);
  const inner = (m.icon ? `<span class="chth-chip__icon" aria-hidden="true">${m.icon}</span>` : '')
    + `<span class="chth-chip__label">${esc(m.label)}</span>`
    + (m.count != null ? `<span class="chth-chip__count">${esc(m.count)}</span>` : '');
  if (m.name) {
    return `<label class="${m.className}"><input type="checkbox" class="chth-sr-only" name="${esc(m.name)}" value="${esc(m.value)}"${m.selected ? ' checked' : ''}>${inner}</label>`;
  }
  return `<span class="${m.className}" data-chth-chip="${esc(m.value)}">${inner}`
    + (m.removable ? `<button type="button" class="chth-chip__remove" data-chth-chip-remove aria-label="${esc(m.removeLabel)}">${m.removeSvg}</button>` : '')
    + '</span>';
}

// ---- Avatar ----

/** One or two letters for a name, in its own script: "Cheth Ober" → "CO", "علی رضایی" → "ع‌ر". */
export function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = (w) => Array.from(w)[0] ?? '';
  const out = words.length === 1 ? first(words[0]) : first(words[0]) + (/[؀-ۿ]/.test(words[0]) ? '‌' : '') + first(words[words.length - 1]);
  return out.toUpperCase();
}

/** A hue from 0 to 359 that is always the same for the same name. */
export function nameHue(name) {
  let h = 0;
  for (const ch of String(name ?? '')) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

/**
 * A round avatar: the photo, or the person's initials on a colour that comes from their name
 * (also when the photo fails to load). `status` adds a dot (online, away, busy, offline).
 * @param {{ name: string, src?: string, size?: 'xs'|'sm'|'md'|'lg'|'xl', status?: 'online'|'away'|'busy'|'offline', className?: string }} opts
 */
export function avatarModel(opts) {
  return {
    className: cls(`chth-avatar chth-avatar--${opts.size ?? 'md'}`, opts.className),
    name: opts.name, initials: initials(opts.name), hue: nameHue(opts.name),
    src: opts.src ?? null, status: opts.status ?? null,
  };
}

export function avatarHtml(opts) {
  const m = avatarModel(opts);
  return `<span class="${m.className}" style="--chth-avatar-hue:${m.hue}" role="img" aria-label="${esc(m.name)}">`
    + `<span class="chth-avatar__initials" aria-hidden="true">${esc(m.initials)}</span>`
    + (m.src ? `<img class="chth-avatar__img" src="${esc(m.src)}" alt="" loading="lazy" decoding="async">` : '')
    + (m.status ? `<span class="chth-avatar__status chth-avatar__status--${esc(m.status)}" aria-hidden="true"></span>` : '')
    + '</span>';
}

/**
 * Overlapping avatars, then "+N" for the rest: who's on shift, who joined, who reviewed.
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ people: { name: string, src?: string }[], max?: number, size?: 'xs'|'sm'|'md'|'lg', label?: string, className?: string }} opts
 */
export function avatarGroupHtml(locale, opts) {
  const t = translator(UI_STRINGS, locale);
  const max = opts.max ?? 4;
  const shown = opts.people.slice(0, max);
  const rest = opts.people.length - shown.length;
  const names = opts.people.map((p) => p.name).join(', ');
  return `<span class="${cls(`chth-avatars chth-avatars--${opts.size ?? 'md'}`, opts.className)}" role="group" aria-label="${esc(opts.label ? `${opts.label}: ${names}` : names)}">`
    + shown.map((p) => avatarHtml({ ...p, size: opts.size ?? 'md' }).replace(' role="img"', ' aria-hidden="true"')).join('')
    + (rest > 0 ? `<span class="chth-avatar chth-avatar--${opts.size ?? 'md'} chth-avatar--more" aria-hidden="true" title="${esc(t('more', { count: rest }))}">+${new Intl.NumberFormat(locale).format(rest)}</span>` : '')
    + '</span>';
}

// ---- Tabs ----

/**
 * Tabs inside a page (the shell's tab bar is for moving between pages). A tablist with an
 * underline that slides to the chosen tab, and its panels. Arrow keys move between tabs (the
 * right way round in RTL), Home and End jump to the ends. Switching fires `chth:tab` with
 * { id } on the tabs. `panel` is trusted HTML.
 * @param {{ id: string, label: string, tabs: { id: string, label: string, panel: string, count?: number }[], selected?: string, className?: string }} opts
 */
export function tabsModel(opts) {
  const selected = opts.selected ?? opts.tabs[0]?.id;
  return {
    id: opts.id, label: opts.label,
    className: cls('chth-tabset', opts.className),
    tabs: opts.tabs.map((tab) => ({ ...tab, tabId: `${opts.id}-tab-${tab.id}`, panelId: `${opts.id}-panel-${tab.id}`, selected: tab.id === selected, count: tab.count ?? null })),
  };
}

export function tabsHtml(opts) {
  const m = tabsModel(opts);
  return `<div class="${m.className}" id="${esc(m.id)}" data-chth-tabset>`
    + `<div class="chth-tabset__list" role="tablist" aria-label="${esc(m.label)}">`
    + m.tabs.map((tab) => `<button type="button" role="tab" class="chth-tabset__tab" id="${esc(tab.tabId)}" aria-controls="${esc(tab.panelId)}" aria-selected="${tab.selected}" tabindex="${tab.selected ? 0 : -1}" data-chth-tab-id="${esc(tab.id)}">${esc(tab.label)}${tab.count != null ? ` <span class="chth-tabset__count">${esc(tab.count)}</span>` : ''}</button>`).join('')
    + '<span class="chth-tabset__line" aria-hidden="true"></span></div>'
    + m.tabs.map((tab) => `<div class="chth-tabset__panel" role="tabpanel" id="${esc(tab.panelId)}" aria-labelledby="${esc(tab.tabId)}" tabindex="0"${tab.selected ? '' : ' hidden'}>${tab.panel}</div>`).join('')
    + '</div>';
}

// ---- Onboarding checklist ----

/**
 * A card of first steps (log a first workout, publish the menu, add a product) with a progress
 * ring and "2 of 4 done". It closes for good with its × (like the banner) until the steps
 * change, and once every step is done it says so. `completeStep(id, stepId)` in shell.js ticks a
 * step on the page and celebrates the last one with a milestone toast. A step can link
 * somewhere (`href`) or carry a short `hint`.
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ id: string, title: string, steps: { id: string, label: string, hint?: string, href?: string, done?: boolean }[], dismissible?: boolean, className?: string }} opts
 */
export function checklistModel(locale, opts) {
  const t = translator(UI_STRINGS, locale);
  const fmt = (n) => new Intl.NumberFormat(locale).format(n);
  const done = opts.steps.filter((s) => s.done).length;
  const total = opts.steps.length;
  return {
    id: opts.id, className: cls(`chth-checklist chth-glass${done === total ? ' is-complete' : ''}`, opts.className),
    title: opts.title, done, total,
    status: done === total ? t('allSet') : t('ofDone', { done: fmt(done), total: fmt(total) }),
    dismissible: opts.dismissible !== false,
    // Dismissed until the list of steps changes
    version: uid('v', opts.steps.map((s) => s.id).join('|')),
    strings: { ofDone: t('ofDone'), allSet: t('allSet') },
    close: t('close'), closeSvg: ICON.x, checkSvg: ICON.check,
    steps: opts.steps.map((s) => ({ ...s, done: !!s.done, hint: s.hint ?? null, href: s.href ?? null })),
  };
}

export function checklistHtml(locale, opts) {
  const m = checklistModel(locale, opts);
  return `<section class="${m.className}" id="${esc(m.id)}" data-chth-checklist="${esc(m.id)}" aria-labelledby="${esc(m.id)}-title"`
    + (m.dismissible ? ` data-chth-dismiss="checklist-${esc(m.id)}" data-chth-dismiss-id="${esc(m.version)}" hidden` : '')
    + ` data-chth-i18n="${esc(JSON.stringify(m.strings))}">`
    + `<header class="chth-checklist__head">${ringHtml(locale, { value: m.done, max: m.total, label: `${m.done}/${m.total}`, size: 'sm', title: m.status })}`
    + `<div class="chth-checklist__titles"><h2 class="chth-checklist__title" id="${esc(m.id)}-title">${esc(m.title)}</h2><p class="chth-checklist__status" aria-live="polite">${esc(m.status)}</p></div>`
    + (m.dismissible ? `<button type="button" class="chth-checklist__close" data-chth-dismiss-close aria-label="${esc(m.close)}">${m.closeSvg}</button>` : '')
    + '</header><ol class="chth-checklist__steps">'
    + m.steps.map((s) => `<li class="chth-checklist__step${s.done ? ' is-done' : ''}" data-chth-checklist-step="${esc(s.id)}">`
      + `<span class="chth-checklist__check" aria-hidden="true">${m.checkSvg}</span>`
      + `<span class="chth-checklist__text">${s.href && !s.done ? `<a href="${esc(s.href)}">${esc(s.label)}</a>` : `<span>${esc(s.label)}</span>`}`
      + `<span class="chth-sr-only">${s.done ? ' ✓' : ''}</span>`
      + (s.hint ? `<small>${esc(s.hint)}</small>` : '') + '</span></li>').join('')
    + '</ol></section>';
}

