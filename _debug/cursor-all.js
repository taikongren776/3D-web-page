/* Check the custom cursor across EVERY page: is the native cursor hidden
   (cursor:none) while the replacement element is absent, zero-sized, or
   covered? Reports one compact line per site.
   Usage: node _debug/cursor-all.js */
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
    this.buf = Buffer.alloc(0);
    this.handlers = { open: [], message: [] };
    const key = crypto.randomBytes(16).toString('base64');
    this.sock = net.connect(this.port, this.host, () => {
      this.sock.write(`GET ${this.path} HTTP/1.1\r\nHost: ${this.host}:${this.port}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let hs = false;
    this.sock.on('data', d => {
      this.buf = Buffer.concat([this.buf, d]);
      if (!hs) {
        const i = this.buf.indexOf('\r\n\r\n'); if (i < 0) return;
        this.buf = this.buf.slice(i + 4); hs = true;
        this.handlers.open.forEach(f => f());
      }
      for (;;) {
        if (this.buf.length < 2) return;
        const b0 = this.buf[0], b1 = this.buf[1], op = b0 & 0x0f;
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
  const r = http.request(u, { method: m || 'GET' }, x => {
    let d = ''; x.on('data', c => d += c); x.on('end', () => { try { res(JSON.parse(d)); } catch (e) { res(d); } });
  });
  r.on('error', rej); r.end();
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PROBE = `(function(){
  function box(sel){
    var n=document.querySelector(sel); if(!n) return null;
    var cs=getComputedStyle(n), r=n.getBoundingClientRect();
    return {w:Math.round(r.width),h:Math.round(r.height),
            o:cs.opacity, v:cs.visibility, d:cs.display, z:cs.zIndex,
            bg:cs.backgroundColor, bd:cs.borderTopColor, t:cs.transform};
  }
  return JSON.stringify({
    bodyCursor: getComputedStyle(document.body).cursor,
    htmlCursor: getComputedStyle(document.documentElement).cursor,
    bodyClass: document.body.className,
    htmlClass: document.documentElement.className,
    dots: document.querySelectorAll('.fx-cursor-dot').length,
    rings: document.querySelectorAll('.fx-cursor-ring').length,
    dot: box('.fx-cursor-dot'),
    ring: box('.fx-cursor-ring')
  });
})()`;

(async () => {
  const port = 9950 + Math.floor(Math.random() * 40);
  const profile = path.join(process.env.TEMP || '/tmp', 'dsh-curall-' + Date.now());
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

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function(){var t=0,seq=1,timers={};window.requestAnimationFrame=function(cb){var id=seq++;
      timers[id]=setTimeout(function(){delete timers[id];t+=16.7;try{cb(t)}catch(e){}},16);return id;};
      window.cancelAnimationFrame=function(id){clearTimeout(timers[id]);delete timers[id];};})();`
  });

  console.log('page        bodyCursor  dots rings  dot(w×h,opacity,display)      ring(w×h,opacity,bg)          verdict');
  console.log('-'.repeat(118));
  for (const [p, name] of PAGES) {
    await call('Page.navigate', { url: BASE + p });
    await sleep(2600);
    await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900, y: 400, button: 'none' });
    await sleep(400);
    const r = await call('Runtime.evaluate', { expression: PROBE, returnByValue: true });
    let d; try { d = JSON.parse(r.result.value); } catch (e) { console.log(name.padEnd(12) + ' PROBE FAILED'); continue; }
    const dot = d.dot, ring = d.ring;
    const hidden = /none/.test(d.bodyCursor);
    const okDot = dot && dot.w > 0 && dot.h > 0 && dot.o !== '0' && dot.d !== 'none' && dot.v !== 'hidden';
    const okRing = ring && ring.w > 0 && ring.h > 0 && ring.o !== '0' && ring.d !== 'none' && ring.v !== 'hidden';
    let verdict = 'OK';
    if (hidden && !okDot) verdict = '*** NATIVE HIDDEN, NO REPLACEMENT ***';
    else if (!hidden && !okDot) verdict = 'native visible, custom missing';
    else if (hidden && !okRing) verdict = 'dot ok, RING MISSING';
    console.log(
      name.padEnd(12) +
      String(d.bodyCursor).padEnd(12) +
      String(d.dots).padEnd(6) + String(d.rings).padEnd(7) +
      ((dot ? `${dot.w}x${dot.h},${dot.o},${dot.d}` : 'MISSING')).padEnd(30) +
      ((ring ? `${ring.w}x${ring.h},${ring.o},${ring.bd}` : 'MISSING')).padEnd(30) +
      verdict
    );
  }

  chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
