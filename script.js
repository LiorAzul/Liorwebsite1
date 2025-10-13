document.addEventListener('DOMContentLoaded', function () {
    // ========== יצירת רקע כוכבים מונפש ==========
    function createStarfield() {
        const canvas = document.createElement('canvas');
        canvas.id = 'stars-canvas';
        document.body.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const stars = [];
        const starCount = window.innerWidth < 768 ? 100 : 200; // פחות כוכבים במובייל

        class Star {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.5 + 0.3;
                this.twinkleSpeed = Math.random() * 0.02 + 0.01;
                this.twinkleDirection = Math.random() > 0.5 ? 1 : -1;

                // צבעי כוכבים שונים
                const colors = [
                    'rgba(255, 255, 255,',
                    'rgba(184, 212, 255,',
                    'rgba(212, 165, 255,',
                    'rgba(13, 206, 218,'
                ];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                // תנועה איטית
                this.x += this.speedX;
                this.y += this.speedY;

                // מצמוץ
                this.opacity += this.twinkleSpeed * this.twinkleDirection;
                if (this.opacity >= 1 || this.opacity <= 0.3) {
                    this.twinkleDirection *= -1;
                }

                // חזרה למסך אם יצא
                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color + this.opacity + ')';
                ctx.fill();

                // הוספת זוהר קל לכוכבים גדולים יותר
                if (this.size > 1.5) {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
                    ctx.fillStyle = this.color + (this.opacity * 0.2) + ')';
                    ctx.fill();
                }
            }
        }

        // יצירת כוכבים
        for (let i = 0; i < starCount; i++) {
            stars.push(new Star());
        }

        // אנימציה
        function animate() {
            ctx.clearRect(0, 0, width, height);

            stars.forEach(star => {
                star.update();
                star.draw();
            });

            requestAnimationFrame(animate);
        }

        animate();

        // עדכון גודל canvas בשינוי גודל חלון
        window.addEventListener('resize', function () {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });
    }

    // הפעלת רקע הכוכבים
    createStarfield();

    // ========== יצירת כוכבים נופלים ==========
    function createShootingStars() {
        const container = document.getElementById('shooting-stars');

        function createShootingStar() {
            const star = document.createElement('div');
            star.className = 'shooting-star';

            // מיקום אקראי בחלק התחתון של המסך - מתחיל מצד ימין תחתון
            star.style.left = (window.innerWidth * 0.7 + Math.random() * window.innerWidth * 0.4) + 'px';
            star.style.top = (window.innerHeight * 0.5 + Math.random() * window.innerHeight * 0.5) + 'px';

            // כיוון וזווית אקראיים - כוכבים עולים מימין לשמאל ומלמטה למעלה
            const angle = 45 + Math.random() * 15; // 45-60 מעלות
            star.style.transform = `rotate(${angle}deg) scaleX(-1)`;

            // מהירות אקראית
            const duration = 2 + Math.random() * 2; // 2-4 שניות
            star.style.animationDuration = duration + 's';

            container.appendChild(star);

            // הסרה אחרי האנימציה
            setTimeout(() => {
                star.remove();
            }, duration * 1000);
        }

        // יצירת כוכב נופל כל כמה שניות
        setInterval(() => {
            if (Math.random() > 0.7) { // 30% סיכוי
                createShootingStar();
            }
        }, 3000);

        // כוכבים ראשוניים
        setTimeout(() => createShootingStar(), 1000);
        setTimeout(() => createShootingStar(), 4000);
    }

    createShootingStars();

    // ========== חלקיקי אנרגיה מרחפים ==========
    function createEnergyParticles() {
        const colors = [
            'rgba(13, 206, 218, 0.8)',
            'rgba(107, 63, 160, 0.8)',
            'rgba(233, 30, 99, 0.8)',
            'rgba(255, 215, 0, 0.8)'
        ];

        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '1';
        document.body.prepend(canvas);

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const particleCount = window.innerWidth < 768 ? 20 : 40;

        class EnergyParticle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 3 + 1;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.speedY = (Math.random() - 0.5) * 0.5;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.life = 1;
                this.decay = Math.random() * 0.01 + 0.005;
                this.pulseSpeed = Math.random() * 0.05 + 0.02;
                this.pulsePhase = Math.random() * Math.PI * 2;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.life -= this.decay;

                // Pulse effect
                this.pulsePhase += this.pulseSpeed;

                // Reset if dead
                if (this.life <= 0) {
                    this.life = 1;
                    this.x = Math.random() * canvas.width;
                    this.y = Math.random() * canvas.height;
                }

                // Wrap around edges
                if (this.x < 0) this.x = canvas.width;
                if (this.x > canvas.width) this.x = 0;
                if (this.y < 0) this.y = canvas.height;
                if (this.y > canvas.height) this.y = 0;
            }

            draw() {
                const pulseFactor = 0.5 + Math.sin(this.pulsePhase) * 0.5;
                const currentSize = this.size * (0.5 + pulseFactor * 0.5);

                ctx.save();
                ctx.globalAlpha = this.life * pulseFactor;

                // Glow effect
                const gradient = ctx.createRadialGradient(
                    this.x, this.y, 0,
                    this.x, this.y, currentSize * 10
                );
                gradient.addColorStop(0, this.color);
                gradient.addColorStop(0.1, this.color.replace('0.8', '0.4'));
                gradient.addColorStop(1, 'transparent');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(this.x, this.y, currentSize * 10, 0, Math.PI * 2);
                ctx.fill();

                // Core
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
        }

        // Create particles
        for (let i = 0; i < particleCount; i++) {
            particles.push(new EnergyParticle());
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });

            requestAnimationFrame(animate);
        }

        animate();

        // Resize handler
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }

    // הפעלת חלקיקי אנרגיה
    if (window.innerWidth > 768) { // רק בדסקטופ לביצועים טובים יותר
        createEnergyParticles();
    }

    // ========== אנימציות scroll מתקדמות ==========
    const animateOnScroll = function () {
        const elements = document.querySelectorAll('.gallery-item, .video-wrapper, .section-title, .section-description, .iframe-wrapper');

        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;

            if (elementPosition < windowHeight - 100) {
                element.classList.add('animate');
                if (element.classList.contains('gallery-item')) {
                    element.classList.add('in-view');
                }
                element.style.opacity = '1';
                element.style.transform = 'translateY(0) scale(1)';
            }
        });
    };

    // ========== Intersection Observer לאנימציות scroll ==========
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // השהייה קלה לאפקט מדורג
                setTimeout(() => {
                    entry.target.classList.add('in-view');
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0) scale(1)';
                }, index * 50);
            }
        });
    }, observerOptions);

    // צפייה באלמנטים
    const elementsToAnimate = document.querySelectorAll('.gallery-item, .video-wrapper, .iframe-wrapper');
    elementsToAnimate.forEach(el => observer.observe(el));

    // ========== מיקרו-אנימציות לכרטיסים ==========
    const addMicroAnimations = function () {
        const galleryItems = document.querySelectorAll('.gallery-item');

        galleryItems.forEach(item => {
            // אפקט 3D tilt על hover (רק בדסקטופ)
            if (window.innerWidth > 768) {
                item.addEventListener('mousemove', function (e) {
                    const rect = this.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;

                    const rotateX = (y - centerY) / 20;
                    const rotateY = (centerX - x) / 20;

                    this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-15px) scale(1.03)`;
                });

                item.addEventListener('mouseleave', function () {
                    this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0) scale(1)';
                });
            }
        });
    };

    // ========== אפקטים נוספים ==========

    // טיפול בתמונות
    const ensureImagesLoaded = function () {
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
            img.addEventListener('error', function () {
                this.style.border = '2px dashed rgba(13, 206, 218, 0.3)';
                this.style.minHeight = '100px';
                console.log('שגיאה בטעינת התמונה:', this.src);
            });
        });
    };

    // הפעלת כל האפקטים
    ensureImagesLoaded();
    addMicroAnimations();

    // scroll אנימציות
    window.addEventListener('scroll', animateOnScroll);
    window.addEventListener('load', animateOnScroll);

    // ========== אנימציות נוספות ==========

    // אנימציה לתמונת פרופיל
    const profileImage = document.querySelector('.profile-image-container');
    if (profileImage && window.innerWidth > 768) {
        profileImage.addEventListener('mouseenter', function () {
            this.style.transform = 'scale(1.08) rotate(5deg)';
        });

        profileImage.addEventListener('mouseleave', function () {
            this.style.transform = 'scale(1) rotate(0)';
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

    // ========== Parallax קל לסקציות ==========
    if (window.innerWidth > 768) {
        window.addEventListener('scroll', function () {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.section-title');

            parallaxElements.forEach((element, index) => {
                const speed = 0.3;
                const yPos = -(scrolled * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
        });
    }

    // ========== אפקטים למובייל - Touch ==========
    if ('ontouchstart' in window) {
        const touchElements = document.querySelectorAll('.gallery-item, .video-wrapper, .iframe-wrapper');

        touchElements.forEach(element => {
            element.addEventListener('touchstart', function () {
                this.style.transform = 'scale(0.98)';
            });

            element.addEventListener('touchend', function () {
                this.style.transform = 'scale(1)';
            });
        });
    }

    // ========== Performance optimization ==========
    // דחיית טעינת iframe עד שהם בתצוגה
    const iframes = document.querySelectorAll('iframe[data-src]');
    if ('IntersectionObserver' in window && iframes.length > 0) {
        const iframeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const iframe = entry.target;
                    iframe.src = iframe.dataset.src;
                    iframeObserver.unobserve(iframe);
                }
            });
        });

        iframes.forEach(iframe => iframeObserver.observe(iframe));
    }

    // ========== גלילה חלקה לקישורים פנימיים ==========
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    console.log('🌌 Galaxy theme loaded successfully!');
}); 