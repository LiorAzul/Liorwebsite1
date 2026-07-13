// i18n.js — תמיכה דו-לשונית עברית/אנגלית לכל האתר.
// אלמנטים מסומנים data-i18n="key"; קישורי וואטסאפ מסומנים data-wa="key".
(function () {
    'use strict';

    var WA_NUMBER = '972523321674';

    var DICT = {
        he: {
            _meta: {
                title: 'ליאור אזולאי — בניית אתרים, אפליקציות iOS, עיצוב ותלת מימד',
                description: 'ליאור אזולאי — בניית אתרים, פיתוח אפליקציות iOS, עיצוב גרפי, וידיאו ותלת מימד. ברמה של סטודיו, במהירות של פרילנסר.'
            },
            loading: 'נעים להכיר...',

            heroName: 'ליאור אזולאי',
            heroHeadline: 'אתר, אפליקציה או מיתוג — ברמה של סטודיו, במהירות של פרילנסר',
            heroSub: 'אני מפתח ומעצב שעובד איתכם אחד־על־אחד: בלי מנהלי פרויקטים באמצע, בלי חודשים של המתנה ובלי מחירים של בית תוכנה. אתם מדברים ישירות עם מי שבונה לכם את המוצר — מהשיחה הראשונה ועד העלייה לאוויר.',
            heroCtaMain: 'בואו נדבר בוואטסאפ',
            heroCtaWorks: 'לצפייה בעבודות',

            trust1b: '5 אפליקציות', trust1s: 'כבר בחנות של אפל',
            trust2b: 'מענה תוך 24 שעות', trust2s: 'בוואטסאפ, בלי מרכזיות',
            trust3b: 'הכול במקום אחד', trust3s: 'פיתוח, עיצוב, וידיאו ותלת מימד',
            trust4b: 'עבודה ישירה 1:1', trust4s: 'בלי מנהלי פרויקטים באמצע',

            whyTitle: 'למה לעבוד איתי ולא עם בית תוכנה?',
            whyIntro: 'כי פרויקט טוב לא צריך שלושה מנהלי פרויקטים, שבועיים לכל תיקון וחשבונית שמכסה משרדים בתל אביב.',
            why1t: 'יחס אישי, בלי מתווכים',
            why1d: 'אתם עובדים ישירות איתי מהשיחה הראשונה ועד העלייה לאוויר. אין "נעביר את זה לצוות", אין טלפון שבור — יש אדם אחד שמכיר את הפרויקט שלכם לעומק ועונה לכם בוואטסאפ.',
            why2t: 'מהירות אמיתית',
            why2d: 'החלטות מתקבלות בשיחה אחת, לא בישיבת סטטוס שבועית. תוצרים ראשונים אצלכם תוך ימים — לא תוך חודשים.',
            why3t: 'הכול תחת קורת גג אחת',
            why3d: 'פיתוח, עיצוב, מיתוג, וידיאו ותלת מימד. לא צריך לתאם בין ארבעה ספקים — מקבלים מוצר שלם בשפה עיצובית אחידה, ממקום אחד.',
            why4t: 'משלמים על עבודה, לא על מנגנון',
            why4d: 'בלי עלויות תקורה של משרד, צוות מכירות ושכבות ניהול. התקציב שלכם הולך למוצר עצמו.',

            svcTitle: 'מה אני בונה בשבילכם',
            svcLead: 'ארבע חבילות שירות — וכולן מתחילות באותה שיחה. מספרים לי מה צריך, ומקבלים הצעת מחיר מסודרת בלי התחייבות.',

            svcWebTitle: 'אתרי תדמית ודפי נחיתה',
            svcWebDesc: 'אתר מהיר, מעוצב וממוקד מטרה שגורם ללקוחות להבין תוך שניות למה כדאי לעבוד איתכם. בדיוק כמו העמוד הזה — עוצב ונבנה על ידי, מקצה לקצה.',
            svcWebB1: 'עיצוב ייחודי שלא נראה כמו תבנית',
            svcWebB2: 'מותאם מושלם למובייל',
            svcWebB3: 'טעינה מהירה',
            svcWebB4: 'מוכן לקידום בגוגל',
            svcWebCta: 'קבלו הצעת מחיר לאתר',

            svcAppTitle: 'אפליקציות iOS',
            svcAppDesc: 'מהרעיון ועד ה-App Store — כבר עשיתי את הדרך הזאת חמש פעמים. אני מפתח, מעצב, ומעביר את האפליקציה את כל תהליך האישורים של אפל, כך שאתם מקבלים מוצר חי בחנות.',
            svcAppB1: '5 אפליקציות שלי כבר בחנות',
            svcAppB2: 'עיצוב וחוויית משתמש כלולים',
            svcAppB3: 'ליווי מלא מול אפל',
            svcAppB4: 'עדכונים גם אחרי ההשקה',
            svcAppCta: 'קבלו הצעת מחיר לאפליקציה',

            svcDesignTitle: 'עיצוב גרפי ומיתוג',
            svcDesignDesc: 'לוגו, שפה מותגית, גרפיקות לסושיאל וחומרים שיווקיים — עיצוב שנותן לעסק שלכם פנים מקצועיות וזכירות, בשפה אחידה מהלוגו ועד הסטורי.',
            svcDesignB1: 'לוגו וזהות מותגית',
            svcDesignB2: 'גרפיקות לסושיאל ולדפוס',
            svcDesignB3: 'מצגות וחומרי מכירה',
            svcDesignB4: 'שפה אחידה לכל הערוצים',
            svcDesignCta: 'קבלו הצעת מחיר לעיצוב',

            svcVideoTitle: 'וידיאו ותלת מימד',
            svcVideoDesc: 'סרטוני תדמית, אנימציה ותלת מימד שעוצרים את הגלילה. אני עובד ב-After Effects וב-Blender ומביא לעסק שלכם ויז\'ואל ברמה שרואים בדרך כלל רק אצל מותגים גדולים.',
            svcVideoB1: 'סרטוני תדמית ומוצר',
            svcVideoB2: 'אנימציית תלת מימד',
            svcVideoB3: 'תוכן לסושיאל',
            svcVideoB4: 'מהקונספט ועד הרינדור הסופי',
            svcVideoCta: 'קבלו הצעת מחיר לוידיאו',

            prcTitle: 'איך עובדים איתי',
            prcIntro: 'פשוט, שקוף ובלי הפתעות:',
            prc1t: 'שיחת היכרות',
            prc1d: 'מספרים לי מה אתם צריכים — בוואטסאפ או בטלפון. בלי עלות ובלי התחייבות.',
            prc2t: 'הצעה מסודרת',
            prc2d: 'תוך יום-יומיים אתם מקבלים הצעת מחיר ברורה: מה בדיוק נבנה, באיזה שלבים ובאיזה לוח זמנים.',
            prc3t: 'עבודה בשקיפות מלאה',
            prc3d: 'אתם רואים התקדמות אמיתית לאורך הדרך ומעירים בזמן אמת — ישירות מולי, בלי טלפון שבור.',
            prc4t: 'עלייה לאוויר וליווי',
            prc4d: 'משיקים, מוודאים שהכול עובד מושלם, ואני נשאר זמין גם אחרי המסירה.',
            prcCta: 'מתחילים בשיחה',

            pfTitle: 'עבודות נבחרות',
            pfLead: 'לא מאמינים למילים? הנה מה שכבר בניתי.',
            pfAppsTitle: 'אפליקציות',
            pfAppsSub: 'חמש מהאפליקציות האלה זמינות להורדה ב-App Store עכשיו.',
            pfGraphicsTitle: 'גרפיקה',
            pfVideoTitle: 'וידיאו',
            futureosDesc: 'FutureOS הוא עמוד סושיאל שאני מתחזק, שמציג קונספטים למערכות ההפעלה של Apple שנוצרו ב-After Effects וב-Blender. זה פרויקט שנעשה נטו מתוך אהבה ליצירה.',
            eldioTitle: 'אלדיו השד',
            eldioDesc: 'אלדיו השד היא סדרת אנימציה קצרה שיצרתי לסושיאל. היא מספרת על שד שמנסה להגיע לגן עדן.',

            aboutTitle: 'נעים להכיר, ליאור',
            aboutText: 'אני מפתח ומעצב, ובעיקר — אדם שאוהב לבנות דברים. העליתי חמש אפליקציות ל-App Store, אני מנהל את FutureOS — עמוד קונספטים למערכות ההפעלה של אפל, יצרתי את סדרת האנימציה "אלדיו השד", ואני עובד על Imagine — כלי ליצירת עולמות תלת מימד עם בינה מלאכותית. כשאתם עובדים איתי, אתם מקבלים את כל התשוקה הזאת מכוונת לפרויקט שלכם.',
            aboutListening: 'אני מאזין עכשיו ל...',

            ctaTitle: 'יש לכם רעיון? בואו נהפוך אותו למציאות.',
            ctaSub: 'ספרו לי מה אתם צריכים — אתר, אפליקציה, מיתוג או וידיאו — ותקבלו מענה אישי תוך 24 שעות.',
            ctaWhatsapp: 'שלחו לי הודעה עכשיו',
            ctaAllChannels: 'כל דרכי ההתקשרות',

            cmTitle: 'יצירת קשר',
            cmLinkedin: 'לינקדאין',
            cmInstagram: 'אינסטגרם',
            cmCopyEmail: 'העתקת אימייל',
            cmCopied: 'הועתק!',
            cmWhatsapp: 'יצירת קשר ב-WhatsApp',
            cmCv: 'הורדת קו״ח',

            dockHome: 'ראשי',
            dockServices: 'שירותים',
            dockWorks: 'עבודות',
            dockContact: 'קשר',

            _wa: {
                waGeneral: 'היי ליאור, הגעתי מהאתר שלך ואשמח לשמוע פרטים על פרויקט',
                waWeb: 'היי ליאור, אני מעוניין/ת באתר תדמית או דף נחיתה ואשמח להצעת מחיר',
                waApp: 'היי ליאור, יש לי רעיון לאפליקציה ואשמח להצעת מחיר',
                waDesign: 'היי ליאור, אני מעוניין/ת בעיצוב גרפי או מיתוג ואשמח להצעת מחיר',
                waVideo: 'היי ליאור, אני מעוניין/ת בסרטון או עבודת תלת מימד ואשמח להצעת מחיר'
            }
        },

        en: {
            _meta: {
                title: 'Lior Azulay — Websites, iOS Apps, Design & 3D',
                description: 'Lior Azulay — websites, iOS app development, graphic design, video and 3D. Studio quality, freelancer speed.'
            },
            loading: 'Nice to meet you...',

            heroName: 'Lior Azulay',
            heroHeadline: 'A website, app or brand — studio quality, freelancer speed',
            heroSub: "I'm a developer and designer who works with you one-on-one: no project managers in the middle, no months of waiting, and no software-house prices. You talk directly with the person building your product — from the first call to launch day.",
            heroCtaMain: "Let's talk on WhatsApp",
            heroCtaWorks: 'See my work',

            trust1b: '5 apps', trust1s: 'live on the App Store',
            trust2b: 'Reply within 24h', trust2s: 'on WhatsApp, no call centers',
            trust3b: 'Everything in one place', trust3s: 'development, design, video & 3D',
            trust4b: 'Direct 1:1 work', trust4s: 'no project managers in between',

            whyTitle: 'Why work with me instead of a software house?',
            whyIntro: "Because a good project doesn't need three project managers, two weeks per revision, and an invoice that covers Tel Aviv office rent.",
            why1t: 'Personal attention, no middlemen',
            why1d: 'You work directly with me from the first call to launch. No "we\'ll pass it to the team", no broken telephone — one person who knows your project deeply and answers you on WhatsApp.',
            why2t: 'Real speed',
            why2d: 'Decisions happen in one conversation, not a weekly status meeting. First deliverables reach you within days — not months.',
            why3t: 'Everything under one roof',
            why3d: "Development, design, branding, video and 3D. No juggling four vendors — you get a complete product with one consistent design language, from one place.",
            why4t: 'Pay for work, not overhead',
            why4d: 'No office overhead, sales teams or management layers. Your budget goes into the product itself.',

            svcTitle: 'What I can build for you',
            svcLead: "Four service packages — and they all start with the same conversation. Tell me what you need, and get a clear quote with no commitment.",

            svcWebTitle: 'Brand sites & landing pages',
            svcWebDesc: 'A fast, beautifully designed, goal-focused website that makes clients understand within seconds why they should work with you. Exactly like this page — designed and built by me, end to end.',
            svcWebB1: "Unique design that doesn't look like a template",
            svcWebB2: 'Perfectly mobile-optimized',
            svcWebB3: 'Fast loading',
            svcWebB4: 'Ready for Google SEO',
            svcWebCta: 'Get a website quote',

            svcAppTitle: 'iOS apps',
            svcAppDesc: "From idea to the App Store — I've walked that road five times already. I develop, design, and take the app through Apple's entire review process, so you get a live product in the store.",
            svcAppB1: '5 of my apps already in the store',
            svcAppB2: 'Design & UX included',
            svcAppB3: 'Full guidance through Apple review',
            svcAppB4: 'Updates after launch too',
            svcAppCta: 'Get an app quote',

            svcDesignTitle: 'Graphic design & branding',
            svcDesignDesc: 'Logo, brand language, social graphics and marketing materials — design that gives your business a professional, memorable face, consistent from the logo to the story.',
            svcDesignB1: 'Logo & brand identity',
            svcDesignB2: 'Social & print graphics',
            svcDesignB3: 'Decks & sales materials',
            svcDesignB4: 'One language across all channels',
            svcDesignCta: 'Get a design quote',

            svcVideoTitle: 'Video & 3D',
            svcVideoDesc: 'Brand videos, animation and 3D that stop the scroll. I work in After Effects and Blender and bring your business visuals at a level usually seen only from big brands.',
            svcVideoB1: 'Brand & product videos',
            svcVideoB2: '3D animation',
            svcVideoB3: 'Social content',
            svcVideoB4: 'From concept to final render',
            svcVideoCta: 'Get a video quote',

            prcTitle: 'How we work together',
            prcIntro: 'Simple, transparent, no surprises:',
            prc1t: 'Intro call',
            prc1d: 'Tell me what you need — on WhatsApp or by phone. Free, no commitment.',
            prc2t: 'A clear proposal',
            prc2d: 'Within a day or two you get a clear quote: exactly what gets built, in what stages, on what timeline.',
            prc3t: 'Full transparency',
            prc3d: 'You see real progress along the way and give feedback in real time — directly with me, no broken telephone.',
            prc4t: 'Launch & support',
            prc4d: 'We launch, make sure everything works perfectly, and I stay available after delivery too.',
            prcCta: 'Start with a chat',

            pfTitle: 'Selected work',
            pfLead: "Don't take my word for it? Here's what I've already built.",
            pfAppsTitle: 'Apps',
            pfAppsSub: 'Five of these apps are available on the App Store right now.',
            pfGraphicsTitle: 'Graphics',
            pfVideoTitle: 'Video',
            futureosDesc: 'FutureOS is a social page I run, showcasing concepts for Apple operating systems created in After Effects and Blender. A project made purely out of love for the craft.',
            eldioTitle: 'Eldio the Demon',
            eldioDesc: 'Eldio the Demon is a short animation series I created for social. It tells the story of a demon trying to reach heaven.',

            aboutTitle: 'Nice to meet you, I\'m Lior',
            aboutText: "I'm a developer and designer, and above all — someone who loves building things. I've shipped five apps to the App Store, I run FutureOS — a concept page for Apple operating systems, I created the animation series \"Eldio the Demon\", and I'm building Imagine — a tool for creating 3D worlds with AI. When you work with me, all of that passion is aimed at your project.",
            aboutListening: "I'm currently listening to...",

            ctaTitle: "Got an idea? Let's make it real.",
            ctaSub: 'Tell me what you need — a website, an app, branding or video — and get a personal reply within 24 hours.',
            ctaWhatsapp: 'Message me now',
            ctaAllChannels: 'All contact options',

            cmTitle: 'Contact',
            cmLinkedin: 'LinkedIn',
            cmInstagram: 'Instagram',
            cmCopyEmail: 'Copy email',
            cmCopied: 'Copied!',
            cmWhatsapp: 'Chat on WhatsApp',
            cmCv: 'Download CV',

            dockHome: 'Home',
            dockServices: 'Services',
            dockWorks: 'Work',
            dockContact: 'Contact',

            _wa: {
                waGeneral: "Hi Lior, I found your website and I'd love to hear more about working together",
                waWeb: "Hi Lior, I'm interested in a website / landing page — I'd love a quote",
                waApp: "Hi Lior, I have an app idea — I'd love a quote",
                waDesign: "Hi Lior, I'm interested in graphic design / branding — I'd love a quote",
                waVideo: "Hi Lior, I'm interested in a video / 3D project — I'd love a quote"
            }
        }
    };

    var current = 'he';
    try {
        var saved = localStorage.getItem('lang');
        if (saved === 'en' || saved === 'he') current = saved;
    } catch (e) { /* private mode */ }

    function t(key) {
        return (DICT[current] && DICT[current][key]) || (DICT.he && DICT.he[key]) || key;
    }

    function apply(lang) {
        current = lang;
        var d = DICT[lang];
        if (!d) return;

        // Text nodes
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            if (d[key] !== undefined) el.textContent = d[key];
        });

        // WhatsApp links with per-language prefill
        document.querySelectorAll('[data-wa]').forEach(function (el) {
            var key = el.getAttribute('data-wa');
            var msg = d._wa[key];
            if (msg) el.setAttribute('href', 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg));
        });

        // Document direction + metadata
        var html = document.documentElement;
        html.setAttribute('lang', lang);
        html.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
        document.title = d._meta.title;
        var meta = document.getElementById('metaDescription');
        if (meta) meta.setAttribute('content', d._meta.description);

        // Toggle button label: shows the language you'd switch TO
        var btn = document.getElementById('langToggle');
        if (btn) {
            var span = btn.querySelector('.top-toggle-text');
            if (span) span.textContent = lang === 'he' ? 'EN' : 'עב';
            btn.setAttribute('aria-label', lang === 'he' ? 'Switch to English' : 'מעבר לעברית');
        }

        try { localStorage.setItem('lang', lang); } catch (e) { /* private mode */ }
    }

    function init() {
        var btn = document.getElementById('langToggle');
        if (btn) {
            btn.addEventListener('click', function () {
                apply(current === 'he' ? 'en' : 'he');
            });
        }
        // Apply saved language (Hebrew markup is the default, so only en needs a pass,
        // but applying he too keeps everything consistent)
        apply(current);
    }

    window.i18n = { t: t, apply: apply, get lang() { return current; } };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
