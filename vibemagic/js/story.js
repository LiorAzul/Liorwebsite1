/* ==========================================================================
   VibeMagic — story.js
   #process timeline · #about portrait tilt + orbit pause · #learn YouTube
   facades + prompt copy · #faq accordion motion

   21st.dev components ported to vanilla (styles in css/story.css):
     · Timeline ............ Manu Arora (Aceternity UI)
         framer-motion useScroll({ offset: ['start X', 'end X'] }) → GSAP
         ScrollTrigger scrub; height transform → scaleY on the fill; opacity
         0→1 over the first slice of progress; + a sparkle "head" and per-row
         ignition (.is-lit) once the head passes each dot.
     · Orbiting Circles .... Dillion Verma (Magic UI)
         pure CSS (see story.css); here only: pause offscreen.
   Everything is wrapped in try/catch: a failing effect leaves the content
   readable (lit timeline, static orbit, native <details>).
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM || {};
  var REDUCED = !!VM.reduced;
  var gsap = window.gsap || null;
  var ST = window.ScrollTrigger || null;
  var hasIO = 'IntersectionObserver' in window;

  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function warn(name, e) { try { console.warn('[story] ' + name + ' failed', e); } catch (x) { /* noop */ } }
  function safe(name, fn) { try { fn(); } catch (e) { warn(name, e); } }

  /* ======================================================================
     1. #process — Timeline (Aceternity UI)
     Head sits on a fixed reading line (start/end at the same viewport %), so
     a row ignites as its dot crosses that line, and un-ignites going back up.
     ====================================================================== */
  function initTimeline() {
    var list = document.querySelector('[data-timeline]');
    if (!list) return;
    var rows = $$('.tl', list);
    var dots = rows.map(function (r) { return r.querySelector('.tl__dot'); });
    if (!rows.length) return;

    var track = document.createElement('li');
    track.className = 'timeline__track';
    track.setAttribute('aria-hidden', 'true');
    track.setAttribute('role', 'presentation');
    track.innerHTML = '<span class="timeline__fill"></span>' +
      '<span class="timeline__head"><svg class="sparkle" focusable="false"><use href="#sparkle-shape"/></svg></span>';
    list.appendChild(track);
    var fill = track.firstChild;
    var head = track.lastChild;

    if (REDUCED) {
      list.classList.add('is-static');
      return; // CSS renders every row lit while the list is not armed
    }

    function lineFor(mobile) { return mobile ? 0.66 : 0.6; }
    var LINE = lineFor(VM.isMobile);       // reading line (fraction of the viewport height)
    var H = list.offsetHeight;
    var lit = rows.map(function () { return null; });
    var state = { p: 0 };

    function render() {
      var p = clamp(state.p, 0, 1);
      fill.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      head.style.transform = 'translate3d(0,' + (p * H).toFixed(1) + 'px,0)';
      head.style.opacity = clamp(Math.min(p, 1 - p) * 40, 0, 1).toFixed(3);
      var top = list.getBoundingClientRect().top;
      var headY = top + p * H;
      for (var i = 0; i < rows.length; i++) {
        var d = dots[i].getBoundingClientRect();
        var on = d.top + d.height / 2 <= headY + 0.5;
        if (on !== lit[i]) {
          lit[i] = on;
          rows[i].classList.toggle('is-lit', on);
        }
      }
    }

    list.classList.add('is-armed');

    // the reading line moves when the layout crosses the mobile breakpoint (rotation, resize)
    var bpTimer = 0, ask = null;           // ask: rAF-merged re-measure of the no-GSAP path
    function onBreakpoint(mode) {
      var next = lineFor(mode === 'mobile');
      if (next === LINE) return;
      LINE = next;
      clearTimeout(bpTimer);
      bpTimer = setTimeout(function () {
        if (gsap && ST) { try { ST.refresh(); } catch (e) { /* noop */ } }
        else if (ask) ask();
      }, 120);
    }
    if (typeof VM.on === 'function') VM.on('breakpoint', onBreakpoint);

    if (gsap && ST) {
      // functions: re-read on every refresh, so a breakpoint change takes the new line
      var pct = function () { return Math.round(LINE * 100) + '%'; };
      gsap.to(state, {
        p: 1,
        ease: 'none',
        onUpdate: render,
        scrollTrigger: {
          trigger: list,
          start: function () { return 'top ' + pct(); },
          end: function () { return 'bottom ' + pct(); },
          scrub: 0.35,
          onRefresh: function () { H = list.offsetHeight; render(); },
          onToggle: function (self) { list.classList.toggle('is-active', self.isActive); }
        }
      });
      render();
      return;
    }

    // no GSAP: same mapping from a rAF-merged scroll listener
    var queued = false;
    function measure() {
      queued = false;
      var r = list.getBoundingClientRect();
      var line = LINE * window.innerHeight;
      state.p = clamp((line - r.top) / (r.height || 1), 0, 1);
      list.classList.toggle('is-active', state.p > 0 && state.p < 1);
      render();
    }
    ask = function () { if (!queued) { queued = true; requestAnimationFrame(measure); } };
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', function () { H = list.offsetHeight; ask(); });
    measure();
  }

  /* ======================================================================
     2. #about — orbit pause offscreen + portrait pointer tilt (desktop)
     ====================================================================== */
  function initAbout() {
    var sec = document.getElementById('about');
    if (!sec) return;
    var orbit = sec.querySelector('.about__orbit');
    var visual = sec.querySelector('.about__visual');
    var img = sec.querySelector('.about__portrait');

    if (orbit) {
      if (REDUCED) orbit.classList.add('is-still');
      else if (hasIO) {
        orbit.classList.add('is-paused');
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { orbit.classList.toggle('is-paused', !e.isIntersecting); });
        }, { rootMargin: '60px 0px' }).observe(orbit);
      }
    }

    if (REDUCED || !VM.finePointer || !visual || !img) return;

    // tilt: rotateX/Y ≤ 6deg toward the pointer, lerped; the orbit follows at half strength (depth)
    var MAX = 6;
    var tx = 0, ty = 0, cx = 0, cy = 0, running = false, inside = false, rect = null;
    function loop() {
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      var settled = Math.abs(tx - cx) < 0.01 && Math.abs(ty - cy) < 0.01;
      if (settled) { cx = tx; cy = ty; }
      img.style.transform = 'perspective(1100px) rotateX(' + cy.toFixed(3) + 'deg) rotateY(' + cx.toFixed(3) + 'deg) translate3d(' + (cx * -1.2).toFixed(2) + 'px,0,0)';
      if (orbit) orbit.style.transform = 'perspective(1100px) rotateX(' + (cy * 0.5).toFixed(3) + 'deg) rotateY(' + (cx * 0.5).toFixed(3) + 'deg)';
      if (settled && !inside) {
        running = false;
        if (tx === 0 && ty === 0) { img.style.transform = ''; if (orbit) orbit.style.transform = ''; }
        return;
      }
      if (settled) { running = false; return; }
      requestAnimationFrame(loop);
    }
    function kick() { if (!running && !document.hidden) { running = true; requestAnimationFrame(loop); } }
    sec.addEventListener('pointerenter', function () { inside = true; rect = visual.getBoundingClientRect(); });
    sec.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      inside = true;
      if (!rect) rect = visual.getBoundingClientRect();
      var nx = clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.75), -1, 1);
      var ny = clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.75), -1, 1);
      tx = nx * MAX;
      ty = -ny * MAX;
      kick();
    }, { passive: true });
    sec.addEventListener('pointerleave', function () { inside = false; rect = null; tx = 0; ty = 0; kick(); });
    window.addEventListener('scroll', function () { rect = null; }, { passive: true });
  }

  /* ======================================================================
     3. #learn — YouTube facade (iframe on click only) + prompt copy
     ====================================================================== */
  function initLearn() {
    var sec = document.getElementById('learn');
    if (!sec) return;

    if (REDUCED) sec.classList.add('is-still');
    else if (hasIO) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { sec.classList.toggle('is-live', e.isIntersecting); });
      }).observe(sec);
    }

    var playing = null; // { wrap, btn }

    function restore() {
      if (!playing) return;
      try { playing.wrap.replaceWith(playing.btn); } catch (e) { /* detached */ }
      playing = null;
    }

    function play(btn) {
      var id = btn.getAttribute('data-yt') || '';
      if (!/^[\w-]{6,20}$/.test(id)) return;
      restore(); // one video at a time: the other one goes back to its thumbnail (stops it)

      var art = btn.closest('.ep');
      var title = art && art.querySelector('h3') ? art.querySelector('h3').textContent.trim() : '';
      var wrap = document.createElement('div');
      wrap.className = 'ep__video is-playing';
      var img = btn.querySelector('img');
      if (img) wrap.appendChild(img.cloneNode(true)); // keeps the thumbnail under the iframe while it loads

      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&playsinline=1';
      f.title = '101' + (title ? ': ' + title : '') + ' (YouTube)';
      f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      wrap.appendChild(f);

      btn.replaceWith(wrap);
      playing = { wrap: wrap, btn: btn };
      try { f.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }

    $$('.ep__video[data-yt]', sec).forEach(function (btn) {
      btn.addEventListener('click', function () { play(btn); });
    });

    // prompt copy
    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      var ok = false;
      try {
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand('copy');
      } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
    function copyText(text) {
      if (navigator.clipboard && window.isSecureContext !== false) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
      }
      return Promise.resolve(fallbackCopy(text));
    }
    function selectNode(node) {
      try {
        var r = document.createRange();
        r.selectNodeContents(node);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      } catch (e) { /* noop */ }
    }

    // one polite status region for the whole section: children of a <button> are presentational,
    // so a live region inside each button is announced unreliably (the button keeps its aria-label)
    var status = null, statusTimer = 0;
    function ensureStatus() {
      if (status) return;
      status = document.createElement('span');
      status.className = 'sr-only';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      (sec.querySelector('.container') || sec).appendChild(status);
    }
    function announce(msg) {
      ensureStatus();
      clearTimeout(statusTimer);
      status.textContent = '';
      // set after a beat, so a second copy of the same prompt is announced again
      statusTimer = setTimeout(function () {
        status.textContent = msg;
        statusTimer = setTimeout(function () { status.textContent = ''; }, 4000);
      }, 60);
    }
    // create it up front: a live region must already exist when its text changes
    if ($$('.prompt__copy', sec).length) ensureStatus();

    $$('.prompt__copy', sec).forEach(function (btn) {
      var card = btn.closest('.prompt');
      var textEl = card && card.querySelector('.prompt__text');
      var label = btn.querySelector('span');
      if (!textEl || !label) return;
      var original = label.textContent;
      var timer = 0;
      btn.addEventListener('click', function () {
        var text = textEl.textContent.replace(/\s+/g, ' ').trim();
        copyText(text).then(function (ok) {
          clearTimeout(timer);
          if (ok) {
            label.textContent = 'הועתק ✓';
            btn.classList.add('is-copied');
            card.classList.add('is-copied');
            announce('הפרומפט הועתק');
          } else {
            selectNode(textEl);
            label.textContent = 'סמנו והעתיקו';
            announce('ההעתקה לא הצליחה. הפרומפט סומן, אפשר להעתיק אותו ידנית');
          }
          timer = setTimeout(function () {
            label.textContent = original;
            btn.classList.remove('is-copied');
            card.classList.remove('is-copied');
          }, 1600);
        });
      });
    });
  }

  /* ======================================================================
     4. #faq — accordion motion
     Modern engines: pure CSS (::details-content + interpolate-size), native
     name="faq" exclusivity, nothing to do here. Elsewhere: WAAPI on .faq__a,
     exclusivity handled here (the name attribute would close the others
     instantly, before they could animate).
     ?faqjs=1 forces the JS path (testing).
     ====================================================================== */
  function initFaq() {
    var sec = document.getElementById('faq');
    if (!sec) return;
    var items = $$('details.faq__item', sec);
    if (!items.length) return;

    var refreshTimer = 0;
    function refreshLater() {
      if (!ST) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(function () { try { ST.refresh(); } catch (e) { /* noop */ } }, 700);
    }
    items.forEach(function (d) { d.addEventListener('toggle', refreshLater); });

    var cssPath = false;
    try {
      cssPath = !!(window.CSS && CSS.supports('interpolate-size', 'allow-keywords') && CSS.supports('selector(::details-content)'));
    } catch (e) { cssPath = false; }
    if (VM.params && VM.params.has && VM.params.has('faqjs')) cssPath = false;
    if (cssPath || REDUCED || typeof Element.prototype.animate !== 'function') return;

    sec.classList.add('faq--js');
    items.forEach(function (d) { d.removeAttribute('name'); });

    var DUR = 520, EASE = 'cubic-bezier(.16, 1, .3, 1)';

    function anim(d, from, to, done) {
      var body = d.querySelector('.faq__a');
      if (d._anim) { d._anim.cancel(); d._anim = null; }
      var a = body.animate([
        { height: from + 'px', opacity: to ? 0.2 : 1 },
        { height: to + 'px', opacity: to ? 1 : 0 }
      ], { duration: DUR, easing: EASE });
      d._anim = a;
      a.onfinish = function () { d._anim = null; if (done) done(); };
    }
    function open(d) {
      items.forEach(function (o) { if (o !== d && o.open && !o._closing) close(o); });
      d._closing = false;
      var body = d.querySelector('.faq__a');
      var start = d._anim ? body.getBoundingClientRect().height : 0;
      d.open = true;
      anim(d, start, body.scrollHeight);
    }
    function close(d) {
      var body = d.querySelector('.faq__a');
      d._closing = true;
      anim(d, body.getBoundingClientRect().height, 0, function () {
        d._closing = false;
        d.open = false;
      });
    }

    items.forEach(function (d) {
      var sum = d.querySelector('summary');
      var body = d.querySelector('.faq__a');
      if (!sum || !body) return;
      sum.addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open && !d._closing) close(d);
        else open(d);
      });
    });
  }

  safe('timeline', initTimeline);
  safe('about', initAbout);
  safe('learn', initLearn);
  safe('faq', initFaq);
})();
