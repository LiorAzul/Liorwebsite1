document.addEventListener('DOMContentLoaded', function () {
    // ========== כוכבים זזים לסקציית Imagine ==========
    function createImagineStars() {
        const canvas = document.getElementById('imagine-stars-canvas');
        const imagineSection = document.querySelector('#apps-page .galaxy-background')?.closest('section');
        if (!canvas || !imagineSection) return;

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

    // ========== גלריית תמונות אנכית ==========
    function initVerticalImageStack() {
        const stack = document.getElementById('graphicsStack');
        if (!stack) return;

        const cards = Array.from(stack.querySelectorAll('.stack-card'));
        const dots = Array.from(stack.querySelectorAll('.stack-dot'));
        const currentLabel = document.getElementById('stackCurrent');
        const totalLabel = document.getElementById('stackTotal');
        const total = cards.length;
        let currentIndex = 0;
        let startY = 0;
        let isPointerDown = false;
        let lastNavigationTime = 0;
        const navigationCooldown = 400;

        if (totalLabel) {
            totalLabel.textContent = String(total).padStart(2, '0');
        }

        function getCircularDiff(index) {
            let diff = index - currentIndex;
            if (diff > total / 2) diff -= total;
            if (diff < -total / 2) diff += total;
            return diff;
        }

        function getCardState(diff) {
            if (diff === 0) {
                return { y: 0, scale: 1, opacity: 1, zIndex: 5, rotateX: 0 };
            }
            if (diff === -1) {
                return { y: -160, scale: 0.82, opacity: 0.6, zIndex: 4, rotateX: 8 };
            }
            if (diff === -2) {
                return { y: -280, scale: 0.7, opacity: 0.3, zIndex: 3, rotateX: 15 };
            }
            if (diff === 1) {
                return { y: 160, scale: 0.82, opacity: 0.6, zIndex: 4, rotateX: -8 };
            }
            if (diff === 2) {
                return { y: 280, scale: 0.7, opacity: 0.3, zIndex: 3, rotateX: -15 };
            }
            return {
                y: diff > 0 ? 420 : -420,
                scale: 0.6,
                opacity: 0,
                zIndex: 0,
                rotateX: diff > 0 ? -20 : 20
            };
        }

        function renderStack() {
            cards.forEach((card, index) => {
                const diff = getCircularDiff(index);
                const state = getCardState(diff);
                const isVisible = Math.abs(diff) <= 2;
                const isCurrent = index === currentIndex;

                card.style.transform = `translateY(${state.y}px) scale(${state.scale}) rotateX(${state.rotateX}deg)`;
                card.style.opacity = String(state.opacity);
                card.style.zIndex = String(state.zIndex);
                card.style.pointerEvents = isVisible ? 'auto' : 'none';
                card.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
                card.classList.toggle('is-current', isCurrent);
            });

            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });

            if (currentLabel) {
                currentLabel.textContent = String(currentIndex + 1).padStart(2, '0');
            }
        }

        function navigate(direction) {
            const now = Date.now();
            if (now - lastNavigationTime < navigationCooldown) return;
            lastNavigationTime = now;

            if (direction > 0) {
                currentIndex = currentIndex === total - 1 ? 0 : currentIndex + 1;
            } else {
                currentIndex = currentIndex === 0 ? total - 1 : currentIndex - 1;
            }
            renderStack();
        }

        stack.addEventListener('wheel', function (event) {
            if (Math.abs(event.deltaY) <= 30) return;
            event.preventDefault();
            navigate(event.deltaY > 0 ? 1 : -1);
        }, { passive: false });

        cards.forEach((card, index) => {
            card.addEventListener('click', function () {
                if (index === currentIndex) return;
                currentIndex = index;
                renderStack();
            });

            card.addEventListener('pointerdown', function (event) {
                if (index !== currentIndex) return;
                isPointerDown = true;
                startY = event.clientY;
                card.setPointerCapture(event.pointerId);
            });

            card.addEventListener('pointerup', function (event) {
                if (!isPointerDown || index !== currentIndex) return;
                isPointerDown = false;
                const offsetY = event.clientY - startY;
                if (offsetY < -50) {
                    navigate(1);
                } else if (offsetY > 50) {
                    navigate(-1);
                }
            });

            card.addEventListener('pointercancel', function () {
                isPointerDown = false;
            });
        });

        dots.forEach((dot, index) => {
            dot.addEventListener('click', function () {
                currentIndex = index;
                renderStack();
            });
        });

        renderStack();
    }

    initVerticalImageStack();

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

    console.log('✨ Website loaded successfully!');
});
