document.addEventListener('DOMContentLoaded', function () {
    // ========== כוכבים זזים לסקציית Imagine ==========
    function createImagineStars() {
        const canvas = document.getElementById('imagine-stars-canvas');
        const imagineSection = document.querySelector('#apps-page .galaxy-background')?.closest('section');
        if (!canvas || !imagineSection) return;
        if (imagineSection.hidden || imagineSection.classList.contains('hidden')) return;

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const stars = [];
        const starCount = window.innerWidth < 768 ? 150 : 300;

        class Star {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.2;
                this.speedY = (Math.random() - 0.5) * 0.2;
                this.opacity = Math.random() * 0.8 + 0.2;
                this.twinkleSpeed = Math.random() * 0.01 + 0.005;
                this.twinkleDirection = Math.random() > 0.5 ? 1 : -1;
                
                const colors = [
                    { r: 138, g: 43, b: 226 }, // סגול
                    { r: 64, g: 224, b: 208 }  // טורקיז
                ];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                this.opacity += this.twinkleSpeed * this.twinkleDirection;
                if (this.opacity >= 1 || this.opacity <= 0.2) {
                    this.twinkleDirection *= -1;
                }

                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;
            }

            draw() {
                const color = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity})`;
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                if (this.size > 1) {
                    const gradient = ctx.createRadialGradient(
                        this.x, this.y, 0,
                        this.x, this.y, this.size * 4
                    );
                    gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity * 0.6})`);
                    gradient.addColorStop(0.3, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity * 0.3})`);
                    gradient.addColorStop(1, 'transparent');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        for (let i = 0; i < starCount; i++) {
            stars.push(new Star());
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);

            stars.forEach(star => {
                star.update();
                star.draw();
            });

            requestAnimationFrame(animate);
        }

        animate();

        window.addEventListener('resize', function () {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });
    }

    // הפעלת כוכבים לסקציית Imagine
    createImagineStars();

    // ========== רקע Gradient אינטראקטיבי ==========
    function initHeroGradientPointer() {
        const hero = document.querySelector('.portfolio-hero');
        const pointerOrb = document.getElementById('heroPointerOrb');
        if (!hero || !pointerOrb) return;

        let curX = window.innerWidth / 2;
        let curY = window.innerHeight / 2;
        let targetX = curX;
        let targetY = curY;
        let rafId = null;

        function animatePointer() {
            curX += (targetX - curX) / 20;
            curY += (targetY - curY) / 20;
            pointerOrb.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
            rafId = requestAnimationFrame(animatePointer);
        }

        hero.addEventListener('mousemove', function (event) {
            const rect = hero.getBoundingClientRect();
            targetX = event.clientX - rect.left;
            targetY = event.clientY - rect.top;
            if (!rafId) {
                rafId = requestAnimationFrame(animatePointer);
            }
        });

        hero.addEventListener('mouseleave', function () {
            targetX = hero.offsetWidth / 2;
            targetY = hero.offsetHeight / 2;
        });
    }

    initHeroGradientPointer();

    // ========== גלריית תמונות עם הטיה לפי גלילת הדף ==========
    function initScrollTiltedGrid() {
        const grid = document.getElementById('graphicsStack');
        if (!grid) return;

        const images = [
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

        function createTile(src, index) {
            const figure = document.createElement('figure');
            figure.className = 'scroll-tilted-tile';
            figure.dataset.side = index % 2 === 0 ? 'L' : 'R';

            const card = document.createElement('div');
            card.className = 'scroll-tilted-card';

            const image = document.createElement('div');
            image.className = 'scroll-tilted-image';
            image.style.backgroundImage = `url("${src}")`;
            image.setAttribute('role', 'img');
            image.setAttribute('aria-label', `עבודת גרפיקה ${index + 1}`);

            card.appendChild(image);
            figure.appendChild(card);
            return figure;
        }

        grid.innerHTML = '';
        images.forEach((src, index) => grid.appendChild(createTile(src, index)));

        const tiles = Array.from(grid.querySelectorAll('.scroll-tilted-tile'));
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let ticking = false;

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        function interpolate(progress, start, middle, end) {
            if (progress <= 0.5) {
                return start + (middle - start) * (progress / 0.5);
            }
            return middle + (end - middle) * ((progress - 0.5) / 0.5);
        }

        function easeOutCubic(value) {
            return 1 - Math.pow(1 - value, 3);
        }

        function updateTiles() {
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;

            tiles.forEach((tile) => {
                const rect = tile.getBoundingClientRect();
                const rawProgress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
                const progress = clamp(rawProgress, 0, 1);
                const focus = 1 - Math.abs(progress - 0.5) * 2;
                const easedFocus = easeOutCubic(clamp(focus, 0, 1));
                const sideSign = tile.dataset.side === 'L' ? -1 : 1;
                const card = tile.querySelector('.scroll-tilted-card');
                const image = tile.querySelector('.scroll-tilted-image');
                if (!card || !image) return;

                if (reduceMotion) {
                    card.style.transform = '';
                    card.style.filter = '';
                    image.style.transform = '';
                    return;
                }

                const translateY = interpolate(progress, 92, 0, -92);
                const translateX = interpolate(progress, sideSign * 34, 0, sideSign * 34);
                const translateZ = interpolate(progress, 260, 0, 260);
                const rotateX = interpolate(progress, 64, 0, -64);
                const rotate = interpolate(progress, -sideSign * 5, 0, sideSign * 5);
                const skew = interpolate(progress, sideSign * 16, 0, -sideSign * 16);
                const blur = interpolate(progress, 7, 0, 7);
                const brightness = 0.16 + easedFocus * 0.84;
                const contrast = 3.2 - easedFocus * 2.2;
                const scaleY = 1.68 - easedFocus * 0.68;

                card.style.transform = `translate3d(${translateX}%, ${translateY}%, ${translateZ}px) rotate(${rotate}deg) rotateX(${rotateX}deg) skewX(${skew}deg)`;
                card.style.filter = `blur(${blur}px) brightness(${brightness}) contrast(${contrast})`;
                image.style.transform = `scaleY(${scaleY})`;
            });

            ticking = false;
        }

        function requestUpdate() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(updateTiles);
        }

        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        requestUpdate();
    }

    initScrollTiltedGrid();

    // ========== אנימציות scroll ==========
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.gallery-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

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
