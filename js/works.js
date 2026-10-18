/* ==========================================================================
   VibeMagic — works.js
   #work: Imagine showcase · screenshot wall · apps grid

   21st.dev components ported to vanilla JS (no framer-motion / motion):
     · Container Scroll Animation .. Manu Arora (Aceternity UI)
         framer useScroll + useTransform (card rotateX 20→0, scale 1.05→1,
         title y 0→-100) → one GSAP ScrollTrigger scrub timeline (Lenis-synced).
         Mobile keeps the original's smaller numbers spirit: 12deg, .94→1.
     · 3D Marquee .................. Manu Arora (Aceternity UI)
         motion y-yoyo per column → CSS keyframes (css/works.css). Here each
         column is cloned once so the board drifts forever without a seam;
         without JS the CSS falls back to the original ±100px yoyo.
     · Comet Card .................. Manu Arora (Aceternity UI)
         useSpring + useTransform + useMotionTemplate → a small spring
         integrator writing the card transform and the glare position.
         Fine pointers only; touch / reduced motion keep a static card.
     · Lamp ........................ Manu Arora (Aceternity UI)
         whileInView width + opacity tween → one-shot IntersectionObserver class.
   Contract: reads window.VM (reduced, finePointer, gsap, whenIntroDone).
   Exports nothing.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM || {};
  var section = document.getElementById('work');
  if (!section) return;

  var reduced = VM.reduced != null ? !!VM.reduced : matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = VM.finePointer != null ? !!VM.finePointer : matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var smallMq = matchMedia('(max-width: 720px)');

  function slice(list) { return Array.prototype.slice.call(list); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function f2(n) { return (Math.round(n * 100) / 100).toString(); }
  function safe(name, fn) {
    try { fn(); } catch (e) { console.error('[works] ' + name + ' failed', e); }
  }
  function whenIntro(fn) {
    if (typeof VM.whenIntroDone === 'function') VM.whenIntroDone(fn); else fn();
  }

  /* ======================================================================
     1. Imagine: Container Scroll Animation
     ====================================================================== */
  function initImagine() {
    var wrap = section.querySelector('[data-imagine]');
    if (!wrap) return;
    var head = wrap.querySelector('.imagine__head');
    var stage = wrap.querySelector('.imagine__stage');
    var device = wrap.querySelector('.imagine__device');
    if (!stage || !device) return;

    var gsap = VM.gsap || window.gsap;
    // no GSAP / reduced motion: the css default is the final, flat state (--p: 1)
    if (reduced || !gsap || !window.ScrollTrigger) return;

    // original numbers (20deg, 1.05) from 1280px up; below that the lying-back card would grow
    // past the viewport edges, so the tilt and the start scale ease off with the width
    var mm = gsap.matchMedia();
    mm.add({ small: '(max-width: 720px)', medium: '(min-width: 721px) and (max-width: 1279px)', large: '(min-width: 1280px)' }, function (ctx) {
      var small = ctx.conditions.small, medium = ctx.conditions.medium;
      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: stage,
          // framer's default offset is ["start end", "end start"]; ending when the
          // device is centred makes it land flat where the eye actually is
          start: 'top bottom',
          end: small ? 'center 58%' : 'center center',
          scrub: true,
          invalidateOnRefresh: true
        }
      });
      tl.fromTo(device, { rotationX: small ? 12 : medium ? 16 : 20, scale: small ? 0.94 : medium ? 0.96 : 1.05 }, { rotationX: 0, scale: 1 }, 0);
      if (head) tl.fromTo(head, { y: 0 }, { y: small ? -36 : -100 }, 0);
      tl.fromTo(stage, { '--p': 0 }, { '--p': 1 }, 0);
    });
  }

  // the wordmark's sparkle twinkles only while the Imagine head is near the viewport (css/works.css)
  function initSparkle() {
    var wrap = section.querySelector('[data-imagine]');
    var head = wrap && wrap.querySelector('.imagine__head');
    if (!head || reduced || !hasIO) return;
    new IntersectionObserver(function (entries) {
      wrap.classList.toggle('is-off', !entries[entries.length - 1].isIntersecting);
    }, { rootMargin: '120px 0px' }).observe(head);
  }

  // the device screen cycles three worlds made in Imagine (local shots, offscreen = paused);
  // phones get the 1080w exports (same srcset/sizes as the first shot in index.html)
  var IMAGINE_WORLDS = [
    { src: 'assets/imagine/IMG_6135.jpg', src1080: 'assets/imagine/IMG_6135-1080.jpg', w: 1800, h: 818 },
    { src: 'assets/imagine/IMG_6137.jpg', src1080: 'assets/imagine/IMG_6137-1080.jpg', w: 1800, h: 815 }
  ];
  var SLIDE_SIZES = '(max-width: 720px) 92vw, 1340px';
  var SLIDE_MS = 4600;

  function initSlides() {
    var stage = section.querySelector('.imagine__stage');
    var screen = section.querySelector('.imagine__screen');
    var first = screen && screen.querySelector('img');
    if (!stage || !first || reduced || !hasIO) return;

    var slides = [first];
    IMAGINE_WORLDS.forEach(function (w) {
      // `loading` first: an <img> that gets its source before it knows it is lazy starts fetching
      var img = document.createElement('img');
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.alt = '';
      img.width = w.w;
      img.height = w.h;
      img.setAttribute('aria-hidden', 'true');
      img.setAttribute('sizes', first.getAttribute('sizes') || SLIDE_SIZES);
      img.setAttribute('srcset', w.src1080 + ' 1080w, ' + w.src + ' ' + w.w + 'w');
      img.src = w.src;
      screen.appendChild(img);
      slides.push(img);
    });
    slides.forEach(function (img) { img.classList.add('imagine__slide'); });
    first.classList.add('is-on');
    screen.classList.add('is-slides');

    var idx = 0, timer = 0, inView = false;
    function ready(img) { return img.complete && img.naturalWidth > 0; }
    function next() {
      timer = 0;
      var n = (idx + 1) % slides.length;
      if (ready(slides[n])) {
        slides[idx].classList.remove('is-on');
        slides[n].classList.add('is-on');
        idx = n;
      }
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      timer = inView && !document.hidden ? setTimeout(next, SLIDE_MS) : 0;
    }
    new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) slides.forEach(eager);
      schedule();
    }, { rootMargin: '200px 0px' }).observe(stage);
    document.addEventListener('visibilitychange', schedule);
  }

  /* ======================================================================
     2. Wall: 3D Marquee
     ====================================================================== */
  var WALL_COLS = 6;

  function eager(img) {
    if (img.getAttribute('loading') === 'lazy') img.setAttribute('loading', 'eager');
  }

  // cloneNode copies attributes in source order, so a clone whose `src` comes before `loading`
  // starts downloading at once and the whole wall (~1.5 MB) loads with the page. Build each
  // copy by hand instead, with `loading` set before any source.
  function cloneShot(img) {
    var c = document.createElement('img');
    c.setAttribute('loading', img.getAttribute('loading') || 'lazy');
    c.setAttribute('decoding', 'async');
    c.alt = '';
    ['width', 'height', 'sizes', 'srcset'].forEach(function (a) {
      var v = img.getAttribute(a);
      if (v) c.setAttribute(a, v);
    });
    c.setAttribute('data-clone', '');
    c.setAttribute('src', img.getAttribute('src'));
    return c;
  }

  function initWall() {
    var wall = section.querySelector('.wall');
    if (!wall) return;
    var cols = slice(wall.querySelectorAll('.wall__col'));
    if (!cols.length) return;

    var board = wall.querySelector('.wall__board');
    var shots = [];
    cols.forEach(function (col) { shots = shots.concat(slice(col.children)); });

    // the markup's 4 columns of portrait phone shots make huge tiles; two more columns
    // (stride-picked so neighbours never repeat a row) give the original's tile density
    if (board && shots.length >= 8) {
      var per = Math.ceil(shots.length / cols.length);
      for (var k = cols.length; k < WALL_COLS; k++) {
        var col = document.createElement('div');
        col.className = 'wall__col';
        for (var i = 0; i < per; i++) {
          col.appendChild(cloneShot(shots[(i * 4 + (k === cols.length ? 1 : 3) + per * (k - cols.length)) % shots.length]));
        }
        board.appendChild(col);
      }
      cols = slice(wall.querySelectorAll('.wall__col'));
      board.style.setProperty('--cols', String(cols.length));
    }

    if (reduced) {
      wall.classList.add('is-static');
    } else {
      // one clone of every column's shots → translateY(-50% - gap/2) loops seamlessly
      cols.forEach(function (col) {
        slice(col.children).forEach(function (img) { col.appendChild(cloneShot(img)); });
      });
      wall.classList.add('is-loop');
    }

    var imgs = slice(wall.querySelectorAll('img'));
    if (!hasIO) { imgs.forEach(eager); return; }

    // the board drifts shots into the clipped band; lazy loading would only start
    // once a shot is already visible, so load them all when the band gets close
    var near = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      imgs.forEach(eager);
      near.disconnect();
    }, { rootMargin: '1200px 0px' });
    near.observe(wall);

    if (reduced) return;
    var visible = false;
    function sync() { wall.classList.toggle('is-paused', !visible || document.hidden); }
    var io = new IntersectionObserver(function (entries) {
      visible = entries[entries.length - 1].isIntersecting;
      sync();
    }, { rootMargin: '120px 0px' });
    io.observe(wall);
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  /* ======================================================================
     3. Apps: Comet Card tilt, mobile carousel helpers
     ====================================================================== */
  function comet(li) {
    var card = li.querySelector('.app__link');
    var glare = li.querySelector('.app__glare');
    if (!card) return;

    var ROT = 9;        // max deg each way (original 17.5)
    var TR = 6;         // max px drift each way (original 20)
    var LIFT = 26;      // translateZ on hover (original z: 50)
    var GROW = 0.025;   // scale on hover (original 1.05)
    var K = 140, D = 15; // spring (motion default 100/10 is a touch bouncier)

    var tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, h = 0, hT = 0;
    var raf = 0, last = 0;

    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      vx += (-K * (x - tx) - D * vx) * dt;
      vy += (-K * (y - ty) - D * vy) * dt;
      x += vx * dt;
      y += vy * dt;
      h += (hT - h) * Math.min(1, dt * 11);

      var settled = Math.abs(x - tx) + Math.abs(y - ty) + Math.abs(vx) + Math.abs(vy) < 1e-3 && Math.abs(h - hT) < 2e-3;
      if (settled && !hT) {
        card.style.transform = '';
        card.style.removeProperty('--h');
        li.classList.remove('is-hover');
        raf = 0; last = 0;
        return;
      }
      card.style.transform =
        'translate3d(' + f2(x * 2 * TR) + 'px,' + f2(-y * 2 * TR) + 'px,' + f2(LIFT * h) + 'px)' +
        ' scale(' + (1 + GROW * h).toFixed(4) + ')' +
        ' rotateX(' + f2(y * 2 * ROT) + 'deg) rotateY(' + f2(-x * 2 * ROT) + 'deg)';
      card.style.setProperty('--h', h.toFixed(3));
      if (glare) {
        glare.style.setProperty('--gx', f2((x + 0.5) * 100) + '%');
        glare.style.setProperty('--gy', f2((y + 0.5) * 100) + '%');
      }
      if (settled) { raf = 0; last = 0; return; }
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function aim(e) {
      var r = li.getBoundingClientRect();   // the untransformed wrapper: no feedback jitter
      if (!r.width || !r.height) return;
      tx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
      ty = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
    }

    li.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;
      aim(e);
      hT = 1;
      li.classList.add('is-hover');
      kick();
    });
    li.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      aim(e);
      hT = 1;
      kick();
    });
    li.addEventListener('pointerleave', function () {
      tx = 0; ty = 0; hT = 0;
      kick();
    });
  }

  function initRail(list) {
    var rail = document.createElement('div');
    rail.className = 'apps-rail';
    rail.setAttribute('aria-hidden', 'true');
    var thumb = document.createElement('span');
    rail.appendChild(thumb);
    list.insertAdjacentElement('afterend', rail);

    var queued = false;
    function update() {
      queued = false;
      if (!smallMq.matches) return;
      var sw = list.scrollWidth, cw = list.clientWidth;
      var max = sw - cw;
      var ratio = sw ? clamp(cw / sw, 0.24, 1) : 1;
      var p = max > 0 ? clamp(Math.abs(list.scrollLeft) / max, 0, 1) : 0;
      var tw = rail.clientWidth;
      thumb.style.width = f2(ratio * 100) + '%';
      // RTL: the thumb starts on the right and travels left
      var dir = getComputedStyle(list).direction === 'rtl' ? -1 : 1;
      thumb.style.transform = 'translate3d(' + f2(dir * p * (1 - ratio) * tw) + 'px,0,0)';
    }
    function ask() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    list.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    ask();
  }

  // carousel: cards scrolled sideways sit outside the viewport, so reveal the
  // whole row together instead of making each one fade in mid-swipe
  function initCarouselReveal(list, items) {
    if (!hasIO || reduced) return;
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      if (!smallMq.matches) return;
      items.forEach(function (li, i) {
        li.style.setProperty('--d', Math.min(i, 2) * 80 + 'ms');
        li.classList.add('in');
      });
    }, { threshold: 0.15 });
    whenIntro(function () { io.observe(list); });
  }

  // carousel + keyboard: Chrome leaves a partly visible card where it is when Tab lands on it,
  // so bring the focused card in whole. Only for keyboard focus: a tap or click keeps the swipe
  // position (and must not start a scroll on the way to the App Store).
  function initCarouselFocus(list) {
    list.addEventListener('focusin', function (e) {
      var it = e.target.closest && e.target.closest('.app');
      if (!it || !smallMq.matches || list.scrollWidth <= list.clientWidth + 1) return;
      var kb = true;
      try { kb = e.target.matches(':focus-visible'); } catch (err) { /* no :focus-visible */ }
      if (!kb) return;
      it.scrollIntoView({ block: 'nearest', inline: 'start', behavior: reduced ? 'auto' : 'smooth', container: 'nearest' });
    });
  }

  // "iOS · AI · תלת־ממד": isolate each token so mixed Latin/Hebrew keeps its logical
  // order in RTL (otherwise the Latin run "iOS · AI" renders as one LTR block)
  function isolateKinds(list) {
    slice(list.querySelectorAll('.app__kind')).forEach(function (el) {
      var parts = el.textContent.split('·').map(function (p) { return p.trim(); }).filter(Boolean);
      if (parts.length < 2) return;
      el.textContent = '';
      parts.forEach(function (p, i) {
        if (i) {
          var sep = document.createElement('span');
          sep.className = 'app__sep';
          sep.setAttribute('aria-hidden', 'true');
          sep.textContent = '·';
          el.appendChild(sep);
        }
        var b = document.createElement('bdi');
        b.textContent = p;
        el.appendChild(b);
      });
    });
  }

  function initApps() {
    var list = section.querySelector('.apps');
    if (!list) return;
    var items = slice(list.querySelectorAll('.app'));
    safe('kinds', function () { isolateKinds(list); });
    if (fine && !reduced) {
      items.forEach(function (li) {
        if (li.hasAttribute('data-tilt')) safe('comet', function () { comet(li); });
      });
    }
    safe('rail', function () { initRail(list); });
    safe('carousel', function () { initCarouselReveal(list, items); });
    safe('carousel-focus', function () { initCarouselFocus(list); });
  }

  /* ======================================================================
     4. Lamp over "האפליקציות שלי"
     ====================================================================== */
  function initLamp() {
    var head = section.querySelector('.apps-head');
    if (!head) return;
    if (reduced || !hasIO) { head.classList.add('is-lit'); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      head.classList.add('is-lit');
      io.disconnect();
    }, { threshold: 0.35 });
    whenIntro(function () { io.observe(head); });
  }

  safe('imagine', initImagine);
  safe('sparkle', initSparkle);
  safe('slides', initSlides);
  safe('wall', initWall);
  safe('apps', initApps);
  safe('lamp', initLamp);
})();
