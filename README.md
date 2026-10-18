# VibeMagic ✦

דף הנחיתה של VibeMagic: פיתוח אתרים ואפליקציות מבוסס AI, עם ליווי אישי מהרעיון ועד ההשקה.
אתר סטטי (HTML / CSS / JS) בלי שלב build, מתפרסם ב-Vercel מהענף lior2. כל הספריות, הפונטים והתמונות יושבים מקומית.
האתר הקודם (תיק העבודות) נשמר כמו שהוא ב-`legacy/`.

## הרצה מקומית

```bash
python3 -m http.server 8000
```

ואז לפתוח `http://localhost:8000/`. (מ-`file://` חלק מהאפקטים לא ייטענו.)

## מבנה

| קובץ | מה יש בו |
|------|-----------|
| `index.html` | כל ה-markup והקופי, כולל ספרייט SVG (לוגו, אייקונים) בראש ה-body |
| `css/core.css` · `js/core.js` | טוקנים לשתי התמות, טיפוגרפיה, מוטיבים מהפוסטרים, Lenis + ScrollTrigger, מערכת reveal, `window.VM` |
| `js/intro.js` · `css/intro.css` | פתיח הניאון של הלוגו (פעם אחת בכל סשן) |
| `js/nav.js` · `css/nav.css` | ה-pill שמשנה צורה בגלילה, ההמבורגר, התפריט המעוקל ומתג התמה (View Transitions) |
| `js/hero.js` · `js/fx/hero-shader.js` · `js/fx/sparkles.js` · `css/hero.css` | ההירו: שיידר WebGL, ניצוצות, טקסט מתחלף, מרקיז |
| `js/fx/text.js` · `css/text.css` | אפקטי טקסט גלובליים (`data-split`, `data-scrub-words`, `data-scramble`, `data-count`) והמניפסט |
| `js/services.js` · `css/services.css` | דיאגרמת הקרניים, הבנטו של השירותים, טבלת ההשוואה, `data-spotlight` |
| `js/playground.js` · `css/playground.css` | "נסו את הקסם": רעיון → קונספט → וואטסאפ |
| `js/works.js` · `css/works.css` | Imagine, קיר צילומי המסך, כרטיסי האפליקציות |
| `js/story.js` · `css/story.css` | תהליך, אודות, סדרת 101, שאלות נפוצות |
| `js/fx/delight.js` · `css/footer.css` | הפוטר, כפתור הוואטסאפ הצף, קונפטי, שובל קסם לעכבר, ביצת פסחא |
| `vendor/` | GSAP 3.15 (+ScrollTrigger, SplitText), Lenis 1.3.26, canvas-confetti 1.9.4 |
| `tools/shot.mjs` | צילומי מסך headless לבדיקות (Chrome + Node 22, הוראות שימוש בראש הקובץ) |

רכיבים שהועברו מ-[21st.dev](https://21st.dev) (React → vanilla): Mesh Gradient (Paper Shaders), Sparkles + Particles,
Morphing Text, Text Generate Effect, Text Reveal, Encrypted Text, Number Ticker, Text Highlighter, Morphing Scroll Navbar,
Menu Toggle Icon, Curved Menu, Animated Theme Toggler, Animated Beam, Magic Card + Glowing Effect, Border Beam,
Container Scroll Animation, 3D Marquee, Comet Card, Lamp, Timeline, Orbiting Circles, Cinematic Footer, Magic Cursor,
Magnetic, Confetti, Shooting Stars. הקרדיט לכל רכיב מופיע בראש הקובץ שמממש אותו.

## פרמטרים לבדיקה

- `?intro=1` מכריח את פתיח הניאון, `?nointro=1` מדלג עליו
- `?rm=1` מדמה reduced motion
- `?nolenis=1` גלילה רגילה בלי Lenis

## עריכות נפוצות

- **מספר הוואטסאפ וההודעה הדיפולטית:** `VM.WA_NUMBER` / `VM.WA_DEFAULT` ב-`js/core.js`. כל קישור עם `data-wa` מקבל אותם אוטומטית.
- **אפליקציה חדשה:** לשכפל `<li class="app">` ב-`#work` ולהוסיף אייקון 256px ל-`assets/apps/`.
- **צבעים:** הטוקנים בראש `css/core.css` (`[data-theme="dark"]` / `[data-theme="light"]`).
