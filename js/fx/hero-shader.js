/* ==========================================================================
   VibeMagic · hero-shader.js
   Port of the 21st.dev "Mesh Gradient · Purple" background by paper-design
   (Paper Shaders, published through the 21st.dev Shader Builder).
   Technique kept from the original: zero-dependency WebGL1 full-screen triangle;
   every fragment takes a Gaussian-weighted average of N palette colours whose
   centres orbit on sin/cos Lissajous paths (shade(), same maths as the original),
   after the domain is rotated and warped by two fBm value-noise lookups, then a
   grain hash. Because it is a weighted average (not additive light) the same
   shader paints a nebula on black and soft pastel blobs on white: only the
   palette changes.
   VibeMagic changes: per-colour weight in u_colors[i].a (so gold reads as a
   glint, not a blob), a calm "focus" pocket behind the headline (mixes toward
   the base colour so the type pops), palette crossfade on theme change, gentle
   pointer parallax through u_offset, a lower pixel budget (a soft gradient does
   not need full resolution), offscreen/hidden pause, reduced-motion still frame,
   and a CSS-gradient fallback (.hero--no-gl) when WebGL is unavailable.
   Exposes: VM.heroShader = { ok, redraw() }.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM || (window.VM = {});
  var canvas = document.querySelector('canvas.hero__shader[data-shader]');
  if (!canvas) return;
  var hero = canvas.closest('.hero') || canvas.parentElement;

  function fail(reason) {
    if (hero) hero.classList.add('hero--no-gl');
    canvas.classList.remove('is-on');
    VM.heroShader = { ok: false, reason: reason, redraw: function () {} };
  }

  /* ---------- palettes: [hex, weight] x 8 ---------- */
  var PALETTES = {
    // near-black nebula: deep violets, electric purple, magenta haze, gold/amber glints
    dark: [
      ['#030106', 1.5],
      ['#22063A', 1.0],
      ['#6D04A0', 0.66],
      ['#C805FE', 0.46],
      ['#060210', 1.2],
      ['#FC38FE', 0.26],
      ['#3A0A66', 0.8],
      ['#12041D', 1.0]
    ],
    // poster 1: white paper with very soft yellow / lilac / peach blobs
    light: [
      ['#FFFFFF', 1.35],
      ['#FFE2A5', 1.0],
      ['#F5C9FC', 1.0],
      ['#FEE6AC', 0.9],
      ['#FFFFFF', 0.9],
      ['#F9E3FC', 0.85],
      ['#FFECC4', 0.8],
      ['#F1B8FB', 0.55]
    ]
  };
  // per-theme finish: focus pocket strength, grain, contrast
  // glint: additive gold light (a weighted average would turn gold into brown on black)
  var FINISH = {
    dark: { focus: 0.82, grain: 0.034, contrast: 1.04, glint: 1 },
    light: { focus: 0.62, grain: 0.018, contrast: 1.0, glint: 0 }
  };
  // recipe (original values unless noted)
  var R = {
    scale: 1.18,        // original 1.7: zoomed in so the blobs reach the screen edges, not just the centre
    intensity: 0.69,
    paramA: 0.74,
    warp: 0.3,
    detail: 3.68,
    seed: 1,
    rotate: 1.2915,
    timeScale: 0.9,     // original 1.069, a touch calmer
    t0: 23              // start time: a composition with colour on both sides of the headline
  };

  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function toVec(pal) {
    var out = [];
    pal.forEach(function (c) { var rgb = hexToRgb(c[0]); out.push(rgb[0], rgb[1], rgb[2], c[1]); });
    return out;
  }
  var VEC = { dark: toVec(PALETTES.dark), light: toVec(PALETTES.light) };

  /* ---------- GLSL ---------- */
  var VERT = 'attribute vec2 a_position;\nvoid main(){ gl_Position = vec4(a_position, 0.0, 1.0); }';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec4 u_colors[8];   // rgb + weight',
    'uniform vec4 u_scene;       // resolution.xy, time, colour count',
    'uniform vec4 u_shape;       // scale, intensity, paramA, warp',
    'uniform vec4 u_surface;     // detail, contrast, -, -',
    'uniform vec4 u_finish;      // focus amount, vignette, gold glint, grain',
    'uniform vec4 u_transform;   // seed, rotation, -, -',
    'uniform vec4 u_space;       // offset.xy, -, -',
    'uniform vec4 u_focus;       // focus centre.xy (uv), radius.xy (uv)',
    '#define u_resolution u_scene.xy',
    '#define u_time u_scene.z',
    '#define u_colorCount u_scene.w',
    '#define u_scale u_shape.x',
    '#define u_intensity u_shape.y',
    '#define u_paramA u_shape.z',
    '#define u_warp u_shape.w',
    '#define u_detail u_surface.x',
    '#define u_contrast u_surface.y',
    '#define u_focusAmt u_finish.x',
    '#define u_vignette u_finish.y',
    '#define u_glint u_finish.z',
    '#define u_grain u_finish.w',
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    '#define u_seed u_transform.x',
    '#else',
    '#define u_seed mod(u_transform.x, 31.0)',
    '#endif',
    '#define u_rotate u_transform.y',
    '#define u_offset u_space.xy',
    '',
    'float hash21(vec2 p) {',
    '#ifndef GL_FRAGMENT_PRECISION_HIGH',
    '  p = mod(p, 31.0);',
    '#endif',
    '  p = fract(p * vec2(234.34, 435.345));',
    '  p += dot(p, p + 34.23);',
    '  return fract(p.x * p.y);',
    '}',
    'float grainHash(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 5; i++) {',
    '    v += a * noise(p);',
    '    p = p * 2.03 + vec2(17.0, 9.2);',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    // shade(): the original mesh-gradient maths; only the per-colour weight (.a) is new
    'vec3 shade(vec2 p, float t) {',
    '  vec3 color = u_colors[0].rgb * 0.16;',
    '  float weight = 0.16;',
    '  for (int i = 0; i < 8; i++) {',
    '    if (float(i) >= u_colorCount) break;',
    '    float fi = float(i);',
    '    vec2 center = vec2(sin(fi * 2.17 + t * 0.13 + u_seed),',
    '                       cos(fi * 1.63 - t * 0.11)) * (0.22 + u_intensity * 0.62);',
    '    float falloff = mix(12.0, 2.4, u_paramA);',
    '    float influence = exp(-dot(p - center, p - center) * falloff) * u_colors[i].a;',
    '    color += u_colors[i].rgb * influence;',
    '    weight += influence;',
    '  }',
    '  return color / weight;',
    '}',
    'void main() {',
    '  vec2 screenUv = gl_FragCoord.xy / u_resolution.xy;',
    '  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);',
    '  p *= u_scale;',
    '  if (abs(u_rotate) > 0.0001) {',
    '    float cr = cos(u_rotate), sr = sin(u_rotate);',
    '    p = mat2(cr, -sr, sr, cr) * p;',
    '  }',
    '  p += u_offset;',
    '  if (u_warp > 0.0) {',
    '    p += u_warp * (vec2(fbm(p * u_detail + u_seed), fbm(p * u_detail + vec2(5.2, 1.3))) - 0.5);',
    '  }',
    '  vec3 col = shade(p, u_time);',
    '  if (abs(u_contrast - 1.0) > 0.0001) col = (col - 0.5) * u_contrast + 0.5;',
    // VibeMagic: two slow additive gold/amber glints that wander the edges (dark theme)
    '  if (u_glint > 0.001) {',
    '    vec2 g1 = vec2(sin(u_time * 0.071 + 1.3) * 1.05, cos(u_time * 0.052 + 0.4) * 0.62);',
    '    vec2 g2 = vec2(cos(u_time * 0.058 + 4.1) * 1.1, sin(u_time * 0.083 + 2.2) * 0.58);',
    '    float k1 = exp(-dot(p - g1, p - g1) * 6.5);',
    '    float k2 = exp(-dot(p - g2, p - g2) * 9.0);',
    '    col += (vec3(1.0, 0.86, 0.12) * k1 * 0.3 + vec3(0.95, 0.62, 0.08) * k2 * 0.24) * u_glint;',
    '  }',
    // calm pocket behind the headline
    '  vec2 fd = (screenUv - u_focus.xy) / u_focus.zw;',
    '  col = mix(col, u_colors[0].rgb, u_focusAmt * (1.0 - smoothstep(0.0, 1.0, dot(fd, fd))));',
    '  if (u_vignette > 0.0001) {',
    '    float vd = length(screenUv - 0.5) * 1.41421356;',
    '    col *= 1.0 - u_vignette * smoothstep(0.35, 1.0, vd);',
    '  }',
    '  if (u_grain > 0.0001) col += (grainHash(gl_FragCoord.xy + vec2(u_seed * 17.0, u_seed * 31.0)) - 0.5) * u_grain;',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  /* ---------- state ---------- */
  var gl = null, prog = null, buf = null, U = {};
  var raf = 0, last = 0, t = R.t0;
  var visible = true, pageVisible = document.visibilityState !== 'hidden';
  var started = false, drewOnce = false;
  var themeMix = VM.theme === 'light' ? 1 : 0, themeFrom = themeMix, themeTo = themeMix, themeT0 = 0, THEME_MS = 700;
  var off = [0, 0], offTarget = [0, 0], scrollOff = 0;
  var budget = VM.isMobile ? 380000 : 1100000;
  var dprCap = VM.isMobile ? 1 : 1.5;
  var perf = { n: 0, sum: 0, downgraded: 0 };
  var colorBuf = new Float32Array(32);
  var parallel = null, shaders = [];

  /* Two phases so the ~50ms shader compile never blocks the main thread at load:
     beginGL() creates the context and queues compile + link (asynchronous where the driver
     offers KHR_parallel_shader_compile), finishGL() reads the result once it is ready. */
  function beginGL() {
    var opts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return false;
    parallel = gl.getExtension('KHR_parallel_shader_compile');
    shaders = [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]].map(function (d) {
      var s = gl.createShader(d[0]);
      gl.shaderSource(s, d[1]);
      gl.compileShader(s);
      return s;
    });
    prog = gl.createProgram();
    shaders.forEach(function (s) { gl.attachShader(prog, s); });
    gl.linkProgram(prog);
    return true;
  }

  function linkDone() {
    return !parallel || gl.isContextLost() || !!gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR);
  }

  function finishGL() {
    if (gl.isContextLost()) return false;
    var linked = gl.getProgramParameter(prog, gl.LINK_STATUS);
    if (!linked) {
      shaders.forEach(function (s) {
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('[hero-shader] compile failed', gl.getShaderInfoLog(s));
      });
      console.warn('[hero-shader] link failed', gl.getProgramInfoLog(prog));
    }
    shaders.forEach(function (s) { gl.deleteShader(s); });
    shaders = [];
    if (!linked) return false;
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['colors', 'scene', 'shape', 'surface', 'finish', 'transform', 'space', 'focus'].forEach(function (k) {
      U[k] = gl.getUniformLocation(prog, 'u_' + k);
    });
    gl.uniform4f(U.shape, R.scale, R.intensity, R.paramA, R.warp);
    gl.uniform4f(U.transform, R.seed, R.rotate, 0, 0);
    return true;
  }

  function resize() {
    if (!gl) return false;
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    var W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    var k = Math.min(1, Math.sqrt(budget / Math.max(1, W * H)));
    W = Math.max(1, Math.round(W * k));
    H = Math.max(1, Math.round(H * k));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      gl.viewport(0, 0, W, H);
      return true;
    }
    return false;
  }

  // the headline sits around 46% from the top; on phones the stack is taller, so the pocket is taller too
  function focusRect() {
    var narrow = canvas.clientWidth < 720;
    return narrow ? [0.5, 0.56, 0.62, 0.36] : [0.5, 0.55, 0.36, 0.34];
  }

  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function draw(now) {
    if (!gl || gl.isContextLost()) return;
    // theme crossfade
    if (themeMix !== themeTo) {
      var p = Math.min(1, (now - themeT0) / THEME_MS);
      themeMix = themeFrom + (themeTo - themeFrom) * ease(p);
      if (p >= 1) themeMix = themeTo;
    }
    var m = themeMix;
    for (var i = 0; i < 32; i++) colorBuf[i] = VEC.dark[i] + (VEC.light[i] - VEC.dark[i]) * m;
    var fd = FINISH.dark, fl = FINISH.light;
    var f = focusRect();
    gl.uniform4fv(U.colors, colorBuf);
    gl.uniform4f(U.scene, canvas.width, canvas.height, t, 8);
    gl.uniform4f(U.surface, R.detail, fd.contrast + (fl.contrast - fd.contrast) * m, 0, 1);
    gl.uniform4f(U.finish, fd.focus + (fl.focus - fd.focus) * m, 0, fd.glint + (fl.glint - fd.glint) * m, fd.grain + (fl.grain - fd.grain) * m);
    gl.uniform4f(U.space, off[0], off[1] + scrollOff, 0, 0);
    gl.uniform4f(U.focus, f[0], f[1], f[2], f[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!drewOnce) {
      drewOnce = true;
      // let the first frame land before fading the canvas in over the CSS fallback
      requestAnimationFrame(function () { canvas.classList.add('is-on'); });
    }
  }

  function shouldRun() {
    return started && visible && pageVisible && !VM.reduced && gl && !gl.isContextLost();
  }

  function frame(now) {
    raf = 0;
    if (!shouldRun()) { last = 0; return; }
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016;
    last = now;
    t += dt * R.timeScale;
    var k = 1 - Math.exp(-dt * 2.4);
    off[0] += (offTarget[0] - off[0]) * k;
    off[1] += (offTarget[1] - off[1]) * k;
    resize();
    draw(now);
    // adaptive quality: if the GPU struggles, lower the pixel budget (at most twice)
    if (perf.downgraded < 2 && dt > 0) {
      perf.n++;
      perf.sum += dt;
      if (perf.n >= 90) {
        if (perf.sum / perf.n > 0.024) {
          budget = Math.round(budget * 0.55);
          perf.downgraded++;
        }
        perf.n = 0;
        perf.sum = 0;
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (raf || !shouldRun()) return;
    raf = requestAnimationFrame(frame);
  }

  // one-off frames (reduced motion, theme change while paused, resize while paused)
  var stillQueued = false;
  function still() {
    if (!started || !gl || stillQueued) return;
    stillQueued = true;
    requestAnimationFrame(function step(now) {
      stillQueued = false;
      resize();
      draw(now);
      // keep stepping while a theme crossfade is in flight
      if (themeMix !== themeTo && !shouldRun()) { stillQueued = true; requestAnimationFrame(step); }
    });
  }

  function start() {
    if (started) return;
    started = true;
    resize();
    if (VM.reduced) still(); else kick();
  }

  /* ---------- boot ----------
     Off the critical path: after the first frame, in an idle slot (the CSS gradient underlay is
     already painted and the canvas fades in over it), then the link result is polled per frame. */
  var booting = false, bootGen = 0;
  function boot(onReady) {
    if (booting) return;
    booting = true;
    var gen = ++bootGen;
    try {
      if (!beginGL()) { booting = false; fail('no-webgl'); return; }
    } catch (e) {
      booting = false;
      console.warn('[hero-shader] init failed', e);
      fail('init-error');
      return;
    }
    var polls = 0;
    (function poll() {
      if (gen !== bootGen) return;   // superseded (context lost and restored meanwhile)
      // ~4s of polling at most; then the (blocking) status read settles it either way
      if (!linkDone() && ++polls < 240) { requestAnimationFrame(poll); return; }
      booting = false;
      var ok = false;
      try { ok = finishGL(); } catch (e) { console.warn('[hero-shader] init failed', e); }
      if (!ok) { if (!gl.isContextLost()) fail('link-error'); return; }
      VM.heroShader = { ok: true, redraw: still };
      onReady();
    })();
  }
  function afterFirstFrame(fn) {
    requestAnimationFrame(function () {
      if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 700 });
      else setTimeout(fn, 50);
    });
  }

  VM.heroShader = { ok: false, pending: true, redraw: still };

  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  });
  canvas.addEventListener('webglcontextrestored', function () {
    booting = false;
    boot(function () {
      drewOnce = false;
      if (!started) { start(); return; }   // the first boot was still compiling (superseded here)
      if (VM.reduced) still(); else kick();
    });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) kick();
    }, { rootMargin: '80px 0px' }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () {
    pageVisible = document.visibilityState !== 'hidden';
    if (pageVisible) kick();
  });

  var resizeQueued = false;
  function onResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () {
      resizeQueued = false;
      if (!shouldRun()) still();
    });
  }
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(canvas);
  else window.addEventListener('resize', onResize);

  VM.on && VM.on('theme', function (th) {
    themeFrom = themeMix;
    themeTo = th === 'light' ? 1 : 0;
    themeT0 = performance.now();
    if (VM.reduced) { themeMix = themeTo; still(); return; }
    if (!shouldRun()) still();
  });

  // gentle pointer parallax (desktop only)
  if (VM.finePointer && !VM.reduced) {
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var nx = e.clientX / window.innerWidth - 0.5;
      var ny = e.clientY / window.innerHeight - 0.5;
      offTarget[0] = -nx * 0.16;
      offTarget[1] = ny * 0.11;
    }, { passive: true });
  }

  // scroll parallax lives inside the shader: the nebula drifts as the hero scrolls away, while the
  // canvas itself stays put (moving it would drag its bottom fade out of the hero's clip)
  if (!VM.reduced) {
    window.addEventListener('scroll', function () {
      if (!visible) return;
      var h = hero.offsetHeight || window.innerHeight;
      var pr = Math.max(0, Math.min(1, window.scrollY / h));
      scrollOff = pr * 0.42;
    }, { passive: true });
  }

  // compile and start painting only once the neon intro has handed off (it keeps the hero hidden
  // until then), and only after that first frame is out
  function bootAndStart() { afterFirstFrame(function () { boot(start); }); }
  if (VM.whenIntroDone) VM.whenIntroDone(bootAndStart); else bootAndStart();
})();
