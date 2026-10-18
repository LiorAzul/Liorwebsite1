/* ==========================================================================
   VibeMagic · delight.js
   Global delight behaviours + the final CTA footer / floating WhatsApp.
   Vanilla ports of these 21st.dev components:
     · "Magnetic" by Julien Thibeaut (Motion Primitives, @ibelick): spring
       (stiffness 26.7, damping 4.1, mass .2) pulling [data-magnetic] toward
       the cursor. Written to the `translate` property so it composes with any
       transform the element already animates (.cta-pill hover, GSAP, …).
     · "Confetti" Stars preset by Dillion Verma (Magic UI) on canvas-confetti:
       [data-confetti] clicks + VM.burst(x, y, opts).
     · "Magic Cursor" by Ritesh Bucha (@bucharitesh): wand trail of tumbling
       sparkle stars (DOM, fall-1/2/3 keyframes) + a glowing stroke, moved to a
       single fixed canvas (the original's box-shadow dots, without the
       scrolled-page offset bug).
     · "Shooting Stars" + "Stars Background" by Manu Arora (Aceternity UI):
       one canvas night sky behind the footer title (dark theme only).
     · "Cinematic Footer" by Hossain Jahed (@jahed): the giant wordmark scrub
       (y 10vh / scale .8 / opacity 0 → rest, here lerped like scrub: 1). The
       curtain itself is pure CSS (css/footer.css).
     · "Floating Action Button" by Motion (@motiondotdev): .wa-fab visibility
       + one-time label peek; the spring lives in CSS (linear() easing).
   Contracts provided:
     VM.burst(clientX, clientY, opts?) → bool   gold/purple star burst
        opts: { scale (particle multiplier, 1), shots (1-3, 3), velocity, colors, ticks }
     VM.wand = { supported, isOn(), set(bool), toggle() }  + VM.emit('wand', on)
     VM.spell()                                  plays the "magic" easter egg
     [data-magnetic] [data-confetti] [data-wand-toggle] behaviours (delegated,
     so elements added later work too).
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM || (window.VM = {});
  var root = document.documentElement;
  var REDUCED = !!VM.reduced;
  var FINE = !!VM.finePointer;
  var MOBILE = !!VM.isMobile;
  var STAR_PATH = 'M50 0C53 33 67 47 100 50C67 53 53 67 50 100C47 67 33 53 0 50C33 47 47 33 50 0Z';

  function safe(name, fn) {
    try { fn(); } catch (e) { console.warn('[delight] ' + name + ' failed', e); }
  }
  function isDark() { return root.getAttribute('data-theme') !== 'light'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function storage(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { /* private mode / blocked storage */ }
    return null;
  }
  function closest(t, sel) { return t && t.closest ? t.closest(sel) : null; }
  function whenIntro(fn) { if (typeof VM.whenIntroDone === 'function') VM.whenIntroDone(fn); else fn(); }
  var raf = function (fn) { return window.requestAnimationFrame(fn); };

  /* ======================================================================
     Confetti stars (Magic UI "Stars" preset)
     ====================================================================== */
  var PALETTE = {
    dark: ['#FFE000', '#FCEC68', '#C805FE', '#FC38FE', '#FFF6B0'],
    // the two palest golds vanish on white: deeper golds for the light theme
    light: ['#FFC800', '#EBA900', '#C805FE', '#FC38FE', '#E08AF7']
  };
  function palette() { return PALETTE[isDark() ? 'dark' : 'light']; }

  var fire = null;
  function confettiFn() {
    if (fire) return fire;
    if (typeof window.confetti !== 'function') return null;
    try {
      var cv = document.createElement('canvas');
      cv.className = 'fx-confetti';
      cv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cv);
      fire = window.confetti.create(cv, { resize: true, useWorker: true, disableForReducedMotion: true });
    } catch (e) {
      fire = window.confetti; // library default canvas
    }
    return fire;
  }

  function burst(x, y, opts) {
    opts = opts || {};
    if (REDUCED) return false;
    var f = confettiFn();
    if (!f) return false;
    var w = window.innerWidth || 1, h = window.innerHeight || 1;
    var n = opts.scale == null ? 1 : opts.scale;
    var base = {
      spread: 360,
      ticks: opts.ticks || 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: opts.velocity || 30,
      colors: opts.colors || palette(),
      origin: { x: clamp(x / w, 0, 1), y: clamp(y / h, 0, 1) },
      disableForReducedMotion: true
    };
    var shoot = function () {
      try {
        f(Object.assign({}, base, { particleCount: Math.max(1, Math.round(40 * n)), scalar: 1.2, shapes: ['star'] }));
        f(Object.assign({}, base, { particleCount: Math.max(1, Math.round(10 * n)), scalar: 0.75, shapes: ['circle'] }));
      } catch (e) { /* never let a burst break a click */ }
    };
    var shots = clamp(opts.shots || 3, 1, 3);
    for (var i = 0; i < shots; i++) setTimeout(shoot, i * 100);
    return true;
  }
  VM.burst = function (x, y, opts) {
    try { return burst(+x || 0, +y || 0, opts); } catch (e) { return false; }
  };

  function pop(el) {
    if (REDUCED || !el || !el.classList) return;
    el.classList.remove('fx-pop');
    void el.offsetWidth; // restart the keyframes
    el.classList.add('fx-pop');
    clearTimeout(el._fxPop);
    el._fxPop = setTimeout(function () { el.classList.remove('fx-pop'); }, 650);
  }

  function initConfetti() {
    // delegated: links added later (playground result) work too. Never preventDefault.
    document.addEventListener('click', function (e) {
      var el = closest(e.target, '[data-confetti]');
      if (!el) return;
      try {
        var r = el.getBoundingClientRect();
        VM.burst(r.left + r.width / 2, r.top + r.height / 2);
        pop(el);
      } catch (err) { /* decorative only */ }
    });
  }

  /* ======================================================================
     Magnetic (Motion Primitives)
     ====================================================================== */
  function initMagnetic() {
    if (!FINE || REDUCED) return;
    var RANGE = 110, PULL = 0.42;
    var K = 26.7, C = 4.1, M = 0.2;
    var states = [], listAt = -1e9;
    var px = 0, py = 0, has = false, loop = 0, last = 0;

    function sync(now) {
      if (now - listAt < 1200) return;
      listAt = now;
      var next = [];
      document.querySelectorAll('[data-magnetic]').forEach(function (el) {
        var s = null;
        for (var i = 0; i < states.length; i++) if (states[i].el === el) { s = states[i]; break; }
        next.push(s || { el: el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, set: false });
      });
      // release elements that left the DOM
      states.forEach(function (s) { if (next.indexOf(s) < 0 && s.set) s.el.style.translate = ''; });
      states = next;
    }

    function targets() {
      for (var i = 0; i < states.length; i++) {
        var s = states[i], tx = 0, ty = 0;
        if (has) {
          var r = s.el.getBoundingClientRect();
          if (r.width) {
            // rest-position centre (remove our own offset so the pull has no feedback)
            var cx = r.left + r.width / 2 - s.x, cy = r.top + r.height / 2 - s.y;
            var dx = px - cx, dy = py - cy;
            var ex = Math.max(Math.abs(dx) - r.width / 2, 0), ey = Math.max(Math.abs(dy) - r.height / 2, 0);
            var d = Math.sqrt(ex * ex + ey * ey);
            if (d < RANGE) {
              var f = 1 - d / RANGE;
              f = f * f * (3 - 2 * f);
              var max = clamp(Math.min(r.width, r.height) * 0.2 + 6, 8, 22);
              tx = clamp(dx * PULL, -max, max) * f;
              ty = clamp(dy * PULL, -max, max) * f;
            }
          }
        }
        s.tx = tx; s.ty = ty;
      }
    }

    function frame(now) {
      loop = 0;
      var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      targets();
      var moving = false, h = dt / 4;
      for (var i = 0; i < states.length; i++) {
        var s = states[i];
        for (var k = 0; k < 4; k++) {
          s.vx += (-K * (s.x - s.tx) - C * s.vx) / M * h;
          s.vy += (-K * (s.y - s.ty) - C * s.vy) / M * h;
          s.x += s.vx * h;
          s.y += s.vy * h;
        }
        if (Math.abs(s.vx) < 0.02 && Math.abs(s.vy) < 0.02 && Math.abs(s.x - s.tx) < 0.05 && Math.abs(s.y - s.ty) < 0.05) {
          s.x = s.tx; s.y = s.ty; s.vx = 0; s.vy = 0;
        } else moving = true;
        if (s.x === 0 && s.y === 0) {
          if (s.set) { s.el.style.translate = ''; s.set = false; }
        } else {
          s.el.style.translate = s.x.toFixed(2) + 'px ' + s.y.toFixed(2) + 'px';
          s.set = true;
        }
      }
      if (moving && !document.hidden) loop = raf(frame);
    }
    function kick() {
      if (loop) return;
      last = performance.now();
      loop = raf(frame);
    }

    document.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      px = e.clientX; py = e.clientY; has = true;
      sync(performance.now());
      kick();
    }, { passive: true });
    root.addEventListener('mouseleave', function () { has = false; kick(); });
    window.addEventListener('blur', function () { has = false; kick(); });
    window.addEventListener('scroll', function () { if (has) kick(); }, { passive: true });
  }

  /* ======================================================================
     Magic wand cursor trail ("Magic Cursor")
     ====================================================================== */
  function initWand() {
    var supported = FINE && !REDUCED;
    var on = storage('vm-wand') !== '0';
    var layer = null, cv = null, ctx = null, W = 0, H = 0;
    var pending = null, lastP = null, lastStar = { x: -1e4, y: -1e4, t: 0 };
    var loop = 0, idle = 0, alive = 0, hot = false, n = 0;
    var CFG = { minStarMs: 250, minStarDist: 75, hotStarMs: 95, hotStarDist: 30, max: 16 };

    function reflect() {
      document.querySelectorAll('[data-wand-toggle]').forEach(function (b) {
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function setOn(v) {
      on = !!v;
      storage('vm-wand', on ? '1' : '0');
      reflect();
      if (!on) wipe();
      if (typeof VM.emit === 'function') VM.emit('wand', on);
    }
    VM.wand = {
      supported: supported,
      isOn: function () { return on && supported; },
      set: setOn,
      toggle: function () { setOn(!on); }
    };
    reflect();
    // no cursor trail on touch or with reduced motion: hide the switch instead of leaving a dead control
    if (!supported) document.querySelectorAll('[data-wand-toggle]').forEach(function (b) { b.hidden = true; });
    document.addEventListener('click', function (e) {
      var b = closest(e.target, '[data-wand-toggle]');
      if (!b) return;
      setOn(!on);
      if (on && supported) {
        var r = b.getBoundingClientRect();
        VM.burst(r.left + r.width / 2, r.top + r.height / 2, { scale: 0.35, shots: 1 });
      }
    });
    if (!supported) return;

    function size() {
      if (!cv) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function build() {
      layer = document.createElement('div');
      layer.className = 'fx-wand';
      layer.setAttribute('aria-hidden', 'true');
      cv = document.createElement('canvas');
      layer.appendChild(cv);
      document.body.appendChild(layer);
      ctx = cv.getContext('2d');
      size();
      window.addEventListener('resize', size);
    }
    function wipe() {
      if (!layer) return;
      if (ctx) ctx.clearRect(0, 0, W, H);
      layer.querySelectorAll('.fx-star').forEach(function (s) { s.remove(); });
      alive = 0; lastP = null; pending = null;
    }

    function stroke(a, b) {
      var dark = isDark();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      // halo pass
      ctx.shadowBlur = dark ? 20 : 10;
      ctx.shadowColor = dark ? 'rgba(200, 5, 254, 1)' : 'rgba(255, 196, 0, 0.9)';
      ctx.strokeStyle = dark ? 'rgba(255, 224, 0, 0.9)' : 'rgba(168, 30, 230, 0.55)';
      ctx.lineWidth = dark ? 4 : 3;
      ctx.stroke();
      // hot core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = dark ? 'rgba(255, 253, 236, 0.95)' : 'rgba(138, 0, 194, 0.75)';
      ctx.lineWidth = dark ? 1.3 : 1.1;
      ctx.stroke();
    }

    function star(p) {
      if (alive >= CFG.max) return;
      var dark = isDark();
      var c = pick(dark ? ['#FFE000', '#FCEC68', '#E08AF7', '#FFFFFF', 'grad', 'grad'] : ['#E8B100', '#C805FE', '#B04BE0', 'grad', 'grad']);
      var s = pick(hot ? [26, 20, 14] : [22, 15, 10]);
      var el = document.createElement('span');
      el.className = 'fx-star';
      el.style.cssText = '--s:' + s + 'px;translate:' + p.x.toFixed(1) + 'px ' + p.y.toFixed(1) + 'px;animation-name:fx-fall-' + ((n++ % 3) + 1) + ';' +
        'color:' + (c === 'grad' ? (dark ? '#FCEC68' : '#D86AF0') : c);
      el.innerHTML = c === 'grad'
        ? '<svg viewBox="0 0 100 100"><use href="#sparkle-shape"/></svg>'
        : '<svg viewBox="0 0 100 100"><path d="' + STAR_PATH + '"/></svg>';
      var done = false;
      var kill = function () {
        if (done) return;
        done = true; alive--;
        el.remove();
      };
      el.addEventListener('animationend', kill);
      setTimeout(kill, 1750);
      alive++;
      layer.appendChild(el);
    }

    function frame(now) {
      loop = 0;
      if (!ctx) return;
      // fade the previous stroke
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      if (pending) {
        var p = pending;
        pending = null; idle = 0;
        if (lastP) stroke(lastP, p);
        lastP = p;
        var gap = hot ? CFG.hotStarMs : CFG.minStarMs, dist = hot ? CFG.hotStarDist : CFG.minStarDist;
        if (Math.sqrt((p.x - lastStar.x) * (p.x - lastStar.x) + (p.y - lastStar.y) * (p.y - lastStar.y)) >= dist || now - lastStar.t > gap) {
          star(p);
          lastStar = { x: p.x, y: p.y, t: now };
        }
      } else idle++;
      if (on && idle < 36 && !document.hidden) loop = raf(frame);
      else { ctx.clearRect(0, 0, W, H); lastP = null; }
    }
    function kick() { if (!loop) loop = raf(frame); }

    whenIntro(function () {
      document.addEventListener('pointermove', function (e) {
        if (!on || (e.pointerType && e.pointerType !== 'mouse')) return;
        if (!layer) build();
        pending = { x: e.clientX, y: e.clientY };
        hot = !!closest(e.target, '[data-magnetic], [data-confetti]');
        kick();
      }, { passive: true });
      root.addEventListener('mouseleave', function () { lastP = null; pending = null; });
    });
  }

  /* ======================================================================
     Easter egg: type "magic" or "קסם"
     ====================================================================== */
  function initSpell() {
    var toast = document.createElement('div');
    toast.className = 'fx-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#sparkle-shape"/></svg><span class="fx-toast__t"></span>';
    document.body.appendChild(toast);
    var txt = toast.querySelector('.fx-toast__t');
    var buf = '', lastCast = 0, hideT = 0;

    function flash() {
      var f = document.createElement('div');
      f.className = 'fx-flash';
      f.setAttribute('aria-hidden', 'true');
      document.body.appendChild(f);
      var gone = function () { f.remove(); };
      f.addEventListener('animationend', gone);
      setTimeout(gone, 2000);
    }
    function shower() {
      var f = confettiFn();
      if (!f) return;
      var w = window.innerWidth, h = window.innerHeight;
      VM.burst(w / 2, h * 0.42, { scale: 1.3 });
      var colors = palette();
      var end = Date.now() + 2400;
      (function rain() {
        try {
          f({
            particleCount: MOBILE ? 3 : 5,
            angle: 270,
            spread: 70,
            startVelocity: rand(12, 24),
            gravity: 1.15,
            decay: 0.95,
            drift: rand(-0.6, 0.6),
            ticks: 260,
            scalar: rand(0.9, 1.6),
            shapes: ['star'],
            colors: colors,
            origin: { x: Math.random(), y: -0.06 },
            disableForReducedMotion: true
          });
        } catch (e) { return; }
        if (Date.now() < end) setTimeout(rain, 60);
      })();
    }
    function cast() {
      var now = Date.now();
      if (now - lastCast < 1500) return;
      lastCast = now;
      // re-set the text inside a visible live region so it is announced every time
      txt.textContent = '';
      toast.classList.add('is-on');
      setTimeout(function () { txt.textContent = 'נתפסתם בקסם'; }, 40);
      clearTimeout(hideT);
      hideT = setTimeout(function () { toast.classList.remove('is-on'); }, 3400);
      if (REDUCED) return;
      flash();
      shower();
    }
    VM.spell = cast;

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var k = e.key;
      if (!k || k.length !== 1) return;
      buf = (buf + k.toLowerCase()).slice(-12);
      if (/magic$/.test(buf) || /קסם$/.test(buf)) { buf = ''; cast(); }
    });
  }

  /* ======================================================================
     Floating WhatsApp (.wa-fab)
     ====================================================================== */
  function initFab() {
    var fab = document.querySelector('.wa-fab');
    if (!fab) return;
    var heroCta = document.querySelector('.hero__ctas .cta-pill') || document.querySelector('.hero .cta-pill');
    var hero = document.getElementById('top');
    var footCta = document.querySelector('.footer__cta');
    var byHero = !!heroCta, byFoot = false, pastHero = false, peeked = false, ready = false;
    var ctaIn = [];                         // other big WhatsApp CTAs currently on screen

    fab.classList.add('is-managed');
    if (!('IntersectionObserver' in window)) { fab.classList.add('is-shown'); return; }

    var queued = false;
    function update() {
      // several observers report in the same task: apply their combined state once per frame
      if (queued) return;
      queued = true;
      raf(apply);
    }
    function apply() {
      queued = false;
      var show = ready && !byHero && !byFoot && !ctaIn.length;
      fab.classList.toggle('is-shown', show);
      if (show && pastHero && !peeked) {
        peeked = true;
        setTimeout(function () {
          if (!fab.classList.contains('is-shown')) { peeked = false; return; }
          fab.classList.add('is-peek');
          setTimeout(function () { fab.classList.remove('is-peek'); }, 2800);
        }, 700);
      }
    }
    // IntersectionObserver only reports crossings, and an instant jump (or a fast
    // Lenis "back to top" that skips over a small element between two frames)
    // can cross nothing. So the "reached or passed" states use roots stretched
    // far past the viewport: then above/below are always on opposite sides of
    // an edge and every jump is reported.
    var FAR = '100000px';
    function watch(el, margin, fn) {
      if (!el) return;
      new IntersectionObserver(function (entries) {
        fn(entries[entries.length - 1].isIntersecting);
        update();
      }, { rootMargin: margin }).observe(el);
    }
    watch(heroCta, '0px', function (v) { byHero = v; });                         // hero CTA on screen
    watch(footCta, FAR + ' 0px 0px 0px', function (v) { byFoot = v; });          // footer CTA on screen or scrolled past
    watch(hero, '0px 0px ' + FAR + ' 0px', function (v) { pastHero = !v; });     // hero fully scrolled away

    // Any other big in-page WhatsApp CTA on screen (the playground result pill above all, which
    // carries the generated concept text): a second WA circle on top of it only competes with it,
    // and a tap on the covered end would send the generic message instead.
    var CTA_SEL = '.pg [data-wa], .pg .cta-pill, .cta-pill[data-wa], .wa-big';
    var watched = [];
    var ctaIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var i = ctaIn.indexOf(en.target);
        if (en.isIntersecting && en.target.isConnected) { if (i < 0) ctaIn.push(en.target); }
        else if (i >= 0) ctaIn.splice(i, 1);
      });
      update();
    });
    function scanCtas() {
      // drop CTAs that left the DOM (a reset playground result), then pick up new ones
      for (var i = watched.length - 1; i >= 0; i--) {
        var el = watched[i];
        if (el.isConnected) continue;
        ctaIO.unobserve(el);
        watched.splice(i, 1);
        var k = ctaIn.indexOf(el);
        if (k >= 0) ctaIn.splice(k, 1);
      }
      document.querySelectorAll(CTA_SEL).forEach(function (el) {
        if (el === fab || fab.contains(el) || watched.indexOf(el) >= 0) return;
        watched.push(el);
        ctaIO.observe(el);
      });
      update();
    }
    scanCtas();
    // the playground builds its result (and its CTA) on demand. Its code typing mutates the
    // DOM every frame, so only rescan when a CTA was added or a watched one was removed.
    if ('MutationObserver' in window) {
      var SUB = '[data-wa], .cta-pill, .wa-big', scanQueued = false;
      var mo = new MutationObserver(function (recs) {
        if (scanQueued) return;
        var hit = false, removed = false;
        for (var i = 0; i < recs.length && !hit; i++) {
          var add = recs[i].addedNodes;
          for (var j = 0; j < add.length && !hit; j++) {
            var n = add[j];
            if (n.nodeType === 1 && (n.matches(SUB) || n.querySelector(SUB))) hit = true;
          }
          if (recs[i].removedNodes.length) removed = true;
        }
        if (!hit && removed) hit = watched.some(function (w) { return !w.isConnected; });
        if (!hit) return;
        scanQueued = true;
        raf(function () { scanQueued = false; scanCtas(); });
      });
      document.querySelectorAll('.pg').forEach(function (pg) { mo.observe(pg, { childList: true, subtree: true }); });
    }
    whenIntro(function () { ready = true; update(); });
  }

  /* ======================================================================
     Footer: pause offscreen, wordmark scrub, night sky
     ====================================================================== */
  function initFooter() {
    var footer = document.getElementById('contact');
    if (!footer) return;
    if (REDUCED) footer.classList.add('is-static');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        footer.classList.toggle('is-off', !entries[entries.length - 1].isIntersecting);
      }, { rootMargin: '120px 0px' }).observe(footer);
    }
    safe('wordmark', function () { initWordmark(footer); });
    safe('night sky', function () { initNightSky(footer); });
  }

  function initWordmark(footer) {
    var wrap = footer.querySelector('.footer__wordmark');
    var mover = wrap && wrap.querySelector('.footer__wm-move');
    if (!mover || REDUCED || !('IntersectionObserver' in window)) return;
    wrap.classList.add('is-scrub');
    var cur = -1, target = 0, loop = 0, inView = false;

    function measure() {
      var r = wrap.getBoundingClientRect(), vh = window.innerHeight || 1;
      // 0 when its top meets the viewport floor, 1 once its bottom sits 10% above it
      target = clamp((vh - r.top) / (r.height + vh * 0.1), 0, 1);
    }
    function apply(p) {
      var e = 1 - Math.pow(1 - p, 3);
      mover.style.transform = 'translate3d(0,' + ((1 - e) * 58).toFixed(2) + '%,0) scale(' + (0.84 + 0.16 * e).toFixed(4) + ')';
      mover.style.opacity = (0.12 + 0.88 * e).toFixed(3);
    }
    function frame() {
      loop = 0;
      measure();
      cur = cur < 0 ? target : cur + (target - cur) * 0.16;
      if (Math.abs(target - cur) < 0.0008) cur = target;
      apply(cur);
      if (cur !== target && !document.hidden) loop = raf(frame);
    }
    function kick() { if (!loop) loop = raf(frame); }
    measure(); cur = target; apply(cur);
    new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) kick();
    }, { rootMargin: '15% 0px' }).observe(wrap);
    window.addEventListener('scroll', function () { if (inView) kick(); }, { passive: true });
    window.addEventListener('resize', kick);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  }

  // Aceternity "Stars Background" + "Shooting Stars" merged into one canvas
  function initNightSky(footer) {
    var fx = footer.querySelector('.footer__fx');
    if (!fx) return;
    var cv = document.createElement('canvas');
    cv.className = 'footer__stars';
    cv.setAttribute('aria-hidden', 'true');
    fx.appendChild(cv);
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    var DPR = Math.min(window.devicePixelRatio || 1, MOBILE ? 1 : 1.5);
    var w = 0, h = 0, stars = [], shots = [], nextAt = 0, loop = 0, last = 0, visible = false;

    // gold head glow sprite (cheaper than shadowBlur every frame)
    var head = document.createElement('canvas');
    head.width = head.height = 48;
    (function () {
      var g = head.getContext('2d'), rg = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      rg.addColorStop(0, 'rgba(255,253,236,1)');
      rg.addColorStop(0.18, 'rgba(255,236,120,0.95)');
      rg.addColorStop(0.45, 'rgba(255,200,0,0.35)');
      rg.addColorStop(1, 'rgba(255,200,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 48, 48);
    })();

    function running() { return visible && isDark() && !document.hidden && !REDUCED; }
    function resize() {
      var nw = cv.clientWidth, nh = cv.clientHeight;
      if (!nw || !nh) return;
      w = nw; h = nh;
      cv.width = Math.round(w * DPR);
      cv.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var count = Math.min(MOBILE ? 110 : 280, Math.floor(w * h * 0.00015)); // original density
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: rand(0, w), y: rand(0, h),
          r: Math.random() < 0.86 ? rand(0.5, 0.85) : rand(0.95, 1.45),
          tw: rand(0.5, 1), ph: rand(0, 6.28),
          gold: Math.random() < 0.2
        });
      }
      if (!running()) draw(performance.now(), 0, true);
    }
    function spawn() {
      // Aceternity getRandomStartPoint, kept to the two "falling" headings
      var fromTop = Math.random() < 0.5;
      var s = fromTop ? { x: rand(0, w * 0.85), y: 0, a: 45 } : { x: w, y: rand(0, h * 0.45), a: 135 };
      s.sp = rand(10, 30) * (w < 600 ? 0.6 : 1);
      s.d = 0;
      shots.push(s);
    }
    function draw(t, dt, still) {
      ctx.clearRect(0, 0, w, h);
      if (!isDark()) return;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = still ? 0.75 : 0.5 + Math.abs(Math.sin(t * 0.001 / s.tw + s.ph)) * 0.5;
        ctx.fillStyle = s.gold ? '#FCEC68' : '#FFFFFF';
        if (s.r < 0.9) ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
        else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      if (still) return;
      if (t >= nextAt && shots.length < 3) { spawn(); nextAt = t + rand(1200, 4200); }
      var k = dt / 16.67;
      for (var j = shots.length - 1; j >= 0; j--) {
        var sh = shots[j], rad = sh.a * Math.PI / 180, cx = Math.cos(rad), cy = Math.sin(rad);
        sh.x += sh.sp * k * cx;
        sh.y += sh.sp * k * cy;
        sh.d += sh.sp * k;
        var len = Math.min(10 * (1 + sh.d / 100), 190); // newScale = 1 + distance / 100
        var tx = sh.x - cx * len, ty = sh.y - cy * len;
        var g = ctx.createLinearGradient(tx, ty, sh.x, sh.y);
        g.addColorStop(0, 'rgba(200,5,254,0)');
        g.addColorStop(0.55, 'rgba(232,125,244,0.55)');
        g.addColorStop(1, 'rgba(255,232,110,1)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(sh.x, sh.y);
        ctx.stroke();
        ctx.drawImage(head, sh.x - 12, sh.y - 12, 24, 24);
        if (sh.x < -20 || sh.x > w + 20 || sh.y < -20 || sh.y > h + 20) shots.splice(j, 1);
      }
    }
    function frame(t) {
      loop = 0;
      var dt = Math.min(50, t - (last || t));
      last = t;
      draw(t, dt, false);
      if (running()) loop = raf(frame);
    }
    function kick() {
      if (loop || !running()) return;
      last = 0;
      loop = raf(frame);
    }
    if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); }).observe(cv);
    else window.addEventListener('resize', resize);
    resize();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) kick();
      }).observe(cv);
    }
    document.addEventListener('visibilitychange', kick);
    if (typeof VM.on === 'function') {
      VM.on('theme', function () {
        if (!isDark()) { ctx.clearRect(0, 0, w, h); return; }
        if (running()) kick(); else draw(performance.now(), 0, true);
      });
    }
  }

  /* ---------------------------------------------------------------- boot */
  safe('confetti', initConfetti);
  safe('magnetic', initMagnetic);
  safe('wand', initWand);
  safe('spell', initSpell);
  safe('fab', initFab);
  safe('footer', initFooter);
})();
