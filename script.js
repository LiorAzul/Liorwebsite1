document.addEventListener('DOMContentLoaded', function () {
    // ========== מתג דארק/לייט ==========
    function initThemeToggle() {
        const html = document.documentElement;
        const btn = document.getElementById('themeToggle');
        const icon = btn ? btn.querySelector('i') : null;

        function applyTheme(theme) {
            if (theme === 'light') {
                html.classList.add('light');
                html.classList.remove('dark');
            } else {
                html.classList.add('dark');
                html.classList.remove('light');
            }
            if (icon) {
                icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
            if (btn) {
                const he = (window.i18n ? window.i18n.lang : 'he') === 'he';
                btn.setAttribute('aria-label', theme === 'light'
                    ? (he ? 'מעבר למצב כהה' : 'Switch to dark mode')
                    : (he ? 'מעבר למצב בהיר' : 'Switch to light mode'));
            }
            try { localStorage.setItem('theme', theme); } catch (e) { /* private mode */ }
        }

        let saved = 'dark';
        try {
            const s = localStorage.getItem('theme');
            if (s === 'light' || s === 'dark') saved = s;
        } catch (e) { /* private mode */ }
        applyTheme(saved);

        if (btn) {
            btn.addEventListener('click', function () {
                applyTheme(html.classList.contains('light') ? 'dark' : 'light');
            });
        }
    }

    initThemeToggle();

    // ========== Scroll-spy לניווט ה-dock ==========
    function initScrollSpy() {
        const navItems = Array.from(document.querySelectorAll('.dock-icon[data-section]'));
        if (!navItems.length || !('IntersectionObserver' in window)) return;

        // כל עוגן ב-dock "מכסה" את הסקשנים שבינו לבין העוגן הבא
        const sectionToNav = {
            top: 'top', trust: 'top', why: 'top',
            services: 'services', process: 'services',
            portfolio: 'portfolio', about: 'portfolio', contact: 'portfolio'
        };

        const observed = Object.keys(sectionToNav)
            .map(id => document.getElementById(id))
            .filter(Boolean);

        function setActive(navId) {
            navItems.forEach(item => {
                item.classList.toggle('active', item.getAttribute('data-section') === navId);
            });
        }

        const spy = new IntersectionObserver((entries) => {
            // בוחרים את הסקשן הנראה ביותר
            let best = null;
            entries.forEach(entry => {
                if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
                    best = entry;
                }
            });
            if (best) {
                const navId = sectionToNav[best.target.id];
                if (navId) setActive(navId);
            }
        }, { threshold: [0.25, 0.5], rootMargin: '-15% 0px -25% 0px' });

        observed.forEach(sec => spy.observe(sec));
    }

    initScrollSpy();

    // ========== גלריית תמונות - רשת ריבועים פשוטה ==========
    function initGraphicsGrid() {
        const grid = document.getElementById('graphicsStack');
        if (!grid) return;

        const images = [
            'Artboard 5@2x.png',
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

        grid.innerHTML = '';
        images.forEach((src, index) => {
            const figure = document.createElement('figure');
            figure.className = 'scroll-tilted-tile';

            const img = document.createElement('img');
            img.src = src;
            img.alt = `עבודת גרפיקה ${index + 1}`;
            img.loading = 'lazy';
            img.decoding = 'async';

            figure.appendChild(img);
            grid.appendChild(figure);
        });
    }

    initGraphicsGrid();

    // ========== אנימציות fade-in עדינות בגלילה ==========
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
        document.querySelectorAll('.glass-card, .gallery-item').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    }

    // ========== הפעלת וידאו אוטומטית ==========
    const videos = document.querySelectorAll('video');

    if ('IntersectionObserver' in window) {
        const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    try {
                        entry.target.play().catch(e => console.log('שגיאת הפעלת וידאו:', e));
                    } catch (error) {
                        console.log('שגיאה בהפעלת וידאו:', error);
                    }
                } else {
                    entry.target.pause();
                }
            });
        }, { threshold: 0.5 });

        videos.forEach(video => {
            videoObserver.observe(video);
        });
    }

    console.log('✨ האתר נטען בהצלחה!');
});
