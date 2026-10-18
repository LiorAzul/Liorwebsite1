// gradflow-bg.js — רקע גרדיאנט חי לכל האתר.
// פורט וניל (ללא React/ogl) של שיידר ה-stripe מתוך gradflow:
// https://github.com/meerbahadin/gradflow (MIT License, © Meer Bahadin)
(function () {
    'use strict';

    var CONFIG = {
        color1: { r: 255, g: 255, b: 255 },
        color2: { r: 66, g: 255, b: 233 },
        color3: { r: 129, g: 6, b: 190 },
        speed: 0.4,
        scale: 1,
        noise: 0.08
    };

    var VERTEX = [
        'attribute vec2 position;',
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = position * 0.5 + 0.5;',
        '  gl_Position = vec4(position, 0.0, 1.0);',
        '}'
    ].join('\n');

    var FRAGMENT = [
        '#ifdef GL_FRAGMENT_PRECISION_HIGH',
        '  precision highp float;',
        '#else',
        '  precision mediump float;',
        '#endif',
        'uniform float u_time;',
        'uniform vec3 u_color1;',
        'uniform vec3 u_color2;',
        'uniform vec3 u_color3;',
        'uniform float u_speed;',
        'uniform float u_scale;',
        'uniform float u_noise;',
        'uniform float u_light;',
        'uniform vec2 u_resolution;',
        'varying vec2 vUv;',
        '',
        'float noise(vec2 st) {',
        '  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);',
        '}',
        '',
        'vec3 stripeGradient(vec2 uv, float time) {',
        '  vec2 p = ((uv * u_resolution * 2.0 - u_resolution.xy) / (u_resolution.x + u_resolution.y) * 2.0) * u_scale;',
        '  float t = time * 0.7, a = 4.0 * p.y - sin(-p.x * 3.0 + p.y - t);',
        '  a = smoothstep(cos(a) * 0.7, sin(a) * 0.7 + 1.0, cos(a - 4.0 * p.y) - sin(a + 3.0 * p.x));',
        '  vec2 warped = (cos(a) * p + sin(a) * vec2(-p.y, p.x)) * 0.5 + 0.5;',
        '  vec3 color = mix(u_color1, u_color2, warped.x);',
        '  color = mix(color, u_color3, warped.y);',
        '  color *= color + 0.6 * sqrt(color);',
        '  return clamp(color, 0.0, 1.0);',
        '}',
        '',
        'void main() {',
        '  float time = u_time * u_speed;',
        '  vec3 color = stripeGradient(vUv, time);',
        '  if (u_noise > 0.001) {',
        '    float grain = noise(vUv * 200.0 + time * 0.1);',
        '    color *= (1.0 - u_noise * 0.4 + u_noise * grain * 0.4);',
        '  }',
        '  // שחור-לבן: בהירות בלבד, מכווץ לטווח כהה (דארק) או בהיר (לייט)',
        '  float lum = dot(color, vec3(0.299, 0.587, 0.114));',
        '  float shade = mix(lum * 0.42, 1.0 - (1.0 - lum) * 0.45, u_light);',
        '  gl_FragColor = vec4(vec3(shade), 1.0);',
        '}'
    ].join('\n');

    function init() {
        var canvas = document.getElementById('gradflow-canvas');
        if (!canvas) return;

        var gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            powerPreference: 'high-performance'
        }) || canvas.getContext('experimental-webgl');

        if (!gl) {
            // Fallback: גרדיאנט CSS סטטי באותם צבעים
            canvas.style.background =
                'linear-gradient(135deg, rgb(129,6,190) 0%, rgb(66,255,233) 55%, rgb(255,255,255) 100%)';
            return;
        }

        function compile(type, src) {
            var s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error('gradflow shader error:', gl.getShaderInfoLog(s));
                return null;
            }
            return s;
        }

        var vs = compile(gl.VERTEX_SHADER, VERTEX);
        var fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
        if (!vs || !fs) return;

        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.useProgram(prog);

        // Quad על כל המסך (שני משולשים)
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]), gl.STATIC_DRAW);
        var posLoc = gl.getAttribLocation(prog, 'position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        var u = {
            time: gl.getUniformLocation(prog, 'u_time'),
            color1: gl.getUniformLocation(prog, 'u_color1'),
            color2: gl.getUniformLocation(prog, 'u_color2'),
            color3: gl.getUniformLocation(prog, 'u_color3'),
            speed: gl.getUniformLocation(prog, 'u_speed'),
            scale: gl.getUniformLocation(prog, 'u_scale'),
            noise: gl.getUniformLocation(prog, 'u_noise'),
            light: gl.getUniformLocation(prog, 'u_light'),
            resolution: gl.getUniformLocation(prog, 'u_resolution')
        };

        gl.uniform3f(u.color1, CONFIG.color1.r / 255, CONFIG.color1.g / 255, CONFIG.color1.b / 255);
        gl.uniform3f(u.color2, CONFIG.color2.r / 255, CONFIG.color2.g / 255, CONFIG.color2.b / 255);
        gl.uniform3f(u.color3, CONFIG.color3.r / 255, CONFIG.color3.g / 255, CONFIG.color3.b / 255);
        gl.uniform1f(u.speed, CONFIG.speed);
        gl.uniform1f(u.scale, CONFIG.scale);
        gl.uniform1f(u.noise, CONFIG.noise);
        gl.uniform1f(u.light, document.documentElement.classList.contains('light') ? 1 : 0);

        // רזולוציה מוקטנת בכוונה — הרקע ממילא מאחורי scrim, וזה חוסך המון GPU.
        // במובייל היא נמוכה עוד קצת כדי לתת עדיפות לגלילה ולאנימציות שמעליה.
        var isMobile = window.matchMedia('(pointer: coarse), (max-width: 840px)').matches;
        var DPR = Math.min(window.devicePixelRatio || 1, 1) * (isMobile ? 0.6 : 0.75);
        var FRAME_INTERVAL = 1000 / 30; // 30fps מספיק לגרדיאנט איטי
        var start = performance.now();
        var lastTime = 0;
        var lastFrameAt = 0;
        var running = false;
        var rafId = null;
        var resizeTimer = null;
        var scrollTimer = null;
        var pausedForScroll = false;
        var pausedOffscreen = false;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function resize() {
            var w = window.innerWidth;
            // הקנבס גבוה 140vh (מכסה את ההירו + מעבר הדרגתי) — לא כל הדף
            var h = Math.round(window.innerHeight * 1.4);
            canvas.width = Math.round(w * DPR);
            canvas.height = Math.round(h * DPR);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.uniform2f(u.resolution, w, h);
        }

        // Safari ו-Chrome משנים את גובה ה-viewport בזמן גלילה במובייל.
        // דחייה קצרה מונעת הקצאה מחדש של WebGL בכל אירוע resize.
        function scheduleResize() {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(function () {
                resize();
                if (!running) renderFrame(lastTime);
            }, 180);
        }

        resize();
        window.addEventListener('resize', scheduleResize, { passive: true });

        function renderFrame(t) {
            gl.uniform1f(u.time, t);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        function loop(now) {
            if (!running) return;
            if (now - lastFrameAt >= FRAME_INTERVAL) {
                lastFrameAt = now;
                lastTime = (now - start) / 1000;
                renderFrame(lastTime);
            }
            if (running) rafId = requestAnimationFrame(loop);
        }

        function play() {
            if (running || reduceMotion || document.hidden || pausedForScroll || pausedOffscreen) return;
            running = true;
            start = performance.now() - lastTime * 1000;
            rafId = requestAnimationFrame(loop);
        }

        function pause() {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
        }

        function pauseDuringMobileScroll() {
            if (!isMobile || reduceMotion) return;
            pausedForScroll = true;
            pause();
            window.clearTimeout(scrollTimer);
            scrollTimer = window.setTimeout(function () {
                pausedForScroll = false;
                play();
            }, 220);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) pause();
            else if (!pausedForScroll) play();
        });
        window.addEventListener('scroll', pauseDuringMobileScroll, { passive: true });

        // עצירה מלאה כשההירו מחוץ למסך: השיידר ממילא מוסתר מאחורי ה-scrim
        // בהמשך הדף, אז אין טעם לרנדר — חוסך את כל ה-GPU בזמן גלילה למטה.
        var hero = document.querySelector('.hero') || document.getElementById('top');
        if (hero && 'IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                pausedOffscreen = !entries[0].isIntersecting;
                if (pausedOffscreen) pause();
                else play();
            }, { rootMargin: '80px' }).observe(hero);
        }

        // מאפשר ל-script.js לעדכן את מצב הבהירות של השיידר בהחלפת theme.
        window.GradFlowBG = {
            setLight: function (isLight) {
                gl.uniform1f(u.light, isLight ? 1 : 0);
                if (!running) renderFrame(lastTime);
            }
        };

        // reduced-motion: פריים סטטי אחד יפה במקום אנימציה
        renderFrame(reduceMotion ? 7.3 : 0);
        play();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
