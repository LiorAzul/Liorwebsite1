/* ==========================================================================
   VibeMagic — js/fx/text.js
   Site-wide text effects (vanilla ports of 21st.dev components) + the
   manifesto's scroll-scrubbed paragraph.

     [data-split]        "Text Generate Effect" by Manu Arora (Aceternity UI):
                         per-word blur-in when the heading scrolls into view.
     [data-scrub-words]  "Text Reveal" (by word, on scroll) by Dillion Verma
                         (Magic UI): per-word opacity .15 -> 1 scrubbed by scroll
                         inside a tall [data-scrub-track] with a sticky child.
     [data-scramble]     "Encrypted Text" by Manu Arora (Aceternity UI): glyphs
                         decode in reading order once revealed.
     [data-count]        "Number Ticker" by Dillion Verma (Magic UI): counts up
                         from 0 when in view.
     .hl                 "Text Highlighter" by Daniel Petho (fancy components):
                         CSS only (css/text.css), the marker sweeps from the right.

   Splitting uses GSAP SplitText (type 'words' only: Hebrew is never split into
   letters). Words stay plain inline spans so wrapping and bidi are untouched,
   and every one-shot effect unwraps its spans when it ends, leaving the
   original markup (nested elements keep their identity).

   Exports VM.text = { scan(root), split(el), scrub(el), scramble(el), count(el) }
   so modules that inject markup later can run the same effects on it.
   ========================================================================== */
