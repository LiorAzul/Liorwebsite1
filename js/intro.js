/* ==========================================================================
   VibeMagic — intro.js  ·  NEON LOGO INTRO (the owner's logo sting, 2.webp)

   Ported from 21st.dev "Neon Sign" (glass-blown neon) by Meng To / ThreeUI:
   the same stacked tube passes (blurred spill → bloom → saturated tube →
   white-hot core) and ignition flicker, rebuilt as SVG stroke layers so the
   real VibeMagic paths can be stroke-drawn. The beam ignite follows the
   Aceternity "Lamp" (Manu Arora): a glowing line that scales open.

   Sequence (one GSAP timeline, ~3.2s):
     beam ignite → yellow neon draw of all 13 logo subpaths → white-hot bloom →
     magenta shift left to right → solid wipe → beam collapse → haze exit →
     FLIP of the solid logo into the header slot (#site-logo) → overlay gone.

   Runs only while html.intro-pending is set (inline <head> script decides).
   Contract: inserts <div id="vm-intro"> as the first child of <body>, locks
   scroll (VM.lockScroll), sets sessionStorage vm_intro_seen=1 and calls
   VM.introComplete() at handoff. Skip: the "דלגו" button (from ~600ms), any
   click, Esc / Enter / Space, wheel or touch-drag. html.vi-flying hides the
   real header logo while the clone flies. Not played (quiet fade-out instead)
   when the tab is hidden or the page needed > 3.5s to become interactive.
   QA only: ?intro=1&introAt=1500 freezes the sequence at 1500ms.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM;
  var root = document.documentElement;
  if (!VM || !root.classList.contains('intro-pending')) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var VB = { x: -40, y: 160, w: 1640, h: 660 };   // intro SVG viewBox
  var LOGO = { x: 33, y: 219, w: 1502, h: 541 };  // #vm-logo symbol viewBox (and the header svg)
  var gsap = VM.gsap || window.gsap;
  var freezeAt = parseFloat(VM.params && VM.params.get('introAt'));
  var frozen = isFinite(freezeAt);
  var tExec = performance.now();

  var state = 'idle';           // idle → playing → (skipping) → handoff → done
  var selfComplete = false;
  var locked = false;
  var el = {};
  var tl = null;

  /* ---------- helpers ---------- */
  // cubic-bezier(x1,y1,x2,y2) as a GSAP ease (Newton with a bisection fallback)
  function bez(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function sx(u) { return ((ax * u + bx) * u + cx) * u; }
    function sy(u) { return ((ay * u + by) * u + cy) * u; }
    function dx(u) { return (3 * ax * u + 2 * bx) * u + cx; }
    return function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      var u = t, i, x, d;
      for (i = 0; i < 6; i++) {
        x = sx(u) - t;
        if (Math.abs(x) < 1e-5) return sy(u);
        d = dx(u);
        if (Math.abs(d) < 1e-6) break;
        u = Math.min(1, Math.max(0, u - x / d));
      }
      var lo = 0, hi = 1;
      u = t;
      for (i = 0; i < 30; i++) {
        x = sx(u);
        if (Math.abs(x - t) < 1e-5) break;
        if (x < t) lo = u; else hi = u;
        u = (lo + hi) / 2;
      }
      return sy(u);
    };
  }
  var EASE = {
    beam: bez(.65, 0, .15, 1),
    draw: bez(.33, 0, .2, 1),
    shift: bez(.45, 0, .2, 1),
    wipe: bez(.6, 0, .25, 1),
    flip: bez(.7, 0, .2, 1)
  };

  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  function markSeen() { try { sessionStorage.setItem('vm_intro_seen', '1'); } catch (e) { /* storage blocked */ } }

  function complete() {
    selfComplete = true;
    try { VM.introComplete(); } finally { selfComplete = false; }
  }

  function unlock() {
    if (locked) { locked = false; VM.lockScroll(false); }
  }

  /* ---------- DOM ---------- */
  var VIEW = 'viewBox="-40 160 1640 660" aria-hidden="true" focusable="false"';
  var TEMPLATE =
    '<div class="vi-bg"></div>' +
    '<div class="vi-smoke"></div>' +
    '<div class="vi-haze"></div>' +
    '<div class="vi-beamwrap"><div class="vi-beam"><i class="vi-beam__under"></i><i class="vi-beam__line"></i><i class="vi-beam__hot"></i></div></div>' +
    '<div class="vi-flare"></div>' +
    '<div class="vi-stage">' +
      '<svg class="vi-l vi-l--halo" ' + VIEW + '>' +
        '<defs>' +
          // magenta (left of the moving edge) → yellow (right of it); x1/x2 travel left to right
          '<linearGradient id="vi-gHalo" gradientUnits="userSpaceOnUse" x1="-400" y1="0" x2="-160" y2="0"><stop offset="0" stop-color="#D729FF"/><stop offset="1" stop-color="#FFC800"/></linearGradient>' +
          '<linearGradient id="vi-gTube" gradientUnits="userSpaceOnUse" x1="-400" y1="0" x2="-160" y2="0"><stop offset="0" stop-color="#FC38FE"/><stop offset="1" stop-color="#FFE000"/></linearGradient>' +
          '<linearGradient id="vi-gCore" gradientUnits="userSpaceOnUse" x1="-400" y1="0" x2="-160" y2="0"><stop offset="0" stop-color="#FDA7FB"/><stop offset="1" stop-color="#FFFDEC"/></linearGradient>' +
          '<linearGradient id="vi-gHot" gradientUnits="userSpaceOnUse" x1="-400" y1="0" x2="-160" y2="0"><stop offset="0" stop-color="#FFD2FD"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>' +
          // solid wipe: a 2400-unit rect, white with an 18% (~430u) soft right edge
          '<linearGradient id="vi-wipeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>' +
          '<mask id="vi-wipe" maskUnits="userSpaceOnUse" x="-40" y="160" width="1640" height="660"><rect class="vi-wipeRect" x="-2400" y="160" width="2400" height="660" fill="url(#vi-wipeGrad)"/></mask>' +
        '</defs>' +
        '<g class="vi-g" stroke="url(#vi-gHalo)"></g>' +
      '</svg>' +
      '<svg class="vi-l vi-l--bloom" ' + VIEW + '><g class="vi-g" stroke="url(#vi-gTube)"></g></svg>' +
      '<svg class="vi-l vi-l--tube" ' + VIEW + '>' +
        '<g class="vi-g vi-g--tube" stroke="url(#vi-gTube)"></g>' +
        '<g class="vi-g vi-g--core" stroke="url(#vi-gCore)"></g>' +
        '<g class="vi-g vi-g--hot" stroke="url(#vi-gHot)"></g>' +
      '</svg>' +
      '<div class="vi-fly"><svg class="vi-solid" ' + VIEW + '><g class="vi-solid__g" mask="url(#vi-wipe)" fill="currentColor"></g></svg></div>' +
    '</div>' +
    '<button class="vi-skip" type="button" aria-label="דלגו על הפתיח">' +
      '<span>דלגו</span><svg class="i" aria-hidden="true"><use href="#i-chevron"/></svg><i class="vi-skip__bar"></i>' +
    '</button>';

  function mount() {
    var sym = document.getElementById('vm-logo');
    var src = sym ? sym.querySelectorAll('path') : [];
    if (!src.length) throw new Error('logo symbol #vm-logo not found');

    var host = document.createElement('div');
    host.id = 'vm-intro';
    host.innerHTML = TEMPLATE;
    document.body.insertBefore(host, document.body.firstChild);

    var q = function (s) { return host.querySelector(s); };
    el = {
      host: host, bg: q('.vi-bg'), smoke: q('.vi-smoke'), haze: q('.vi-haze'),
      beamWrap: q('.vi-beamwrap'), beam: q('.vi-beam'), beamHot: q('.vi-beam__hot'), flare: q('.vi-flare'),
      stage: q('.vi-stage'), halo: q('.vi-l--halo'), bloom: q('.vi-l--bloom'), tube: q('.vi-l--tube'),
      hot: q('.vi-g--hot'), fly: q('.vi-fly'), solid: q('.vi-solid'), wipe: q('.vi-wipeRect'),
      skip: q('.vi-skip'), skipBar: q('.vi-skip__bar'),
      grads: host.querySelectorAll('linearGradient[id^="vi-g"]')
    };

    var groups = [
      host.querySelector('.vi-l--halo .vi-g'),
      host.querySelector('.vi-l--bloom .vi-g'),
      host.querySelector('.vi-g--tube'),
      host.querySelector('.vi-g--core'),
      el.hot
    ];
    var solidG = q('.vi-solid__g');

    // split every compound path into its subpaths (absolute M/L/C/Z only) → 13 strokes
    var subs = [];
    Array.prototype.forEach.call(src, function (p) {
      var d = p.getAttribute('d') || '';
      solidG.appendChild(svgEl('path', { d: d }));
      var thin = !!(p.closest && p.closest('.lg-magic'));
      d.trim().split(/(?=M)/).forEach(function (sd) {
        sd = sd.trim();
        if (sd) subs.push({ d: sd, parent: p, thin: thin });
      });
    });

    var vars = {};
    subs.forEach(function (s, i) {
      var style = 'stroke-dashoffset:var(--o' + i + ');stroke-opacity:var(--f' + i + ')';
      groups.forEach(function (g, gi) {
        var path = svgEl('path', { d: s.d, pathLength: '1', style: style });
        if (s.thin) path.setAttribute('class', 'is-thin');
        g.appendChild(path);
        if (gi === 2) s.node = path;
      });
      vars['--o' + i] = 1;
      vars['--f' + i] = 0;
    });
    Object.keys(vars).forEach(function (k) { el.stage.style.setProperty(k, String(vars[k])); });

    // geometry for the stagger: bbox minX (left → right sweep) and outline length
    subs.forEach(function (s) {
      var b = null, len = 900;
      try { b = s.node.getBBox(); } catch (e) { /* not rendered */ }
      try { len = s.node.getTotalLength(); } catch (e) { /* keep default */ }
      s.box = b || { x: 0, y: 0, width: 0, height: 0 };
      s.len = len;
    });
    // a subpath fully inside a sibling of the same compound path is a counter (b, A)
    subs.forEach(function (s) {
      s.counter = subs.some(function (o) {
        return o !== s && o.parent === s.parent &&
          s.box.x > o.box.x && s.box.y > o.box.y &&
          s.box.x + s.box.width < o.box.x + o.box.width && s.box.y + s.box.height < o.box.y + o.box.height;
      });
    });
    return subs;
  }

  /* ---------- timeline ---------- */
  function build(subs) {
    var minX = Infinity, maxX = -Infinity;
    subs.forEach(function (s) { minX = Math.min(minX, s.box.x); maxX = Math.max(maxX, s.box.x); });
    var span = Math.max(1, maxX - minX);

    tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

    // 200-650 beam ignite (+ flicker over its first 130ms), smoke rises (light only)
    tl.fromTo(el.beam, { scaleX: 0 }, { scaleX: 1, duration: .45, ease: EASE.beam }, .2);
    tl.to(el.beamWrap, { keyframes: { opacity: [0, 1, .3, .9, .5, 1], easeEach: 'none' }, duration: .13 }, .2);
    tl.to(el.smoke, { opacity: 1, duration: .5, ease: 'power1.out' }, .2);

    // 350-1300 yellow neon draw, staggered by left edge, each with an ignition flicker
    subs.forEach(function (s, i) {
      var at = .35 + .315 * (s.box.x - minX) / span + (s.counter ? .03 : 0);
      var dur = Math.min(.76, Math.max(.56, .52 + s.len * .00012));
      var o = {}; o['--o' + i] = 0;
      o.duration = dur;
      o.ease = EASE.draw;
      tl.to(el.stage, o, at);
      var kf = {}; kf['--f' + i] = [0, 1, .35, 1, .6, 1]; kf.easeEach = 'none';
      tl.to(el.stage, { keyframes: kf, duration: .26 }, at);
    });

    // 950-1350 white-hot bloom: hot cores, a brighter beam glow and a flare over "vibe"
    tl.to(el.hot, { opacity: 1, duration: .4, ease: 'power1.out' }, .95);
    tl.to(el.beamHot, { opacity: 1, duration: .4, ease: 'power1.out' }, .95);
    tl.fromTo(el.flare, { opacity: 0, scale: .55 }, { opacity: 1, scale: 1, duration: .38, ease: 'power2.out' }, .95);
    tl.to(el.flare, { opacity: 0, scale: 1.15, duration: .55, ease: 'power1.in' }, 1.45);

    // 1150-1800 magenta shift left to right (gradient edge travels), haze rises and drifts
    tl.to(el.grads, { attr: { x1: 1760, x2: 2000 }, duration: .65, ease: EASE.shift }, 1.15);
    tl.to(el.haze, { opacity: 1, duration: .25, ease: 'power1.out' }, 1.15);
    tl.fromTo(el.haze, { xPercent: -20.6 }, { xPercent: 26, duration: 1.55, ease: 'sine.inOut' }, 1.15);

    // 1600-2350 solid wipe; the neon cools away under it (1750-2400)
    tl.to(el.wipe, { attr: { x: -40 }, duration: .75, ease: EASE.wipe }, 1.6);
    tl.to([el.halo, el.bloom, el.tube], { opacity: 0, duration: .65, ease: 'power1.in' }, 1.75);

    // 1750-2250 beam collapse, 1900-2400 smoke out, 2200-2700 haze exit
    tl.to(el.beam, { scaleY: 0, duration: .5, ease: 'power2.in' }, 1.75);
    tl.to(el.beamWrap, { opacity: 0, duration: .5, ease: 'power2.in' }, 1.75);
    tl.to(el.smoke, { opacity: 0, duration: .5, ease: 'power1.in' }, 1.9);
    tl.to(el.haze, { opacity: 0, duration: .5, ease: 'power1.in' }, 2.2);

    // skip affordance (appears at 600ms, progress hairline, leaves before handoff)
    tl.fromTo(el.skip, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .35, ease: 'power2.out' }, .6);
    tl.fromTo(el.skipBar, { scaleX: 0 }, { scaleX: 1, duration: 2.7 }, 0);
    tl.to(el.skip, { autoAlpha: 0, duration: .25, ease: 'power1.in' }, 2.45);

    // 2700 handoff
    tl.call(handoff, null, 2.7);
  }

  /* ---------- skip ---------- */
  function onKey(e) {
    var k = e.key;
    if (k === 'Escape' || k === 'Enter' || k === ' ' || k === 'Spacebar') { e.preventDefault(); skip(); }
  }
  function onWheel(e) { if (Math.abs(e.deltaY) + Math.abs(e.deltaX) > 2) skip(); }
  function onClick() { skip(); }
  function attachSkip() {
    el.host.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchmove', onClick, { passive: true });
  }
  function detachSkip() {
    if (!el.host) return;
    el.host.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchmove', onClick);
  }

  function skip() {
    if (state !== 'playing') return;
    state = 'skipping';
    detachSkip();
    var t = tl.time();
    tl.pause();
    var st = gsap.timeline();
    st.to([el.halo, el.bloom, el.tube, el.beamWrap, el.smoke, el.haze, el.flare], { opacity: 0, duration: .25, ease: 'power1.out' }, 0);
    st.to(el.skip, { autoAlpha: 0, duration: .2 }, 0);
    if (t < 1.6) {
      gsap.set(el.wipe, { attr: { x: -40 } });
      st.fromTo(el.solid, { opacity: 0 }, { opacity: 1, duration: .25, ease: 'power1.out' }, 0);
    } else if (t < 2.35) {
      st.to(el.wipe, { attr: { x: -40 }, duration: .25, ease: 'power2.out' }, 0);
    }
    st.call(handoff, null, .25);
  }

  /* ---------- FLIP handoff into the header logo slot ---------- */
  function targetBox() {
    var a = document.getElementById('site-logo');
    if (!a) return null;
    var svg = a.querySelector('svg') || a;
    var r = svg.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null;
    // content box of the logo inside its svg (preserveAspectRatio: xMidYMid meet)
    var vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : LOGO;
    var aspect = vb.width / vb.height, w = r.width, h = r.height;
    if (w / h > aspect) w = h * aspect; else h = w / aspect;
    return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w: w, h: h };
  }

  function handoff() {
    if (state === 'handoff' || state === 'done') return;
    state = 'handoff';
    detachSkip();
    if (tl) tl.pause();
    markSeen();
    el.host.classList.add('is-leaving');

    // measure the clone before anything moves
    var sr = el.stage.getBoundingClientRect();
    var k = sr.width / VB.w;
    var S = { x: sr.left + (LOGO.x - VB.x) * k, y: sr.top + (LOGO.y - VB.y) * k, w: LOGO.w * k, h: LOGO.h * k };
    var scx = S.x + S.w / 2, scy = S.y + S.h / 2;
    el.fly.style.transformOrigin = (scx - sr.left).toFixed(2) + 'px ' + (scy - sr.top).toFixed(2) + 'px';
    el.fly.style.willChange = 'transform, opacity';

    // reveal the page under the overlay so the hero entrance plays as the backdrop dissolves;
    // the header logo stays hidden (html.vi-flying) until the clone lands on it
    root.classList.add('vi-flying');
    complete();

    var T = targetBox();
    var last = T;
    var proxy = { p: 0 };
    function place() {
      var p = proxy.p;
      if (!last) { // no visible slot: settle in place
        el.fly.style.transform = 'scale(' + (1 - .1 * p).toFixed(4) + ')';
        return;
      }
      var t = targetBox() || last;   // track the slot live (the header may still be easing in)
      last = t;
      var s = t.w / S.w;
      var dx = t.x + t.w / 2 - scx, dy = t.y + t.h / 2 - scy;
      el.fly.style.transform = 'translate3d(' + (dx * p).toFixed(2) + 'px,' + (dy * p).toFixed(2) + 'px,0) scale(' + (1 + (s - 1) * p).toFixed(4) + ')';
    }

    // two frames of slack so heavy 'intro:done' handlers don't eat the first frames of the flight
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var ht = gsap.timeline({ onComplete: cleanup });
        ht.to(proxy, { p: 1, duration: .48, ease: EASE.flip, onUpdate: place }, 0);
        ht.to(el.bg, { opacity: 0, duration: .45, ease: 'power1.inOut' }, .05);
        if (!T) ht.to(el.fly, { opacity: 0, duration: .4, ease: 'power1.in' }, .05);
        ht.call(function () { root.classList.remove('vi-flying'); }, null, .46);
        ht.to(el.fly, { opacity: 0, duration: .16, ease: 'power1.out' }, .46);
      });
    });
  }

  function cleanup() {
    state = 'done';
    root.classList.remove('vi-flying');
    detachSkip();
    if (tl) { tl.kill(); tl = null; }
    if (el.host && el.host.parentNode) el.host.parentNode.removeChild(el.host);
    VM.off('intro:done', onExternalDone);
    document.removeEventListener('visibilitychange', onVisibility);
    unlock();
  }

  // instant, quiet exit (error, hidden tab, too late to play, or a failsafe fired)
  function bail(remember) {
    if (state === 'done') return;
    state = 'done';
    if (remember) markSeen();
    detachSkip();
    if (tl) { tl.kill(); tl = null; }
    root.classList.remove('vi-flying');
    complete();
    var host = el.host;
    if (host && host.parentNode) {
      host.style.transition = 'opacity .35s ease';
      host.style.pointerEvents = 'none';
      host.style.opacity = '0';
      setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 380);
    }
    VM.off('intro:done', onExternalDone);
    document.removeEventListener('visibilitychange', onVisibility);
    unlock();
  }

  // core.js failsafe (6.5s) or anyone else completing the intro first
  function onExternalDone() {
    if (selfComplete || frozen || state === 'handoff' || state === 'done') return;
    bail(true);
  }

  // a tab opened in the background should not replay a stale sting when it is focused
  function onVisibility() {
    if (document.hidden && state === 'idle') bail(false);
  }

  /* ---------- start ---------- */
  var started = false;
  function start() {
    if (started) return;
    started = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (state !== 'idle') return;
        // core.js forces completion 6.5s after it ran: only play if the whole sting fits.
        // On a slow load the visitor has already waited, so don't add 3s more (?intro=1 forces it).
        var now = performance.now();
        var slow = now > 3500 && !(VM.params && VM.params.get('intro') === '1');
        if (document.hidden || now - tExec > 3000 || slow) { bail(false); return; }
        state = 'playing';
        if (frozen) { tl.pause(Math.max(0, freezeAt) / 1000); return; }
        attachSkip();
        tl.play(0);
      });
    });
  }

  try {
    if (!gsap || VM.reduced) throw new Error('intro skipped (no gsap or reduced motion)');
    VM.lockScroll(true);
    locked = true;
    var subs = mount();
    build(subs);
    VM.on('intro:done', onExternalDone);
    document.addEventListener('visibilitychange', onVisibility);
    if (document.readyState === 'complete') start();
    else {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      window.addEventListener('load', start, { once: true });
      setTimeout(start, 600);
    }
  } catch (err) {
    if (!/intro skipped/.test(String(err && err.message))) console.warn('[intro] skipped:', err);
    bail(true);
  }
})();
