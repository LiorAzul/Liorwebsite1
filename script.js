document.addEventListener('DOMContentLoaded', function () {

    // ========== אנימציות scroll מתקדמות ==========
    const animateOnScroll = function () {
        const elements = document.querySelectorAll('.gallery-item, .video-wrapper, .section-title, .section-description, .iframe-wrapper, .info-item');

        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;

            if (elementPosition < windowHeight - 100) {
                element.classList.add('animate');
                if (element.classList.contains('gallery-item')) {
                    element.classList.add('in-view');
                }
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
                setTimeout(() => {
                    entry.target.classList.add('in-view');
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 50);
            }
        });
    }, observerOptions);

    // צפייה באלמנטים
    const elementsToAnimate = document.querySelectorAll('.gallery-item, .video-wrapper, .iframe-wrapper');
    elementsToAnimate.forEach(el => observer.observe(el));

    // ========== אנימציות hover מתקדמות ==========
    const addHoverAnimations = function () {
        const interactiveElements = document.querySelectorAll('.gallery-item, .video-wrapper, .iframe-wrapper, .info-item, .social-button');

        interactiveElements.forEach(item => {
            if (window.innerWidth > 768) {
                item.addEventListener('mousemove', function (e) {
                    const rect = this.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;

                    const rotateX = (y - centerY) / 30;
                    const rotateY = (centerX - x) / 30;

                    this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.02)`;
                });

                item.addEventListener('mouseleave', function () {
                    this.style.transform = '';
                });
            }
        });
    };

    addHoverAnimations();

    // ========== טיפול בתמונות ==========
    const ensureImagesLoaded = function () {
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
            img.addEventListener('error', function () {
                this.style.border = '2px dashed rgba(0, 212, 255, 0.3)';
                this.style.minHeight = '100px';
            });
        });
    };

    ensureImagesLoaded();

    // scroll אנימציות
    window.addEventListener('scroll', animateOnScroll);
    window.addEventListener('load', animateOnScroll);

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

    // ========== Loading Screen ==========
    const loadingScreen = document.querySelector('.loading-screen');

    window.addEventListener('load', function () {
        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1500); // 1.5 שניות של טעינה
    });

    // ========== Scroll Progress Bar ==========
    const progressBar = document.querySelector('.scroll-progress-bar');

    function updateProgressBar() {
        if (!progressBar) return;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = window.pageYOffset;
        const progress = (scrolled / documentHeight) * 100;

        progressBar.style.width = progress + '%';
    }

    window.addEventListener('scroll', updateProgressBar);

    // ========== כפתור חזרה למעלה ==========
    const backToTopBtn = document.getElementById('backToTop');

    if (backToTopBtn) {
        window.addEventListener('scroll', function () {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });

        backToTopBtn.addEventListener('click', function () {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ========== אנימציות header על scroll ==========
    let lastScroll = 0;
    const header = document.querySelector('.main-header');

    if (header) {
        window.addEventListener('scroll', function () {
            const currentScroll = window.pageYOffset;

            if (currentScroll > lastScroll && currentScroll > 100) {
                // גלילה למטה - header נעלם
                header.style.transform = 'translateY(-100px)';
                header.style.opacity = '0';
            } else {
                // גלילה למעלה - header מופיע
                header.style.transform = 'translateY(0)';
                header.style.opacity = '1';
            }

            lastScroll = currentScroll;
        });
    }

    // ========== אנימציות smooth לסקציות ==========
    const sections = document.querySelectorAll('section');

    if ('IntersectionObserver' in window) {
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });

        sections.forEach(section => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(30px)';
            section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            sectionObserver.observe(section);
        });
    }

    // ========== כוכבים זזים לסקציית Imagine ==========
    function createImagineStars() {
        const canvas = document.getElementById('imagine-stars-canvas');
        const imagineSection = document.querySelector('.imagine-section');
        if (!canvas || !imagineSection) return;

        const ctx = canvas.getContext('2d');
        const sectionRect = imagineSection.getBoundingClientRect();
        let width = canvas.width = sectionRect.width;
        let height = canvas.height = sectionRect.height;

        const stars = [];
        const starCount = window.innerWidth < 768 ? 150 : 300; // הרבה כוכבים

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
                
                // צבעים: סגול או טורקיז
                const colors = [
                    { r: 138, g: 43, b: 226 }, // סגול
                    { r: 64, g: 224, b: 208 }  // טורקיז
                ];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                // תנועה עדינה
                this.x += this.speedX;
                this.y += this.speedY;

                // מצמוץ עדין
                this.opacity += this.twinkleSpeed * this.twinkleDirection;
                if (this.opacity >= 1 || this.opacity <= 0.2) {
                    this.twinkleDirection *= -1;
                }

                // חזרה למסך אם יצא
                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;
            }

            draw() {
                const color = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity})`;
                
                // כוכב עם זוהר
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                // זוהר קל
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
        function updateCanvasSize() {
            const sectionRect = imagineSection.getBoundingClientRect();
            width = canvas.width = sectionRect.width;
            height = canvas.height = sectionRect.height;
        }

        window.addEventListener('resize', updateCanvasSize);
        
        // עדכון גם ב-scroll
        window.addEventListener('scroll', function() {
            const sectionRect = imagineSection.getBoundingClientRect();
            if (sectionRect.top < window.innerHeight && sectionRect.bottom > 0) {
                updateCanvasSize();
            }
        });
    }

    // הפעלת כוכבים לסקציית Imagine
    createImagineStars();

    console.log('✨ Liquid Glass theme loaded successfully!');
});
