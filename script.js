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