(function () {
  'use strict';

  var VM = (window.VM = window.VM || {});
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var SplitText = window.SplitText;
  var REDUCED = !!VM.reduced;
  var whenIntro = VM.whenIntroDone || function (fn) { fn(); };
  var slice = function (list) { return Array.prototype.slice.call(list || []); };

  function warn(e) { try { console.warn('[VM text]', e); } catch (_) { /* noop */ } }
  function claim(el, key) { if (el['_vmtx_' + key]) return false; el['_vmtx_' + key] = true; return true; }

  /* One-shot "in view" helper. Observation starts only after the neon intro so
     nothing plays (and finishes) behind the intro overlay. */
  function inView(el, cb, opts) {
    whenIntro(function () {
      if (!('IntersectionObserver' in window)) { cb(); return; }
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { io.disconnect(); cb(); return; }
        }
      }, opts || { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
      io.observe(el);
    });
  }

  /* Replace each wrapper with its children (undo a split without innerHTML, so
     nested elements such as .grad-text keep their identity for other modules). */
  function unwrap(nodes) {
    nodes.forEach(function (w) {
      var p = w.parentNode;
      if (!p) return;
      while (w.firstChild) p.insertBefore(w.firstChild, w);
      p.removeChild(w);
    });
  }

  function splitWords(el, cls, aria, ignore) {
    var opts = { type: 'words', tag: 'span', wordsClass: cls, aria: aria };
    if (ignore && ignore.length) opts.ignore = ignore;
    return new SplitText(el, opts);
  }

  /* The text a screen reader would read: <br> counts as a space (SplitText's own
     aria-label uses textContent, which glues "ליאור.<br>ואני" into one word) and
     aria-hidden decorations are left out. Works on a detached clone, so it does
     not depend on rendering (innerText is empty under the intro's visibility:hidden). */
  function spokenText(el) {
    var c = el.cloneNode(true);
    slice(c.querySelectorAll('[aria-hidden="true"]')).forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    slice(c.querySelectorAll('br')).forEach(function (br) { br.parentNode.replaceChild(document.createTextNode(' '), br); });
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /* ======================================================================
     [data-split]  Text Generate Effect (Aceternity): opacity 0 + blur(10px)
     -> 1 + blur(0), staggered per word.
     .grad-text inside the heading paints its gradient with background-clip:
     text; splitting it into word spans would restart the gradient on every
     word. While the words animate, each word inside it paints its own slice
     of the SAME gradient (background-size = the line fragment's width,
     background-position = the word's offset in it). css/text.css sets
     box-decoration-break: clone on these phrases so the resting state (after
     the spans are unwrapped) matches the slices exactly, line by line.
     ====================================================================== */
  function sliceGradient(grad, words) {
    var rects = words.map(function (w) { return w.getBoundingClientRect(); });
    var lines = [];
    rects.forEach(function (r, i) {
      var line = null;
      for (var j = 0; j < lines.length; j++) {
        if (Math.abs(lines[j].top - r.top) < r.height * 0.5) { line = lines[j]; break; }
      }
      if (!line) lines.push(line = { top: r.top, left: r.left, right: r.right, items: [] });
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.items.push(i);
    });
    lines.forEach(function (l) {
      var width = Math.max(1, l.right - l.left);
      l.items.forEach(function (i) {
        words[i].style.setProperty('--tx-gw', width.toFixed(2) + 'px');
        words[i].style.setProperty('--tx-gx', (l.left - rects[i].left).toFixed(2) + 'px');
      });
    });
  }

  function initSplit(el) {
    if (!claim(el, 'split')) return;
    if (REDUCED || !gsap || !SplitText) { el.classList.add('tx-split'); return; }

    var origLabel = el.getAttribute('aria-label');
    var split, words, grads = [];
    try {
      var spoken = origLabel === null ? spokenText(el) : origLabel;
      split = splitWords(el, 'tx-w', 'auto');
      if (spoken) el.setAttribute('aria-label', spoken);
      words = split.words.slice();
      slice(el.querySelectorAll('.grad-text')).forEach(function (g) {
        var inner = words.filter(function (w) { return g.contains(w); });
        if (inner.length) { g.classList.add('tx-g'); grads.push({ el: g, words: inner }); }
      });
      gsap.set(words, { opacity: 0 });
    } catch (e) {
      warn(e);
      if (words) gsap.set(words, { clearProps: 'opacity,filter' });
      el.classList.add('tx-split');
      return;
    }
    el.classList.add('tx-split');

    var finished = false;
    var tween = null;
    var lastW = window.innerWidth;

    function finish() {
      if (finished) return;
      finished = true;
      window.removeEventListener('resize', onResize);
      try {
        unwrap(words);
        grads.forEach(function (g) { g.el.classList.remove('tx-g'); g.el.normalize(); });
        el.normalize();
        if (origLabel === null) el.removeAttribute('aria-label'); else el.setAttribute('aria-label', origLabel);
        el.classList.add('tx-done');
      } catch (e) { warn(e); }
    }
    function onResize() {
      // the gradient slices are measured once; a width change mid-animation
      // just jumps to the end (which unwraps the spans).
      if (window.innerWidth === lastW) return;
      if (tween) tween.progress(1); else finish();
    }

    inView(el, function () {
      try {
        grads.forEach(function (g) { sliceGradient(g.el, g.words); });
        gsap.set(words, { willChange: 'opacity, filter' });
        window.addEventListener('resize', onResize);
        tween = gsap.fromTo(words, { opacity: 0, filter: 'blur(10px)' }, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.85,
          ease: 'power2.out',
          stagger: { each: Math.min(0.11, 0.9 / Math.max(1, words.length)) },
          onComplete: finish
        });
      } catch (e) {
        warn(e);
        gsap.set(words, { clearProps: 'opacity,filter,willChange' });
        finish();
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.25 });
  }

  /* ======================================================================
     [data-scrub-words]  Text Reveal (Magic UI): one scrubbed timeline, word i
     lights up over its slice of the scroll range. The trailing .grad-text
     word lights up last, with a scale pop, a halo and three sparkles, and
     gets .is-lit (CSS shimmer + twinkle) once the timeline reaches the end.
     Scroll range: the closest [data-scrub-track] (a tall box whose child is
     sticky), or the paragraph itself when there is no track.
     ====================================================================== */
  var SPARK = '<svg class="tx-pop__spark" viewBox="0 0 100 100"><use href="#sparkle-shape"/></svg>';

  function initScrub(el) {
    if (!claim(el, 'scrub')) return;
    var track = el.closest('[data-scrub-track]');
    if (REDUCED || !gsap || !ST || !SplitText) { el.classList.add('tx-scrub-static'); return; }

    var words, pop = null, fx = null;
    try {
      var grads = slice(el.querySelectorAll('.grad-text'));
      var split = splitWords(el, 'tx-sw', 'none', grads);
      words = split.words.slice();

      // the closing gradient phrase becomes the "pop" word. SplitText glues an
      // ignored element to the word right before it when no space separates
      // them ("ל" + "קסם."); otherwise wrap it ourselves.
      var last = grads[grads.length - 1];
      if (last) {
        pop = last.closest('.tx-sw');
        if (!pop) {
          pop = document.createElement('span');
          pop.className = 'tx-sw';
          last.parentNode.insertBefore(pop, last);
          pop.appendChild(last);
          words.push(pop);
        }
        pop.classList.add('tx-pop');
        fx = document.createElement('span');
        fx.className = 'tx-pop__fx';
        fx.setAttribute('aria-hidden', 'true');
        fx.innerHTML = '<span class="tx-pop__halo"></span>' + SPARK + SPARK + SPARK;
        pop.appendChild(fx);
      }
      el.classList.add('tx-scrub');
      if (track) track.classList.add('is-on');

      var rest = words.filter(function (w) { return w !== pop; });
      var EACH = 0.55;
      var tl = gsap.timeline({ defaults: { ease: 'none' } });
      tl.fromTo(rest, { opacity: 0.15 }, { opacity: 1, duration: 1, stagger: EACH }, 0);
      var litAt = 1;
      if (pop) {
        var halo = fx.querySelector('.tx-pop__halo');
        var sparks = slice(fx.querySelectorAll('.tx-pop__spark'));
        var at = rest.length * EACH + 0.15;
        tl.fromTo(pop, { opacity: 0.15, scale: 0.9 }, { opacity: 1, scale: 1, duration: 1.6, ease: 'back.out(2.4)' }, at);
        tl.fromTo(halo, { opacity: 0, scale: 0.35 }, { opacity: 1, scale: 1, duration: 1.6, ease: 'power2.out' }, at + 0.1);
        tl.fromTo(sparks, { opacity: 0, scale: 0, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 1, ease: 'back.out(3)', stagger: 0.25 }, at + 0.5);
        litAt = (at + 1.6) / (at + 1.6 + 2.2);
      }
      tl.to({}, { duration: 2.2 }); // hold the finished paragraph before the sticky ends

      tl.eventCallback('onUpdate', function () {
        if (!pop) return;
        var p = tl.progress();
        if (p >= litAt - 0.01) pop.classList.add('is-lit');
        else if (p < litAt - 0.12) pop.classList.remove('is-lit');
      });

      ST.create({
        trigger: track || el,
        start: track ? 'top 38%' : 'top 85%',
        end: track ? 'bottom bottom' : 'bottom 40%',
        scrub: 0.6,
        animation: tl,
        invalidateOnRefresh: false
      });

      // twinkle loops only while the paragraph can be seen
      if (pop && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          pop.classList.toggle('is-off', !en[0].isIntersecting);
        }).observe(pop);
      }
    } catch (e) {
      warn(e);
      if (words) gsap.set(words, { clearProps: 'opacity,transform' });
      if (track) track.classList.remove('is-on');
      el.classList.add('tx-scrub-static');
    }
  }

  /* ======================================================================
     [data-scramble]  Encrypted Text (Aceternity): revealedCount grows every
     REVEAL ms in reading order (right to left for Hebrew); the tail re-rolls
     every FLIP ms. Each glyph draws from its own script (Hebrew / Latin /
     digits) so bidi runs never flip; punctuation and spaces stay put. The
     real text keeps the box (no layout shift) while an overlay animates, and
     random glyphs are picked near the original's width so the closing
     parenthesis barely moves.
     ====================================================================== */
  var POOLS = {
    he: 'אבגדהוזחטיכלמנסעפצקרשת'.split(''),
    la: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''),
    di: '0123456789'.split('')
  };
  var REVEAL = 46, FLIP = 52;
  var canvasCtx = null, widthCache = {};

  function scriptOf(c) {
    if (/[א-ת]/.test(c)) return 'he';
    if (/[A-Za-z]/.test(c)) return 'la';
    if (/[0-9]/.test(c)) return 'di';
    return null;
  }
  function graphemes(text) {
    try {
      if (window.Intl && Intl.Segmenter) {
        return Array.from(new Intl.Segmenter('he', { granularity: 'grapheme' }).segment(text), function (s) { return s.segment; });
      }
    } catch (e) { /* fall through */ }
    return Array.from(text);
  }
  function measure(font, ch) {
    var key = font + '|' + ch;
    if (key in widthCache) return widthCache[key];
    if (!canvasCtx) canvasCtx = document.createElement('canvas').getContext('2d');
    canvasCtx.font = font;
    return (widthCache[key] = canvasCtx.measureText(ch).width);
  }
  // per original glyph: a pool of same-script glyphs within ~20% of its width
  function poolFor(ch, font) {
    var s = scriptOf(ch);
    if (!s) return null;
    var key = 'pool|' + font + '|' + ch;
    if (widthCache[key]) return widthCache[key];
    var base = POOLS[s];
    var pool = base;
    try {
      var w = measure(font, ch);
      if (w > 0) {
        var near = base.filter(function (g) { return Math.abs(measure(font, g) - w) <= w * 0.2; });
        if (near.length >= 4) pool = near;
      }
    } catch (e) { /* any glyph will do */ }
    return (widthCache[key] = pool);
  }

  function initScramble(el) {
    if (!claim(el, 'scr')) return;
    if (REDUCED || el.children.length) return; // plain-text labels only
    var original = el.textContent;
    var text = original.replace(/\s+/g, ' ').trim();
    if (!text) return;

    var chars = graphemes(text);
    var font = '';
    try {
      var cs = getComputedStyle(el);
      font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    } catch (e) { /* default canvas font */ }
    var pools = chars.map(function (c) { return poolFor(c, font); });
    var roll = function (i) { var p = pools[i]; return p ? p[(Math.random() * p.length) | 0] : chars[i]; };
    var cur = chars.map(function (c, i) { return roll(i); });

    var wrap = document.createElement('span');
    var real = document.createElement('span');
    var fx = document.createElement('span');
    var done = document.createElement('span');
    var enc = document.createElement('span');
    wrap.className = 'tx-scr';
    real.className = 'tx-scr__real';
    fx.className = 'tx-scr__fx';
    done.className = 'tx-scr__done';
    enc.className = 'tx-scr__enc';
    fx.setAttribute('aria-hidden', 'true');
    real.textContent = text;
    enc.textContent = cur.join('');
    fx.appendChild(done);
    fx.appendChild(enc);
    wrap.appendChild(real);
    wrap.appendChild(fx);
    el.textContent = '';
    el.appendChild(wrap);
    el.classList.add('tx-scrambling');

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      el.textContent = original;
      el.classList.remove('tx-scrambling');
    }

    function run() {
      var n = chars.length;
      var t0 = 0, lastFlip = 0;
      var guard = setTimeout(finish, n * REVEAL + 1800); // never leave it scrambled
      function step(now) {
        if (finished) return;
        if (!t0) { t0 = now; lastFlip = now; }
        var k = Math.min(n, Math.floor((now - t0) / REVEAL));
        if (now - lastFlip >= FLIP) {
          for (var i = k; i < n; i++) cur[i] = roll(i);
          lastFlip = now;
        }
        done.textContent = chars.slice(0, k).join('');
        enc.textContent = cur.slice(k).join('');
        if (k >= n) { clearTimeout(guard); finish(); return; }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    inView(el, function () {
      try { setTimeout(run, 120); } catch (e) { warn(e); finish(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.5 });
  }

  /* ======================================================================
     [data-count]  Number Ticker (Magic UI): 0 -> value when in view. The
     spring (damping 60, stiffness 100) is approximated with expo.out; the box
     is locked to the final value's width so nothing around it moves.
     Optional: data-count-delay="ms". Inside the hero ([data-hero-in]) it
     waits a beat for the hero's own entrance.
     ====================================================================== */
  function initCount(el) {
    if (!claim(el, 'cnt')) return;
    var raw = (el.getAttribute('data-count') || '').trim();
    var to = parseFloat(raw);
    if (REDUCED || !isFinite(to)) return;
    var finalText = el.textContent;
    var dec = (raw.split('.')[1] || '').length;
    var fmt;
    try { fmt = new Intl.NumberFormat('he-IL', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
    catch (e) { fmt = { format: function (v) { return v.toFixed(dec); } }; }
    var attrDelay = parseFloat(el.getAttribute('data-count-delay'));
    var delay = isFinite(attrDelay) ? attrDelay / 1000 : (el.closest('[data-hero-in]') ? 0.75 : 0.1);

    el.classList.add('tx-count');
    try { if (getComputedStyle(el).display === 'inline') el.classList.add('tx-count--inline'); } catch (e) { /* noop */ }

    // screen readers (and find-in-page) get the real value while the visible digits tick
    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = finalText.replace(/\s+/g, ' ').trim();
    el.parentNode.insertBefore(sr, el.nextSibling);
    el.setAttribute('aria-hidden', 'true');

    // Lock the box to the final value's width BEFORE the zero shows (one synchronous
    // pass, no paint in between), so the text around it never reflows when the ticker
    // starts (a paragraph re-wrapping on screen also left ScrollTrigger stale). Taken
    // again once the webfonts are in and after resizes (breakpoints change the size)
    // until the ticker runs.
    var started = false, rsTimer = 0;
    function lock() {
      if (started) return;
      el.style.minWidth = '';
      el.textContent = finalText;
      el.style.minWidth = Math.ceil(el.getBoundingClientRect().width * 100) / 100 + 'px';
      el.textContent = fmt.format(0);
    }
    function onResize() {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(function () { try { lock(); } catch (e) { warn(e); } }, 150);
    }
    function restore() {
      el.textContent = finalText;
      el.style.minWidth = '';
      el.removeAttribute('aria-hidden');
      if (sr.parentNode) sr.parentNode.removeChild(sr);
    }
    try { lock(); } catch (e) { warn(e); restore(); return; }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { try { lock(); } catch (e) { warn(e); } });
    window.addEventListener('resize', onResize);

    inView(el, function () {
      started = true;
      clearTimeout(rsTimer);
      window.removeEventListener('resize', onResize);
      try {
        var o = { v: 0 };
        var render = function () { el.textContent = fmt.format(dec ? o.v : Math.round(o.v)); };
        if (gsap) {
          gsap.to(o, { v: to, duration: 1.9, delay: delay, ease: 'expo.out', onUpdate: render, onComplete: restore });
        } else {
          setTimeout(restore, delay * 1000);
        }
      } catch (e) { warn(e); restore(); }
    }, { threshold: 0.6 });
  }

  /* ---------- scan ---------- */
  function each(scope, sel, fn) {
    slice((scope || document).querySelectorAll(sel)).forEach(function (el) {
      try { fn(el); } catch (e) { warn(e); }
    });
  }
  function scan(scope) {
    each(scope, '[data-split]', initSplit);
    each(scope, '[data-scrub-words]', initScrub);
    each(scope, '[data-scramble]', initScramble);
    each(scope, '[data-count]', initCount);
  }

  VM.text = { scan: scan, split: initSplit, scrub: initScrub, scramble: initScramble, count: initCount };

  try { scan(document); } catch (e) {
    warn(e);
    // failsafe: never leave a heading hidden
    each(document, '[data-split]', function (el) { el.classList.add('tx-split'); });
  }
})();
