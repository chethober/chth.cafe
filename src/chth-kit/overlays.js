// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// Overlays: dialogs (a bottom sheet on phones), tooltips and popovers, all in the kit's glass.
// They're built on the browser's own <dialog> and popover, so focus, Escape and the backdrop
// come from the browser; the shell's script opens them from buttons, closes a dialog on a click
// outside or a drag down, and places tooltips and popovers next to what they belong to.

import { translator } from './locales.js';
import { UI_STRINGS } from './ui-strings.js';
import { ICON, attr, cls, esc } from './html.js';

// ---- Dialog and sheet ----

/**
 * A modal dialog. On phones (640px and under) a `sheet` rises from the bottom and can be dragged
 * down to close. `body` and `actions` are trusted HTML (the kit's buttons, say); a button with
 * value="cancel" or a [data-chth-close] closes it. Open it with a button carrying
 * data-chth-open="<id>", or openDialog(id) from shell.js. Closing fires the dialog's own `close`
 * event, with `returnValue` set to the value of the button that closed it.
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ id: string, title: string, description?: string, body?: string, actions?: string, sheet?: boolean, size?: 'sm'|'md'|'lg', className?: string }} opts
 */
export function dialogModel(locale, opts) {
  const t = translator(UI_STRINGS, locale);
  return {
    id: opts.id,
    className: cls(`chth-dialog chth-glass chth-dialog--${opts.size ?? 'md'}${opts.sheet ? ' chth-dialog--sheet' : ''}`, opts.className),
    title: opts.title, titleId: `${opts.id}-title`,
    description: opts.description ?? null, descriptionId: opts.description ? `${opts.id}-desc` : null,
    body: opts.body ?? '', actions: opts.actions ?? '',
    sheet: !!opts.sheet, close: t('close'), closeSvg: ICON.x,
  };
}

export function dialogHtml(locale, opts) {
  const m = dialogModel(locale, opts);
  return `<dialog id="${esc(m.id)}" class="${m.className}" data-chth-dialog aria-labelledby="${esc(m.titleId)}"${attr('aria-describedby', m.descriptionId)}>`
    + `<form method="dialog" class="chth-dialog__frame">`
    + (m.sheet ? '<span class="chth-dialog__handle" data-chth-sheet-handle aria-hidden="true"></span>' : '')
    + `<header class="chth-dialog__head"><h2 class="chth-dialog__title" id="${esc(m.titleId)}">${esc(m.title)}</h2>`
    + `<button type="submit" value="cancel" class="chth-dialog__close" aria-label="${esc(m.close)}" formnovalidate>${m.closeSvg}</button></header>`
    + (m.description ? `<p class="chth-dialog__desc" id="${esc(m.descriptionId)}">${esc(m.description)}</p>` : '')
    + `<div class="chth-dialog__body">${m.body}</div>`
    + (m.actions ? `<footer class="chth-dialog__actions">${m.actions}</footer>` : '')
    + '</form></dialog>';
}

/** The attribute that makes a button open dialog `id`: ` data-chth-open="id"`. */
export const opensDialog = (id) => ` data-chth-open="${esc(id)}" aria-haspopup="dialog"`;

// ---- Tooltip ----

/**
 * The attribute that gives an element a tooltip: a short label in the glass, above it (below
 * when there's no room), on hover after a moment or straight away on keyboard focus. For
 * icon-only buttons and small notes; a tooltip never holds anything you'd need to click.
 * Returns ` data-chth-tip="…"` to put in a tag (React: { 'data-chth-tip': text }).
 */
export const tooltipAttr = (text) => ` data-chth-tip="${esc(text)}"`;

// ---- Popover ----

/**
 * A small panel that opens from a button and closes on a click outside or Escape: a menu of
 * actions, a help note, a filter. It uses the browser's popover (the top layer, no z-index
 * fights); the script places it under its button, flipping above or across when it would go
 * off screen. `content` is trusted HTML; `trigger` is the button's label (or pass
 * `triggerHtml` for your own button contents).
 * @param {{ id: string, trigger?: string, triggerHtml?: string, triggerClass?: string, content: string, label?: string, align?: 'start'|'end', className?: string }} opts
 */
export function popoverModel(opts) {
  return {
    id: opts.id,
    className: cls(`chth-popover chth-glass${opts.align === 'end' ? ' chth-popover--end' : ''}`, opts.className),
    trigger: opts.trigger ?? '', triggerHtml: opts.triggerHtml ?? null,
    triggerClass: opts.triggerClass ?? 'chth-btn chth-btn--secondary chth-btn--md',
    label: opts.label ?? null, content: opts.content,
  };
}

export function popoverHtml(opts) {
  const m = popoverModel(opts);
  return `<button type="button" class="${esc(m.triggerClass)}" popovertarget="${esc(m.id)}" aria-haspopup="true">${m.triggerHtml ?? esc(m.trigger)}</button>`
    + `<div id="${esc(m.id)}" class="${m.className}" popover data-chth-popover${attr('aria-label', m.label)}>${m.content}</div>`;
}
