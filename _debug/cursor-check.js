/* Diagnose the custom-cursor component: is the native cursor hidden while the
   replacement is missing, mispositioned, or overridden?
   Usage: node _debug/cursor-check.js <urlPath> [label] */
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
const urlPath = process.argv[2] || '/sites/02-nexus-terminal/';
const label = process.argv[3] || 'cursor';
const W = 1440, H = 900;

/* ---- minimal WS (same as shot.js) ---- */
class WS {
  constructor(url) {
    const m = url.match(/^ws:\/\/([^:/]+):(\d+)(\/.*)$/);
    this.host = m[1]; this.port = +m[2]; this.path = m[3];
    this.buf = Buffer.alloc(0); this.frag = [];
    this.handlers = { open: [], message: [], close: [] };
    const key = crypto.randomBytes(16).toString('base64');
    this.sock = net.connect(this.port, this.host, () => {
      this.sock.write(`GET ${this.path} HTTP/1.1\r\nHost: ${this.host}:${this.port}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\n` +
        'Sec-WebSocket-Version: 13\r\n\r\n');
    });
    let hs = false;
    this.sock.on('data', d => {
      this.buf = Buffer.concat([this.buf, d]);
      if (!hs) {
        const i = this.buf.indexOf('\r\n\r\n');
        if (i < 0) return;
        this.buf = this.buf.slice(i + 4); hs = true;
        this.handlers.open.forEach(f => f());
      }
      for (;;) {
        if (this.buf.length < 2) return;
        const b0 = this.buf[0], b1 = this.buf[1];
        const op = b0 & 0x0f;
        let len = b1 & 0x7f, off = 2;
        if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
        if (b1 & 0x80) off += 4;
        if (this.buf.length < off + len) return;
        const pl = this.buf.slice(off, off + len);
        this.buf = this.buf.slice(off + len);
        if (op === 1) this.handlers.message.forEach(f => f(pl.toString('utf8')));
      }
    });
  }
  on(e, f) { this.handlers[e].push(f); return this; }
  send(o) {
    const payload = Buffer.from(JSON.stringify(o), 'utf8');
    const mask = crypto.randomBytes(4);
    const masked = Buffer.from(payload);
    for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
    let head;
    if (payload.length < 126) head = Buffer.from([0x81, 0x80 | payload.length]);
    else { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0x80 | 126; head.writeUInt16BE(payload.length, 2); }
    this.sock.write(Buffer.concat([head, mask, masked]));
  }
}

const get = (u, m) => new Promise((res, rej) => {
  const r = http.request(u, { method: m || 'GET' }, x => {
    let d = ''; x.on('data', c => d += c); x.on('end', () => { try { res(JSON.parse(d)); } catch (e) { res(d); } });
  });
  r.on('error', rej); r.end();
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const port = 9900 + Math.floor(Math.random() * 90);
  const profile = path.join(process.env.TEMP || '/tmp', 'dsh-cur-' + Date.now());
  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--disable-extensions',
    '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--mute-audio', '--user-data-dir=' + profile, `--window-size=${W},${H}`,
    '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = await get(`http://127.0.0.1:${port}/json/version`); } catch (e) { await sleep(250); } }
  let list = await get(`http://127.0.0.1:${port}/json/list`);
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

  // rAF shim (same reason as shot.js: headless starves rAF)
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function(){var t=0,seq=1,timers={};window.requestAnimationFrame=function(cb){var id=seq++;
      timers[id]=setTimeout(function(){delete timers[id];t+=16.7;try{cb(t)}catch(e){}},16);return id;};
      window.cancelAnimationFrame=function(id){clearTimeout(timers[id]);delete timers[id];};})();`
  });

  await call('Page.navigate', { url: BASE + urlPath });
  await sleep(4000);

  const probe = `(function(){
    function info(sel){
      var n = document.querySelector(sel);
      if(!n) return { sel:sel, exists:false };
      var cs = getComputedStyle(n);
      var r = n.getBoundingClientRect();
      return { sel:sel, exists:true,
        rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
        opacity:cs.opacity, visibility:cs.visibility, display:cs.display,
        transform:cs.transform, top:cs.top, left:cs.left,
        zIndex:cs.zIndex, position:cs.position, bg:cs.backgroundColor,
        borderColor:cs.borderTopColor, mixBlend:cs.mixBlendMode,
        inlineTransform: n.style.transform, inlineOpacity: n.style.opacity };
    }
    var html = getComputedStyle(document.documentElement);
    var body = getComputedStyle(document.body);
    return JSON.stringify({
      htmlCursor: html.cursor,
      bodyCursor: body.cursor,
      htmlHasClass: document.documentElement.className,
      bodyHasClass: document.body.className,
      dot: info('.fx-cursor-dot'),
      ring: info('.fx-cursor-ring'),
      dotCount: document.querySelectorAll('.fx-cursor-dot').length,
      ringCount: document.querySelectorAll('.fx-cursor-ring').length
    }, null, 1);
  })()`;

  const r1 = await call('Runtime.evaluate', { expression: probe, returnByValue: true });
  console.log('=== ' + label + ' — BEFORE any pointer event ===');
  console.log(r1.result.value);

  // now simulate a real pointer move and re-check
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 450, button: 'none' });
  await sleep(600);
  const r2 = await call('Runtime.evaluate', { expression: probe, returnByValue: true });
  console.log('\n=== after moving the pointer to (700,450) ===');
  console.log(r2.result.value);

  await call('Page.captureScreenshot', { format: 'png' });
  chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
