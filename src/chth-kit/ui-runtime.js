// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The browser side of the kit's content pieces (kit/src/controls.js, overlays.js, display.js,
// datepicker.js). Like shell-runtime.js, it is wired by data-chth-* attributes with listeners on
// the document, so the same markup works server-rendered or from React, and it runs once.
// It loads after the shell's script (shell.js imports both; SHELL_JS inlines both).

(function () {
  if (typeof window === 'undefined' || window.chthUi) return;
  var w = window, d = document, root = d.documentElement;
  var reduced = function () { return w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var lang = function (el) { var l = el && el.closest && el.closest('[lang]'); return (l ? l.getAttribute('lang') : root.lang) || 'en'; };
  var rtl = function (el) { return getComputedStyle(el || root).direction === 'rtl'; };
  var strings = function (el) { try { return JSON.parse(el.getAttribute('data-chth-i18n') || '{}'); } catch (e) { return {}; } };
  var fill = function (text, vars) { return String(text || '').replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }); };
  var num = function (n, el) { try { return new Intl.NumberFormat(lang(el)).format(n); } catch (e) { return String(n); } };
  var toast = function () { return w.chthShell && w.chthShell.toast; };

  // ---- Field counters ([data-chth-count]: "12/140" under the field) ----
  function count(input) {
    var field = input.closest('.chth-field');
    var out = field && field.querySelector('.chth-field__count');
    var max = parseInt(input.getAttribute('maxlength'), 10);
    if (!out || !max) return;
    var n = input.value.length;
    out.textContent = num(n, input) + '/' + num(max, input);
    out.classList.toggle('is-near', n >= max * 0.9);
  }
  d.addEventListener('input', function (e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-chth-count')) count(e.target); });

  // ---- Copy and share ----
  function copyText(text) {
    if (navigator.clipboard && w.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = d.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      d.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = d.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      ok ? resolve() : reject(new Error('copy'));
    });
  }
  function done(btn) {
    btn.classList.add('is-done');
    setTimeout(function () { btn.classList.remove('is-done'); }, 1600);
  }
  d.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-chth-copy], [data-chth-share]');
    if (!btn) return;
    var s = strings(btn);
    if (btn.hasAttribute('data-chth-share')) {
      var url = btn.getAttribute('data-chth-share');
      var data = { url: url, title: btn.getAttribute('data-chth-share-title') || d.title, text: btn.getAttribute('data-chth-share-text') || undefined };
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        navigator.share(data).catch(function () { /* closed the sheet */ });
        return;
      }
      copyText(url).then(function () { done(btn); toast() && toast().success(s.copied || 'Link copied'); }, function () { toast() && toast().danger(s.failed || 'Could not copy'); });
      return;
    }
    var from = btn.getAttribute('data-chth-copy-from');
    var src = from && d.querySelector(from);
    var text = src ? ('value' in src && src.value != null ? src.value : src.textContent) : btn.getAttribute('data-chth-copy');
    copyText(String(text || '')).then(function () { done(btn); toast() && toast().success(s.copied || 'Copied', { duration: 2000 }); }, function () { toast() && toast().danger(s.failed || 'Could not copy'); });
  });

  // ---- Dialogs and sheets ----
  function openDialog(id) {
    var dlg = typeof id === 'string' ? d.getElementById(id) : id;
    if (!dlg || dlg.open || !dlg.showModal) return;
    dlg.returnValue = '';
    dlg.showModal();
  }
  function closeDialog(id, value) {
    var dlg = typeof id === 'string' ? d.getElementById(id) : id;
    if (!dlg || !dlg.open) return;
    if (reduced()) return dlg.close(value);
    dlg.classList.add('is-closing');
    setTimeout(function () { dlg.classList.remove('is-closing'); dlg.style.transform = ''; dlg.close(value); }, 180);
  }
  d.addEventListener('click', function (e) {
    var opener = e.target.closest && e.target.closest('[data-chth-open]');
    if (opener) { e.preventDefault(); openDialog(opener.getAttribute('data-chth-open')); return; }
    var closer = e.target.closest && e.target.closest('[data-chth-close]');
    if (closer) { var dl = closer.closest('dialog'); if (dl) { e.preventDefault(); closeDialog(dl, closer.getAttribute('data-chth-close') || ''); } return; }
    // A click on the backdrop lands on the <dialog> itself, outside its frame
    if (e.target.matches && e.target.matches('dialog[data-chth-dialog]')) {
      var r = e.target.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialog(e.target, 'cancel');
    }
  });
  // The × and value="cancel" buttons submit the dialog's form: animate the close there too
  d.addEventListener('submit', function (e) {
    var dlg = e.target.closest && e.target.closest('dialog[data-chth-dialog]');
    if (!dlg || e.target.method !== 'dialog' || reduced()) return;
    e.preventDefault();
    closeDialog(dlg, e.submitter ? e.submitter.value : '');
  });
  // Sheets: drag the handle (or the head) down to close
  d.addEventListener('pointerdown', function (e) {
    var handle = e.target.closest && e.target.closest('[data-chth-sheet-handle], .chth-dialog--sheet .chth-dialog__head');
    if (!handle || (e.target.closest('button'))) return;
    var dlg = handle.closest('dialog');
    if (!dlg || !w.matchMedia('(max-width: 640px)').matches) return;
    var y0 = e.clientY, dy = 0, id = e.pointerId;
    dlg.classList.add('is-dragging');
    var move = function (ev) { if (ev.pointerId !== id) return; dy = Math.max(0, ev.clientY - y0); dlg.style.transform = 'translateY(' + dy + 'px)'; };
    var up = function (ev) {
      if (ev.pointerId !== id) return;
      d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up);
      dlg.classList.remove('is-dragging');
      if (dy > Math.min(120, dlg.offsetHeight * 0.3)) closeDialog(dlg, 'cancel');
      else dlg.style.transform = '';
    };
    d.addEventListener('pointermove', move); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
  });

  // ---- Tooltips ([data-chth-tip]) ----
  var tip = null, tipFor = null, tipTimer = 0;
  function tipEl() {
    if (tip) return tip;
    tip = d.createElement('div');
    tip.className = 'chth-tooltip chth-glass';
    tip.id = 'chth-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    d.body.appendChild(tip);
    return tip;
  }
  function place(el, anchor, gap) {
    var a = anchor.getBoundingClientRect(), r = el.getBoundingClientRect();
    var vw = root.clientWidth, vh = w.innerHeight;
    var top = a.top - r.height - gap, below = false;
    if (top < 8) { top = a.bottom + gap; below = true; }
    if (below && top + r.height > vh - 8) top = Math.max(8, vh - r.height - 8);
    var left = a.left + a.width / 2 - r.width / 2;
    left = Math.max(8, Math.min(vw - r.width - 8, left));
    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.classList.toggle('is-below', below);
  }
  function showTip(target) {
    var text = target.getAttribute('data-chth-tip');
    if (!text) return;
    var t = tipEl();
    t.textContent = text;
    t.hidden = false;
    t.style.top = '0px'; t.style.left = '0px';
    place(t, target, 8);
    tipFor = target;
    var by = (target.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (by.indexOf('chth-tooltip') < 0) target.setAttribute('aria-describedby', by.concat('chth-tooltip').join(' '));
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (!tipFor) return;
    var by = (tipFor.getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== 'chth-tooltip'; });
    if (by.length) tipFor.setAttribute('aria-describedby', by.join(' ')); else tipFor.removeAttribute('aria-describedby');
    tipFor = null;
    if (tip) tip.hidden = true;
  }
  d.addEventListener('mouseover', function (e) {
    var t = e.target.closest && e.target.closest('[data-chth-tip]');
    if (!t || t === tipFor) return;
    hideTip();
    tipTimer = setTimeout(function () { showTip(t); }, 380);
  });
  d.addEventListener('mouseout', function (e) {
    var t = e.target.closest && e.target.closest('[data-chth-tip]');
    if (t && !t.contains(e.relatedTarget)) hideTip();
  });
  d.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-chth-tip]'); if (t && t.matches(':focus-visible')) { hideTip(); showTip(t); } });
  d.addEventListener('focusout', function (e) { if (tipFor && e.target === tipFor) hideTip(); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
  w.addEventListener('scroll', hideTip, true);

  // ---- Popovers ([data-chth-popover]): placed under the button that opened them ----
  d.addEventListener('toggle', function (e) {
    var pop = e.target;
    if (!pop.matches || !pop.matches('[data-chth-popover]') || e.newState !== 'open') return;
    var trigger = d.querySelector('[popovertarget="' + pop.id + '"]');
    if (!trigger) return;
    var a = trigger.getBoundingClientRect(), r = pop.getBoundingClientRect();
    var vw = root.clientWidth, vh = w.innerHeight;
    var top = a.bottom + 6;
    if (top + r.height > vh - 8 && a.top - r.height - 6 > 8) top = a.top - r.height - 6;
    var end = pop.classList.contains('chth-popover--end') !== rtl(trigger);
    var left = end ? a.right - r.width : a.left;
    left = Math.max(8, Math.min(vw - r.width - 8, left));
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
  }, true);

  // ---- Tabs ([data-chth-tabset]) ----
  function line(set) {
    var list = set.querySelector('[role=tablist]');
    var tab = list && list.querySelector('[role=tab][aria-selected=true]');
    if (!tab) return;
    list.style.setProperty('--chth-tab-x', (tab.offsetLeft) + 'px');
    list.style.setProperty('--chth-tab-w', tab.offsetWidth + 'px');
    list.classList.add('is-ready');
  }
  function select(tab, focus) {
    var set = tab.closest('[data-chth-tabset]');
    var tabs = set.querySelectorAll('[role=tab]');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i] === tab;
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].tabIndex = on ? 0 : -1;
      var panel = d.getElementById(tabs[i].getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
    line(set);
    set.dispatchEvent(new CustomEvent('chth:tab', { bubbles: true, detail: { id: tab.getAttribute('data-chth-tab-id') } }));
  }
  d.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('[data-chth-tabset] [role=tab]');
    if (tab) select(tab, false);
  });
  d.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[data-chth-tabset] [role=tab]');
    if (!tab) return;
    var tabs = [].slice.call(tab.closest('[role=tablist]').querySelectorAll('[role=tab]:not([disabled])'));
    var i = tabs.indexOf(tab), next = -1, flip = rtl(tab) ? -1 : 1;
    if (e.key === 'ArrowRight') next = i + flip;
    else if (e.key === 'ArrowLeft') next = i - flip;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], true);
  });

  // ---- Segmented controls ([data-chth-seg]): the thumb slides to the chosen option ----
  function placeSeg(seg) {
    var thumb = seg.querySelector('.chth-seg__thumb');
    var on = seg.querySelector('input:checked');
    var face = on && on.nextElementSibling;
    if (!thumb || !face) { seg.classList.remove('is-ready'); return; }
    seg.style.setProperty('--chth-seg-x', face.offsetLeft + 'px');
    seg.style.setProperty('--chth-seg-w', face.offsetWidth + 'px');
    if (!seg.classList.contains('is-ready')) requestAnimationFrame(function () { seg.classList.add('is-ready'); });
  }
  d.addEventListener('change', function (e) { var seg = e.target.closest && e.target.closest('[data-chth-seg]'); if (seg) placeSeg(seg); });

  // ---- Chips: the × removes the chip ----
  d.addEventListener('click', function (e) {
    var x = e.target.closest && e.target.closest('[data-chth-chip-remove]');
    if (!x) return;
    var chip = x.closest('[data-chth-chip]');
    if (!chip) return;
    var parent = chip.parentElement;
    var next = chip.nextElementSibling || chip.previousElementSibling;
    var value = chip.getAttribute('data-chth-chip');
    chip.remove();
    var focus = next && next.querySelector('[data-chth-chip-remove]');
    if (focus) focus.focus();
    if (parent) parent.dispatchEvent(new CustomEvent('chth:chip-remove', { bubbles: true, detail: { value: value } }));
  });

  // ---- Avatars: a photo that fails to load shows the initials ----
  d.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.classList && img.classList.contains('chth-avatar__img')) img.closest('.chth-avatar').classList.add('is-broken');
  }, true);

  // ---- Onboarding checklist ----
  function completeStep(listId, stepId) {
    var list = typeof listId === 'string' ? d.querySelector('[data-chth-checklist="' + listId + '"]') : listId;
    if (!list) return;
    var step = list.querySelector('[data-chth-checklist-step="' + stepId + '"]');
    if (!step || step.classList.contains('is-done')) return;
    step.classList.add('is-done');
    var link = step.querySelector('.chth-checklist__text a');
    if (link) { var span = d.createElement('span'); span.textContent = link.textContent; link.replaceWith(span); }
    var steps = list.querySelectorAll('[data-chth-checklist-step]');
    var doneCount = list.querySelectorAll('[data-chth-checklist-step].is-done').length;
    var s = strings(list);
    var all = doneCount === steps.length;
    var status = list.querySelector('.chth-checklist__status');
    if (status) status.textContent = all ? s.allSet : fill(s.ofDone, { done: num(doneCount, list), total: num(steps.length, list) });
    var ring = list.querySelector('.chth-ring');
    if (ring) {
      ring.style.setProperty('--chth-ring', String(doneCount / steps.length));
      ring.setAttribute('aria-valuenow', String(doneCount));
      ring.classList.toggle('chth-ring--done', all);
      var label = ring.querySelector('.chth-ring__label');
      if (label) label.textContent = doneCount + '/' + steps.length;
    }
    if (all) {
      list.classList.add('is-complete');
      var title = list.querySelector('.chth-checklist__title');
      if (toast() && toast().milestone) toast().milestone(s.allSet, { detail: title ? title.textContent : '' });
    }
  }

  // ---- Date picker ([data-chth-date]) ----
  var DAY = 864e5;
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function fromIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], 12) : null; }
  function todayT() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12); }
  function fmt(box, opts) {
    var key = lang(box) + '|' + box.chthCal + '|' + JSON.stringify(opts);
    box.chthFmt = box.chthFmt || {};
    if (!box.chthFmt[key]) {
      var o = { timeZone: 'UTC' };
      for (var k in opts) o[k] = opts[k];
      try { box.chthFmt[key] = new Intl.DateTimeFormat(lang(box) + '-u-ca-' + box.chthCal, o); }
      catch (e) { box.chthFmt[key] = new Intl.DateTimeFormat('en', o); }
    }
    return box.chthFmt[key];
  }
  // Year, month and day in the box's calendar, in Latin digits, for the month arithmetic
  function ymd(box, t) {
    var f = box.chthParts || (box.chthParts = new Intl.DateTimeFormat('en-u-ca-' + box.chthCal + '-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' }));
    var out = {};
    f.formatToParts(t).forEach(function (p) { if (p.type === 'year' || p.type === 'month' || p.type === 'day') out[p.type] = parseInt(p.value, 10); });
    return out;
  }
  function monthStart(box, t) { return t - (ymd(box, t).day - 1) * DAY; }
  function monthLength(box, start) { var m = ymd(box, start).month, n = 1; while (n < 32 && ymd(box, start + n * DAY).month === m) n++; return n; }
  function firstDay(box) {
    var l = lang(box);
    try { var info = new Intl.Locale(l); info = info.getWeekInfo ? info.getWeekInfo() : info.weekInfo; if (info && info.firstDay) return info.firstDay % 7; } catch (e) { /* older browsers */ }
    return { fa: 6, ar: 6, ru: 1, es: 1 }[l.slice(0, 2)] || 0;
  }
  function enhance(box) {
    if (box.chthDate) return;
    var native = box.querySelector('.chth-date__native');
    var btn = box.querySelector('.chth-date__button');
    if (!native || !btn) return;
    box.chthDate = true;
    box.chthCal = box.getAttribute('data-chth-calendar') || 'gregory';
    box.classList.add('is-enhanced');
    btn.hidden = false;
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');
    paintValue(box);
  }
  function paintValue(box) {
    var native = box.querySelector('.chth-date__native');
    var text = box.querySelector('.chth-date__text');
    var btn = box.querySelector('.chth-date__button');
    var t = fromIso(native.value);
    text.textContent = t ? fmt(box, { dateStyle: 'medium' }).format(t) : strings(box).choose || '';
    btn.classList.toggle('is-empty', !t);
  }
  function closePicker(box, focusButton) {
    var panel = box.querySelector('.chth-date__panel');
    if (panel) panel.remove();
    box.classList.remove('is-open');
    var btn = box.querySelector('.chth-date__button');
    btn.setAttribute('aria-expanded', 'false');
    if (focusButton) btn.focus();
  }
  function choose(box, t) {
    var native = box.querySelector('.chth-date__native');
    native.value = t == null ? '' : iso(t);
    native.dispatchEvent(new Event('input', { bubbles: true }));
    native.dispatchEvent(new Event('change', { bubbles: true }));
    paintValue(box);
    closePicker(box, true);
  }
  function renderMonth(box, focusT) {
    var s = strings(box);
    var native = box.querySelector('.chth-date__native');
    var min = fromIso(native.min), max = fromIso(native.max), sel = fromIso(native.value), today = todayT();
    var start = monthStart(box, focusT), len = monthLength(box, start);
    var panel = box.querySelector('.chth-date__panel');
    if (!panel) {
      panel = d.createElement('div');
      panel.className = 'chth-date__panel chth-glass';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', s.choose || '');
      box.appendChild(panel);
    }
    var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    var html = '<div class="chth-date__head">'
      + '<button type="button" class="chth-date__nav chth-date__prev" data-chth-date-nav="-1" aria-label="' + (s.prev || '') + '"' + (min != null && start - DAY < min ? ' disabled' : '') + '>' + arrow + '</button>'
      + '<span class="chth-date__month" aria-live="polite">' + fmt(box, { month: 'long', year: 'numeric' }).format(start) + '</span>'
      + '<button type="button" class="chth-date__nav" data-chth-date-nav="1" aria-label="' + (s.next || '') + '"' + (max != null && start + len * DAY > max ? ' disabled' : '') + '>' + arrow + '</button></div>'
      + '<div class="chth-date__grid" role="grid">';
    var fd = firstDay(box), wd = fmt(box, { weekday: 'narrow' });
    for (var i = 0; i < 7; i++) html += '<span class="chth-date__wd" aria-hidden="true">' + wd.format(Date.UTC(2024, 0, 7 + ((fd + i) % 7), 12)) + '</span>';
    var lead = (new Date(start).getUTCDay() - fd + 7) % 7;
    for (var j = 0; j < lead; j++) html += '<span></span>';
    var dayF = fmt(box, { day: 'numeric' }), fullF = fmt(box, { dateStyle: 'full' });
    for (var k = 0; k < len; k++) {
      var t = start + k * DAY;
      var off = (min != null && t < min) || (max != null && t > max);
      html += '<button type="button" class="chth-date__day' + (t === today ? ' is-today' : '') + '" data-chth-date-day="' + t + '"'
        + ' aria-label="' + fullF.format(t) + '"' + (t === sel ? ' aria-pressed="true"' : '') + (t === today ? ' aria-current="date"' : '')
        + ' tabindex="' + (t === focusT ? 0 : -1) + '"' + (off ? ' disabled' : '') + '>' + dayF.format(t) + '</button>';
    }
    html += '</div><div class="chth-date__foot">'
      + '<button type="button" class="chth-date__link" data-chth-date-today' + ((min != null && today < min) || (max != null && today > max) ? ' disabled' : '') + '>' + (s.today || '') + '</button>'
      + (native.required ? '' : '<button type="button" class="chth-date__link" data-chth-date-clear>' + (s.clear || '') + '</button>') + '</div>';
    panel.innerHTML = html;
    box.chthFocus = focusT;
    // Above the field when there's no room below
    var r = box.getBoundingClientRect();
    panel.classList.toggle('is-up', r.bottom + panel.offsetHeight + 12 > w.innerHeight && r.top > panel.offsetHeight + 12);
  }
  function focusDay(box, t) {
    var native = box.querySelector('.chth-date__native');
    var min = fromIso(native.min), max = fromIso(native.max);
    if (min != null && t < min) t = min;
    if (max != null && t > max) t = max;
    var btn = box.querySelector('[data-chth-date-day="' + t + '"]');
    if (!btn) { renderMonth(box, t); btn = box.querySelector('[data-chth-date-day="' + t + '"]'); }
    if (!btn) return;
    var cur = box.querySelectorAll('.chth-date__day[tabindex="0"]');
    for (var i = 0; i < cur.length; i++) cur[i].tabIndex = -1;
    btn.tabIndex = 0;
    btn.focus();
    box.chthFocus = t;
  }
  function openPicker(box) {
    var native = box.querySelector('.chth-date__native');
    var t = fromIso(native.value) || todayT();
    box.classList.add('is-open');
    box.querySelector('.chth-date__button').setAttribute('aria-expanded', 'true');
    renderMonth(box, t);
    var day = box.querySelector('.chth-date__day[tabindex="0"]') || box.querySelector('.chth-date__day:not([disabled])');
    if (day) day.focus();
  }
  // Same day in the month before or after (or its last day)
  function shiftMonth(box, t, dir) {
    var day = ymd(box, t).day, start = monthStart(box, t);
    var other = dir < 0 ? monthStart(box, start - DAY) : start + monthLength(box, start) * DAY;
    return other + (Math.min(day, monthLength(box, other)) - 1) * DAY;
  }
  d.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-chth-date]');
    var openBoxes = d.querySelectorAll('[data-chth-date].is-open');
    for (var i = 0; i < openBoxes.length; i++) if (openBoxes[i] !== el) closePicker(openBoxes[i], false);
    if (!el) return;
    var t = e.target;
    if (t.closest('.chth-date__button')) { el.classList.contains('is-open') ? closePicker(el, false) : openPicker(el); return; }
    var nav = t.closest('[data-chth-date-nav]');
    if (nav) { renderMonth(el, shiftMonth(el, el.chthFocus, +nav.getAttribute('data-chth-date-nav'))); return; }
    var day = t.closest('[data-chth-date-day]');
    if (day) { choose(el, +day.getAttribute('data-chth-date-day')); return; }
    if (t.closest('[data-chth-date-today]')) { choose(el, todayT()); return; }
    if (t.closest('[data-chth-date-clear]')) choose(el, null);
  });
  d.addEventListener('keydown', function (e) {
    var box = e.target.closest && e.target.closest('[data-chth-date].is-open');
    if (!box) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(box, true); return; }
    if (!e.target.matches('.chth-date__day')) return;
    var t = +e.target.getAttribute('data-chth-date-day'), flip = rtl(box) ? -1 : 1, next = null;
    if (e.key === 'ArrowRight') next = t + flip * DAY;
    else if (e.key === 'ArrowLeft') next = t - flip * DAY;
    else if (e.key === 'ArrowDown') next = t + 7 * DAY;
    else if (e.key === 'ArrowUp') next = t - 7 * DAY;
    else if (e.key === 'PageDown') next = shiftMonth(box, t, 1);
    else if (e.key === 'PageUp') next = shiftMonth(box, t, -1);
    else if (e.key === 'Home') next = monthStart(box, t);
    else if (e.key === 'End') next = monthStart(box, t) + (monthLength(box, monthStart(box, t)) - 1) * DAY;
    if (next == null) return;
    e.preventDefault();
    focusDay(box, next);
  });
  d.addEventListener('focusout', function (e) {
    var box = e.target.closest && e.target.closest('[data-chth-date].is-open');
    if (box && e.relatedTarget && !box.contains(e.relatedTarget)) closePicker(box, false);
  });
  // A value set from outside (a reset, the page's code) shows on the button
  d.addEventListener('change', function (e) { var b = e.target.closest && e.target.closest('[data-chth-date]'); if (b && b.chthDate) paintValue(b); });
  d.addEventListener('reset', function (e) { setTimeout(function () { var bs = e.target.querySelectorAll('[data-chth-date]'); for (var i = 0; i < bs.length; i++) if (bs[i].chthDate) paintValue(bs[i]); }); });

  // ---- Start: enhance what's on the page now and what arrives later ----
  function scan(scope) {
    var s = scope && scope.querySelectorAll ? scope : d;
    var dates = s.querySelectorAll('[data-chth-date]');
    for (var i = 0; i < dates.length; i++) enhance(dates[i]);
    var sets = s.querySelectorAll('[data-chth-tabset]');
    for (var j = 0; j < sets.length; j++) line(sets[j]);
    if (s.matches && s.matches('[data-chth-seg]')) placeSeg(s);
    var segs = s.querySelectorAll('[data-chth-seg]');
    for (var q = 0; q < segs.length; q++) placeSeg(segs[q]);
    var counted = s.querySelectorAll('[data-chth-count]');
    for (var k = 0; k < counted.length; k++) count(counted[k]);
    var imgs = s.querySelectorAll('img.chth-avatar__img');
    for (var m = 0; m < imgs.length; m++) if (imgs[m].complete && !imgs[m].naturalWidth) imgs[m].closest('.chth-avatar').classList.add('is-broken');
  }
  function start() {
    scan(d);
    if (w.MutationObserver) {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i].addedNodes.length; j++) {
          var n = list[i].addedNodes[j];
          if (n.nodeType === 1 && !(n.classList && (n.classList.contains('chth-date__panel') || n.classList.contains('chth-tooltip')))) scan(n.parentNode || n);
        }
      }).observe(d.body, { childList: true, subtree: true });
    }
    var resize = function () {
      var sets = d.querySelectorAll('[data-chth-tabset]'); for (var i = 0; i < sets.length; i++) line(sets[i]);
      var segs = d.querySelectorAll('[data-chth-seg]'); for (var j = 0; j < segs.length; j++) placeSeg(segs[j]);
    };
    if (w.ResizeObserver) new ResizeObserver(resize).observe(root); else w.addEventListener('resize', resize);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(resize);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();

  w.chthUi = { openDialog: openDialog, closeDialog: closeDialog, completeStep: completeStep, scan: scan };
})();
