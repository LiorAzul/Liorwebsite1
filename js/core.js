/* ==========================================================================
   VibeMagic — core.js
   Shared runtime for every module (loaded with `defer` right after the vendor
   libs, before any module):
     VM.on / VM.off / VM.emit      tiny event bus ('theme', 'intro:done', 'reveal', 'menu')
     VM.theme / VM.setTheme / VM.toggleTheme
     VM.reduced / VM.finePointer / VM.params
     VM.lenis / VM.scrollTo / VM.lockScroll
     VM.waLink(text) + [data-wa] wiring (data-wa="custom message" or empty)
     VM.whenIntroDone(fn)          runs fn after the neon intro hands off (or at once)
     [data-reveal] → .in           once, via IntersectionObserver
   ========================================================================== */
(function () {
  'use strict';

  var VM = (window.VM = window.VM || {});
  var root = document.documentElement;

  VM.params = new URLSearchParams(location.search);
  VM.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || VM.params.get('rm') === '1';
  VM.finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mqMobile = matchMedia('(max-width: 720px)');
  VM.isMobile = mqMobile.matches;
  try {
    mqMobile.addEventListener('change', function (e) { VM.isMobile = e.matches; VM.emit('breakpoint', e.matches ? 'mobile' : 'desktop'); });
  } catch (e) { /* Safari < 14 */ }

  /* ---------- event bus ---------- */
  var bus = {};
  VM.on = function (ev, fn) { (bus[ev] = bus[ev] || []).push(fn); return fn; };
  VM.off = function (ev, fn) { bus[ev] = (bus[ev] || []).filter(function (f) { return f !== fn; }); };
  VM.emit = function (ev, data) {
    (bus[ev] || []).slice().forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[VM] ' + ev + ' handler failed', e); }
    });
    try { document.dispatchEvent(new CustomEvent('vm:' + ev, { detail: data })); } catch (e) { /* old browsers */ }
  };

  /* ---------- theme ---------- */
  var STORE = 'vm-theme';
  function storedTheme() { try { return localStorage.getItem(STORE); } catch (e) { return null; } }
  var metaTheme = document.querySelector('meta[name="theme-color"]');

  VM.theme = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  VM.setTheme = function (t, persist) {
    if (t !== 'light' && t !== 'dark') return;
    VM.theme = t;
    root.setAttribute('data-theme', t);
    if (metaTheme) metaTheme.setAttribute('content', t === 'dark' ? '#040207' : '#FEFEFE');
    if (persist !== false) { try { localStorage.setItem(STORE, t); } catch (e) { /* private mode */ } }
    VM.emit('theme', t);
  };
  VM.toggleTheme = function () { VM.setTheme(VM.theme === 'dark' ? 'light' : 'dark'); };
  if (metaTheme) metaTheme.setAttribute('content', VM.theme === 'dark' ? '#040207' : '#FEFEFE');
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      if (!storedTheme()) VM.setTheme(e.matches ? 'dark' : 'light', false);
    });
  } catch (e) { /* Safari < 14 */ }

  /* ---------- WhatsApp ---------- */
  VM.WA_NUMBER = '972523321674';
  VM.WA_DEFAULT = 'היי ליאור, הגעתי מהאתר של VibeMagic ויש לי רעיון שאשמח לבנות איתך. אפשר לשמוע פרטים?';
  VM.waLink = function (text) {
    return 'https://wa.me/' + VM.WA_NUMBER + '?text=' + encodeURIComponent(text || VM.WA_DEFAULT);
  };
  VM.wireWa = function (scope) {
    (scope || document).querySelectorAll('[data-wa]').forEach(function (a) {
      var msg = a.getAttribute('data-wa');
      a.setAttribute('href', VM.waLink(msg || undefined));
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
  };
  VM.wireWa();

  /* ---------- scroll (Lenis + GSAP ScrollTrigger) ---------- */
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    if (window.SplitText) window.gsap.registerPlugin(window.SplitText);
  }
  VM.gsap = window.gsap || null;

  if (!VM.reduced && window.Lenis && !VM.params.has('nolenis')) {
    try {
      var lenis = new window.Lenis({
        duration: 1.12,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.4
      });
      VM.lenis = lenis;
      root.classList.add('lenis');
      if (hasGsap) {
        lenis.on('scroll', window.ScrollTrigger.update);
        window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
        window.gsap.ticker.lagSmoothing(0);
      } else {
        var rafLoop = function (t) { lenis.raf(t); requestAnimationFrame(rafLoop); };
        requestAnimationFrame(rafLoop);
      }
    } catch (e) { console.warn('[VM] Lenis failed, using native scroll', e); VM.lenis = null; }
  }

  function navOffset() {
    var v = getComputedStyle(root).getPropertyValue('--nav-h');
    return -((parseFloat(v) || 64) + 16);
  }
  /* VM.navHold: until this timestamp the nav must not treat scrolling as a "fast scroll
     down" (programmatic jumps, deep links, scroll restoration) and hide itself. */
  VM.navHold = performance.now() + 1500;
  VM.holdNav = function (ms) { VM.navHold = Math.max(VM.navHold || 0, performance.now() + ms); };
  window.addEventListener('hashchange', function () { VM.holdNav(1200); });
  window.addEventListener('load', function () { VM.holdNav(1200); });

  VM.scrollTo = function (target, opts) {
    opts = opts || {};
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (target === '#top' || target === 0) el = 0;
    if (el === null || el === undefined) return;
    VM.holdNav(opts.immediate || !VM.lenis ? 400 : (opts.duration || 1.3) * 1000 + 300);
    if (VM.lenis) {
      // Lenis already honours html{scroll-padding-top} (nav height + 24px) for element targets
      VM.lenis.scrollTo(el, { offset: opts.offset != null ? opts.offset : 0, duration: opts.duration || 1.3, immediate: !!opts.immediate });
    } else {
      var y = el === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY + (opts.offset != null ? opts.offset : navOffset());
      window.scrollTo({ top: y, behavior: VM.reduced || opts.immediate ? 'auto' : 'smooth' });
    }
  };

  // in-page anchors go through VM.scrollTo (Lenis-aware, nav-offset aware)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var id = a.getAttribute('href');
    if (id === '#' || id.length < 2) return;
    var el = id === '#top' ? 0 : document.querySelector(id);
    if (el === null) return;
    e.preventDefault();
    VM.scrollTo(id === '#top' ? 0 : el);
    if (history.replaceState) history.replaceState(null, '', id === '#top' ? location.pathname + location.search : id);
    // move the sequential focus start point to the target (skip link, menu, hero jumps);
    // without this, the next Tab would send the page back to where the link was
    var t = id === '#top' ? document.getElementById('top') : el;
    if (t && t.focus) {
      if (!t.matches('a[href],button,input,textarea,select,summary,[tabindex]')) t.setAttribute('tabindex', '-1');
      // after nav.js has closed the menu (which returns focus to the burger)
      setTimeout(function () { try { t.focus({ preventScroll: true }); } catch (err) { t.focus(); } }, 0);
    }
  });

  var lockCount = 0;
  VM.lockScroll = function (on) {
    lockCount = Math.max(0, lockCount + (on ? 1 : -1));
    var locked = lockCount > 0;
    root.classList.toggle('scroll-locked', locked);
    root.style.overflow = locked ? 'hidden' : '';
    if (VM.lenis) { locked ? VM.lenis.stop() : VM.lenis.start(); }
  };

  /* ---------- reveal ---------- */
  var io = null;
  VM.observeReveal = function (el) {
    if (io) io.observe(el); else el.classList.add('in');
  };
  function initReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (VM.reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
        VM.emit('reveal', en.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- intro gating ----------
     The inline <head> script adds html.intro-pending when the neon intro will play
     (first visit this session, motion allowed, no ?nointro). js/intro.js removes it at
     handoff and calls VM.introComplete(). Everyone else waits via VM.whenIntroDone. */
  VM.introDone = !root.classList.contains('intro-pending');
  VM.whenIntroDone = function (fn) {
    if (VM.introDone) { fn(); return; }
    VM.on('intro:done', fn);
  };
  VM.introComplete = function () {
    if (VM.introDone) return;
    VM.introDone = true;
    root.classList.remove('intro-pending');
    root.classList.add('intro-done');
    VM.emit('intro:done');
  };
  // failsafe: never leave the page hidden if intro.js fails to load or throws
  if (!VM.introDone) setTimeout(function () { VM.introComplete(); }, 6500);
  else root.classList.add('intro-done');

  /* ---------- misc ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  // keep ScrollTrigger measurements right once fonts and images settle
  function refresh() { if (hasGsap) window.ScrollTrigger.refresh(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.addEventListener('load', function () { setTimeout(refresh, 60); });

  // safety net: late height changes (counters, morph text, lazy content, resizes that settle
  // after ScrollTrigger's own resize refresh) would leave every trigger below them stale.
  if (hasGsap && 'ResizeObserver' in window) {
    var docH = 0, roTimer = 0;
    window.ScrollTrigger.addEventListener('refresh', function () { docH = document.documentElement.scrollHeight; });
    new ResizeObserver(function () {
      clearTimeout(roTimer);
      roTimer = setTimeout(function () {
        if (root.classList.contains('scroll-locked') || root.classList.contains('intro-pending')) return;
        var h = document.documentElement.scrollHeight;
        if (Math.abs(h - docH) > 1) refresh();
      }, 250);
    }).observe(document.body);
  }

  initReveal();
})();
