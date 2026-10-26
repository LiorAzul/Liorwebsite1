/* ==========================================================================
   VibeMagic — nav.js
   Header, side menu and theme toggle, ported to vanilla from 21st.dev:
     · "Morphing Scroll Navbar" by Kiki (@laziekiki)
         rAF-throttled scroll state: .is-floating (left the top) and .is-compact
         (floating + reading downward), a page-progress line and scroll-spy
         (aria-current="location" on the last section above 34% of the viewport).
         Added for VibeMagic: .is-hidden on a fast scroll-down, back on scroll-up,
         and a sliding "tubelight" lamp under the active link.
     · "Menu Toggle Icon" by Efferd
         one looped path + a line; the dash slides from the two bars to the stem
         and the svg turns -45deg (pure CSS on aria-expanded, see nav.css).
     · "Curved Menu" by Shamsudheen (@ishamsu)
         side panel with a liquid SVG leading edge: the quadratic control point is
         tweened -100 (bulge) → 100 (flat) on enter and back on exit, plus the
         per-letter staggered hover ripple.
     · "Animated Theme Toggler" (Magic UI pattern, port by Arunachalam)
         document.startViewTransition + a circular clip-path reveal of
         ::view-transition-new(root) from the button centre.
   Provides on window.VM:
     VM.menu   { open(), close(opts), toggle(), isOpen() }
     VM.nav    { show(), measure() }
     VM.switchTheme(originEl?)   animated theme switch (falls back to VM.toggleTheme)
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM;
  if (!VM) return;

  var root = document.documentElement;
  var nav = document.getElementById('nav');
  var menu = document.getElementById('menu');
  var burger = document.getElementById('burger');

  var menuOpen = false;
  var headerApi = { show: function () {}, measure: function () {}, update: function () {} };

  function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt); }
  function debounce(fn, ms) {
    var t = 0;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ======================================================================
     1. Header: morphing scroll navbar
     ====================================================================== */
  function initHeader() {
    if (!nav) return;
    var linksBox = nav.querySelector('.nav__links');
    var progress = nav.querySelector('.nav__progress');
    var headerLinks = linksBox ? Array.prototype.slice.call(linksBox.querySelectorAll('a[href^="#"]')) : [];
    var menuLinks = menu ? Array.prototype.slice.call(menu.querySelectorAll('.menu__links a[href^="#"]')) : [];
    var allLinks = headerLinks.concat(menuLinks);

    var ids = [];
    allLinks.forEach(function (a) {
      var id = a.hash.slice(1);
      if (id && ids.indexOf(id) < 0) ids.push(id);
    });

    // sliding lamp under the active header link
    var lamp = null;
    if (linksBox) {
      lamp = document.createElement('span');
      lamp.className = 'nav__lamp';
      lamp.setAttribute('aria-hidden', 'true');
      linksBox.insertBefore(lamp, linksBox.firstChild);
    }

    var marks = [];
    var maxScroll = 1;
    var lastY = window.scrollY || 0;
    var lastT = performance.now();
    var vel = 0, downAcc = 0, upAcc = 0, dir = 0;
    var compactLatch = false, hidden = false;
    var current = null;
    var lastP = -1;
    var raf = 0;
    var kbd = false;

    function measure() {
      var sy = window.scrollY || 0;
      marks = [];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        // a ScrollTrigger-pinned section sits in a .pin-spacer that keeps its place in the flow
        var box = el.parentElement && el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
        marks.push({ id: id, top: box.getBoundingClientRect().top + sy });
      });
      marks.sort(function (a, b) { return a.top - b.top; });
      maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
    }

    function placeLamp() {
      if (!lamp) return;
      var a = null;
      for (var i = 0; i < headerLinks.length; i++) if (headerLinks[i].hash === '#' + current) a = headerLinks[i];
      var c = linksBox.getBoundingClientRect();
      if (!a || !c.height) { lamp.classList.remove('is-on'); return; }
      var r = a.getBoundingClientRect();
      if (!r.width) { lamp.classList.remove('is-on'); return; }
      // RTL: links pack from the right edge, so measure from it (stable while the box collapses)
      var lx = -(c.right - r.right) + 'px';
      var lw = r.width + 'px';
      if (!lamp.classList.contains('is-on')) {
        lamp.style.transition = 'none';
        lamp.style.setProperty('--lx', lx);
        lamp.style.setProperty('--lw', lw);
        void lamp.offsetWidth;
        lamp.style.transition = '';
        lamp.classList.add('is-on');
      } else {
        lamp.style.setProperty('--lx', lx);
        lamp.style.setProperty('--lw', lw);
      }
    }

    function setActive(id) {
      if (id === current) return;
      current = id;
      allLinks.forEach(function (a) {
        if (id && a.hash === '#' + id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      placeLamp();
    }

    function update() {
      raf = 0;
      var y = window.scrollY || 0;
      var now = performance.now();
      var dy = y - lastY;
      var dt = Math.max(8, now - lastT);
      vel = vel * 0.5 + (dy / dt) * 0.5;               // px per ms, smoothed

      if (dy > 0.5) { downAcc += dy; upAcc = 0; } else if (dy < -0.5) { upAcc -= dy; downAcc = 0; }
      if (downAcc > 4) dir = 1; else if (upAcc > 4) dir = -1;   // 4px dead zone (original)

      // programmatic jumps (anchor links, deep links, scroll restoration) are not the visitor
      // reading downward: while core's VM.navHold runs, nothing accumulates and the bar stays out
      var held = VM.navHold && now < VM.navHold;
      if (held) { downAcc = 0; upAcc = 0; vel = 0; dir = 0; }

      var atTop = y < 8;
      var pinned = menuOpen || kbd;
      if (dir === 1 && downAcc > 24) compactLatch = true;
      if (dir === -1 || atTop) compactLatch = false;

      if (pinned || held || y < 160) hidden = false;
      else if (dir === 1 && (vel > 1 || downAcc > window.innerHeight * 0.9)) hidden = true;
      else if (dir === -1 && upAcc > 10) hidden = false;

      // owner's call (2026-10): the bar is always the compact floating pill, at the top and
      // while scrolling, and it never slides away
      hidden = false;
      nav.classList.add('is-floating', 'is-compact');
      nav.classList.remove('is-hidden');

      // progress (0 → 1), only written when it actually moved
      var p = Math.min(1, Math.max(0, y / maxScroll));
      if (progress && Math.abs(p - lastP) > 0.0004) {
        lastP = p;
        progress.style.setProperty('--p', p.toFixed(4));
      }

      // scroll-spy
      var probe = y + window.innerHeight * 0.34;
      var id = null;
      for (var i = 0; i < marks.length; i++) if (marks[i].top <= probe) id = marks[i].id;
      if (marks.length && y >= maxScroll - 4) id = marks[marks.length - 1].id;
      setActive(id);

      lastY = y;
      lastT = now;
    }

    function schedule() { if (!raf) raf = requestAnimationFrame(update); }

    // keyboard users keep the bar visible and expanded while focus is inside it
    on(nav, 'focusin', function (e) {
      var fv = true;
      try { fv = e.target.matches(':focus-visible'); } catch (err) { /* old engines */ }
      if (fv) { kbd = true; schedule(); }
    });
    on(nav, 'focusout', function (e) {
      if (!e.relatedTarget || !nav.contains(e.relatedTarget)) { kbd = false; schedule(); }
    });

    var remeasure = function () { measure(); placeLamp(); schedule(); };
    on(window, 'scroll', schedule, { passive: true });
    on(window, 'resize', debounce(remeasure, 140));
    on(window, 'load', function () { setTimeout(remeasure, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    if (window.ScrollTrigger && window.ScrollTrigger.addEventListener) {
      window.ScrollTrigger.addEventListener('refresh', remeasure);
    }
    if ('ResizeObserver' in window) {
      var roPending = 0;
      new ResizeObserver(function () {
        if (roPending) return;
        roPending = requestAnimationFrame(function () { roPending = 0; measure(); schedule(); });
      }).observe(document.body);
    }

    // first frame without transitions (e.g. a reload that restores a mid-page scroll)
    nav.classList.add('nav--instant');
    measure();
    update();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { nav.classList.remove('nav--instant'); });
    });

    headerApi = {
      show: function () { hidden = false; nav.classList.remove('is-hidden'); },
      measure: remeasure,
      update: schedule
    };
  }

  /* entrance: links and actions drop in after the intro hands the logo over */
  function entrance(withLogo) {
    if (!nav || VM.reduced || !nav.animate) return;
    var els = [];
    if (withLogo) {
      var logo = nav.querySelector('.nav__logo .logo');
      if (logo) els.push(logo);
    }
    Array.prototype.push.apply(els, nav.querySelectorAll('.nav__links a'));
    Array.prototype.push.apply(els, nav.querySelectorAll('.nav__actions > *'));
    els.forEach(function (el, i) {
      try {
        el.animate(
          [{ opacity: 0, transform: 'translate3d(0,-14px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
          { duration: 850, delay: 60 + i * 55, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
        );
      } catch (e) { /* WAAPI missing: stay static */ }
    });
  }

  /* ======================================================================
     2. Side menu: curved panel + burger
     ====================================================================== */
  // grad-headline (dark), sampled per letter: rightmost (first) letter purple, last letter gold
  var RAMP = [
    [0, [255, 238, 85]], [0.3, [251, 225, 35]], [0.4, [251, 206, 46]], [0.46, [248, 167, 146]],
    [0.54, [236, 86, 253]], [0.7, [219, 67, 255]], [1, [215, 41, 255]]
  ];
  function sampleRamp(g) {
    g = Math.min(1, Math.max(0, g));
    for (var i = 1; i < RAMP.length; i++) {
      if (g <= RAMP[i][0]) {
        var a = RAMP[i - 1], b = RAMP[i];
        var t = (g - a[0]) / (b[0] - a[0] || 1);
        var c = [0, 1, 2].map(function (k) { return Math.round(a[1][k] + (b[1][k] - a[1][k]) * t); });
        return 'rgb(' + c.join(',') + ')';
      }
    }
    return 'rgb(215,41,255)';
  }

  function splitLetters(scope) {
    var seg = null;
    try { if (window.Intl && Intl.Segmenter) seg = new Intl.Segmenter('he', { granularity: 'grapheme' }); } catch (e) { seg = null; }
    function graphemes(w) {
      if (seg) return Array.from(seg.segment(w), function (s) { return s.segment; });
      return Array.from(w);
    }
    scope.querySelectorAll('.menu__txt').forEach(function (txt) {
      if (txt.querySelector('.menu__split')) return;
      var label = txt.textContent.replace(/\s+/g, ' ').trim();
      if (!label) return;
      var words = label.split(' ');
      var total = words.reduce(function (n, w) { return n + graphemes(w).length; }, 0);
      var vis = document.createElement('span');
      vis.className = 'menu__split';
      vis.setAttribute('aria-hidden', 'true');
      var i = 0;
      words.forEach(function (w, wi) {
        if (wi) vis.appendChild(document.createTextNode(' '));
        var ws = document.createElement('span');
        ws.className = 'menu__w';
        graphemes(w).forEach(function (g) {
          var ch = document.createElement('span');
          ch.className = 'menu__ch';
          ch.textContent = g;
          ch.style.setProperty('--i', i);
          ch.style.setProperty('--c', sampleRamp(1 - (total > 1 ? i / (total - 1) : 0)));
          ws.appendChild(ch);
          i++;
        });
        vis.appendChild(ws);
      });
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = label;
      txt.textContent = '';
      txt.appendChild(sr);
      txt.appendChild(vis);
    });
    scope.querySelectorAll('.menu__no').forEach(function (n) { n.setAttribute('aria-hidden', 'true'); });
  }

  function initMenu() {
    if (!menu || !burger) return;
    var panel = menu.querySelector('.menu__panel');
    var curvePath = menu.querySelector('.menu__curve path');
    var inner = menu.querySelector('.menu__inner');
    if (inner) inner.setAttribute('data-lenis-prevent', '');   // let the panel scroll while Lenis is stopped

    // stagger index for the entrance
    var items = [menu.querySelector('.menu__inner > .eyebrow')]
      .concat(Array.prototype.slice.call(menu.querySelectorAll('.menu__links > li')))
      .concat([menu.querySelector('.menu__cta'), menu.querySelector('.menu__foot')])
      .filter(Boolean);
    items.forEach(function (el, i) { el.style.setProperty('--mi', i); });

    try { splitLetters(menu); } catch (e) { /* plain text stays */ }

    var hideTimer = 0, curveRaf = 0, inerted = [], gutterSet = false;

    /* --- liquid edge --- */
    function setCurve(q) {
      if (curvePath) curvePath.setAttribute('d', 'M100 0 L100 1000 Q' + q.toFixed(2) + ' 500 100 0 Z');
    }
    function easeIO(t) { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; } // ≈ cubic-bezier(.76,0,.24,1)
    function tweenCurve(from, to, dur) {
      cancelAnimationFrame(curveRaf);
      if (VM.reduced || !curvePath) { setCurve(100); return; }
      var t0 = performance.now();
      setCurve(from);
      var frame = function (now) {
        var p = Math.min(1, (now - t0) / dur);
        setCurve(from + (to - from) * easeIO(p));
        if (p < 1) curveRaf = requestAnimationFrame(frame);
      };
      curveRaf = requestAnimationFrame(frame);
    }
    setCurve(-100);

    /* --- inert everything behind the dialog (the burger stays live as the X) --- */
    function setInert(onState) {
      if (onState) {
        inerted = [];
        Array.prototype.forEach.call(document.body.children, function (el) {
          if (el === nav || el === menu || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName) || el.inert) return;
          el.inert = true;
          inerted.push(el);
        });
        if (nav) {
          nav.querySelectorAll('.nav__logo, .nav__links, .nav__wa, #theme-toggle').forEach(function (el) {
            if (el.inert) return;
            el.inert = true;
            inerted.push(el);
          });
        }
      } else {
        inerted.forEach(function (el) { el.inert = false; });
        inerted = [];
      }
    }

    /* no layout jump when the scrollbar disappears under the lock */
    function gutter(onState) {
      if (onState) {
        if (window.innerWidth - root.clientWidth > 0) { root.style.scrollbarGutter = 'stable'; gutterSet = true; }
      } else if (gutterSet) {
        root.style.scrollbarGutter = '';
        gutterSet = false;
      }
    }

    function focusables() {
      var list = [burger].concat(Array.prototype.slice.call(
        menu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ));
      return list.filter(function (el) {
        return el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      });
    }

    function open() {
      if (menuOpen) return;
      menuOpen = true;
      clearTimeout(hideTimer);
      menu.hidden = false;
      void panel.offsetWidth;                  // commit the off-canvas start before transitioning
      headerApi.show();
      root.classList.add('menu-open');
      menu.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'סגירת תפריט');
      gutter(true);
      VM.lockScroll(true);
      setInert(true);
      tweenCurve(-100, 100, 1000);
      headerApi.update();
      VM.emit('menu', true);
      var first = menu.querySelector('.menu__links a');
      setTimeout(function () {
        if (menuOpen && first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
      }, VM.reduced ? 0 : 140);
    }

    function close(opts) {
      if (!menuOpen) return;
      opts = opts || {};
      menuOpen = false;
      var hadFocus = menu.contains(document.activeElement) || document.activeElement === burger;
      menu.classList.remove('is-open');
      root.classList.remove('menu-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'פתיחת תפריט');
      setInert(false);
      VM.lockScroll(false);                    // released synchronously: core's anchor scroll runs right after
      gutter(false);
      tweenCurve(100, -100, 800);
      headerApi.update();
      VM.emit('menu', false);
      if (opts.focus !== false && hadFocus) {
        try { burger.focus({ preventScroll: true }); } catch (e) { burger.focus(); }
      }
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!menuOpen) { menu.hidden = true; setCurve(-100); }
      }, VM.reduced ? 0 : 900);
    }

    on(burger, 'click', function () { if (menuOpen) close(); else open(); });
    // any other "open the menu" button on the page (e.g. the hero's תפריט button)
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-menu-open]');
      if (t && !menuOpen) { e.preventDefault(); open(); }
    });

    // an in-page link whose target exists: core's document-level anchor handler scrolls there and
    // moves focus to the section, so the menu must not pull focus back to the burger first
    function isJump(a) {
      if (!a.matches('a[href^="#"]')) return false;
      var id = a.getAttribute('href');
      if (id === '#top') return true;
      if (id.length < 2) return false;
      try { return !!document.querySelector(id); } catch (err) { return false; }
    }

    // scrim + every [data-menu-close]. This listener runs before core's (on document), and close()
    // releases the scroll lock synchronously, so Lenis is running again when core starts the scroll.
    on(menu, 'click', function (e) {
      var t = e.target.closest && e.target.closest('[data-menu-close]');
      if (!t || !menu.contains(t)) return;
      var plain = !(e.metaKey || e.ctrlKey || e.shiftKey);
      close({ focus: !(plain && isJump(t)) });
    });

    on(document, 'keydown', function (e) {
      if (!menuOpen) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      var inside = f.indexOf(a) >= 0;
      if (e.shiftKey && (a === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !inside)) { e.preventDefault(); first.focus(); }
    });

    VM.menu = {
      open: open,
      close: close,
      toggle: function () { if (menuOpen) close(); else open(); },
      isOpen: function () { return menuOpen; }
    };
  }

  /* ======================================================================
     3. Theme toggle: View Transitions circular reveal
     ====================================================================== */
  var vtToken = 0;
  function switchTheme(origin) {
    var doc = document;
    if (VM.reduced || typeof doc.startViewTransition !== 'function') { VM.toggleTheme(); return; }
    var x = window.innerWidth / 2, y = window.innerHeight / 2;
    if (origin && origin.getBoundingClientRect) {
      var r = origin.getBoundingClientRect();
      if (r.width) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    }
    var R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    var token = ++vtToken;
    root.classList.add('vm-vt');
    var vt;
    try {
      vt = doc.startViewTransition(function () {
        root.classList.add('vm-theming');
        VM.toggleTheme();
      });
    } catch (e) {
      root.classList.remove('vm-vt', 'vm-theming');
      VM.toggleTheme();
      return;
    }
    vt.ready.then(function () {
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 700, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () { /* skipped transition: the theme still changed */ });
    var done = function () { if (token === vtToken) root.classList.remove('vm-vt', 'vm-theming'); };
    vt.finished.then(done, done);
  }

  function syncThemeUi(t) {
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה');
  }

  function initTheme() {
    // delegated: every #theme-toggle / [data-theme-toggle] on the page gets the reveal
    on(document, 'click', function (e) {
      var btn = e.target.closest && e.target.closest('#theme-toggle, [data-theme-toggle]');
      if (!btn) return;
      e.preventDefault();
      if (!VM.reduced) {
        btn.classList.remove('is-casting');
        void btn.offsetWidth;
        btn.classList.add('is-casting');
        setTimeout(function () { btn.classList.remove('is-casting'); }, 800);
      }
      switchTheme(btn);
    });
    syncThemeUi(VM.theme);
    VM.on('theme', syncThemeUi);
  }

  /* ---------- boot ---------- */
  try { initHeader(); } catch (e) { console.error('[nav] header', e); if (nav) nav.classList.remove('nav--instant'); }
  try { initMenu(); } catch (e) { console.error('[nav] menu', e); }
  try { initTheme(); } catch (e) { console.error('[nav] theme', e); }

  VM.switchTheme = switchTheme;
  VM.nav = { show: function () { headerApi.show(); }, measure: function () { headerApi.measure(); } };

  try {
    var introWillPlay = !VM.introDone;
    VM.whenIntroDone(function () {
      entrance(!introWillPlay);
      headerApi.measure();
    });
  } catch (e) { /* entrance is decoration only */ }
})();
