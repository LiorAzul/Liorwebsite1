/* ==========================================================================
   VibeMagic — playground.js · "נסו את הקסם" idea playground (section#magic)
   The visitor writes a one-line idea (or taps a chip), watches a fake-but-
   delightful "AI build" (Claude-Code-style step list + a mini editor typing
   code), gets a concept that materializes (device mock with a generated mini
   UI, name, palette, features) and sends it to Lior on WhatsApp in one tap.

   21st.dev components ported to vanilla (restyled to the brand):
     · Typing Animation ....... Magic UI, Dillion Verma (placeholder + chip typewriter)
     · iPhone 15 Pro + Safari . Magic UI, Dillion Verma (device frames, HTML screen overlay)
     · Text Generate Effect ... Aceternity UI, Manu Arora (per-word blur-in of the concept name)
     · Confetti "Stars" preset  Magic UI, Dillion Verma, on canvas-confetti (fallback burst)
     · Border Beam ............ Magic UI, Dillion Verma (.beam from core.css on the panel + CTA)

   Contracts: reads VM.reduced, VM.waLink, VM.lenis (scrolls to an explicit Y; see keepInView),
   VM.burst(x, y) (viewport px, optional, from delight.js) else window.confetti, and
   window.ScrollTrigger.refresh() after the panel changes height. Exports nothing.
   The result CTA carries [data-confetti] for delegated click bursts.
   Security: user text only ever goes through textContent / attributes, never innerHTML.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM || {};
  var pg = document.querySelector('[data-playground]');
  if (!pg) return;

  var body = pg.querySelector('.pg__body');
  var form = pg.querySelector('.pg__form');
  var input = pg.querySelector('.pg__input');
  var phEl = pg.querySelector('.pg__ph');
  var hint = pg.querySelector('.pg__hint');
  var count = pg.querySelector('.pg__count');
  var stage = pg.querySelector('.pg__stage');
  var live = pg.querySelector('[data-pg-live]');
  var statusT = pg.querySelector('.pg__status-t');
  var chips = Array.prototype.slice.call(pg.querySelectorAll('.pg__chips .chip'));
  if (!body || !form || !input || !stage) return;

  var REDUCED = !!VM.reduced;
  var MAX = 280;
  var NS = 'http://www.w3.org/2000/svg';
  var HINT_DEFAULT = hint ? hint.innerHTML : '';   // static markup from index.html (no user data)

  var state = 'idle';     // idle | typing | building | result
  var focusRun = false;   // focus was inside the playground when the current run started
  var run = 0;            // bumps on every start/reset so stale timers and frames bail out
  var timers = [];
  var rafs = [];
  var inView = false;

  /* ======================================================================
     DATA
     ====================================================================== */
  var TYPES = {
    app: {
      label: 'אפליקציה לנייד', device: 'phone', test: 'בודק על אייפון', testD: 'iPhone ✓',
      file: 'App.swift', screens: '4 מסכים', lines: [300, 420], cta: 'בואו נתחיל', tld: '.app', fallback: 'VibeApp',
      feats: ['כניסה מהירה עם Apple או Google', 'התראות פוש בדיוק בזמן הנכון', 'עיצוב נקי שמרגיש כמו של חברה גדולה', 'מוכנה להעלאה לאפ סטור']
    },
    site: {
      label: 'אתר', device: 'browser', test: 'בודק בדפדפן', testD: 'Chrome · Safari ✓',
      file: 'index.html', screens: '3 עמודים', lines: [180, 280], cta: 'דברו איתנו', tld: '.co.il', fallback: 'VibeSite',
      feats: ['עמוד נחיתה מהיר עם אנימציות', 'כפתור וואטסאפ וטופס לידים', 'מותאם בול לנייד', 'SEO בסיסי כדי שימצאו אתכם בגוגל']
    },
    system: {
      label: 'מערכת לעסק', device: 'browser', test: 'בודק בדפדפן', testD: 'Chrome · Safari ✓',
      file: 'leads.ts', screens: 'דשבורד + 3 מסכים', lines: [420, 560], cta: 'כניסה', tld: '.app', fallback: 'VibeOps',
      feats: ['דשבורד עם כל הלידים במקום אחד', 'תזכורות ומעקב אוטומטיים', 'חיבור לגוגל שיטס ולוואטסאפ', 'הרשאות לכל אחד בצוות']
    },
    game: {
      label: 'משחק', device: 'phone', test: 'בודק על אייפון', testD: 'iPhone ✓',
      file: 'game.ts', screens: '5 שלבים', lines: [340, 480], cta: 'שחקו עכשיו', tld: '.app', fallback: 'VibeGame',
      feats: ['שלבים שהולכים ונהיים קשים יותר', 'טבלת שיאים בזמן אמת', 'אפקטים וסאונד שעושים חשק להמשיך', 'משחק קבוצתי ישר מהטלפון']
    },
    store: {
      label: 'חנות אונליין', device: 'browser', test: 'בודק בדפדפן', testD: 'Chrome · Safari ✓',
      file: 'shop.ts', screens: 'קטלוג + קופה', lines: [380, 520], cta: 'לקנייה', tld: '.shop', fallback: 'VibeShop',
      feats: ['קטלוג מוצרים עם סינון חכם', 'סליקה מאובטחת, ביט ו-Apple Pay', 'ניהול מלאי והזמנות', 'קופונים ומבצעים בלחיצה']
    },
    ai: {
      label: 'מוצר AI', device: 'browser', test: 'בודק בדפדפן', testD: 'Chrome · Safari ✓',
      file: 'agent.ts', screens: 'צ׳אט + דשבורד', lines: [260, 380], cta: 'שאלו אותי', tld: '.ai', fallback: 'VibeAI',
      feats: ['צ׳אט חכם שמכיר את העסק שלכם', 'עונה בעברית, מסביב לשעון', 'מחובר למסמכים ולמידע שלכם', 'דשבורד שמראה מה שואלים הכי הרבה']
    }
  };

  // [type, weight, test]. Highest weight wins; ties go to the earlier type in PRIORITY.
  var RULES = [
    ['game', 3, /משחק|(^|[^a-z])games?([^a-z]|$)|טריוויה|trivia|חידון|quiz/i],
    ['store', 3, /חנות|חנויות|(^|[^a-z])(store|shop)([^a-z]|$)|מכירות|e-?commerce|סליקה/i],
    ['store', 2, /מכירה|למכור|מוכר|קטלוג|עגלת/i],
    ['ai', 3, /בוט|(^|[^a-z])(chat)?bot([^a-z]|$)|בינה מלאכותית|gpt/i],
    ['ai', 2, /(^|[^a-z])ai([^a-z]|$)|בינה|צ[׳'’]?אט|(^|[^a-z])chat|claude|ג[׳'’]?מיני/i],
    ['system', 3, /מערכת|(^|[^a-z])(crm|dashboard|system)([^a-z]|$)|דשבורד/i],
    ['system', 2, /לידים|ניהול|אוטומצי|מלאי|הנהלת|תזכור|automation/i],
    ['site', 3, /אתר|דף נחיתה|(^|[^a-z])(web)?site([^a-z]|$)|website|landing|בלוג|(^|[^a-z])blog|פורטפוליו|portfolio/i],
    ['site', 2, /תדמית|נחיתה/i],
    ['app', 3, /אפליקצי|(^|[^a-z])apps?([^a-z]|$)|application|אייפון|iphone|ios|אנדרואיד|android/i],
    ['app', 2, /נייד|טלפון|mobile/i]
  ];
  var PRIORITY = ['game', 'store', 'ai', 'system', 'site', 'app'];

  // palette = [primary, secondary, accent, surface]
  var PALETTES = {
    app: [{ n: 'Neon Violet', c: ['#C805FE', '#F7ACE2', '#FFE000', '#130A20'] }, { n: 'Lemon Grape', c: ['#7C3AED', '#F9A8D4', '#FACC15', '#FFFDF6'] }],
    game: [{ n: 'Arcade', c: ['#FC38FE', '#22D3EE', '#FFE000', '#12051F'] }, { n: 'Candy Pop', c: ['#FF4D8D', '#7C3AED', '#FFD23F', '#FFF6FB'] }],
    site: [{ n: 'Golden Hour', c: ['#E8590C', '#F677B6', '#FFC845', '#FFF8EE'] }, { n: 'Lilac Studio', c: ['#9D3BF0', '#FFB276', '#F1ADFD', '#FCF7FF'] }],
    system: [{ n: 'Calm Ops', c: ['#6D5DFC', '#2DD4BF', '#F472B6', '#0E1020'] }, { n: 'Clean Desk', c: ['#4F46E5', '#10B981', '#F59E0B', '#F7F7FB'] }],
    store: [{ n: 'Boutique', c: ['#D6246E', '#FFC857', '#7C3AED', '#FFF5EE'] }, { n: 'Night Market', c: ['#FFE000', '#FC38FE', '#38BDF8', '#120A1C'] }],
    ai: [{ n: 'Aurora', c: ['#8B5CF6', '#22D3EE', '#F0ABFC', '#0B0717'] }, { n: 'Soft Mind', c: ['#B021C9', '#FDE047', '#A5B4FC', '#FAF7FF'] }]
  };

  var EXAMPLES = [
    'אפליקציה להזמנת תורים למספרה שלי',
    'אתר לסטודיו לקרמיקה עם הרשמה לסדנאות',
    'מערכת שמזכירה ללקוחות לשלם בזמן',
    'משחק טריוויה על תנ״ך לילדים',
    'חנות אונליין לתכשיטים בעבודת יד',
    'בוט AI שעונה ללקוחות בוואטסאפ'
  ];

  function toSet(str) { var s = {}; str.split(/\s+/).forEach(function (w) { if (w) s[w] = 1; }); return s; }
  var STOP = toSet('אני אנחנו את אתה אתם הוא היא הם רוצה רוצים רציתי צריך צריכה צריכים שלי שלנו שלו שלה של עם על או גם כמו כל זה זו זאת יש לי לנו מה איך עבור בשביל ממש חדש חדשה חדשים מגניב מגניבה מגניבים פשוט קטן קטנה גדול גדולה אונליין דיגיטלי דיגיטלית חכם חכמה חכמים טוב טובה יפה אחד אחת כמה הרבה מאוד רק עוד אם כי אז זמן יום היום מהר מהיר מהירה קל נוח לעשות לבנות ליצור לנהל למכור להזמין לקבוע הזמנת הזמנה הזמנות קביעת ניהול מעקב מכירת תדמית נחיתה דף עמוד הרשמה עבודת יד ' +
    'i a an the my our your for to of with and or in on at by is it that which who new cool simple small big smart easy fast best online book booking manage managing track tracking sell selling make build create find order help get people');
  var TYPEW = toSet('אפליקציה אפליקציית אפליקציות אתר אתרים מערכת מערכות משחק משחקים חנות חנויות בוט צ׳אט צ\'אט צאט צ׳טבוט פלטפורמה כלי תוכנה בינה מלאכותית ai app apps application website site web page landing system crm dashboard game games store shop bot chatbot platform tool');
  var GENERIC = toSet('סטודיו עסק עסקים חברה משרד סוכן סוכנים לקוחות לקוח לידים אנשים משתמשים כיתה ילדים צוות עובדים שירות שירותים מוצרים דברים מידע בית מקום אזור עיר וואטסאפ סדנאות business company clients customers users class kids team service services products whatsapp');
  var KEEP = toSet('לידים לקוחות לקוח לימוד לימודים ליגה לגו לוגו לחם לימון לייזר לוח לבנה בגדים ביטוח בלוג בוט בירה בריכה ביסקוויט בייגל בורגר בננה בובות בלונים בית ביגוד ברביקיו בייבי בקרה בישול בורסה בשמים ברכות וילה וידאו ויטמינים');
  var TR = { 'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'כ': 'k', 'ך': 'ch', 'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'f', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't' };

  /* ======================================================================
     HELPERS
     ====================================================================== */
  function later(fn, ms) {
    var my = run;
    var id = setTimeout(function () { if (my === run) fn(); }, ms);
    timers.push(id);
    return id;
  }
  function frame(fn) { var my = run; var id = requestAnimationFrame(function (t) { if (my === run) fn(t); }); rafs.push(id); return id; }
  function clearAll() {
    timers.forEach(clearTimeout); timers = [];
    rafs.forEach(cancelAnimationFrame); rafs = [];
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(id, cls) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', cls || 'i');
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  }
  function chars(s) { return Array.from ? Array.from(s) : s.split(''); }
  function clean(raw) {
    var s = String(raw || '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
    var c = chars(s);
    return c.length > MAX ? c.slice(0, MAX).join('').trim() : s;
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {   // mulberry32
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function onColor(hex) { return lum(hex) > 0.4 ? '#0A0A0B' : '#FFFFFF'; }
  function navH() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64; }
  function announce(msg) {
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 40);
  }
  function setStatus(s) {
    pg.setAttribute('data-state', s);
    if (statusT) statusT.textContent = s;
  }
  var stTimer = 0;
  function refreshST() {
    clearTimeout(stTimer);
    stTimer = setTimeout(function () { try { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); } catch (e) { /* ignore */ } }, 120);
  }

  /* ======================================================================
     CLASSIFY + NAME + PALETTE
     ====================================================================== */
  function classify(idea) {
    var scores = {};
    RULES.forEach(function (r) { if (r[2].test(idea)) scores[r[0]] = Math.max(scores[r[0]] || 0, r[1]); });
    var best = 'app', w = 0;
    PRIORITY.forEach(function (t) { if ((scores[t] || 0) > w) { best = t; w = scores[t]; } });
    return best;
  }

  function stripPrefix(w) {
    if (KEEP[w] || w.length < 4) return w;
    var c = w.charAt(0);
    if (c === 'ל' || c === 'ב') return w.slice(1);
    if (c === 'ו' && w.charAt(1) !== 'ו') return w.slice(1);
    return w;
  }
  function makeName(idea, type) {
    var words = idea.split(/[\s,.;:!?()[\]{}\/\\|+&=*<>~`@#$%^_\u2013\u2014-]+/);
    var best = null, bestTier = 9;
    for (var i = 0; i < words.length; i++) {
      var raw = words[i].replace(/^["'״׳“”‘’]+|["'״׳“”‘’]+$/g, '');
      if (!raw || /^\d+$/.test(raw)) continue;
      var latin = /^[a-z0-9'’]+$/i.test(raw);
      var w = latin ? raw.toLowerCase() : raw;
      var b = latin ? w : stripPrefix(w);
      if (STOP[w] || STOP[b] || TYPEW[w] || TYPEW[b] || b.length < 2) continue;
      var tier = GENERIC[b] ? 2 : (!latin && b.charAt(0) === 'ש' ? 3 : 1);
      if (tier < bestTier) { best = latin ? b.charAt(0).toUpperCase() + b.slice(1) : b; bestTier = tier; }
    }
    if (!best || bestTier > 1) return TYPES[type].fallback;   // only generic words ("לקוחות") → a brand-ish fallback
    var c = chars(best);
    return c.length > 16 ? c.slice(0, 16).join('') : best;
  }
  function translit(w) {
    if (/^[a-z0-9]+$/i.test(w)) return w.toLowerCase();
    var ch = chars(w.replace(/[״׳"'’]/g, '')), s = '';
    for (var i = 0; i < ch.length; i++) {
      var c = ch[i], next = ch[i + 1], last = i === ch.length - 1;
      if (c === 'ו') { if (next === 'ו') { s += 'v'; i++; } else s += i === 0 ? 'v' : 'o'; continue; }
      if (c === 'י') { if (next === 'י') { s += 'y'; i++; } else s += i === 0 ? 'y' : 'i'; continue; }
      if ((c === 'ה' || c === 'א') && last) { s += 'a'; continue; }
      if (TR[c]) s += TR[c];
      else if (/[a-z0-9]/i.test(c)) s += c.toLowerCase();
    }
    if (s && !/[aeiou]/.test(s)) s = s.split('').join('a');   // "ndln" → "nadalan"
    return s.slice(0, 18);
  }
  function makeConcept(idea) {
    var type = classify(idea);
    var T = TYPES[type];
    var seed = hash(idea);
    var pal = PALETTES[type][seed % PALETTES[type].length];
    var name = makeName(idea, type);
    var slug = translit(name) || 'magic';
    var tl = T.tld.slice(1);
    if (slug.length > tl.length + 2 && slug.slice(-tl.length) === tl) slug = slug.slice(0, -tl.length);   // vibeai.ai → vibe.ai
    var r = rng(seed);
    return {
      idea: idea, type: type, T: T, seed: seed, rand: r,
      name: name, slug: slug, slugCap: slug.charAt(0).toUpperCase() + slug.slice(1),
      pal: pal, lines: Math.round(T.lines[0] + r() * (T.lines[1] - T.lines[0]))
    };
  }

  /* ======================================================================
     CODE SAMPLES (tokens: [class, text]; class '' = plain, 'he' = isolated string)
     ====================================================================== */
  var CODE = {
    app: function (c) {
      return [
        [['kw', 'import'], ['', ' '], ['ty', 'SwiftUI']],
        [],
        [['at', '@main']],
        [['kw', 'struct'], ['', ' '], ['ty', c.slugCap + 'App'], ['pn', ': '], ['ty', 'App'], ['pn', ' {']],
        [['', '  '], ['kw', 'var'], ['', ' body'], ['pn', ': '], ['kw', 'some'], ['', ' '], ['ty', 'Scene'], ['pn', ' {']],
        [['', '    '], ['ty', 'WindowGroup'], ['pn', ' { '], ['fn', 'HomeView'], ['pn', '('], ['st he', '"' + c.name + '"'], ['pn', ') }']],
        [['', '      .'], ['fn', 'tint'], ['pn', '(.'], ['', 'magic'], ['pn', ')']],
        [['', '  '], ['pn', '}']],
        [['pn', '}']]
      ];
    },
    game: function (c) {
      return [
        [['kw', 'const'], ['', ' game '], ['pn', '= '], ['kw', 'new'], ['', ' '], ['ty', 'Trivia'], ['pn', '({']],
        [['', '  title'], ['pn', ': '], ['st he', '"' + c.name + '"'], ['pn', ',']],
        [['', '  rounds'], ['pn', ': '], ['nm', '10'], ['pn', ', '], ['', 'timer'], ['pn', ': '], ['nm', '15'], ['pn', ',']],
        [['pn', '})']],
        [['', 'game'], ['pn', '.'], ['fn', 'on'], ['pn', '('], ['st', "'answer'"], ['pn', ', (p, ok) =>']],
        [['', '  ok '], ['pn', '? '], ['', 'p.score '], ['pn', '+= '], ['nm', '100'], ['pn', ' : '], ['', 'fx'], ['pn', '.'], ['fn', 'shake'], ['pn', '()']],
        [['pn', ')']],
        [['', 'game'], ['pn', '.'], ['fn', 'start'], ['pn', '() '], ['cm', '// ✦']]
      ];
    },
    site: function (c) {
      return [
        [['tg', '<section'], ['at', ' class'], ['pn', '='], ['st', '"hero"'], ['tg', '>']],
        [['', '  '], ['tg', '<h1>'], ['he', c.name], ['tg', '</h1>']],
        [['', '  '], ['tg', '<a'], ['at', ' class'], ['pn', '='], ['st', '"cta"'], ['at', ' href'], ['pn', '='], ['st', '"#contact"'], ['tg', '>']],
        [['', '    '], ['he', c.T.cta]],
        [['', '  '], ['tg', '</a>']],
        [['tg', '</section>']],
        [['tg', '<script>'], ['fn', 'reveal'], ['pn', '('], ['st', "'.hero'"], ['pn', ')'], ['tg', '</script>']]
      ];
    },
    system: function (c) {
      return [
        [['cm he', '// ✦ ' + c.name + ' · ' + c.T.label]],
        [['kw', 'const'], ['', ' leads '], ['pn', '= '], ['kw', 'await'], ['', ' db']],
        [['', '  .'], ['fn', 'from'], ['pn', '('], ['st', "'leads'"], ['pn', ')']],
        [['', '  .'], ['fn', 'select'], ['pn', '('], ['st', "'name, phone, status'"], ['pn', ')']],
        [['', '  .'], ['fn', 'order'], ['pn', '('], ['st', "'created_at'"], ['pn', ')']],
        [],
        [['fn', 'cron'], ['pn', '('], ['st', "'0 9 * * *'"], ['pn', ', () =>']],
        [['', '  '], ['fn', 'remind'], ['pn', '('], ['', 'leads'], ['pn', '.'], ['fn', 'filter'], ['pn', '('], ['', 'isHot'], ['pn', ')))']]
      ];
    },
    store: function (c) {
      return [
        [['kw', 'const'], ['', ' shop '], ['pn', '= '], ['fn', 'createShop'], ['pn', '({']],
        [['', '  name'], ['pn', ': '], ['st he', '"' + c.name + '"'], ['pn', ',']],
        [['', '  currency'], ['pn', ': '], ['st', "'ILS'"], ['pn', ',']],
        [['pn', '})']],
        [['', 'shop.cart'], ['pn', '.'], ['fn', 'add'], ['pn', '('], ['', 'item'], ['pn', ', { '], ['', 'qty'], ['pn', ': '], ['nm', '1'], ['pn', ' })']],
        [['kw', 'await'], ['', ' '], ['fn', 'checkout'], ['pn', '({']],
        [['', '  pay'], ['pn', ': ['], ['st', "'bit'"], ['pn', ', '], ['st', "'apple-pay'"], ['pn', '],']],
        [['pn', '})']]
      ];
    },
    ai: function (c) {
      return [
        [['kw', 'const'], ['', ' agent '], ['pn', '= '], ['kw', 'new'], ['', ' '], ['ty', 'Assistant'], ['pn', '({']],
        [['', '  name'], ['pn', ': '], ['st he', '"' + c.name + '"'], ['pn', ',']],
        [['', '  model'], ['pn', ': '], ['st', "'claude'"], ['pn', ',']],
        [['', '  knowledge'], ['pn', ': ['], ['st', "'faq.pdf'"], ['pn', ', '], ['st', "'prices'"], ['pn', '],']],
        [['pn', '})']],
        [['', 'agent'], ['pn', '.'], ['fn', 'on'], ['pn', '('], ['st', "'message'"], ['pn', ', '], ['kw', 'async'], ['pn', ' (m) =>']],
        [['', '  '], ['fn', 'reply'], ['pn', '('], ['kw', 'await'], ['', ' agent'], ['pn', '.'], ['fn', 'answer'], ['pn', '('], ['', 'm'], ['pn', ')))']]
      ];
    }
  };

  /* ======================================================================
     MINI UIs (constant markup only; user text is filled in with textContent)
     ====================================================================== */
  var STATUS = '<div class="m-status"><b>9:41</b><span class="m-sig"><i></i><i></i><i></i></span></div>';
  var UI = {
    app: '<div class="m m--app">' + STATUS +
      '<div class="m-head"><span class="m-logo" data-initial></span><b class="m-name" data-name></b><span class="m-bell"></span></div>' +
      '<div class="m-hero"><i class="m-l m-w70"></i><i class="m-l m-w45"></i><span class="m-btn" data-cta></span></div>' +
      '<i class="m-l m-sec"></i>' +
      '<div class="m-grid"><span></span><span></span><span></span><span></span></div>' +
      '<div class="m-list"><div><span class="m-av"></span><i class="m-l"></i></div><div><span class="m-av"></span><i class="m-l m-w60"></i></div></div>' +
      '<div class="m-tab"><i></i><i></i><i></i><i></i></div></div>',
    game: '<div class="m m--game">' + STATUS +
      '<div class="m-gtop"><span class="m-score">★ 1,250</span><span class="m-hearts"><i></i><i></i><i></i></span></div>' +
      '<div class="m-prog"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="m-q"><b class="m-name" data-name></b><span class="m-qmark">?</span><i class="m-l"></i><i class="m-l"></i></div>' +
      '<div class="m-ans"><span></span><span class="is-ok"></span><span></span><span></span></div>' +
      '<div class="m-board"><div><b>1</b><span class="m-av"></span><i class="m-l"></i><em></em></div><div><b>2</b><span class="m-av"></span><i class="m-l m-w60"></i><em></em></div><div><b>3</b><span class="m-av"></span><i class="m-l m-w45"></i><em></em></div></div>' +
      '<span class="m-btn" data-cta></span></div>',
    site: '<div class="m m--site">' +
      '<div class="m-nav"><span class="m-logo" data-initial></span><b class="m-name" data-name></b><span class="m-links"><i></i><i></i><i></i></span><span class="m-btn" data-cta></span></div>' +
      '<div class="m-hero2"><div class="m-copy"><b class="m-title"><span class="m-title-hl" data-name></span></b><i class="m-l m-w90"></i><i class="m-l m-w60"></i>' +
      '<div class="m-btns"><span class="m-btn" data-cta></span><span class="m-btn m-btn--ghost"></span></div></div>' +
      '<div class="m-art"><span class="m-orb"></span><span class="m-orb m-orb--2"></span></div></div>' +
      '<div class="m-cards"><span><i class="m-l m-w90"></i><i class="m-l m-w60"></i></span><span><i class="m-l m-w90"></i><i class="m-l m-w60"></i></span><span><i class="m-l m-w90"></i><i class="m-l m-w60"></i></span></div></div>',
    system: '<div class="m m--sys"><div class="m-side"><b class="m-name" data-name></b><i class="is-on"></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="m-main"><div class="m-top"><i class="m-l"></i><span class="m-search"></span><span class="m-av"></span></div>' +
      '<div class="m-kpis"><span><b></b><i></i></span><span><b></b><i></i></span><span><b></b><i></i></span></div>' +
      '<div class="m-chart" data-bars></div>' +
      '<div class="m-table"><div><span class="m-av"></span><i class="m-l"></i><em class="m-pill"></em></div><div><span class="m-av"></span><i class="m-l"></i><em class="m-pill"></em></div><div><span class="m-av"></span><i class="m-l"></i><em class="m-pill"></em></div></div>' +
      '</div></div>',
    store: '<div class="m m--store">' +
      '<div class="m-nav"><span class="m-logo" data-initial></span><b class="m-name" data-name></b><span class="m-search"></span><span class="m-cart"><i></i></span></div>' +
      '<div class="m-banner"><div><i class="m-l m-w70"></i><i class="m-l m-w45"></i></div><span class="m-btn" data-cta></span></div>' +
      '<div class="m-prods"><div><span class="m-img"></span><i class="m-l"></i><em class="m-price"></em></div><div><span class="m-img"></span><i class="m-l"></i><em class="m-price"></em></div><div><span class="m-img"></span><i class="m-l"></i><em class="m-price"></em></div><div><span class="m-img"></span><i class="m-l"></i><em class="m-price"></em></div></div></div>',
    ai: '<div class="m m--ai"><div class="m-side"><b class="m-name" data-name></b><i class="is-on"></i><i></i><i></i><i></i></div>' +
      '<div class="m-chat"><div class="m-chat-head"><span class="m-logo" data-initial></span><b data-name></b><span class="m-online"></span></div>' +
      '<div class="m-msgs"><div class="m-msg m-msg--bot"><i></i><i></i></div><div class="m-msg m-msg--me"><i></i></div><div class="m-msg m-msg--bot"><span class="m-dots"><i></i><i></i><i></i></span></div></div>' +
      '<div class="m-sugg"><span></span><span></span><span></span></div>' +
      '<div class="m-input"><i class="m-l"></i><span class="m-send"></span></div></div></div>'
  };
  var PHONE_FRAME =
    '<svg class="pg-phone__frame" viewBox="0 0 433 882" aria-hidden="true">' +
    '<path class="f" d="M2 73C2 32.6832 34.6832 0 75 0H357C397.317 0 430 32.6832 430 73V809C430 849.317 397.317 882 357 882H75C34.6832 882 2 849.317 2 809V73Z"/>' +
    '<path class="f" d="M0 171C0 170.448 0.447715 170 1 170H3V204H1C0.447715 204 0 203.552 0 203V171Z"/>' +
    '<path class="f" d="M1 234C1 233.448 1.44772 233 2 233H3.5V300H2C1.44772 300 1 299.552 1 299V234Z"/>' +
    '<path class="f" d="M1 319C1 318.448 1.44772 318 2 318H3.5V385H2C1.44772 385 1 384.552 1 384V319Z"/>' +
    '<path class="f" d="M430 279H432C432.552 279 433 279.448 433 280V384C433 384.552 432.552 385 432 385H430V279Z"/>' +
    '<path class="b" d="M6 74C6 35.3401 37.3401 4 76 4H356C394.66 4 426 35.3401 426 74V808C426 846.66 394.66 878 356 878H76C37.3401 878 6 846.66 6 808V74Z"/>' +
    '</svg>';
  var PHONE_ISLAND =
    '<svg class="pg-phone__island" viewBox="0 0 433 882" aria-hidden="true"><path d="M154 48.5C154 38.2827 162.283 30 172.5 30H259.5C269.717 30 278 38.2827 278 48.5C278 58.7173 269.717 67 259.5 67H172.5C162.283 67 154 58.7173 154 48.5Z"/></svg>';
  var LOCK = '<svg viewBox="0 0 9 12" aria-hidden="true"><path d="M1.3 12.6h6.2c.8 0 1.3-.4 1.3-1.4V6.5c0-.8-.4-1.3-1-1.3V3.6C7.7 1.2 6.1 0 4.4 0S1 1.2 1 3.6v1.6C.4 5.3 0 5.7 0 6.5v4.7c0 1 .4 1.4 1.3 1.4zm1-9.1C2.3 2 3.2 1.2 4.4 1.2s2.1.8 2.1 2.3v1.7H2.3V3.5z"/></svg>';
  var ORBIT = '<svg class="pg-res__orbit" viewBox="0 0 400 130" aria-hidden="true"><ellipse cx="200" cy="65" rx="196" ry="56" fill="none" stroke="url(#brand-grad)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';

  function buildDevice(c) {
    var p = c.pal.c;
    var wrap = el('div', 'pg-res__device');
    wrap.setAttribute('data-m', '');
    wrap.setAttribute('aria-hidden', 'true');
    var vars = { '--m-p': p[0], '--m-s': p[1], '--m-a': p[2], '--m-bg': p[3], '--m-ink': lum(p[3]) > 0.4 ? '#14101C' : '#F5F1FA', '--m-on-p': onColor(p[0]), '--m-on-a': onColor(p[2]) };
    Object.keys(vars).forEach(function (k) { wrap.style.setProperty(k, vars[k]); });

    var dev;
    if (c.T.device === 'phone') {
      dev = el('div', 'pg-phone');
      dev.innerHTML = PHONE_FRAME + '<div class="pg-phone__screen">' + UI[c.type] + '</div>' + PHONE_ISLAND;
    } else {
      dev = el('div', 'pg-browser');
      dev.innerHTML = '<div class="pg-browser__bar"><span class="pg-browser__dots"><i></i><i></i><i></i></span><span class="pg-browser__url">' + LOCK + '<span data-url></span></span></div>' +
        '<div class="pg-browser__view">' + UI[c.type] + '</div>';
      dev.querySelector('[data-url]').textContent = c.slug + c.T.tld;
    }
    dev.querySelectorAll('[data-name]').forEach(function (n) { n.textContent = c.name; });
    dev.querySelectorAll('[data-initial]').forEach(function (n) { n.textContent = chars(c.name)[0] || '✦'; });
    dev.querySelectorAll('[data-cta]').forEach(function (n) { n.textContent = c.T.cta; });
    var bars = dev.querySelector('[data-bars]');
    if (bars) {
      var peak = 0, hs = [];
      for (var i = 0; i < 9; i++) { hs.push(28 + Math.round(c.rand() * 64)); if (hs[i] > hs[peak]) peak = i; }
      hs.forEach(function (h, j) { var b = el('i', j === peak ? 'is-peak' : ''); b.style.setProperty('--h', h + '%'); bars.appendChild(b); });
    }
    wrap.insertAdjacentHTML('beforeend', ORBIT);
    wrap.appendChild(dev);
    var s1 = icon('sparkle-shape', 'sparkle pg-res__spark pg-res__spark--a'); s1.setAttribute('viewBox', '0 0 100 100');
    var s2 = icon('sparkle-shape', 'sparkle pg-res__spark pg-res__spark--b'); s2.setAttribute('viewBox', '0 0 100 100');
    wrap.appendChild(s1); wrap.appendChild(s2);
    return wrap;
  }

  /* ======================================================================
     PLACEHOLDER TYPEWRITER (Magic UI Typing Animation, looped type/erase)
     ====================================================================== */
  var ph = { i: 0, n: chars(EXAMPLES[0]).length, dir: -1, timer: 0, shown: false };
  function phSet(n) { if (phEl) phEl.textContent = chars(EXAMPLES[ph.i]).slice(0, n).join(''); }
  function phStep() {
    ph.timer = 0;
    if (!phRunning()) return;
    var len = chars(EXAMPLES[ph.i]).length, wait;
    if (ph.dir > 0) {
      ph.n = Math.min(len, ph.n + 1);
      if (ph.n >= len) { ph.dir = -1; wait = 1900; } else wait = 42 + Math.random() * 46;
    } else {
      ph.n = Math.max(0, ph.n - 1);
      if (ph.n <= 0) { ph.dir = 1; ph.i = (ph.i + 1) % EXAMPLES.length; wait = 420; } else wait = 18;
    }
    phSet(ph.n);
    ph.timer = setTimeout(phStep, wait);
  }
  function phShow() { return !REDUCED && !!phEl && state === 'idle' && !input.value && document.activeElement !== input; }
  function phRunning() { return phShow() && inView && !document.hidden; }
  function phSync() {
    var show = phShow();
    if (show !== ph.shown) { ph.shown = show; pg.classList.toggle('pg--ph', show); }
    if (phRunning()) { if (!ph.timer) ph.timer = setTimeout(phStep, ph.dir < 0 && ph.n > 0 ? 1600 : 300); }
    else if (ph.timer) { clearTimeout(ph.timer); ph.timer = 0; }
  }

  /* ======================================================================
     COMPOSER
     ====================================================================== */
  function autosize() {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
    // a long idea scrolls inside the field (Lenis steps aside) only while it actually overflows
    input.toggleAttribute('data-lenis-prevent', input.scrollHeight > input.clientHeight + 2);
  }
  function updateCount() {
    var n = chars(input.value).length;
    if (count) { count.textContent = n + '/' + MAX; count.classList.toggle('is-near', n > MAX - 40); }
  }
  var hintTimer = 0;
  function nudge() {
    form.classList.remove('is-shake');
    void form.offsetWidth;
    if (!REDUCED) form.classList.add('is-shake');
    if (hint) {
      hint.textContent = 'רגע, חסר רעיון. אפילו כמה מילים מספיקות ✦';
      hint.classList.add('is-warn');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { hint.innerHTML = HINT_DEFAULT; hint.classList.remove('is-warn'); }, 3600);
    }
    announce('כתבו רעיון קצר ואז לחצו על צרו קסם');
    input.focus({ preventScroll: true });
  }

  /* ======================================================================
     LAYOUT MORPH (smooth height between idle / run / result)
     ====================================================================== */
  // Browser scroll anchoring would "compensate" for the panel growing (and fight Lenis), so it is
  // suspended on <html> only for the length of a morph + the follow-up scroll, then restored.
  var finalH = 0, anchorTimer = 0, rootEl = document.documentElement;
  function holdAnchor(ms) {
    rootEl.style.overflowAnchor = 'none';
    clearTimeout(anchorTimer);
    anchorTimer = setTimeout(function () { rootEl.style.overflowAnchor = ''; }, ms);
  }
  function morph(mutate) {
    holdAnchor(1900);
    var h0 = body.offsetHeight;
    mutate();
    var h1 = body.offsetHeight;
    finalH = pg.offsetHeight;
    if (!REDUCED && body.animate && Math.abs(h1 - h0) > 2) {
      body.classList.add('is-morphing');
      var a = body.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 680, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      a.onfinish = a.oncancel = function () { body.classList.remove('is-morphing'); refreshST(); };
    } else refreshST();
  }
  // Keep the panel (or the start of the result) in view after it changes size. Scrolls to an explicit Y:
  // Lenis already subtracts the root scroll-padding for element targets, so passing the element through
  // VM.scrollTo would count the nav twice. Returns true when it scrolled.
  function keepInView(target) {
    var top = pg.getBoundingClientRect().top, nh = navH(), vh = window.innerHeight, gap = nh + 18;
    var fits = finalH <= vh - gap - 12;
    if (fits && top >= nh && top + finalH <= vh) return false;
    var t = fits ? pg : (target || pg);
    var tt = t.getBoundingClientRect().top;
    if (!fits && tt >= nh && tt < vh * 0.4) return false;
    var y = Math.max(0, Math.round(tt + window.scrollY - gap));
    holdAnchor(1900);
    if (VM.lenis && typeof VM.lenis.scrollTo === 'function') VM.lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
    return true;
  }

  /* ======================================================================
     RUN (the fake build)
     ====================================================================== */
  var STEP_MS = [680, 600, 760, 1100, 640, 300];   // ≈ 4.7s from submit to the concept

  function buildRun(c) {
    var v = {};
    v.root = el('div', 'pg-run');
    var prompt = el('p', 'pg-run__prompt', c.idea);
    prompt.setAttribute('dir', 'auto');
    v.root.appendChild(prompt);
    var grid = el('div', 'pg-run__grid');
    var ol = el('ol', 'pg-steps');
    ol.setAttribute('aria-label', 'שלבי הבנייה');
    v.focus = ol;   // focus holder during the build (short name; the code pane is aria-hidden)
    ol.setAttribute('tabindex', '-1');
    var labels = ['מנתח את הרעיון', 'בוחר פלטת צבעים', 'מעצב את המסכים', 'כותב קוד', c.T.test, null];
    v.steps = labels.map(function (t, i) {
      var li = el('li', 'pg-step');
      li.style.setProperty('--i', i);
      var ic = el('span', 'pg-step__ic');
      ic.appendChild(icon('i-check'));
      var tt = el('span', 'pg-step__t');
      if (t) tt.textContent = t;
      else { tt.appendChild(el('b', '', '✦')); tt.appendChild(document.createTextNode(' מוכן')); }
      li.appendChild(ic); li.appendChild(tt); li.appendChild(el('span', 'pg-step__d'));
      ol.appendChild(li);
      return li;
    });
    var code = el('div', 'pg-code');
    code.setAttribute('aria-hidden', 'true');
    var tab = el('div', 'pg-code__tab');
    tab.appendChild(el('b', '', c.T.file));
    tab.appendChild(el('span', '', 'vibemagic agent'));
    v.pre = el('pre', 'pg-code__pre');
    v.caret = el('span', 'pg-code__caret');
    var first = el('span', 'pg-code__ln');
    first.appendChild(v.caret);
    v.pre.appendChild(first);       // a blinking caret while the agent "thinks"
    v.firstLine = first;
    code.appendChild(tab); code.appendChild(v.pre);
    grid.appendChild(ol); grid.appendChild(code);
    v.root.appendChild(grid);
    var bar = el('div', 'pg-run__bar'); bar.setAttribute('aria-hidden', 'true');
    v.bar = el('i');
    bar.appendChild(v.bar);
    v.root.appendChild(bar);
    return v;
  }

  function detail(step, i, c, elapsed) {
    var d = step.querySelector('.pg-step__d');
    d.textContent = '';
    if (i === 0) d.appendChild(el('span', 'pg-tag', c.T.label));
    else if (i === 1) {
      var sw = el('span', 'pg-step__sw');
      c.pal.c.forEach(function (hex, k) { var s = el('i'); s.style.background = hex; s.style.setProperty('--i', k); sw.appendChild(s); });
      d.appendChild(sw);
    } else if (i === 2) d.textContent = c.T.screens;
    else if (i === 3) d.textContent = '+' + c.lines + ' שורות';
    else if (i === 4) { d.textContent = c.T.testD; d.setAttribute('dir', 'ltr'); }
    else { d.textContent = (elapsed / 1000).toFixed(1) + 's'; d.setAttribute('dir', 'ltr'); }
  }

  // types the code sample into the editor, char-by-char, paced by time (rAF)
  function typeCode(v, c, dur) {
    var src = CODE[c.type](c);
    var lines = src.map(function (toks) {
      var ln = el('span', 'pg-code__ln');
      return { el: ln, toks: toks.map(function (t) { var cls = t[0] ? t[0].split(' ').map(function (k) { return 't-' + k; }).join(' ') : ''; return { el: el('span', cls), text: t[1] }; }) };
    });
    var total = 0;
    lines.forEach(function (l) { l.toks.forEach(function (t) { total += t.text.length; }); total += 1; });
    var li = 0, ti = 0, ci = 0, typed = 0, t0 = 0;
    if (v.firstLine && v.firstLine.parentNode) v.pre.removeChild(v.firstLine);
    function attach(l) { v.pre.appendChild(l.el); l.el.appendChild(v.caret); v.pre.scrollTop = v.pre.scrollHeight; }
    function advance(k) {
      while (k > 0 && li < lines.length) {
        var l = lines[li];
        if (!l.el.parentNode) attach(l);
        if (ti >= l.toks.length) { li++; ti = 0; ci = 0; k--; continue; }
        var tok = l.toks[ti];
        if (!tok.el.parentNode) { l.el.insertBefore(tok.el, v.caret); }
        var n = Math.min(k, tok.text.length - ci);
        ci += n; k -= n;
        tok.el.textContent = tok.text.slice(0, ci);
        if (ci >= tok.text.length) { ti++; ci = 0; }
      }
      if (li >= lines.length) { var last = lines[lines.length - 1]; last.el.appendChild(v.caret); }
    }
    v.finishCode = function () { advance(Infinity); };
    function tick(now) {
      if (!t0) t0 = now;
      var want = Math.min(total, Math.round((now - t0) / dur * total));
      if (want > typed) { advance(want - typed); typed = want; }
      if (typed < total) frame(tick);
    }
    frame(tick);
  }

  function countUp(node, to, dur) {
    var t0 = 0;
    function tick(now) {
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      node.textContent = '+' + Math.round(to * (1 - Math.pow(1 - p, 3))) + ' שורות';
      if (p < 1) frame(tick);
    }
    frame(tick);
  }

  function start(raw) {
    if (state === 'building') return;
    var idea = clean(raw);
    if (!idea) { nudge(); return; }
    run++; clearAll();
    pg.classList.remove('is-typing');
    chips.forEach(function (ch) { ch.classList.remove('is-picked'); });
    if (hint && hint.classList.contains('is-warn')) { clearTimeout(hintTimer); hint.innerHTML = HINT_DEFAULT; hint.classList.remove('is-warn'); }
    var c = makeConcept(idea);
    // the composer (and the chip or button that started this) is hidden while busy: decide now
    // whether focus travels with the run and then lands on the result, instead of dropping to <body>
    focusRun = pg.contains(document.activeElement);
    phSync();

    if (REDUCED) { showResult(c); return; }

    state = 'building';
    setStatus('building');
    var v = buildRun(c);
    morph(function () { pg.classList.add('is-busy'); stage.textContent = ''; stage.appendChild(v.root); });
    // also closes the phone keyboard, so the build is in view
    if (focusRun) { try { v.focus.focus({ preventScroll: true }); } catch (e) { /* old browsers */ } }
    phSync();
    announce('בונה ' + c.T.label + ' מהרעיון שלכם…');
    keepInView(pg);

    var t = 260, t0 = performance.now();
    var total = STEP_MS.reduce(function (a, b) { return a + b; }, 0);
    v.bar.style.transitionDuration = (total + 40) + 'ms';
    later(function () { v.root.classList.add('is-running'); }, t);
    STEP_MS.forEach(function (ms, i) {
      later(function () {
        v.steps[i].classList.add('is-active');
        if (i === 1) typeCode(v, c, STEP_MS[1] + STEP_MS[2] + STEP_MS[3] - 140);
        if (i === 3) { var d = v.steps[3].querySelector('.pg-step__d'); countUp(d, c.lines, ms - 60); }
      }, t);
      t += ms;
      later(function () {
        if (i === 3 && v.finishCode) v.finishCode();
        v.steps[i].classList.remove('is-active');
        v.steps[i].classList.add('is-done');
        detail(v.steps[i], i, c, performance.now() - t0);
      }, t);
    });
    later(function () { showResult(c); }, t + 420);
  }

  /* ======================================================================
     RESULT
     ====================================================================== */
  function waMsg(c) {
    return 'היי ליאור, הגעתי מהאתר של VibeMagic. יש לי רעיון: ' + c.idea + ' (' + c.T.label + '). אפשר לדבר?';
  }
  function waHref(c) {
    var msg = waMsg(c);
    return typeof VM.waLink === 'function' ? VM.waLink(msg) : 'https://wa.me/972523321674?text=' + encodeURIComponent(msg);
  }

  function buildResult(c) {
    var r = {};
    r.root = el('div', 'pg-res');
    var info = el('div', 'pg-res__info');
    var i = 0;
    function m(node) { node.setAttribute('data-m', ''); node.style.setProperty('--i', i++); info.appendChild(node); return node; }

    var meta = el('div', 'pg-res__meta');
    meta.appendChild(el('span', 'label label--purple', '( הקונספט שלכם )'));
    meta.appendChild(el('span', 'chip', c.T.label));
    m(meta);

    // name: Text Generate Effect (per-word blur-in), sparkle after it
    r.title = el('h3', 'pg-res__name');
    r.title.setAttribute('tabindex', '-1');
    var gt = el('span', 'pg-res__name-t');   // gradient lives on each word (.w) so it survives the blur-in
    c.name.split(/(\s+)/).forEach(function (w, k) {
      if (!w) return;
      if (/^\s+$/.test(w)) { gt.appendChild(document.createTextNode(w)); return; }
      var s = el('span', 'w', w); s.style.setProperty('--wi', k); gt.appendChild(s);
    });
    r.title.appendChild(gt);
    var sp = icon('sparkle-shape', 'sparkle'); sp.setAttribute('viewBox', '0 0 100 100');
    r.title.appendChild(sp);
    info.appendChild(r.title);

    var ideaP = el('p', 'pg-res__idea', c.idea);
    ideaP.setAttribute('dir', 'auto');
    m(ideaP);

    var pal = el('div', 'pg-res__pal');
    var k = el('span', 'pg-res__k', 'פלטת צבעים · ');
    k.appendChild(el('b', '', c.pal.n));
    pal.appendChild(k);
    var ul = el('ul', 'pg-res__sw'); ul.setAttribute('role', 'list');
    c.pal.c.forEach(function (hex) {
      var li = el('li');
      var sw = el('i'); sw.style.background = hex; sw.style.setProperty('--sw', hex);
      li.appendChild(sw); li.appendChild(el('span', '', hex));
      ul.appendChild(li);
    });
    pal.appendChild(ul);
    m(pal);

    var feats = el('ul', 'neon-list pg-res__feats'); feats.setAttribute('role', 'list');
    c.T.feats.forEach(function (f) { feats.appendChild(el('li', '', f)); });
    m(feats);

    var honest = el('p', 'pg-res__honest');
    honest.appendChild(icon('i-sparkles'));
    honest.appendChild(el('span', '', 'זו רק הדגמה. את הדבר האמיתי בונים יחד.'));
    m(honest);

    var ctas = el('div', 'pg-res__ctas');
    // .pg__wa[data-wa]: an in-content WhatsApp CTA, like the hero and footer ones (delight.js keeps
    // the floating WA button out of its way); data-wa holds the same message, so a VM.wireWa() pass
    // over the page would write the same href
    var a = el('a', 'cta-pill pg-res__wa pg__wa');
    a.setAttribute('data-wa', waMsg(c));
    a.href = waHref(c);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('data-confetti', '');
    var beam = el('span', 'beam'); beam.setAttribute('aria-hidden', 'true');
    a.appendChild(beam);
    a.appendChild(el('span', 'cta-pill__l1', 'אהבתם את הכיוון?'));
    a.appendChild(el('span', 'cta-pill__l2', 'שלחו לליאור את הרעיון'));
    var wa = el('span', 'cta-pill__wa'); wa.appendChild(icon('i-whatsapp', 'i i--fill'));
    a.appendChild(wa);
    r.cta = a;
    var again = el('button', 'btn btn--ghost pg-res__again');
    again.type = 'button';
    again.appendChild(icon('i-pencil'));
    again.appendChild(el('span', '', 'רעיון חדש'));
    again.addEventListener('click', reset);
    ctas.appendChild(a); ctas.appendChild(again);
    m(ctas);

    r.device = buildDevice(c);
    r.root.appendChild(info);
    r.root.appendChild(r.device);
    return r;
  }

  function showResult(c) {
    state = 'result';
    setStatus('done');
    var r = buildResult(c);
    morph(function () { pg.classList.add('is-busy'); stage.textContent = ''; stage.appendChild(r.root); });
    announce('הקונספט מוכן: ' + c.name + ', ' + c.T.label + '. אפשר לשלוח לליאור את הרעיון בוואטסאפ.');
    // focus was in the playground at submit (recorded then: the run view it moved to is gone now)
    var ae = document.activeElement;
    if (focusRun || !ae || ae === document.body) { try { r.title.focus({ preventScroll: true }); } catch (e) { /* old browsers */ } }
    var scrolled = keepInView(r.root);
    if (REDUCED) r.root.classList.add('is-in');
    else {
      frame(function () { frame(function () { r.root.classList.add('is-in'); }); });
      later(function () { r.root.classList.add('is-in'); }, 500);   // failsafe if rAF is throttled
      // burst once the device has landed (after the follow-up scroll, if there was one)
      later(function () { burstAt(r.device.querySelector('.pg-phone, .pg-browser') || r.device); }, scrolled ? 1150 : 420);
    }
  }

  // sparkle burst: delight.js VM.burst if present, else the Magic UI "Stars" confetti preset
  function burstAt(node) {
    if (REDUCED || !node) return;
    var b = node.getBoundingClientRect();
    if (b.bottom < 0 || b.top > window.innerHeight) return;
    var x = b.left + b.width / 2, y = b.top + Math.min(b.height * 0.45, window.innerHeight * 0.6);
    try {
      if (typeof VM.burst === 'function') { VM.burst(x, y); return; }
      if (typeof window.confetti !== 'function') return;
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      var colors = light ? ['#E8B100', '#F29A1F', '#EE5FA8', '#C82AE8', '#8A00C2'] : ['#FFE000', '#FFF6B0', '#FCEC68', '#F7ACE2', '#FC38FE', '#C805FE'];
      var base = { spread: 360, ticks: 60, gravity: 0, decay: 0.94, startVelocity: 28, colors: colors, origin: { x: x / window.innerWidth, y: y / window.innerHeight }, disableForReducedMotion: true };
      var shoot = function () {
        window.confetti(Object.assign({}, base, { particleCount: 36, scalar: 1.2, shapes: ['star'] }));
        window.confetti(Object.assign({}, base, { particleCount: 10, scalar: 0.75, shapes: ['circle'] }));
      };
      shoot(); later(shoot, 110); later(shoot, 220);
    } catch (e) { /* decoration only */ }
  }

  function reset() {
    run++; clearAll();
    state = 'idle';
    setStatus('ready');
    morph(function () {
      stage.textContent = '';
      pg.classList.remove('is-busy');
      input.value = '';
      autosize(); updateCount();
    });
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    announce('אפשר לכתוב רעיון חדש');
    keepInView(pg);
    phSync();
  }

  /* ======================================================================
     CHIPS → typewriter fill, then auto-submit
     ====================================================================== */
  function pickChip(chip) {
    if (state !== 'idle') return;
    var text = chip.textContent.replace(/\s+/g, ' ').trim();
    chips.forEach(function (c) { c.classList.toggle('is-picked', c === chip); });
    if (REDUCED) { input.value = text; updateCount(); start(text); return; }
    run++; clearAll();
    state = 'typing';
    pg.classList.add('is-typing');
    phSync();
    input.value = '';
    var cs = chars(text), n = 0;
    var step = Math.max(16, Math.min(40, 950 / cs.length));
    (function tick() {
      n++;
      input.value = cs.slice(0, n).join('');
      autosize(); updateCount();
      if (n < cs.length) later(tick, step * (0.6 + Math.random() * 0.8));
      else later(function () {
        pg.classList.remove('is-typing');
        chips.forEach(function (c) { c.classList.remove('is-picked'); });
        state = 'idle';
        start(input.value);
      }, 340);
    })();
  }

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    if (REDUCED) pg.classList.add('pg--rm');
    setStatus('ready');
    if (phEl) phSet(ph.n);

    form.addEventListener('submit', function (e) { e.preventDefault(); start(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        start(input.value);
      }
    });
    input.addEventListener('input', function () {
      if (state === 'typing') return;
      autosize(); updateCount(); phSync();
      if (hint && hint.classList.contains('is-warn') && input.value.trim()) { clearTimeout(hintTimer); hint.innerHTML = HINT_DEFAULT; hint.classList.remove('is-warn'); }
    });
    input.addEventListener('focus', phSync);
    input.addEventListener('blur', phSync);
    form.addEventListener('animationend', function () { form.classList.remove('is-shake'); });
    chips.forEach(function (chip) { chip.addEventListener('click', function () { pickChip(chip); }); });
    // phone chip row is a sideways scroller: a chip reached with Tab comes fully into view
    // (keyboard focus only; a tap keeps the row still while the chip types itself in).
    // inline 'start' = the row's own snap point; 'nearest' would be snapped straight back.
    var chipRow = pg.querySelector('.pg__chips');
    if (chipRow) chipRow.addEventListener('focusin', function (e) {
      var chip = e.target.closest && e.target.closest('.chip');
      if (!chip || chipRow.scrollWidth <= chipRow.clientWidth + 1) return;
      var kb = true;
      try { kb = e.target.matches(':focus-visible'); } catch (err) { /* no :focus-visible */ }
      if (kb) chip.scrollIntoView({ block: 'nearest', inline: 'start', behavior: REDUCED ? 'auto' : 'smooth', container: 'nearest' });
    });

    document.addEventListener('visibilitychange', phSync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { inView = en.isIntersecting; pg.classList.toggle('is-inview', inView); });
        phSync();
      }, { rootMargin: '80px 0px' }).observe(pg);
    } else { inView = true; pg.classList.add('is-inview'); }

    updateCount();
    phSync();
  }

  try { init(); }
  catch (err) {
    // leave the plain form working: without the submit handler it opens WhatsApp with the idea (form action)
    console.error('[playground] init failed', err);
    pg.classList.remove('pg--ph', 'is-busy');
  }
})();
