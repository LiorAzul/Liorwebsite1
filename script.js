document.addEventListener('DOMContentLoaded', function() {
    // אנימציית המופע האלמנטים כאשר הם מופיעים במסך
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.gallery-item, .video-wrapper, .section-title, .section-description');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementPosition < windowHeight - 100) {
                element.classList.add('animate');
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        });
    };
    
    // הוספת קלאס לאנימציה - אבל רק אם המסך לא קטן מדי
    const addAnimationClass = function() {
        // אם המסך קטן מדי, לא נוסיף אנימציות שיכולות לגרום לבעיות
        if (window.innerWidth < 768) {
            // עבור מסכים קטנים, נראה את כל התוכן מיד
            const items = document.querySelectorAll('.gallery-item, .video-wrapper, .section-title, .section-description');
            items.forEach(item => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            });
            return;
        }
        
        const items = document.querySelectorAll('.gallery-item, .video-wrapper, .section-title, .section-description');
        items.forEach((item, index) => {
            // וודא שהפריטים לא נעלמים לגמרי - שמור על אטימות מינימלית
            item.style.opacity = '0.1';
            item.style.transform = 'translateY(20px)';
            item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            item.style.transitionDelay = `${Math.min(index * 0.05, 1)}s`; // מגביל את ההשהיה המרבית
        });
        
        // האנימציה תתחיל מיד אחרי הוספת הקלאסים
        setTimeout(() => {
            animateOnScroll();
        }, 100);
    };
    
    // וודא שכל התמונות נטענו
    const ensureImagesLoaded = function() {
        const allImages = document.querySelectorAll('img');
        allImages.forEach(img => {
            // אם התמונה לא נטענה או שיש לה שגיאה, הצג מסגרת כדי להראות שהיא אמורה להיות שם
            img.addEventListener('error', function() {
                this.style.border = '2px dashed #ccc';
                this.style.minHeight = '100px';
                console.log('שגיאה בטעינת התמונה:', this.src);
            });
        });
    };
    
    // אפקט הובר על פריטי הגלריה
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        // וודא שהפריטים נראים גם בלי אפקט הובר
        item.style.opacity = '1';
        
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.05)';
            this.style.zIndex = '1';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.zIndex = '0';
        });
    });
    
    // התחלת הקובץ - קודם וודא שכל התמונות נטענו
    ensureImagesLoaded();
    // הפעל את האנימציות רק אחרי שהדף נטען לגמרי
    window.addEventListener('load', function() {
        addAnimationClass();
        animateOnScroll(); // הפעל את האנימציה מיד בטעינה
    });
    window.addEventListener('scroll', animateOnScroll);
    
    // האנשה של כל התמונה העיקרית
    const profileImage = document.querySelector('.profile-image-container');
    if (profileImage) {
        profileImage.addEventListener('mouseenter', function() {
            this.style.transform = 'rotate(5deg) scale(1.05)';
        });
        
        profileImage.addEventListener('mouseleave', function() {
            this.style.transform = 'rotate(0) scale(1)';
        });
    }
    
    // הפעלת סרטוני וידאו אוטומטית כאשר הם גלויים
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        // נסה להפעיל את הוידאו ישירות
        try {
            video.play().catch(error => {
                console.log('לא ניתן להפעיל וידאו אוטומטית:', error);
            });
        } catch (error) {
            console.log('שגיאה בהפעלת וידאו:', error);
        }
    });
    
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
    
    // אפקט מרחף על כפתורי רשתות חברתיות
    const socialButtons = document.querySelectorAll('.social-button');
    socialButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.05)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // וודא שכל האלמנטים מוצגים לאחר פרק זמן קצוב, ללא קשר לאנימציות
    setTimeout(function() {
        document.querySelectorAll('.gallery-item, .video-wrapper, .section-title, .section-description').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }, 2000); // אחרי 2 שניות, כל האלמנטים יהיו גלויים בכל מקרה
}); 