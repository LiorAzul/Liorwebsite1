#!/usr/bin/env node
// Headless-Chrome screenshot tool (no dependencies; Node >= 22 for global WebSocket).
//
//   node tools/shot.mjs --root . --out /tmp/shots/home --path / [--path /about/ ...] [--width 1440] [--mobile] [--tiles 6]
//        [--scheme dark|light] [--reduced-motion] [--sel '#works' [--sel '.hero']] [--wait 1800]
// VibeMagic additions: --scheme emulates prefers-color-scheme (the site follows it unless the visitor picked a theme),
// --reduced-motion emulates prefers-reduced-motion: reduce, --sel captures each matching element (first match) as
// <out>/<slug>-<w>[-scheme]/sel-<name>.png after the scroll-through. Paths may carry a query string (e.g. /?nointro=1).
//
// For every path it serves --root over a throwaway local HTTP server, loads the page in headless Chrome,
// scrolls through it (so scroll-reveal animations fire), and writes:
//   <out>/<slug>-<w>/tile-01.png ...   viewport-sized captures while scrolling (what a visitor actually sees)
//   <out>/<slug>-<w>/overview.png      whole page in one image, scaled down (layout overview)
//   <out>/<slug>-<w>/report.json       console errors, failed requests, page height, horizontal-overflow check
// --mobile = 390x844 touch viewport. --tiles N caps the number of tiles (default 8).
// report.json: errors (JS / console), failed (requests of the site itself), network (Google Fonts timeouts: noise under
// parallel load, not a page defect), overflow (horizontal-overflow offenders; boxes clipped by an in-viewport
// overflow:hidden ancestor, e.g. marquee tiles under the rail's edge, are listed as overflow.clipped), unrevealed ([data-reveal] elements the
// scroll-through did not reveal; tiles are then captured with every reveal settled to its final state).
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const opt = { root: '.', out: null, paths: [], width: 1440, mobile: false, tiles: 8, wait: 1800, scheme: null, reduced: false, sels: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--root') opt.root = args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--path') opt.paths.push(args[++i]);
  else if (a === '--width') opt.width = +args[++i];
  else if (a === '--mobile') opt.mobile = true;
  else if (a === '--tiles') opt.tiles = +args[++i];
  else if (a === '--wait') opt.wait = +args[++i];
  else if (a === '--scheme') opt.scheme = args[++i];
  else if (a === '--reduced-motion') opt.reduced = true;
  else if (a === '--sel') opt.sels.push(args[++i]);
}
if (!opt.out || !opt.paths.length) { console.error('usage: shot.mjs --out DIR --path /x/ [--path ...] [--root .] [--width 1440] [--mobile]'); process.exit(2); }
if (opt.mobile) opt.width = 390;
const VH = opt.mobile ? 844 : 900;
const ROOT = path.resolve(opt.root);

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.xml': 'application/xml', '.pdf': 'application/pdf' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { rsp.writeHead(403); return rsp.end(); }
      try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch { }
      fs.readFile(f, (err, data) => {
        if (err) { rsp.writeHead(404, { 'content-type': 'text/plain' }); return rsp.end('404'); }
        const range = req.headers.range;
        const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
        if (range && type.startsWith('video')) {
          const m = /bytes=(\d*)-(\d*)/.exec(range); const s = +m[1] || 0; const e = m[2] ? +m[2] : data.length - 1;
          rsp.writeHead(206, { 'content-type': type, 'content-range': `bytes ${s}-${e}/${data.length}`, 'accept-ranges': 'bytes', 'content-length': e - s + 1 });
          return rsp.end(data.subarray(s, e + 1));
        }
        rsp.writeHead(200, { 'content-type': type, 'content-length': data.length });
        rsp.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Chrome writes DevToolsActivePort when it is ready. Under load (several agents shooting in parallel) that can take
// far longer than a few seconds, so wait up to 90s for a non-empty port line, and retry a failed start twice.
async function launchOnce() {
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--hide-scrollbars', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--force-color-profile=srgb',
    '--enable-features=BackdropFilterSVGFilter', 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(udd, 'DevToolsActivePort');
  let port = '';
  for (let i = 0; i < 900 && !port; i++) {
    try { port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim(); } catch { }
    if (!port) await sleep(100);
  }
  if (!port) {
    proc.kill('SIGKILL');
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch { }
    throw new Error('Chrome did not start within 90s (DevToolsActivePort missing)');
  }
  return { proc, port, udd };
}
async function launch() {
  for (let attempt = 1; ; attempt++) {
    try { return await launchOnce(); }
    catch (e) { if (attempt >= 3) throw e; console.error(`chrome start failed (${e.message}), retrying…`); await sleep(2000); }
  }
}

function cdp(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const pending = new Map(); const listeners = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { const { r, j } = pending.get(m.id); pending.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); }
      else if (m.method) listeners.forEach(l => l(m));
    };
    ws.onopen = () => res({
      send: (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); }),
      on: fn => listeners.push(fn),
      close: () => ws.close(),
    });
    ws.onerror = rej;
  });
}

