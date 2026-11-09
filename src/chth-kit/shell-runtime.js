// Generated from the CHTH kit (chth.hub/kit) by `npm run sync`. Do not edit here: edit the kit and sync.
// The CHTH shell in the browser: the navbar, the theme toggle, toasts, the banner and the cookie notice.
// A classic script with no imports, so the same file runs inlined in a server-rendered page
// (SHELL_JS) and imported for its side effect by a React site. Everything is wired by
// delegated listeners on data-chth-* attributes, so markup can come from the server, React or
// both, and the script can load before or after it.

(function () {
  if (typeof window === 'undefined' || window.chthShell) return;
  var w = window, d = document, root = d.documentElement;
  var THEME_KEY = 'chth_theme';
  var reduced = function () { return w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var store = {
    get: function (k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { w.localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  // ---- Theme ----
  // The page's theme is on <html> three ways at once (data-theme, .dark/.light, color-scheme), so
  // every site's existing CSS keeps working whichever one it was written against.

  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    if (root.classList.contains('dark')) return 'dark';
    if (root.classList.contains('light')) return 'light';
    return w.matchMedia && w.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function paint(theme) {
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
    // <meta name="theme-color" data-chth-dark="#…" data-chth-light="#…"> follows the theme.
    var metas = d.querySelectorAll('meta[name="theme-color"][data-chth-' + theme + ']');
    for (var m = 0; m < metas.length; m++) { metas[m].removeAttribute('media'); metas[m].setAttribute('content', metas[m].getAttribute('data-chth-' + theme)); }
    var toggles = d.querySelectorAll('[data-chth-theme-toggle]');
    for (var i = 0; i < toggles.length; i++) toggles[i].setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  /**
   * Sets the theme, remembers it (localStorage, plus a cookie for server-rendered pages), and
   * tells the page (`chth:theme` on window, { theme }). A site with its own theme engine sets
   * window.chthApplyTheme(theme) and does the painting itself. With `origin` (an element), the
   * new theme spreads out from it in a circle.
   */
  function setTheme(theme, origin) {
    if (theme !== 'dark' && theme !== 'light') return;
    store.set(THEME_KEY, theme);
    try {
      d.cookie = THEME_KEY + '=' + theme + '; path=/; max-age=31536000; samesite=lax' + (location.protocol === 'https:' ? '; secure' : '');
    } catch (e) { /* sandboxed */ }
    var swap = function () {
      if (typeof w.chthApplyTheme === 'function') w.chthApplyTheme(theme);
      paint(theme);
      w.dispatchEvent(new CustomEvent('chth:theme', { detail: { theme: theme } }));
    };
    if (!origin || !d.startViewTransition || reduced()) return swap();
    var r = origin.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var radius = Math.hypot(Math.max(x, w.innerWidth - x), Math.max(y, w.innerHeight - y));
    root.classList.add('chth-theme-switching');
    var t = d.startViewTransition(swap);
    t.ready.then(function () {
      root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 420, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(function () {});
    t.finished.then(function () { root.classList.remove('chth-theme-switching'); }, function () { root.classList.remove('chth-theme-switching'); });
  }

  function toggleTheme(origin) { setTheme(currentTheme() === 'dark' ? 'light' : 'dark', origin); }

  // Another tab changed the theme.
  w.addEventListener('storage', function (e) {
    if (e.key === THEME_KEY && (e.newValue === 'dark' || e.newValue === 'light') && e.newValue !== currentTheme()) setTheme(e.newValue);
  });

  // ---- Toasts ----
  // One region per page, bottom centre (above the phone's home bar), newest at the bottom, at
  // most three. A toast closes itself after `duration` ms (0 keeps it), pauses while hovered or
  // focused, and shows the time left as a shrinking line. Screen readers hear it politely
  // (errors assertively).

  var ICONS = {
    success: '<path d="M20 6 9 17l-5-5"/>',
    danger: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    accent: '<path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1z"/>',
  };
  var KINDS = { success: 1, danger: 1, warning: 1, info: 1, accent: 1, error: 'danger', default: 'info' };
  var CLOSE = { en: 'Close', fa: 'بستن', ar: 'إغلاق', ru: 'Закрыть', es: 'Cerrar' };
  var seq = 0, live = {};

  function region() {
    var r = d.querySelector('.chth-toasts');
    if (!r) {
      r = d.createElement('section');
      r.className = 'chth-toasts';
      r.setAttribute('aria-label', 'Notifications');
      d.body.appendChild(r);
    }
    return r;
  }

  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  function close(id) {
    var t = live[id];
    if (!t) return;
    delete live[id];
    clearTimeout(t.timer);
    var el = t.el;
    if (t.onClose) try { t.onClose(); } catch (e) { /* the page's handler */ }
    if (reduced()) return el.remove();
    el.classList.add('chth-toast--out');
    setTimeout(function () { el.remove(); }, 200);
  }

  /**
   * Shows a toast and returns its id.
   * @param {string} message
   * @param {{ type?: 'success'|'danger'|'warning'|'info'|'accent', duration?: number,
   *   action?: { label: string, onClick?: Function }, onClose?: Function }} [opts]
   */
  function toast(message, opts) {
    opts = opts || {};
    if (!d.body) { d.addEventListener('DOMContentLoaded', function () { toast(message, opts); }); return null; }
    var kind = KINDS[opts.type] === 1 ? opts.type : (KINDS[opts.type] || 'info');
    var id = 'chth-toast-' + (++seq);
    var el = d.createElement('div');
    el.className = 'chth-toast chth-toast--' + kind;
    el.id = id;
    el.setAttribute('role', kind === 'danger' ? 'alert' : 'status');
    var icon = d.createElement('span');
    icon.className = 'chth-toast__icon';
    icon.innerHTML = svg(ICONS[kind]);
    var text = d.createElement('span');
    text.className = 'chth-toast__text';
    text.textContent = String(message == null ? '' : message);
    el.appendChild(icon);
    el.appendChild(text);
    if (opts.action && opts.action.label) {
      var act = d.createElement('button');
      act.type = 'button';
      act.className = 'chth-toast__action';
      act.textContent = opts.action.label;
      act.addEventListener('click', function () {
        if (opts.action.onClick) try { opts.action.onClick(); } catch (e) { /* the page's handler */ }
        close(id);
      });
      el.appendChild(act);
    }
    var x = d.createElement('button');
    x.type = 'button';
    x.className = 'chth-toast__close';
    var lang = (root.lang || 'en').slice(0, 2);
    x.setAttribute('aria-label', CLOSE[lang] || CLOSE.en);
    x.innerHTML = svg('<path d="M18 6 6 18M6 6l12 12"/>');
    x.addEventListener('click', function () { close(id); });
    el.appendChild(x);

    var duration = opts.duration == null ? (kind === 'danger' ? 6000 : 4000) : opts.duration;
    var t = live[id] = { el: el, onClose: opts.onClose, timer: 0, left: duration, started: 0 };
    if (duration > 0) {
      var bar = d.createElement('span');
      bar.className = 'chth-toast__time';
      bar.style.animationDuration = duration + 'ms';
      el.appendChild(bar);
      var run = function () { t.started = Date.now(); t.timer = setTimeout(function () { close(id); }, t.left); el.classList.remove('chth-toast--paused'); };
      var pause = function () { if (!live[id]) return; clearTimeout(t.timer); t.left -= Date.now() - t.started; el.classList.add('chth-toast--paused'); };
      el.addEventListener('mouseenter', pause);
      el.addEventListener('mouseleave', run);
      el.addEventListener('focusin', pause);
      el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget)) run(); });
      run();
    }
    var r = region();
    r.appendChild(el);
    var shown = r.querySelectorAll('.chth-toast:not(.chth-toast--out)');
    for (var i = 0; i < shown.length - 3; i++) close(shown[i].id);
    return id;
  }
  ['success', 'danger', 'warning', 'info', 'accent'].forEach(function (k) {
    toast[k] = function (message, opts) { var o = {}; for (var p in opts || {}) o[p] = opts[p]; o.type = k; return toast(message, o); };
  });
  toast.error = toast.danger;
  toast.close = close;

  // ---- Dismissable strips (the banner and the cookie notice) ----
  // <div data-chth-dismiss="key" data-chth-dismiss-id="version"> is removed for good once its
  // [data-chth-dismiss-close] is pressed, until the id changes.

  function applyDismissed(scope) {
    var els = (scope || d).querySelectorAll('[data-chth-dismiss]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], key = 'chth_dismissed_' + el.getAttribute('data-chth-dismiss');
      if (store.get(key) === (el.getAttribute('data-chth-dismiss-id') || '1')) el.remove();
      else el.removeAttribute('hidden');
    }
  }

  // ---- Wiring ----
  d.addEventListener('click', function (e) {
    var target = e.target && e.target.closest ? e.target : null;
    if (!target) return;
    var tg = target.closest('[data-chth-theme-toggle]');
    if (tg) { e.preventDefault(); toggleTheme(tg); return; }
    var dc = target.closest('[data-chth-dismiss-close]');
    if (dc) {
      var box = dc.closest('[data-chth-dismiss]');
      if (!box) return;
      e.preventDefault();
      store.set('chth_dismissed_' + box.getAttribute('data-chth-dismiss'), box.getAttribute('data-chth-dismiss-id') || '1');
      box.classList.add('chth-dismissing');
      setTimeout(function () { box.remove(); }, reduced() ? 0 : 220);
      return;
    }
    // The language menu closes when something outside it is clicked.
    var menus = d.querySelectorAll('details.chth-lang-menu[open]');
    for (var i = 0; i < menus.length; i++) if (!menus[i].contains(target)) menus[i].removeAttribute('open');
  });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = d.querySelector('details.chth-lang-menu[open]');
    if (open) { open.removeAttribute('open'); var s = open.querySelector('summary'); if (s) s.focus(); }
  });
  // Server-rendered strips are hidden until checked, so a dismissed one never flashes.
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { applyDismissed(); });
  else applyDismissed();
  if (w.MutationObserver) {
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i].addedNodes.length; j++) {
        var n = list[i].addedNodes[j];
        if (n.nodeType !== 1) continue;
        if (n.hasAttribute('data-chth-dismiss') || n.querySelector('[data-chth-dismiss]')) applyDismissed(n.parentNode || d);
        if (n.hasAttribute('data-chth-type') || n.querySelector('[data-chth-type]') || n.hasAttribute('data-chth-tabs') || n.querySelector('[data-chth-tabs]') || n.hasAttribute('data-chth-nav') || n.querySelector('[data-chth-nav]')) startNav(n.parentNode || d);
      }
    }).observe(root, { childList: true, subtree: true });
  }

  // ---- The navbar and tab bars: minimize on scroll ----
  // Scrolling down past the top minimizes [data-chth-nav] (.chth-nav--scrolled) and [data-chth-tabs]
  // (.chth-tabs--min); scrolling up brings them back, as on iOS. Small moves and the rubber band
  // past either end are ignored.

  var lastY = Math.max(0, w.scrollY || 0), minimized = false, scrollQueued = false;
  // How far the navbar's glass narrows when minimized, measured here so the CSS only has to clip
  // and translate (no layout while it animates). The narrow width: 88% of the room on phones,
  // else 56% (at least 36rem). Mirrors nothing in the CSS; change it here.
  function measureNav(nav) {
    var pill = nav.querySelector('.chth-nav__pill');
    if (!pill) return;
    var cs = w.getComputedStyle(nav);
    var room = nav.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var full = pill.offsetWidth;
    if (!full || room <= 0) return;
    var rem = parseFloat(w.getComputedStyle(d.documentElement).fontSize) || 16;
    var phone = w.matchMedia && w.matchMedia('(max-width: 640px)').matches;
    var narrow = Math.min(phone ? room * 0.88 : Math.max(36 * rem, room * 0.56), full);
    var dx = Math.max(0, (full - narrow) / 2);
    var rtl = w.getComputedStyle(pill).direction === 'rtl';
    nav.style.setProperty('--chth-nav-dx', dx.toFixed(1) + 'px');
    nav.style.setProperty('--chth-nav-shift', (rtl ? -dx : dx).toFixed(1) + 'px');
  }
  function setupNav(nav) {
    if (nav.chthNav) return;
    nav.chthNav = true;
    measureNav(nav);
    if (w.ResizeObserver) new ResizeObserver(function () { measureNav(nav); }).observe(nav);
    else w.addEventListener('resize', function () { measureNav(nav); });
  }
  function paintMinimized() {
    var navs = d.querySelectorAll('[data-chth-nav]');
    for (var i = 0; i < navs.length; i++) navs[i].classList.toggle('chth-nav--scrolled', minimized);
    var bars = d.querySelectorAll('[data-chth-tabs]');
    for (var j = 0; j < bars.length; j++) bars[j].classList.toggle('chth-tabs--min', minimized);
  }
  function onScroll() {
    scrollQueued = false;
    var max = Math.max(0, (d.documentElement.scrollHeight || 0) - w.innerHeight);
    var y = Math.min(Math.max(0, w.scrollY || 0), max);
    var dy = y - lastY;
    var next = minimized;
    if (y <= 40) next = false;
    else if (dy > 8) next = true;
    else if (dy < -8) next = false;
    if (y <= 40 || Math.abs(dy) > 8) lastY = y;
    if (next !== minimized) { minimized = next; paintMinimized(); }
  }
  // At most once a frame, however often the browser reports scrolling.
  w.addEventListener('scroll', function () {
    if (scrollQueued) return;
    scrollQueued = true;
    (w.requestAnimationFrame || setTimeout)(onScroll);
  }, { passive: true });

  // ---- Tab bars: the sliding highlight and finger scrubbing ----

  function setupTabs(bar) {
    if (bar.chthTabs) return;
    bar.chthTabs = true;
    var glider = bar.querySelector('.chth-tabs__glider');
    if (!glider) {
      glider = d.createElement('span');
      glider.className = 'chth-tabs__glider';
      glider.setAttribute('aria-hidden', 'true');
      bar.insertBefore(glider, bar.firstChild);
    }
    var items = function () { return [].slice.call(bar.querySelectorAll('[data-chth-tab]')); };
    var active = function () { return bar.querySelector('[data-chth-tab][aria-current="page"], [data-chth-tab].is-active'); };
    var scrubbing = false, startX = 0, pointer = null, hovered = null, suppressClick = false;
    // Positions come from layout (offsetLeft/offsetWidth), which minimizing and scrubbing never
    // change (they only transform), so the highlight isn't re-measured while anything animates.
    function place(item) {
      if (!item) { glider.style.opacity = '0'; return; }
      glider.style.opacity = '1';
      glider.style.width = item.offsetWidth + 'px';
      glider.style.transform = 'translateX(' + item.offsetLeft + 'px)';
    }
    // A pointer's x in the bar's own (untransformed) coordinates.
    function local(x) {
      var r = bar.getBoundingClientRect();
      return r.width ? (x - r.left) * (bar.offsetWidth / r.width) : 0;
    }
    // The labels' row (a label and the gap above it), which the glass loses when minimized.
    function measureTrim() {
      var label = bar.querySelector('[data-chth-tab] > .chth-tabs__label'), prev = label && label.previousElementSibling;
      if (!label || !prev || !label.offsetHeight) return;
      var trim = label.offsetTop + label.offsetHeight - (prev.offsetTop + prev.offsetHeight);
      if (trim > 0 && trim < bar.offsetHeight) bar.style.setProperty('--chth-tabs-trim', trim + 'px');
    }
    function settle() { if (!scrubbing) place(active()); }
    function itemAt(x) {
      var list = items(), lo = null, hi = null;
      for (var i = 0; i < list.length; i++) {
        var l = list[i].offsetLeft, r = l + list[i].offsetWidth;
        if (x >= l && x <= r) return list[i];
        if (!lo || l < lo.offsetLeft) lo = list[i];
        if (!hi || l > hi.offsetLeft) hi = list[i];
      }
      if (!lo) return null;
      return x < lo.offsetLeft ? lo : hi;
    }
    function follow(clientX) {
      var x = local(clientX), item = itemAt(x);
      if (!item) return;
      var w0 = item.offsetWidth * 1.08;
      var left = Math.min(Math.max(x - w0 / 2, 4), bar.offsetWidth - w0 - 4);
      glider.style.width = w0 + 'px';
      glider.style.transform = 'translateX(' + left + 'px)';
      if (item !== hovered) {
        if (hovered) hovered.classList.remove('is-scrub');
        hovered = item;
        item.classList.add('is-scrub');
        if (w.navigator.vibrate) try { w.navigator.vibrate(6); } catch (e) { /* not allowed */ }
      }
    }
    function end(go) {
      if (hovered) hovered.classList.remove('is-scrub');
      var target = hovered;
      if (scrubbing) {
        bar.classList.remove('chth-tabs--scrub');
        scrubbing = false;
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 60);
        if (go && target) target.click();
      }
      hovered = null; pointer = null;
      settle();
    }
    bar.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      pointer = e.pointerId; startX = e.clientX;
    });
    bar.addEventListener('pointermove', function (e) {
      if (pointer !== e.pointerId) return;
      if (!scrubbing && Math.abs(e.clientX - startX) > 8) {
        scrubbing = true;
        bar.classList.add('chth-tabs--scrub');
        try { bar.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
      }
      if (scrubbing) follow(e.clientX);
    });
    bar.addEventListener('pointerup', function (e) { if (pointer === e.pointerId) end(true); });
    bar.addEventListener('pointercancel', function () { end(false); });
    // The release of a scrub isn't also a tap on whatever was under it.
    bar.addEventListener('click', function (e) { if (suppressClick && e.isTrusted) { e.stopPropagation(); e.preventDefault(); } }, true);
    // Follow the page's own idea of the active tab, and changes of size (rotating, fonts).
    new MutationObserver(settle).observe(bar, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
    var resized = function () { measureTrim(); settle(); };
    if (w.ResizeObserver) new ResizeObserver(resized).observe(bar);
    else w.addEventListener('resize', resized);
    resized();
  }

  function typeWords(el) {
    if (el.chthTyping) return;
    var words;
    try { words = JSON.parse(el.getAttribute('data-chth-type') || '[]'); } catch (e) { return; }
    var out = el.querySelector('.chth-nav__type');
    if (!out || !words || words.length < 2) return;
    el.chthTyping = true;
    el.setAttribute('aria-label', words[0]);
    var i = 0, n = words[0].length, deleting = false;
    var source = el.getAttribute('data-chth-type');
    var tick = function () {
      if (!el.isConnected) { el.chthTyping = false; return; }
      // The page changed the words (a new language): start again with them.
      if (el.getAttribute('data-chth-type') !== source) {
        source = el.getAttribute('data-chth-type');
        try { words = JSON.parse(source || '[]'); } catch (e) { words = []; }
        if (words.length < 1) { el.chthTyping = false; return; }
        i = 0; n = 0; deleting = false;
      }
      if (reduced()) {
        i = (i + 1) % words.length;
        out.textContent = words[i];
        return setTimeout(tick, 3500);
      }
      var word = words[i];
      if (!deleting && n < word.length) { out.textContent = word.slice(0, ++n); return setTimeout(tick, 75); }
      if (!deleting) { deleting = true; return setTimeout(tick, 1600); }
      if (n > 0) { out.textContent = word.slice(0, --n); return setTimeout(tick, 40); }
      deleting = false;
      i = (i + 1) % words.length;
      setTimeout(tick, 250);
    };
    setTimeout(tick, 1600);
  }
  function startNav(scope) {
    var els = (scope || d).querySelectorAll('[data-chth-type]');
    for (var i = 0; i < els.length; i++) typeWords(els[i]);
    var bars = (scope || d).querySelectorAll('[data-chth-tabs]');
    for (var j = 0; j < bars.length; j++) setupTabs(bars[j]);
    var navs = (scope || d).querySelectorAll('[data-chth-nav]');
    for (var k = 0; k < navs.length; k++) setupNav(navs[k]);
    onScroll();
    paintMinimized();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { startNav(); });
  else startNav();

  w.chthShell = { theme: currentTheme, setTheme: setTheme, toggleTheme: toggleTheme, toast: toast, applyDismissed: applyDismissed, startNav: startNav };
  w.chthToast = toast;
})();
