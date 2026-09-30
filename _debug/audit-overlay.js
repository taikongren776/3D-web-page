/* Click-blocker audit: sample a grid of points in every page and report any
   point where the element under the pointer is a full-viewport overlay with a
   higher z-index than the content — i.e. an invisible sheet eating clicks.
   Usage: node _debug/audit-overlay.js */
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });

const BASE = process.env.BASE || 'http://127.0.0.1:5178';
const PAGES = [
  ['/', 'landing'],
  ['/sites/01-aurora-glass/', 'aurora'],
  ['/sites/02-nexus-terminal/', 'nexus'],
  ['/sites/03-miami-vapor/', 'miami'],
  ['/sites/04-monolith-swiss/', 'monolith'],
  ['/sites/05-kinetic-particle/', 'kinetic']
];

class WS {
  constructor(url) {
    const m = url.match(/^ws:\/\/([^:/]+):(\d+)(\/.*)$/);
    this.host = m[1]; this.port = +m[2]; this.path = m[3];
    this.buf = Buffer.alloc(0); this.handlers = { open: [], message: [] };
    const key = crypto.randomBytes(16).toString('base64');
    this.sock = net.connect(this.port, this.host, () => {
      this.sock.write(`GET ${this.path} HTTP/1.1\r\nHost: ${this.host}:${this.port}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let hs = false;
    this.sock.on('data', d => {
      this.buf = Buffer.concat([this.buf, d]);
      if (!hs) { const i = this.buf.indexOf('\r\n\r\n'); if (i < 0) return; this.buf = this.buf.slice(i + 4); hs = true; this.handlers.open.forEach(f => f()); }
      for (;;) {
        if (this.buf.length < 2) return;
        const b1 = this.buf[1], op = this.buf[0] & 0x0f;
        let len = b1 & 0x7f, off = 2;
        if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
        if (b1 & 0x80) off += 4;
        if (this.buf.length < off + len) return;
        const pl = this.buf.slice(off, off + len); this.buf = this.buf.slice(off + len);
        if (op === 1) this.handlers.message.forEach(f => f(pl.toString('utf8')));
      }
    });
  }
  on(e, f) { this.handlers[e].push(f); return this; }
  send(o) {
    const p = Buffer.from(JSON.stringify(o), 'utf8');
    const mask = crypto.randomBytes(4); const m = Buffer.from(p);
    for (let i = 0; i < m.length; i++) m[i] ^= mask[i % 4];
    let h; if (p.length < 126) h = Buffer.from([0x81, 0x80 | p.length]);
    else { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 0x80 | 126; h.writeUInt16BE(p.length, 2); }
    this.sock.write(Buffer.concat([h, mask, m]));
  }
}
const get = (u, m) => new Promise((res, rej) => {
  const r = http.request(u, { method: m || 'GET' }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => { try { res(JSON.parse(d)); } catch (e) { res(d); } }); });
  r.on('error', rej); r.end();
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PROBE = `(function(){
  var w = innerWidth, h = innerHeight;
  var overlays = {};
  for (var gy = 1; gy <= 7; gy++) {
    for (var gx = 1; gx <= 9; gx++) {
      var x = Math.round(w * gx / 10), y = Math.round(h * gy / 8);
      var stack = document.elementsFromPoint(x, y);
      // the topmost element that is NOT one of our own decorations
      var top = stack[0];
      if (!top) continue;
      var cs = getComputedStyle(top);
      var pe = cs.pointerEvents;
      var key = top.tagName + '.' + (top.className || '').toString().split(' ')[0] + '|pe=' + pe;
      if (pe === 'none') continue;                 // harmless: clicks pass through
      var r = top.getBoundingClientRect();
      var fullViewport = r.width >= w * 0.9 && r.height >= h * 0.5;
      if (fullViewport) {
        overlays[key] = (overlays[key] || 0) + 1;
      }
    }
  }
  // also: is any element covering a known CTA?
  var cta = document.querySelector('a.btn, button.btn, .btn, .dicon, .tab-btn');
  var ctaHit = null;
  if (cta) {
    var cr = cta.getBoundingClientRect();
    if (cr.width > 0) {
      var cx = Math.round(cr.left + cr.width/2), cy = Math.round(cr.top + cr.height/2);
      var el = document.elementFromPoint(cx, cy);
      var inside = el && (el === cta || cta.contains(el) || (el.closest && el.closest('.btn,.dicon,.tab-btn') === cta));
      ctaHit = { label: cta.textContent.trim().slice(0,18), reachable: !!inside, hitEl: el ? el.tagName + '.' + (el.className||'').toString().split(' ')[0] : null };
    }
  }
  return JSON.stringify({ clickBlockingFullViewportOverlays: overlays, firstCta: ctaHit });
})()`;

(async () => {
  const port = 9600 + Math.floor(Math.random() * 60);
  const profile = path.join(process.env.TEMP || '/tmp', 'dsh-ovl-' + Date.now());
  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--disable-extensions',
    '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--mute-audio', '--user-data-dir=' + profile, '--window-size=1440,900',
    '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = await get(`http://127.0.0.1:${port}/json/version`); } catch (e) { await sleep(250); } }
  const list = await get(`http://127.0.0.1:${port}/json/list`);
  const arr = Array.isArray(list) ? list : (list.value || []);
  const t = arr.find(x => x.type === 'page');
  const ws = new WS(t.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  let id = 0; const pend = new Map();
  ws.on('message', txt => { const m = JSON.parse(txt); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const call = (method, params) => new Promise((res, rej) => {
    const i = ++id;
    pend.set(i, m => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result));
    ws.send({ id: i, method, params: params || {} });
    setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error(method + ' timeout')); } }, 20000);
  });
  await call('Page.enable'); await call('Runtime.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function(){var t=0,seq=1,timers={};window.requestAnimationFrame=function(cb){var id=seq++;
      timers[id]=setTimeout(function(){delete timers[id];t+=16.7;try{cb(t)}catch(e){}},16);return id;};
      window.cancelAnimationFrame=function(id){clearTimeout(timers[id]);delete timers[id];};})();`
  });

  for (const [p, name] of PAGES) {
    await call('Page.navigate', { url: BASE + p });
    await sleep(2800);
    const r = await call('Runtime.evaluate', { expression: PROBE, returnByValue: true });
    let d; try { d = JSON.parse(r.result.value); } catch (e) { console.log(name.padEnd(11) + ' PROBE FAILED'); continue; }
    const ov = Object.keys(d.clickBlockingFullViewportOverlays || {});
    const cta = d.firstCta;
    const bad = ov.length > 0;
    const ctaBad = cta && cta.reachable === false;
    console.log(name.padEnd(11) +
      (bad ? 'OVERLAY-BLOCKED: ' + ov.join(', ') : 'no click-blocking overlay').padEnd(46) +
      ' | first CTA: ' + (cta ? (cta.reachable ? 'reachable (' + cta.label + ')' : '*** UNREACHABLE (' + cta.label + ') hit=' + cta.hitEl + ' ***') : 'none'));
  }

  chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