async function shoot(port, base, p, report) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const c = await cdp(t.webSocketDebuggerUrl);
  const errors = [], failed = [], network = [], urls = new Map();
  const FONTS = /fonts\.(googleapis|gstatic)\.com/;
  c.on(m => {
    if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const t = m.params.entry.text + ' ' + (m.params.entry.url || '');
      (FONTS.test(t) ? network : errors).push(t);
    }
    if (m.method === 'Network.loadingFailed' && !m.params.canceled) {
      const u = urls.get(m.params.requestId) || '';
      (FONTS.test(u) ? network : failed).push(m.params.errorText + (u ? ' ' + u : ''));
    }
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) failed.push(m.params.response.status + ' ' + m.params.response.url);
  });
  await c.send('Runtime.enable'); await c.send('Log.enable'); await c.send('Network.enable'); await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: opt.width, height: VH, deviceScaleFactor: 1, mobile: opt.mobile });
  if (opt.mobile) await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const media = [];
  if (opt.scheme) media.push({ name: 'prefers-color-scheme', value: opt.scheme });
  if (opt.reduced) media.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  if (media.length) await c.send('Emulation.setEmulatedMedia', { features: media });
  let loaded = false; c.on(m => { if (m.method === 'Page.loadEventFired') loaded = true; });
  await c.send('Page.navigate', { url: base + p });
  for (let i = 0; i < 150 && !loaded; i++) await sleep(100);
  await sleep(opt.wait);
  const ev = async e => (await c.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
  // scroll through to trigger reveal animations / lazy images, then back to top
  const H0 = await ev('document.documentElement.scrollHeight');
  for (let y = 0; y < H0; y += Math.round(VH * 0.6)) { await ev(`window.scrollTo({ top: ${y}, behavior: 'instant' })`); await sleep(120); }
  await ev("window.scrollTo({ top: 0, behavior: 'instant' })"); await sleep(900);
  // settle every reveal to its final state (what a reader sees once it has scrolled in): under parallel load a tile
  // captured 450ms after its scroll can otherwise catch a 1s fade mid-way and read as low contrast. Elements the
  // scroll-through never revealed are counted first (report.unrevealed) so a broken observer still shows up.
  const unrevealed = await ev("document.querySelectorAll('html.js [data-reveal]:not(.in)').length");
  await ev("document.querySelectorAll('html.js [data-reveal]').forEach(e => e.classList.add('in'))"); await sleep(1300);
  const H = Math.min(await ev('document.documentElement.scrollHeight'), 40000);
  // overflow offenders: boxes past the viewport edge that actually paint there. A box clipped by an ancestor whose
  // overflow is not visible and which itself sits inside the viewport (a marquee rail sliding tiles out under its edge)
  // cannot show past the edge: it is listed under `clipped` instead (information, not a defect).
  const overflow = await ev(`(() => { const w = document.documentElement.clientWidth; const bad = [], clipped = []; const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''); const clipper = el => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.position === 'fixed') return null; if (cs.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); return ar.left >= -2 && ar.right <= w + 2 ? a : null; } } return null; }; document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.right > w + 2 || r.left < -2) && getComputedStyle(el).position !== 'fixed') { const s = name(el) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']'; const c = clipper(el); if (c) { if (clipped.length < 12) clipped.push(s + ' in ' + name(c)); } else if (bad.length < 12) bad.push(s); } }); return { docScrollWidth: document.documentElement.scrollWidth, clientWidth: w, offenders: bad, clipped }; })()`);
  const slug = (p.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '_') || 'home') + '-' + opt.width + (opt.scheme ? '-' + opt.scheme : '') + (opt.reduced ? '-rm' : '');
  const dir = path.join(opt.out, slug); fs.mkdirSync(dir, { recursive: true });
  const n = Math.min(opt.tiles, Math.ceil(H / VH));
  for (let i = 0; i < n; i++) {
    await ev(`window.scrollTo({ top: ${i * VH}, behavior: 'instant' })`); await sleep(450);
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(dir, `tile-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'));
  }
  for (const sel of opt.sels) {
    try {
      const box = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'start', behavior: 'instant' }); return true; })()`);
      if (!box) { errors.push('sel not found: ' + sel); continue; }
      await sleep(900);
      const r = await ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
      const shot = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(opt.width, r.w), height: Math.min(r.h, 6000), scale: 1 } });
      fs.writeFileSync(path.join(dir, 'sel-' + sel.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') + '.png'), Buffer.from(shot.data, 'base64'));
    } catch (e) { errors.push('sel ' + sel + ' failed: ' + e.message); }
  }
  await ev("window.scrollTo({ top: 0, behavior: 'instant' })"); await sleep(300);
  try {
    const scale = Math.min(1, 6000 / H) * (opt.mobile ? 0.8 : 0.45);
    const ov = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: true, clip: { x: 0, y: 0, width: opt.width, height: H, scale } });
    fs.writeFileSync(path.join(dir, 'overview.jpg'), Buffer.from(ov.data, 'base64'));
  } catch (e) { errors.push('overview failed: ' + e.message); }
  const r = { path: p, width: opt.width, height: H, tiles: n, unrevealed, errors: [...new Set(errors)].slice(0, 30), failed: [...new Set(failed)].slice(0, 30), network: [...new Set(network)].slice(0, 30), overflow, dir };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(r, null, 1));
  report.push(r);
  c.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`).catch(() => { });
}

const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const { proc, port, udd } = await launch();
const report = [];
try {
  for (const p of opt.paths) {
    try { await shoot(port, base, p, report); }
    catch (e) { report.push({ path: p, fatal: e.message }); }
  }
} finally {
  proc.kill('SIGKILL'); srv.close();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch { }
}
for (const r of report) {
  if (r.fatal) { console.log(`✗ ${r.path}: ${r.fatal}`); continue; }
  const ovf = r.overflow.docScrollWidth > r.overflow.clientWidth ? ` HORIZONTAL OVERFLOW ${r.overflow.docScrollWidth}>${r.overflow.clientWidth} ${r.overflow.offenders.join(', ')}`
    : r.overflow.offenders.length ? ` | overflow offenders: ${r.overflow.offenders.join(', ')}` : '';
  console.log(`✓ ${r.path} @${r.width}: ${r.height}px, ${r.tiles} tiles -> ${r.dir}${r.errors.length ? ' | JS ERRORS: ' + r.errors.join(' || ') : ''}${r.failed.length ? ' | FAILED: ' + r.failed.join(' || ') : ''}${r.network.length ? ' | network (3rd-party fonts, not a page defect): ' + r.network.length : ''}${ovf}`);
}
process.exit(0);
