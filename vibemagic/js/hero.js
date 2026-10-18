/* ==========================================================================
   VibeMagic · hero.js
   Hero entrance + motifs and the tools marquee.
     · Entrance (after VM.whenIntroDone): GSAP SplitText chars on both headline
       lines (rise + blur stagger, the gradient line keeps one continuous
       gradient by giving every char its own slice), orbit ring draw, sparkle
       pop, swoosh clip reveal, then the [data-hero-in] items stagger in.
     · Orbit ring: split into a back copy (top arc, behind the letters) and a
       front copy (bottom arc, over the letters) with a comet that travels
       around both, so it really passes behind and in front of "מרעיון".
     · Morphing Text: port of Magic UI "Morphing Text" by Dillion Verma
       (21st.dev): two stacked spans, blur(8/f - 8) + opacity f^0.4 crossfade,
       fused by an SVG feColorMatrix alpha threshold (the gooey melt). Same
       arithmetic as the original hook; longer hold so Hebrew reads.
     · Marquee: port of Magic UI "Marquee" by Dillion Verma (21st.dev): the
       CSS lives in hero.css; here we clone groups until the loop is seamless
       on any width, pause it offscreen, and let scroll velocity briefly speed
       it up (Web Animations playbackRate on the CSS animation).
   Everything fails open: if anything throws, the hero is shown as is.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM || (window.VM = {});
  var hero = document.querySelector('section.hero');
  var gsap = VM.gsap || window.gsap || null;
  var reduced = !!VM.reduced;
  var splits = []; // live SplitText instances during the entrance (declared before initHero runs)

  function q(sel, root) { return (root || hero).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || hero).querySelectorAll(sel)); }

  /* ======================================================================
     HERO
     ====================================================================== */
  if (hero) {
    try { initHero(); } catch (e) {
      console.error('[hero] init failed', e);
      hero.classList.add('hero--ready', 'hero--in');
    }
  }

  function initHero() {
    hero.classList.add('hero--ready');
    if (reduced) hero.classList.add('is-reduced');

    var orbit = buildOrbit();
    var morph = buildMorph();
    var revealed = false;

    // offscreen: pause CSS loops (comet, sparkle, scroll line) and the morph rAF
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var on = entries[entries.length - 1].isIntersecting;
        hero.classList.toggle('is-off', !on);
        if (morph) morph.setVisible(on);
      }, { threshold: 0 }).observe(hero);
    }

    function finish() {
      if (revealed) return;
      revealed = true;
      hero.classList.add('hero--in');
      if (!reduced) hero.classList.add('is-orbiting');
      if (morph) morph.start();
      VM.emit && VM.emit('hero:in');
    }

    function play() {
      if (reduced) { finish(); return; }
      if (!gsap) {
        hero.classList.add('hero--css');
        requestAnimationFrame(function () { requestAnimationFrame(finish); });
        return;
      }
      var tl = null;
      try { tl = entrance(orbit, finish); } catch (e) {
        console.error('[hero] entrance failed', e);
        revertSplits();
        clearEntranceStyles();
        finish();
      }
      // belt and braces: whatever happens, the hero is fully visible 4.5s after the handoff
      setTimeout(function () {
        if (revealed) return;
        if (tl) { try { tl.progress(1); } catch (e) { /* noop */ } }
        if (!revealed) { revertSplits(); clearEntranceStyles(); finish(); }
      }, 4500);
    }

    VM.whenIntroDone ? VM.whenIntroDone(function () { fontsThen(play); }) : fontsThen(play);
    if (!reduced) setupParallax();
    setupScrolled();
  }

  // wait (briefly) for the webfonts so SplitText measures the real glyphs
  function fontsThen(fn) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    if (document.fonts && document.fonts.ready) {
      var heebo = document.fonts.check ? document.fonts.check('900 1em Heebo', 'מרעיון') : true;
      if (heebo) { go(); return; }
      document.fonts.ready.then(go, go);
      setTimeout(go, 900);
    } else {
      go();
    }
  }

  /* ---------- orbit ring: back + front copies, ring + comet ---------- */
  function buildOrbit() {
    var back = q('.hero__orbit');
    if (!back) return null;
    var ring = back.querySelector('ellipse');
    if (!ring) return null;
    ring.classList.add('hero__orbit-ring');
    ring.setAttribute('stroke-linecap', 'round');
    var comet = ring.cloneNode(false);
    comet.setAttribute('class', 'hero__orbit-comet');
    comet.removeAttribute('stroke');
    comet.setAttribute('stroke-width', '3.5');
    back.appendChild(comet);

    var front = back.cloneNode(true);
    front.classList.add('hero__orbit--front');
    var defs = front.querySelector('defs');
    if (defs) defs.parentNode.removeChild(defs); // keep #orbit-grad unique; the front ring still uses it
    back.parentNode.insertBefore(front, back.nextSibling);
    return { rings: qa('.hero__orbit-ring'), svgs: [back, front] };
  }

  /* ---------- Magic UI Morphing Text (vanilla port) ---------- */
  function buildMorph() {
    var el = q('.morph[data-morph]');
    if (!el) return null;
    var texts;
    try { texts = JSON.parse(el.getAttribute('data-morph')); } catch (e) { return null; }
    if (!texts || texts.length < 2) return null;

    var NS = 'http://www.w3.org/2000/svg';
    if (!document.getElementById('vm-threshold')) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'hero__filters');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      svg.innerHTML = '<defs><filter id="vm-threshold" x="-20%" y="-60%" width="140%" height="220%" color-interpolation-filters="sRGB">' +
        '<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"/></filter></defs>';
      hero.appendChild(svg);
    }

    // screen readers get one calm sentence; the animated spans are decoration
    var list = texts.slice(0, -1).join(', ') + ' או ' + texts[texts.length - 1];
    el.textContent = '';
    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = list;
    var t1 = document.createElement('span');
    var t2 = document.createElement('span');
    var m = document.createElement('span');
    t1.className = t2.className = 'morph__t';
    m.className = 'morph__m';
    [t1, t2, m].forEach(function (s) { s.setAttribute('aria-hidden', 'true'); });
    el.appendChild(sr);
    el.appendChild(t1);
    el.appendChild(t2);
    el.appendChild(m);

    var morphTime = 1.5;     // original
    var cooldownTime = 2.2;  // original 0.5: a longer hold so each Hebrew phrase can be read
    var idx = 0, morphV = 0, cooldown = cooldownTime;
    var widths = [];
    var raf = 0, last = 0, running = false, visible = true, pageVisible = document.visibilityState !== 'hidden';

    function measure() {
      widths = texts.map(function (w) { m.textContent = w; return m.getBoundingClientRect().width; });
      m.textContent = '';
    }
    function setWidth(i) {
      if (!widths.length) measure();
      el.style.width = Math.ceil(widths[i % texts.length] + 2) + 'px';
    }

    // ---- the original hook, verbatim arithmetic ----
    function setStyles(fraction) {
      t2.style.filter = 'blur(' + Math.min(8 / fraction - 8, 100) + 'px)';
      t2.style.opacity = Math.pow(fraction, 0.4) * 100 + '%';
      var inv = 1 - fraction;
      t1.style.filter = 'blur(' + Math.min(8 / inv - 8, 100) + 'px)';
      t1.style.opacity = Math.pow(inv, 0.4) * 100 + '%';
      t1.textContent = texts[idx % texts.length];
      t2.textContent = texts[(idx + 1) % texts.length];
    }
    function doMorph() {
      if (morphV === 0) setWidth(idx + 1); // VibeMagic: the box eases to the incoming phrase
      morphV -= cooldown;
      cooldown = 0;
      var fraction = morphV / morphTime;
      if (fraction > 1) { cooldown = cooldownTime; fraction = 1; }
      setStyles(fraction);
      if (fraction === 1) idx++;
    }
    function doCooldown() {
      morphV = 0;
      t2.style.filter = 'none';
      t2.style.opacity = '100%';
      t1.style.filter = 'none';
      t1.style.opacity = '0%';
    }
    function animate(now) {
      raf = 0;
      if (!running || !visible || !pageVisible) { last = 0; return; }
      raf = requestAnimationFrame(animate);
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      cooldown -= dt;
      if (cooldown <= 0) doMorph(); else doCooldown();
    }
    function kick() { if (!raf && running && visible && pageVisible) raf = requestAnimationFrame(animate); }

    // initial (cooldown) state: the first phrase, crisp
    t2.textContent = texts[0];
    doCooldown();
    setWidth(0);

    var rq = false;
    function remeasure() {
      if (rq) return;
      rq = true;
      requestAnimationFrame(function () {
        rq = false;
        measure();
        // keep the phrase that is currently on screen; snap (no width ease) so a resize never
        // leaves the rotator wrapped onto two lines while ScrollTrigger re-measures the page
        el.style.transition = 'none';
        setWidth(morphV > 0 ? idx + 1 : idx);
        void el.offsetWidth;
        el.style.transition = '';
      });
    }
    window.addEventListener('resize', remeasure, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    document.addEventListener('visibilitychange', function () {
      pageVisible = document.visibilityState !== 'hidden';
      kick();
    });

    return {
      start: function () {
        if (reduced) return;
        el.classList.add('is-gooey');
        running = true;
        kick();
      },
      setVisible: function (v) { visible = v; kick(); }
    };
  }

  /* ---------- entrance timeline ---------- */
  function entrance(orbit, onDone) {
    var title = q('.hero__title');
    var word = q('.hero__word');
    var grad = q('.hero__line--2 .grad-text');
    var brand = q('.hero__brand');
    var items = qa('[data-hero-in]').filter(function (el) { return el !== brand; });
    var swoosh = q('.hero__swoosh');
    var scroll = q('.hero__scroll');
    var rings = orbit ? orbit.rings : [];
    var chars1 = word ? [word] : [], chars2 = grad ? [grad] : [];

    var Split = window.SplitText;
    if (Split && word && grad) {
      try {
        var s1 = Split.create ? Split.create(word, { type: 'chars', tag: 'span', charsClass: 'hero-ch' }) : new Split(word, { type: 'chars', tag: 'span', charsClass: 'hero-ch' });
        var s2 = Split.create ? Split.create(grad, { type: 'chars', tag: 'span', charsClass: 'hero-ch' }) : new Split(grad, { type: 'chars', tag: 'span', charsClass: 'hero-ch' });
        splits = [s1, s2];
        if (s1.chars && s1.chars.length) chars1 = s1.chars;
        if (s2.chars && s2.chars.length) {
          chars2 = s2.chars;
          grad.classList.add('is-split');
          sliceGradient(grad, chars2);
        }
      } catch (e) {
        console.warn('[hero] SplitText failed, animating lines whole', e);
        revertSplits();
        chars1 = word ? [word] : [];
        chars2 = grad ? [grad] : [];
      }
    }

    var tl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: function () {
        onDone();
        revertSplits();
        clearEntranceStyles();
      }
    });
    var hidden = { opacity: 0, yPercent: 62, filter: 'blur(14px)' };
    var shown = { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.3 };

    tl.set(title, { opacity: 1 }, 0);
    if (brand) tl.fromTo(brand, { opacity: 0, y: 14, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1 }, 0);
    tl.fromTo(chars1, hidden, Object.assign({}, shown, { stagger: 0.065 }), 0.08);
    tl.fromTo(chars2, hidden, Object.assign({}, shown, { stagger: 0.045 }), 0.32);
    if (rings.length) tl.fromTo(rings, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut' }, 0.5);
    tl.call(function () { hero.classList.add('is-spark'); }, null, 0.95);
    if (swoosh) tl.fromTo(swoosh, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut' }, 0.95);
    if (items.length) tl.fromTo(items, { opacity: 0, y: 26, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.15, stagger: 0.1 }, 1.08);
    if (scroll) tl.fromTo(scroll, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 1.9);
    return tl;
  }

  // every char gets a slice of one continuous gradient (yellow left → purple right)
  function sliceGradient(parent, chars) {
    var pr = parent.getBoundingClientRect();
    chars.forEach(function (c) {
      var r = c.getBoundingClientRect();
      c.style.backgroundSize = pr.width + 'px 100%';
      c.style.backgroundPosition = (pr.left - r.left) + 'px 0';
    });
  }

  function revertSplits() {
    splits.forEach(function (s) { try { s.revert(); } catch (e) { /* noop */ } });
    splits = [];
    var grad = q('.hero__line--2 .grad-text');
    if (grad) grad.classList.remove('is-split');
  }

  function clearEntranceStyles() {
    if (!gsap) return;
    var els = qa('.hero__title, .hero__brand, [data-hero-in], .hero__swoosh, .hero__scroll, .hero__orbit-ring');
    gsap.set(els, { clearProps: 'opacity,transform,filter,clipPath,clip-path,strokeDashoffset,stroke-dashoffset,visibility' });
  }

  /* ---------- scroll-out parallax ---------- */
  function setupParallax() {
    var ST = window.ScrollTrigger;
    if (!gsap || !ST) return;
    var inner = q('.hero__inner');
    var dust = q('.hero__sparkles');
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
    });
    if (inner) {
      tl.fromTo(inner, { y: 0 }, { y: function () { return hero.offsetHeight * 0.22; }, duration: 1 }, 0);
      tl.fromTo(inner, { opacity: 1 }, { opacity: 0, duration: 0.55 }, 0.42);
    }
    if (dust) tl.fromTo(dust, { yPercent: 0 }, { yPercent: 10, duration: 1 }, 0);
  }

  // the scroll hint bows out as soon as the visitor scrolls (CSS fades it via .is-scrolled)
  function setupScrolled() {
    var on = false;
    function check() {
      var s = window.scrollY > 60;
      if (s !== on) { on = s; hero.classList.toggle('is-scrolled', s); }
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
  }

  /* ======================================================================
     MARQUEE
     ====================================================================== */
  var mq = document.querySelector('.marquee');
  if (mq) {
    try { initMarquee(mq); } catch (e) { console.error('[marquee] init failed', e); }
  }

  function initMarquee(root) {
    var track = root.querySelector('.marquee__track');
    if (!track) return;
    if (reduced) { root.classList.add('is-reduced'); return; }

    function groups() { return Array.prototype.slice.call(track.querySelectorAll('.marquee__group')); }
    var anims = null;

    // make sure (groups - 1) x (group width + gap) covers the visible band, on any screen
    function fill() {
      var gs = groups();
      if (!gs.length) return;
      var gw = gs[0].getBoundingClientRect().width;
      if (!gw) return;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var need = root.clientWidth * 1.3;
      var guard = 0;
      while ((gs.length - 1) * (gw + gap) < need && guard++ < 6) {
        var c = gs[0].cloneNode(true);
        try { c.inert = true; } catch (e) { /* old browsers */ }
        track.appendChild(c);
        gs = groups();
        anims = null;
      }
      gs.slice(1).forEach(function (g) { g.setAttribute('aria-hidden', 'true'); });
    }
    fill();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fill);
    var rq = false;
    window.addEventListener('resize', function () {
      if (rq) return;
      rq = true;
      requestAnimationFrame(function () { rq = false; fill(); });
    }, { passive: true });

    var onScreen = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        root.classList.toggle('is-off', !onScreen);
      }, { rootMargin: '60px 0px' }).observe(root);
    }

    // scroll energy: the band briefly speeds up with scroll velocity, then settles
    function getAnims() {
      if (anims) return anims;
      anims = [];
      groups().forEach(function (g) {
        if (g.getAnimations) g.getAnimations().forEach(function (a) { anims.push(a); });
      });
      return anims;
    }
    var rate = 1, target = 1, lastY = window.scrollY, lastT = 0, loop = 0;
    function setRate(r) {
      getAnims().forEach(function (a) {
        try { a.updatePlaybackRate ? a.updatePlaybackRate(r) : (a.playbackRate = r); } catch (e) { /* noop */ }
      });
    }
    function step(now) {
      loop = 0;
      target += (1 - target) * 0.06;
      rate += (target - rate) * 0.12;
      if (Math.abs(rate - 1) < 0.01 && Math.abs(target - 1) < 0.01) {
        rate = 1;
        setRate(1);
        return;
      }
      setRate(rate);
      loop = requestAnimationFrame(step);
    }
    window.addEventListener('scroll', function () {
      if (!onScreen) { lastY = window.scrollY; return; }
      var now = performance.now();
      var y = window.scrollY;
      var dt = Math.max(16, now - (lastT || now - 16));
      var v = Math.abs(y - lastY) / dt; // px per ms
      lastY = y;
      lastT = now;
      target = Math.max(target, 1 + Math.min(v * 2.2, 3.2));
      if (!loop) loop = requestAnimationFrame(step);
    }, { passive: true });
  }
})();
