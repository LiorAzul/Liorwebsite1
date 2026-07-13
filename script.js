document.addEventListener('DOMContentLoaded', function () {
    var site = document.querySelector('.site');
    var html = document.documentElement;

    // ========== Loader עם ספירה ==========
    (function initLoader() {
        var loader = document.getElementById('loader');
        var num = document.getElementById('loadnum');
        if (!loader || !num) return;
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { loader.classList.add('off'); return; }
        var t0 = performance.now(), dur = 1300;
        function tick(now) {
            var p = Math.min((now - t0) / dur, 1);
            num.textContent = String(Math.round(p * 100)).padStart(3, '0');
            if (p < 1) requestAnimationFrame(tick);
            else setTimeout(function () { loader.classList.add('off'); }, 250);
        }
        requestAnimationFrame(tick);
    })();

    // ========== שפה (עברית / English) ==========
    var WA = 'https://wa.me/972523321674?text=';
    var WA_MSG = {
        he: 'היי ליאור, הגעתי מהאתר שלך ואשמח לשמוע פרטים על פרויקט',
        en: "Hi Lior, I found your website and I'd love to hear more about working together"
    };
    var META = {
        he: {
            title: 'ליאור אזולאי · מפתח ומעצב',
            desc: 'ליאור אזולאי, מפתח ומעצב עצמאי. אפליקציות iOS, אתרים, וידאו ותלת מימד. מהשרטוט הראשון ועד ה-App Store.'
        },
        en: {
            title: 'Lior Azulay · Developer & Designer',
            desc: 'Lior Azulay, independent developer and designer. iOS apps, websites, video and 3D. From first sketch to the App Store.'
        }
    };

    function applyLang(lang) {
        var en = lang === 'en';
        site.classList.toggle('on-en', en);
        html.setAttribute('lang', lang);
        html.setAttribute('dir', en ? 'ltr' : 'rtl');
        document.title = META[lang].title;
        var meta = document.getElementById('metaDescription');
        if (meta) meta.setAttribute('content', META[lang].desc);
        var btn = document.getElementById('langToggle');
        if (btn) btn.textContent = en ? 'עב' : 'EN';
        document.querySelectorAll('[data-wa]').forEach(function (a) {
            a.setAttribute('href', WA + encodeURIComponent(WA_MSG[lang]));
        });
        try { localStorage.setItem('lang', lang); } catch (e) { /* private mode */ }
    }

    var lang = 'he';
    try {
        var savedLang = localStorage.getItem('lang');
        if (savedLang === 'en' || savedLang === 'he') lang = savedLang;
    } catch (e) { /* private mode */ }
    applyLang(lang);

    var langBtn = document.getElementById('langToggle');
    if (langBtn) {
        langBtn.addEventListener('click', function () {
            lang = lang === 'he' ? 'en' : 'he';
            applyLang(lang);
        });
    }

    // ========== צבע accent: אקראי בכל רענון, מתחלף בכפתור ✦ ==========
    // לכל צבע: גרסה למצב כהה [צבע, R,G,B] וגרסה כהה יותר למצב בהיר
    var ACCENTS = [
        { d: ['#ff8a4c', '255,138,76'], l: ['#e06a20', '224,106,32'] },   // כתום
        { d: ['#a78bfa', '167,139,250'], l: ['#7c3aed', '124,58,237'] },  // סגול
        { d: ['#7aa2ff', '122,162,255'], l: ['#2f5fd8', '47,95,216'] },   // כחול
        { d: ['#2ee6a8', '46,230,168'], l: ['#0b9e6e', '11,158,110'] },   // ירוק
        { d: ['#ff6b6b', '255,107,107'], l: ['#d43d3d', '212,61,61'] }    // אדום
    ];
    var accentIdx = Math.floor(Math.random() * ACCENTS.length);

    function applyAccent() {
        var isLight = html.classList.contains('light');
        var pair = isLight ? ACCENTS[accentIdx].l : ACCENTS[accentIdx].d;
        html.style.setProperty('--a1', pair[0]);
        html.style.setProperty('--glow', pair[1]);
    }

    var accentBtn = document.getElementById('accentToggle');
    if (accentBtn) {
        accentBtn.addEventListener('click', function () {
            accentIdx = (accentIdx + 1) % ACCENTS.length;
            applyAccent();
        });
    }

    // ========== ערכת נושא (כהה / בהיר) ==========
    function applyTheme(theme) {
        html.classList.toggle('light', theme === 'light');
        html.classList.toggle('dark', theme !== 'light');
        var btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = theme === 'light' ? '☀' : '☾';
        applyAccent();
        if (window.GradFlowBG) window.GradFlowBG.setLight(theme === 'light');
        try { localStorage.setItem('theme', theme); } catch (e) { /* private mode */ }
    }

    var theme = 'dark';
    try {
        var savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
    } catch (e) { /* private mode */ }
    applyTheme(theme);

    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            theme = theme === 'light' ? 'dark' : 'light';
            applyTheme(theme);
        });
    }

    // ========== גלריית גרפיקה ==========
    (function initGraphicsGrid() {
        var grid = document.getElementById('graphicsStack');
        if (!grid) return;

        var images = [
            'Artboard 5.jpg',
            'המרכז ללימודי תעודה.png',
            'lior1.jpg',
            'lior3.jpg',
            'lior4.webp',
            'lior5.webp',
            'lior6.webp',
            'lior7.webp',
            'lior8.webp',
            'lior9.webp',
            'lior10.webp'
        ];

        var imageObserver = 'IntersectionObserver' in window
            ? new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var img = entry.target;
                    imageObserver.unobserve(img);

                    // דחיית הורדה ופענוח לרגע פנוי שומרת על גלילה חלקה במובייל.
                    var loadImage = function () {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    };
                    if ('requestIdleCallback' in window) {
                        window.requestIdleCallback(loadImage, { timeout: 500 });
                    } else {
                        window.setTimeout(loadImage, 0);
                    }
                });
            }, { rootMargin: '320px 0px' })
            : null;

        images.forEach(function (src, index) {
            var figure = document.createElement('figure');
            var img = document.createElement('img');
            img.alt = 'עבודת גרפיקה ' + (index + 1);
            img.loading = 'lazy';
            img.decoding = 'async';
            img.fetchPriority = 'low';
            img.dataset.src = src;
            figure.appendChild(img);
            grid.appendChild(figure);

            if (imageObserver) imageObserver.observe(img);
            else img.src = src;
        });
    })();

    // ========== אנימציות חשיפה בגלילה ==========
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add('in');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
    } else {
        document.querySelectorAll('.rv').forEach(function (el) { el.classList.add('in'); });
    }

    console.log('✨ האתר נטען בהצלחה!');
});
