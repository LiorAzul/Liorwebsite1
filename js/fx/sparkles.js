/* ==========================================================================
   VibeMagic · sparkles.js
   A generic canvas "magic dust" field for every canvas[data-sparkles] on the
   page (hero + footer). Vanilla port that merges two 21st.dev components:
     · Aceternity UI "Sparkles" (SparklesCore) by Manu Arora: the tsparticles
       config boiled down: density per 400x400 px, random size, slow random
       drift with "out" edge wrapping, opacity ping-pong twinkle, and a click
       that pushes a few more particles.
     · Magic UI "Particles" by Dillion Verma: per-particle magnetism that eases
       each speck toward the cursor (translate += (mouse / (staticity /
       magnetism) - translate) / ease), soft alpha near the canvas edges, and a
       fade-in toward a target alpha.
   VibeMagic additions: glowing sprite rendering (cheap drawImage instead of
   arc fills), ~4% of the specks are tiny 4-point sparkles (the poster motif),
   theme-aware colours (gold / lilac / white glow on dark; deeper gold #C98000
   and purple #B04BE0 at lower alpha on white), one shared rAF ticker that
   only runs visible canvases, DPR cap plus a backing-store budget (a field
   taller than the screen paints only the band around the viewport), reduced
   motion = one static scatter.
   Options (data attributes on the canvas):
     data-density   particles per 400x400 px (default 46)
     data-speed     drift + twinkle speed multiplier (default 1)
     data-magnet    "0" turns the cursor magnetism off
   Exposes: VM.sparkles = { refresh(), burst(clientX, clientY) }.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM || (window.VM = {});
  var TAU = Math.PI * 2;
  var STAR = 'M50 0C53 33 67 47 100 50C67 53 53 67 50 100C47 67 33 53 0 50C33 47 47 33 50 0Z';
  var DPR_CAP = VM.isMobile ? 1 : 1.5;
  var MAX = VM.isMobile ? 220 : 650;
  var STATICITY = 50, EASE = 50; // Magic UI defaults

  // colour slots: gold, lilac, white (dark) / deep gold, purple, violet (light)
  var COLORS = {
    dark: ['#FFA600', '#E08AF7', '#FFFFFF', '#FDC967'],
    light: ['#C98000', '#B04BE0', '#9A34D4', '#B87400']
  };
  var SLOT_WEIGHTS = [0.34, 0.3, 0.24, 0.12];
  var THEME_ALPHA = { dark: 1, light: 0.72 };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pickSlot() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < SLOT_WEIGHTS.length; i++) { acc += SLOT_WEIGHTS[i]; if (r <= acc) return i; }
    return 0;
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ---------- sprites (built per theme, shared by every field) ---------- */
  var sprites = null, spriteTheme = null;
  // drawn diameter = particle radius * factor
  var DOT_FACTOR = { dark: 7, light: 2.6 };
  var STAR_FACTOR = { dark: 3.2, light: 2.2 };

  function makeCanvas(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }
  function buildSprites(theme) {
    var dark = theme !== 'light';
    var cols = COLORS[dark ? 'dark' : 'light'];
    var dots = cols.map(function (hex) {
      var S = 64, c = makeCanvas(S), x = c.getContext('2d');
      var g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      if (dark) {
        // bright core (radius = 1/7 of the sprite) + soft neon halo
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.1, rgba(hex, 1));
        g.addColorStop(0.16, rgba(hex, 0.7));
        g.addColorStop(0.34, rgba(hex, 0.16));
        g.addColorStop(1, rgba(hex, 0));
      } else {
        g.addColorStop(0, rgba(hex, 1));
        g.addColorStop(0.5, rgba(hex, 0.92));
        g.addColorStop(1, rgba(hex, 0));
      }
      x.fillStyle = g;
      x.fillRect(0, 0, S, S);
      return c;
    });
    var stars = [0, 1].map(function (variant) {
      var S = 96, c = makeCanvas(S), x = c.getContext('2d');
      var pad = dark ? 22 : 12, k = (S - pad * 2) / 100;
      var lg = x.createLinearGradient(pad, S - pad, S - pad, pad);
      if (dark) {
        lg.addColorStop(0, '#F8C966');
        lg.addColorStop(0.45, variant ? '#FFFFFF' : '#FED2AF');
        lg.addColorStop(0.75, '#E87DF4');
        lg.addColorStop(1, '#DD58F3');
      } else {
        lg.addColorStop(0, '#D48600');
        lg.addColorStop(0.5, variant ? '#C66BE6' : '#E08A3C');
        lg.addColorStop(1, '#9B1FD6');
      }
      x.translate(pad, pad);
      x.scale(k, k);
      if (dark) {
        x.shadowColor = variant ? 'rgba(255,166,0,.9)' : 'rgba(200,5,254,.9)';
        x.shadowBlur = 14 / k;
      }
      x.fillStyle = lg;
      try { x.fill(new Path2D(STAR)); } catch (e) { x.beginPath(); x.arc(50, 50, 30, 0, TAU); x.fill(); }
      return c;
    });
    return { dots: dots, stars: stars, dark: dark };
  }
  function ensureSprites() {
    var th = VM.theme === 'light' ? 'light' : 'dark';
    if (!sprites || spriteTheme !== th) { sprites = buildSprites(th); spriteTheme = th; }
    return sprites;
  }

  /* ---------- pointer (shared) ---------- */
  var ptr = { x: -1e5, y: -1e5 };
  if (VM.finePointer && !VM.reduced) {
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      ptr.x = e.clientX;
      ptr.y = e.clientY;
    }, { passive: true });
    document.addEventListener('pointerleave', function () { ptr.x = ptr.y = -1e5; });
  }

  /* ---------- a field ---------- */
  function Field(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.P = [];
    this.B = []; // burst particles (short-lived)
    this.on = false;      // intersecting
    this.mouse = { x: 0, y: 0 };
    this.density = parseFloat(canvas.getAttribute('data-density')) || 46;
    this.speed = parseFloat(canvas.getAttribute('data-speed')) || 1;
    this.magnet = canvas.getAttribute('data-magnet') !== '0' && VM.finePointer && !VM.reduced;
    this.rect = null;
  }

  Field.prototype.make = function (x, y, burst) {
    var star = Math.random() < (burst ? 0.4 : 0.04);
    var a = rand(0, TAU), v = rand(0.05, 0.32);
    return {
      x: x == null ? rand(0, this.w) : x,
      y: y == null ? rand(0, this.h) : y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 0.05,                 // a whisper of upward lift ("rising magic")
      r: star ? rand(2.6, 5.2) : rand(0.45, 1.45),  // Aceternity min/max size, in px
      o: rand(0.1, 1),                            // twinkle opacity (Aceternity ping-pong 0.1..1)
      od: Math.random() < 0.5 ? -1 : 1,
      os: rand(0.004, 0.018),
      tx: 0, ty: 0,                               // Magic UI translate toward the cursor
      mag: 0.1 + Math.random() * 4,               // Magic UI magnetism
      a: 0,                                       // fade-in
      slot: pickSlot(),
      star: star,
      rot: rand(0, TAU),
      vr: rand(-0.012, 0.012),
      life: burst ? rand(70, 120) : 0
    };
  };

  Field.prototype.resize = function () {
    var w = this.c.clientWidth, h = this.c.clientHeight;
    if (!w || !h) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    // backing-store budget: a field several screens tall (the footer) gets at most ~1.25 screens of
    // pixels at the DPR cap, by lowering its density (never below 1); viewport-sized fields keep it
    var vw = window.innerWidth || w, vh = window.innerHeight || h;
    var budget = vw * vh * DPR_CAP * DPR_CAP * 1.25;
    if (w * h * dpr * dpr > budget) dpr = Math.max(1, Math.min(dpr, Math.sqrt(budget / (w * h))));
    // only fields clearly taller than the screen are worth drawing band by band (see draw)
    this.tall = h > vh * 1.3;
    var changedW = Math.abs(w - this.w) > 2;
    var oldH = this.h;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.c.width = Math.round(w * dpr);
    this.c.height = Math.round(h * dpr);
    var n = Math.min(MAX, Math.round(this.density * w * h / 160000));
    if (!this.P.length || changedW) {
      this.P = [];
      for (var i = 0; i < n; i++) this.P.push(this.make());
    } else if (oldH) {
      // height-only change (mobile URL bar): keep the field, just rescale it
      var sy = h / oldH;
      this.P.forEach(function (p) { p.y *= sy; });
      while (this.P.length < n) this.P.push(this.make());
      if (this.P.length > n) this.P.length = n;
    }
    return true;
  };

  Field.prototype.draw = function (dt, animate) {
    var ctx = this.ctx, w = this.w, h = this.h, S = ensureSprites();
    var th = S.dark ? 'dark' : 'light';
    var themeA = THEME_ALPHA[th], dotF = DOT_FACTOR[th], starF = STAR_FACTOR[th];
    var spd = this.speed;
    // tall fields: clear and paint only the visible band plus half a screen above and below (the
    // rest of the backing store is never on screen in this frame; it is cleared before it gets there)
    var y0 = 0, y1 = h;
    if (animate && this.tall) {
      this.rect = this.c.getBoundingClientRect();
      var vh = window.innerHeight || h, pad = vh * 0.5;
      y0 = Math.max(0, Math.floor(-this.rect.top - pad));
      y1 = Math.min(h, Math.ceil(vh - this.rect.top + pad));
      if (y1 <= y0) { y0 = 0; y1 = 0; }
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (y1 > y0) ctx.clearRect(0, y0, w, y1 - y0);
    if (S.dark) ctx.globalCompositeOperation = 'lighter';

    // Magic UI: mouse offset from the canvas centre, only while the pointer is over the field
    if (this.magnet && animate) {
      if (!this.tall) this.rect = this.c.getBoundingClientRect();
      var mx = ptr.x - this.rect.left - w / 2, my = ptr.y - this.rect.top - h / 2;
      if (mx < w / 2 && mx > -w / 2 && my < h / 2 && my > -h / 2) { this.mouse.x = mx; this.mouse.y = my; }
      else { this.mouse.x *= 0.96; this.mouse.y *= 0.96; }
    }

    var list = this.P;
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (animate) {
          if (p.life) {
            p.vx *= Math.pow(0.94, dt);
            p.vy *= Math.pow(0.94, dt);
            p.life -= dt;
          }
          p.x += p.vx * dt * spd;
          p.y += p.vy * dt * spd;
          if (!p.life) {
            // Aceternity outModes "out": leave one side, come back on the other
            if (p.x < -6) p.x = w + 6; else if (p.x > w + 6) p.x = -6;
            if (p.y < -6) p.y = h + 6; else if (p.y > h + 6) p.y = -6;
          }
          p.o += p.od * p.os * dt * spd;
          if (p.o >= 1) { p.o = 1; p.od = -1; } else if (p.o <= 0.1) { p.o = 0.1; p.od = 1; }
          if (this.magnet) {
            p.tx += (this.mouse.x / (STATICITY / p.mag) - p.tx) / EASE * dt;
            p.ty += (this.mouse.y / (STATICITY / p.mag) - p.ty) / EASE * dt;
          }
          if (p.a < 1) p.a = Math.min(1, p.a + 0.02 * dt);
          if (p.star) p.rot += p.vr * dt;
        }
        var px = p.x + p.tx, py = p.y + p.ty;
        // outside the cleared band (16px keeps a rotated star sprite from painting past its edge)
        if ((y0 > 0 && py < y0 + 16) || (y1 < h && py > y1 - 16)) continue;
        // Magic UI: soften specks within 20px of the edges
        var edge = Math.min(px - p.r, w - px - p.r, py - p.r, h - py - p.r);
        var k = edge >= 20 ? 1 : edge <= 0 ? 0 : edge / 20;
        var alpha = p.o * k * p.a * themeA;
        if (p.life && p.life < 30) alpha *= p.life / 30;
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha > 1 ? 1 : alpha;
        if (p.star) {
          var d = p.r * starF * (0.8 + 0.35 * p.o);
          var spr = S.stars[p.slot & 1];
          var c = Math.cos(p.rot), s = Math.sin(p.rot);
          ctx.setTransform(c * this.dpr, s * this.dpr, -s * this.dpr, c * this.dpr, px * this.dpr, py * this.dpr);
          ctx.drawImage(spr, -d / 2, -d / 2, d, d);
          ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        } else {
          var dd = p.r * dotF;
          ctx.drawImage(S.dots[p.slot], px - dd / 2, py - dd / 2, dd, dd);
        }
      }
      if (pass === 0) {
        list = this.B;
      }
    }
    if (animate && this.B.length) this.B = this.B.filter(function (b) { return b.life > 0; });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  Field.prototype.staticFrame = function () {
    if (!this.w && !this.resize()) return;
    this.P.forEach(function (p) { p.a = 1; });
    this.draw(0, false);
  };

  Field.prototype.burst = function (x, y) {
    for (var i = 0; i < 6; i++) {
      var p = this.make(x, y, true), a = rand(0, TAU), v = rand(1.6, 4.2);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - 0.6;
      p.a = 1;
      p.o = 1;
      this.B.push(p);
    }
    if (this.B.length > 60) this.B.splice(0, this.B.length - 60);
  };

  /* ---------- shared ticker ---------- */
  var fields = [];
  var raf = 0, last = 0, started = false, pageVisible = document.visibilityState !== 'hidden';

  function anyActive() {
    for (var i = 0; i < fields.length; i++) if (fields[i].on) return true;
    return false;
  }
  function tick(now) {
    raf = 0;
    if (!started || !pageVisible || VM.reduced || !anyActive()) { last = 0; return; }
    var dt = last ? Math.min((now - last) / 16.667, 3) : 1;
    last = now;
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.on && (f.w || f.resize())) f.draw(dt, true);
    }
    raf = requestAnimationFrame(tick);
  }
  function kick() {
    if (!raf && started && pageVisible && !VM.reduced && anyActive()) raf = requestAnimationFrame(tick);
  }

  function setup(canvas) {
    if (canvas.__vmSparkles) return canvas.__vmSparkles;
    var f = new Field(canvas);
    if (!f.ctx) return null;
    canvas.__vmSparkles = f;
    fields.push(f);
    f.resize();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        f.on = entries[entries.length - 1].isIntersecting;
        if (f.on) { f.rect = null; if (VM.reduced) f.staticFrame(); else kick(); }
      }, { rootMargin: '100px 0px' }).observe(canvas);
    } else {
      f.on = true;
    }

    var rq = false;
    var onResize = function () {
      if (rq) return;
      rq = true;
      requestAnimationFrame(function () {
        rq = false;
        f.rect = null;
        if (f.resize() && (VM.reduced || !raf)) f.staticFrame();
      });
    };
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(canvas);
    else window.addEventListener('resize', onResize);

    // Aceternity: a click on the field pushes a few more particles (here, a little burst)
    var host = canvas.parentElement;
    if (host && !VM.reduced) {
      host.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || (e.target.closest && e.target.closest('a, button, input, textarea, select, label, [role="button"], iframe'))) return;
        var r = canvas.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (x < 0 || y < 0 || x > r.width || y > r.height) return;
        f.burst(x, y);
        kick();
      });
    }
    if (VM.reduced) f.staticFrame();
    return f;
  }

  function scan() {
    document.querySelectorAll('canvas[data-sparkles]').forEach(function (c) {
      try { setup(c); } catch (e) { console.warn('[sparkles] init failed', e); }
    });
  }

  try {
    scan();
  } catch (e) {
    console.warn('[sparkles] scan failed', e);
  }

  document.addEventListener('visibilitychange', function () {
    pageVisible = document.visibilityState !== 'hidden';
    if (pageVisible) kick();
  });

  if (VM.on) {
    VM.on('theme', function () {
      ensureSprites();
      fields.forEach(function (f) { if (VM.reduced || !raf) f.staticFrame(); });
    });
  }

  VM.sparkles = {
    refresh: function () {
      scan();
      fields.forEach(function (f) { f.rect = null; f.resize(); if (VM.reduced) f.staticFrame(); });
      kick();
    },
    burst: function (clientX, clientY) {
      fields.forEach(function (f) {
        var r = f.c.getBoundingClientRect();
        var x = clientX - r.left, y = clientY - r.top;
        if (x >= 0 && y >= 0 && x <= r.width && y <= r.height) { f.burst(x, y); }
      });
      kick();
    }
  };

  function start() {
    started = true;
    if (VM.reduced) fields.forEach(function (f) { f.staticFrame(); });
    else kick();
  }
  if (VM.whenIntroDone) VM.whenIntroDone(start); else start();
})();
