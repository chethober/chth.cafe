// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The date picker: the browser's own date field, which the shell's script turns into a calendar
// in the page's language and calendar (Solar Hijri for Persian pages, or wherever asked). The
// field underneath keeps the value as an ISO date (2026-11-11), so forms and servers never deal
// with calendars. Without the script it is just the browser's date field.

import { translator } from './locales.js';
import { UI_STRINGS } from './ui-strings.js';
import { ICON, attr, cls, esc } from './html.js';

/** Which calendar a locale shows by default: Solar Hijri for Persian, Gregorian otherwise. */
export const calendarFor = (locale) => (locale === 'fa' ? 'persian' : 'gregory');

/** A date (an ISO yyyy-mm-dd string) as the page's language and calendar write it. */
export function formatDate(iso, locale = 'en', calendar = calendarFor(locale), style = 'medium') {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return '';
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], 12);
  try {
    return new Intl.DateTimeFormat(`${locale}-u-ca-${calendar}`, { dateStyle: style, timeZone: 'UTC' }).format(t);
  } catch {
    return iso;
  }
}

/**
 * @param {'en'|'fa'|'ar'|'ru'|'es'} locale
 * @param {{ name: string, id?: string, value?: string, min?: string, max?: string, calendar?: 'auto'|'gregory'|'persian', label?: string, placeholder?: string, required?: boolean, disabled?: boolean, time?: { name: string, value?: string, step?: number }, className?: string }} opts
 */
export function datePickerModel(locale, opts) {
  const t = translator(UI_STRINGS, locale);
  const calendar = !opts.calendar || opts.calendar === 'auto' ? calendarFor(locale) : opts.calendar;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(opts.value ?? '') ? opts.value : '';
  return {
    className: cls('chth-date', opts.className), calendar,
    input: { name: opts.name, id: opts.id ?? null, value, min: opts.min ?? null, max: opts.max ?? null, required: !!opts.required, disabled: !!opts.disabled, label: opts.label ?? t('chooseDate') },
    text: value ? formatDate(value, locale, calendar) : opts.placeholder ?? t('chooseDate'),
    empty: !value,
    time: opts.time ? { name: opts.time.name, value: opts.time.value ?? '', step: opts.time.step ?? null, label: t('time') } : null,
    strings: { choose: opts.placeholder ?? t('chooseDate'), prev: t('prevMonth'), next: t('nextMonth'), today: t('today'), clear: t('clear') },
    icon: ICON.calendar, chevron: ICON.chevron,
  };
}

export function datePickerHtml(locale, opts) {
  const m = datePickerModel(locale, opts);
  const i = m.input;
  return `<div class="${m.className}" data-chth-date data-chth-calendar="${esc(m.calendar)}" data-chth-i18n="${esc(JSON.stringify(m.strings))}">`
    + `<input type="date" class="chth-input chth-date__native"${attr('id', i.id)} name="${esc(i.name)}"${attr('value', i.value || null)}${attr('min', i.min)}${attr('max', i.max)}${attr('required', i.required)}${attr('disabled', i.disabled)} aria-label="${esc(i.label)}">`
    + `<button type="button" class="chth-input chth-date__button${m.empty ? ' is-empty' : ''}" aria-haspopup="dialog" aria-label="${esc(i.label)}"${attr('disabled', i.disabled)} hidden>`
    + `<span class="chth-date__icon" aria-hidden="true">${m.icon}</span><span class="chth-date__text">${esc(m.text)}</span></button>`
    + (m.time ? `<input type="time" class="chth-input chth-date__time" name="${esc(m.time.name)}"${attr('value', m.time.value || null)}${attr('step', m.time.step)}${attr('disabled', i.disabled)} aria-label="${esc(m.time.label)}">` : '')
    + '</div>';
}
