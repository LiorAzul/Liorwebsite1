/* ==========================================================================
   VibeMagic — services.js
   #vibe beam diagram · #services bento loops · global [data-spotlight] cards

   21st.dev components ported to vanilla JS (no framer-motion / motion):
     · Magic Card ........ Dillion Verma (Magic UI)
         pointer position → --mx/--my (radial spotlight painted by css ::before)
     · Glowing Effect .... Manu Arora (Aceternity UI)
         pointer angle around the card centre → --start (conic wedge mask on ::after),
         --active inside rect+proximity; motion's 2s easeOutExpo tween → rAF lerp
     · Animated Beam ..... Dillion Verma (Magic UI)
         SVG overlay, paths measured from node rects (ResizeObserver), a faint base path
         plus a userSpaceOnUse linearGradient whose x1/y1/x2/y2 are swept along each wire
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM || {};
  var NS = 'http://www.w3.org/2000/svg';
  var reduced = VM.reduced != null ? !!VM.reduced : matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function slice(list) { return Array.prototype.slice.call(list); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function safe(name, fn) {
    try { fn(); } catch (e) { console.error('[services] ' + name + ' failed', e); }
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /* ======================================================================
     1. [data-spotlight]: Magic Card spotlight + Glowing Effect border arc
     ====================================================================== */
  function initSpotlight() {
    var cards = slice(document.querySelectorAll('[data-spotlight]'));
    if (!cards.length) return;
    var fine = VM.finePointer != null ? VM.finePointer : matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine || !hasIO) return;               // touch: css shows a static gradient border

    var PROXIMITY = 64, INACTIVE_ZONE = 0.01;  // demo settings of the original
    var state = new Map();
    cards.forEach(function (c) { state.set(c, { cur: 0, tgt: 0, act: 0 }); });

    var visible = new Set();
    var mx = -1e5, my = -1e5, queued = false, animating = false, last = 0;

    function setActive(card, a) {
      var s = state.get(card);
      if (s.act !== a) { s.act = a; card.style.setProperty('--active', String(a)); }
    }
    function setVar(card, s, name, v) {
      if (s[name] === v) return;
      s[name] = v;
      card.style.setProperty(name, v);
    }
    function ask() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    }
    // all rect reads first, then all custom-property writes: interleaving them forced a
    // style recalc per card on every pointer frame
    function measure() {
      queued = false;
      var rects = [];
      visible.forEach(function (card) { rects.push(card, card.getBoundingClientRect()); });
      for (var i = 0; i < rects.length; i += 2) write(rects[i], rects[i + 1]);
      if (!animating) {
        animating = true;
        last = performance.now();
        requestAnimationFrame(tick);
      }
    }
    function write(card, r) {
      if (!r.width) return;
      var s = state.get(card);
      if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
        setVar(card, s, '--mx', (mx - r.left).toFixed(1) + 'px');
        setVar(card, s, '--my', (my - r.top).toFixed(1) + 'px');
        setVar(card, s, '--px', ((mx - r.left) / r.width).toFixed(3));
      }
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var near = mx > r.left - PROXIMITY && mx < r.right + PROXIMITY && my > r.top - PROXIMITY && my < r.bottom + PROXIMITY;
      var dead = Math.hypot(mx - cx, my - cy) < 0.5 * Math.min(r.width, r.height) * INACTIVE_ZONE;
      var on = near && !dead ? 1 : 0;
      setActive(card, on);
      if (!on) return;
      var target = Math.atan2(my - cy, mx - cx) * 180 / Math.PI + 90;
      // shortest way round (the original's % keeps the sign, so it is wrapped twice here)
      var diff = ((((target - s.cur + 180) % 360) + 360) % 360) - 180;
      s.tgt = s.cur + diff;
    }
    // stands in for motion's animate(current, target, { duration: 2, ease: [.16, 1, .3, 1] })
    function tick(now) {
      var k = 1 - Math.pow(1 - 0.075, Math.min(64, now - last) / 16.667);
      last = now;
      var moving = false;
      visible.forEach(function (card) {
        var s = state.get(card), d = s.tgt - s.cur;
        if (Math.abs(d) > 0.05) {
          s.cur += d * k;
          moving = true;
          card.style.setProperty('--start', s.cur.toFixed(2));
        }
      });
      animating = moving;
      if (moving) requestAnimationFrame(tick);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target);
        else { visible.delete(e.target); setActive(e.target, 0); }
      });
      ask();
    }, { rootMargin: '120px 0px' });
    cards.forEach(function (c) { io.observe(c); });

    function away() { mx = my = -1e5; ask(); }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      ask();
    }, { passive: true });
    document.addEventListener('mouseout', function (e) { if (!e.relatedTarget) away(); });
    window.addEventListener('blur', away);
    window.addEventListener('scroll', ask, { passive: true });
  }

  /* ======================================================================
     2. #vibe beam diagram (Animated Beam)
     inputs [data-beam-from] → core [data-beam-core] → outputs [data-beam-to]
     ====================================================================== */
  function initBeamflow(box) {
    var core = box.querySelector('[data-beam-core]');
    if (!core) return;
    var orb = core.querySelector('.beamflow__orb') || core;
    var froms = slice(box.querySelectorAll('[data-beam-from]'));
    var tos = slice(box.querySelectorAll('[data-beam-to]'));
    if (!froms.length && !tos.length) return;

    var svg = svgEl('svg', { 'class': 'beamflow__svg', 'aria-hidden': 'true', focusable: 'false' });
    var defs = svgEl('defs'), gBase = svgEl('g'), gGlow = svgEl('g'), gPulse = svgEl('g');
    svg.appendChild(defs); svg.appendChild(gBase); svg.appendChild(gGlow); svg.appendChild(gPulse);

    // choreography (seconds): inputs fire toward the core, the core charges, then emits to the outputs
    var T = 5.8, D = 1.6;
    var IN_ORDER = [2, 0, 3, 1], OUT_ORDER = [1, 3, 0, 2];
    var beams = [];

    function addBeam(node, kind, i, n) {
      var id = 'vm-beam-' + beams.length;
      var grad = svgEl('linearGradient', { id: id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 0 });
      // head (offset 0) fades in to yellow, then pink, purple tail fading out: yellow leads, as in the brand axis
      [[0, 'a', 0], [0.1, 'a', 1], [0.42, 'b', 1], [0.74, 'c', 1], [1, 'c', 0]].forEach(function (s) {
        grad.appendChild(svgEl('stop', { offset: s[0], 'class': 's-' + s[1], 'stop-opacity': s[2] }));
      });
      defs.appendChild(grad);
      var order = kind === 'in' ? IN_ORDER : OUT_ORDER;
      var slot = n === order.length ? order.indexOf(i) : i;
      var stagger = 1.05 / Math.max(1, n - 1);
      beams.push({
        node: node, kind: kind, grad: grad,
        base: gBase.appendChild(svgEl('path', { 'class': 'b-base' })),
        glow: gGlow.appendChild(svgEl('path', { 'class': 'b-glow', stroke: 'url(#' + id + ')' })),
        pulse: gPulse.appendChild(svgEl('path', { 'class': 'b-pulse', stroke: 'url(#' + id + ')' })),
        dep: kind === 'in' ? slot * stagger : 2.65 + slot * stagger * 0.9,
        lastE: -1, hot: -1, ok: false
      });
    }
    froms.forEach(function (n, i) { addBeam(n, 'in', i, froms.length); });
    tos.forEach(function (n, i) { addBeam(n, 'out', i, tos.length); });
    box.insertBefore(svg, box.firstChild);

    function rel(r, sr) {
      return { l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top, b: r.bottom - sr.top,
        cx: r.left - sr.left + r.width / 2, cy: r.top - sr.top + r.height / 2, w: r.width, h: r.height };
    }
    function f1(v) { return Math.round(v * 10) / 10; }

    function layout() {
      var sr = svg.getBoundingClientRect();
      if (!sr.width || !sr.height) return;
      svg.setAttribute('viewBox', '0 0 ' + f1(sr.width) + ' ' + f1(sr.height));
      var o = rel(orb.getBoundingClientRect(), sr);
      var C = { x: o.cx, y: o.cy }, R = o.w / 2 + 2;
      var vertical = (getComputedStyle(box).getPropertyValue('--beam-axis') || '').trim() === 'y';

      ['in', 'out'].forEach(function (kind) {
        var list = beams.filter(function (b) { return b.kind === kind; });
        if (!list.length) return;
        list.forEach(function (b) { b.r = rel(b.node.getBoundingClientRect(), sr); b.straight = false; });

        if (!vertical) {
          // columns: anchor on the node side that faces the core, fan the endpoints over the orb's side arc
          list.forEach(function (b) {
            var side = b.r.cx >= C.x ? 1 : -1;
            b.side = side;
            b.anchor = { x: side > 0 ? b.r.l - 4 : b.r.r + 4, y: b.r.cy };
            b.ta = { x: -side, y: 0 };
          });
          list.sort(function (a, c) { return a.anchor.y - c.anchor.y; });
          list.forEach(function (b, k) {
            var f = list.length > 1 ? k / (list.length - 1) : 0.5;
            var deg = -38 + 76 * f;
            var th = (b.side > 0 ? deg : 180 - deg) * Math.PI / 180;
            b.n = { x: Math.cos(th), y: Math.sin(th) };
          });
        } else {
          // stacked: the row next to the core leaves from its facing edge, the far row from its inner side
          // and runs down/up the channel between the near row's nodes
          var minDy = Infinity;
          list.forEach(function (b) { minDy = Math.min(minDy, Math.abs(b.r.cy - C.y)); });
          list.forEach(function (b) {
            var side = b.r.cy < C.y ? -1 : 1;
            b.side = side;
            if (Math.abs(b.r.cy - C.y) - minDy < 6) {
              b.anchor = { x: b.r.cx, y: side < 0 ? b.r.b + 4 : b.r.t - 4 };
              b.ta = { x: 0, y: -side };
            } else {
              var hs = b.r.cx < C.x ? 1 : -1;
              b.anchor = { x: hs > 0 ? b.r.r + 3 : b.r.l - 3, y: b.r.cy };
              b.ta = { x: hs, y: 0 };
              b.straight = true;
            }
          });
          list.sort(function (a, c) { return a.anchor.x - c.anchor.x; });
          list.forEach(function (b, k) {
            var f = list.length > 1 ? k / (list.length - 1) : 0.5;
            var deg = -34 + 68 * f;
            var th = (b.side < 0 ? -90 + deg : 90 - deg) * Math.PI / 180;
            b.n = { x: Math.cos(th), y: Math.sin(th) };
          });
        }

        list.forEach(function (b) {
          var E = { x: C.x + R * b.n.x, y: C.y + R * b.n.y };
          var A = b.anchor;
          var dist = Math.hypot(E.x - A.x, E.y - A.y);
          var k = clamp(dist * 0.42, 18, 170);
          var kA = b.straight ? Math.max(6, Math.abs(A.x - C.x) * 0.8) : k;
          var nE = b.straight ? { x: 0, y: b.side } : b.n;   // channel beams meet the orb vertically
          var A2 = { x: A.x + b.ta.x * kA, y: A.y + b.ta.y * kA };
          var E2 = { x: E.x + nE.x * k, y: E.y + nE.y * k };
          var P0, P1, P2, P3;
          if (b.kind === 'in') { P0 = A; P1 = A2; P2 = E2; P3 = E; }
          else { P0 = E; P1 = E2; P2 = A2; P3 = A; }
          var d = 'M' + f1(P0.x) + ',' + f1(P0.y) + ' C' + f1(P1.x) + ',' + f1(P1.y) + ' ' + f1(P2.x) + ',' + f1(P2.y) + ' ' + f1(P3.x) + ',' + f1(P3.y);
          b.base.setAttribute('d', d);
          b.glow.setAttribute('d', d);
          b.pulse.setAttribute('d', d);
          var dx = P3.x - P0.x, dy = P3.y - P0.y, L = Math.hypot(dx, dy) || 1;
          b.P0 = P0; b.u = { x: dx / L, y: dy / L }; b.L = L;
          b.band = clamp(L * 0.5, 70, 180);
          b.lastE = -1;
          b.ok = true;
        });
      });
      if (reduced) paintStatic(); else if (!running) paint(clock);
    }

    function setGrad(b, s, band) {
      var hx = b.P0.x + b.u.x * s, hy = b.P0.y + b.u.y * s;
      b.grad.setAttribute('x1', f1(hx));
      b.grad.setAttribute('y1', f1(hy));
      b.grad.setAttribute('x2', f1(hx - b.u.x * band));
      b.grad.setAttribute('y2', f1(hy - b.u.y * band));
    }
    // reduced motion: one still gradient over the whole wire
    function paintStatic() {
      beams.forEach(function (b) { if (b.ok) setGrad(b, b.L * 1.12, b.L * 1.3); });
      orb.style.setProperty('--charge', '0.55');
    }

    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function bell(tau, c, w) {
      var d = tau - c;
      d -= T * Math.round(d / T);
      return Math.exp(-(d * d) / (w * w));
    }
    function paint(clk) {
      var tau = clk % T, charge = 0;
      beams.forEach(function (b) {
        if (!b.ok) return;
        var t = (tau - b.dep) / D;
        var e = t <= 0 ? 0 : t >= 1 ? 1 : ease(t);
        if (e !== b.lastE) {
          b.lastE = e;
          setGrad(b, e * (b.L + b.band), b.band);
        }
        var hot;
        if (b.kind === 'in') {
          hot = bell(tau, b.dep + 0.08, 0.32);
          charge += bell(tau, b.dep + D * 0.9, 0.34);
        } else {
          hot = bell(tau, b.dep + D * 0.92, 0.36);
          charge += 0.8 * bell(tau, b.dep + 0.05, 0.3);
        }
        hot = Math.round(hot * 50) / 50;
        if (hot !== b.hot) { b.hot = hot; b.node.style.setProperty('--hot', String(hot)); }
      });
      charge = Math.round(clamp(charge, 0, 1) * 50) / 50;
      if (charge !== lastCharge) { lastCharge = charge; orb.style.setProperty('--charge', String(charge)); }
    }

    // running starts unknown (null) so the first sync() always writes --beam-play: the CSS
    // fallback is `running`, and the orb/ring/sparkle loops would otherwise spin off screen
    // until the diagram had been seen once
    var clock = 0.35, lastCharge = -1, raf = 0, last = 0, running = null, inView = false;
    function frame(now) {
      raf = 0;
      if (!running) return;
      clock += last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      paint(clock);
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      var should = !reduced && inView && !document.hidden;
      if (should === running) return;
      running = should;
      box.style.setProperty('--beam-play', should ? 'running' : 'paused');
      if (should) { last = 0; if (!raf) raf = requestAnimationFrame(frame); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    var queued = false;
    function relayout() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; safe('beam layout', layout); });
    }
    layout();
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(relayout);
      ro.observe(box);
      ro.observe(orb);
    } else {
      window.addEventListener('resize', relayout);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    window.addEventListener('load', relayout);

    if (hasIO) {
      new IntersectionObserver(function (es) {
        inView = es[es.length - 1].isIntersecting;
        if (inView) relayout();
        sync();
      }, { rootMargin: '60px 0px' }).observe(box);
    } else {
      inView = true;
    }
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  /* ======================================================================
     3. #services: run the card loops only on screen + terminal typing
     ====================================================================== */
  function initTerminal(card) {
    var term = card.querySelector('.svc-term');
    if (!term) return null;
    var codes = slice(term.querySelectorAll('code'));
    if (!codes.length) return null;

    // split "> text" into a coloured prompt + the typed part (no-JS keeps the plain text)
    var lines = codes.map(function (c) {
      var txt = c.textContent.trim();
      var m = /^(\S{1,2})\s+([\s\S]+)$/.exec(txt);
      var pre = document.createElement('span');
      var body = document.createElement('span');
      pre.className = 'svc-term__p';
      body.className = 'svc-term__t';
      pre.textContent = m ? m[1] : '';
      body.textContent = m ? m[2] : txt;
      c.textContent = '';
      c.appendChild(pre);
      c.appendChild(body);
      return { code: c, pre: pre, body: body, full: body.textContent };
    });
    if (reduced) return null;

    var caret = document.createElement('span');
    caret.className = 'svc-term__caret';
    var timer = 0, live = false, busy = false;

    function later(fn, ms) {
      timer = setTimeout(function () { timer = 0; if (live) fn(); else busy = false; }, ms);
    }
    function typeLine(k, done) {
      var l = lines[k], i = 0, chars = Array.from(l.full);
      l.pre.style.visibility = '';
      l.code.appendChild(caret);
      (function next() {
        if (i >= chars.length) { done(); return; }
        i++;
        l.body.textContent = chars.slice(0, i).join('');
        later(next, (k === 0 ? 58 : 74) + Math.random() * 46);
      })();
    }
    function cycle() {
      busy = true;
      term.classList.remove('is-building', 'is-fading');
      term.classList.add('is-typing');
      lines.forEach(function (l) { l.body.textContent = ''; l.pre.style.visibility = 'hidden'; });
      later(function () {
        typeLine(0, function () {
          later(function () {
            var rest = 1;
            (function nextLine() {
              if (rest >= lines.length) {
                term.classList.remove('is-typing');
                term.classList.add('is-building');
                later(function () {
                  term.classList.add('is-fading');
                  later(cycle, 420);
                }, 3600);
                return;
              }
              typeLine(rest++, function () { later(nextLine, 260); });
            })();
          }, 520);
        });
      }, 380);
    }
    // off screen the terminal rests on its finished state (full text, full bar)
    function rest() {
      if (timer) { clearTimeout(timer); timer = 0; }
      busy = false;
      term.classList.remove('is-typing', 'is-building', 'is-fading');
      lines.forEach(function (l) { l.body.textContent = l.full; l.pre.style.visibility = ''; });
      if (caret.parentNode) caret.parentNode.removeChild(caret);
    }
    return {
      setLive: function (on) {
        live = on;
        if (on && !busy) cycle();
        else if (!on) rest();
      }
    };
  }

  function initServices() {
    var cards = slice(document.querySelectorAll('.bento .svc'));
    if (!cards.length) return;
    var mentor = document.querySelector('.bento .svc--mentor');
    var term = mentor ? initTerminal(mentor) : null;
    if (!hasIO) {
      cards.forEach(function (c) { c.classList.add('is-live'); });
      if (term) term.setLive(true);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.classList.toggle('is-live', e.isIntersecting);
        if (term && e.target === mentor) term.setLive(e.isIntersecting);
      });
    }, { rootMargin: '40px 0px' });
    cards.forEach(function (c) { io.observe(c); });
  }

  /* ---------- boot ---------- */
  safe('spotlight', initSpotlight);
  slice(document.querySelectorAll('[data-beamflow]')).forEach(function (box) {
    safe('beamflow', function () { initBeamflow(box); });
  });
  safe('services', initServices);
})();
