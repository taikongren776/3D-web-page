/* ==========================================================================
   shot.js — real-wall-clock screenshots + runtime diagnostics via Chrome
   DevTools Protocol (no npm dependencies: raw WebSocket over net.Socket).

   Why this exists: the first headless attempt used --virtual-time-budget,
   which fast-forwards timers but STARVES requestAnimationFrame. Only 2 frames
   ran in 2.5s, so every rAF-driven animation (scroll reveals, the 3D render
   loop, typing effects) was frozen at frame 0 and screenshots lied.

   This tool:
     1. launches Chrome with --remote-debugging-port
     2. attaches with Page.addScriptToEvaluateOnNewDocument so the rAF shim is
        installed BEFORE any page script runs
     3. waits real wall-clock time so animations actually advance
     4. captures a PNG and evaluates a diagnostic expression
     5. reports console errors / uncaught exceptions

   Usage:
     node _debug/shot.js <urlPath> <outName> [waitMs] [width] [height] [scrollY] [evalExpr]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });

if (!CHROME) { console.error('no chrome/edge found'); process.exit(1); }

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_shots');
const BASE = process.env.BASE || 'http://127.0.0.1:5178';

const [, , urlPath = '/', name = 'shot', waitMsArg = '3500', wArg = '1440', hArg = '900', scrollArg = '0', evalExpr = ''] = process.argv;
const WAIT = parseInt(waitMsArg, 10);
const W = parseInt(wArg, 10);
const H = parseInt(hArg, 10);
const SCROLL = parseInt(scrollArg, 10);

/* ------------------------------------------------------------------ *
   Minimal RFC6455 WebSocket client
   ------------------------------------------------------------------ */
class WS {
  constructor(url) {
    const m = url.match(/^ws:\/\/([^:/]+):(\d+)(\/.*)$/);
    this.host = m[1]; this.port = +m[2]; this.path = m[3];
    this.buf = Buffer.alloc(0);
    this.frag = [];
    this.handlers = { open: [], message: [], close: [] };
    this.ready = false;
    this._connect();
  }
  on(ev, fn) { this.handlers[ev].push(fn); return this; }
  _emit(ev, arg) { (this.handlers[ev] || []).forEach(f => { try { f(arg); } catch (e) { console.error(e); } }); }
  _connect() {
    const key = crypto.randomBytes(16).toString('base64');
    this.sock = net.connect(this.port, this.host, () => {
      this.sock.write(
        `GET ${this.path} HTTP/1.1\r\n` +
        `Host: ${this.host}:${this.port}\r\n` +
        'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    let handshake = false;
    this.sock.on('data', (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      if (!handshake) {
        const idx = this.buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        const head = this.buf.slice(0, idx).toString();
        if (!/ 101 /.test(head.split('\r\n')[0])) {
          console.error('websocket handshake failed:', head.split('\r\n')[0]);
          process.exit(1);
        }
        this.buf = this.buf.slice(idx + 4);
        handshake = true;
        this.ready = true;
        this._emit('open');
      }
      this._read();
    });
    this.sock.on('error', (e) => { console.error('ws error:', e.message); });
  }
  _read() {
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      let mask = null;
      if (masked) { if (this.buf.length < off + 4) return; mask = this.buf.slice(off, off + 4); off += 4; }
      if (this.buf.length < off + len) return;
      let payload = this.buf.slice(off, off + len);
      if (mask) { payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]; }
      this.buf = this.buf.slice(off + len);
      if (opcode === 0x8) { this.handlers.close.forEach(f => f()); return; }
      if (opcode === 0x9) { this._send(payload, 0xA); continue; }
      if (opcode === 0xA) continue;
      this.frag.push(payload);
      if (b0 & 0x80) {
        const full = Buffer.concat(this.frag).toString('utf8');
        this.frag = [];
        this.handlers.message.forEach(f => f(full));
      }
    }
  }
  _send(data, opcode = 0x1) {
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    const mask = crypto.randomBytes(4);
    const masked = Buffer.from(payload);
    for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
    let header;
    if (payload.length < 126) header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
    else if (payload.length < 65536) {
      header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    this.sock.write(Buffer.concat([header, mask, masked]));
  }
  send(obj) { this._send(JSON.stringify(obj)); }
  close() { try { this.sock.end(); } catch (e) { } }
}

/* ------------------------------------------------------------------ *
   CDP session
   ------------------------------------------------------------------ */
function getJSON(url, method) {
  return new Promise((res, rej) => {
    const req = http.request(url, { method: method || 'GET' }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { res(d); } });
    });
    req.on('error', rej);
    req.end();
  });
}

/** Chrome returns either a bare array or {value:[...]} depending on version. */
function asList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.value)) return payload.value;
  return [];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = path.join(process.env.TEMP || '/tmp', 'dsh-cdp-' + Date.now());
  const port = 9500 + Math.floor(Math.random() * 400);

  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--disable-extensions', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--mute-audio', '--force-device-scale-factor=1',
    '--user-data-dir=' + profile,
    '--window-size=' + W + ',' + H,
    '--remote-debugging-port=' + port,
    'about:blank'
  ], { stdio: 'ignore' });

  process.on('exit', () => {
    try { chrome.kill(); } catch (e) { }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { }
  });

  // wait for the debugging endpoint
  let version = null;
  for (let i = 0; i < 60; i++) {
    try { version = await getJSON(`http://127.0.0.1:${port}/json/version`); break; }
    catch (e) { await sleep(250); }
  }
  if (!version) { console.error('chrome did not expose a debugging port'); process.exit(1); }

  // create a fresh page target; Chrome requires PUT on /json/new
  let targetInfo = null;
  try {
    const created = await getJSON(`http://127.0.0.1:${port}/json/new?about:blank`, 'PUT');
    targetInfo = Array.isArray(created) ? created[0] : created;
  } catch (e) { /* fall through to the list */ }

  if (!targetInfo || !targetInfo.webSocketDebuggerUrl) {
    for (let i = 0; i < 20 && !targetInfo; i++) {
      const list = asList(await getJSON(`http://127.0.0.1:${port}/json/list`));
      targetInfo = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (!targetInfo) await sleep(250);
    }
  }
  if (!targetInfo || !targetInfo.webSocketDebuggerUrl) {
    console.error('no debuggable page target found');
    process.exit(1);
  }
  const ws = new WS(targetInfo.webSocketDebuggerUrl);
  if (!ws.ready) await new Promise(r => ws.on('open', r));

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.on('message', (txt) => {
    let msg; try { msg = JSON.parse(txt); } catch (e) { return; }
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  });
  const call = (method, params) => new Promise((res, rej) => {
    const myId = ++id;
    pending.set(myId, (m) => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result));
    ws.send({ id: myId, method, params: params || {} });
    setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); rej(new Error(method + ' timed out')); } }, 30000);
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Log.enable');

  // install the rAF shim BEFORE any page script runs
  const shim = `(function(){
    var t=0, seq=1, timers={};
    window.__rafShim = true;
    var realRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = function(cb){
      window.__diag.rafCount++;
      var id = seq++;
      timers[id] = setTimeout(function(){ delete timers[id]; t += 16.7;
        try { cb(t); } catch(e){ window.__diag.errors.push('raf: '+(e && e.message)); } }, 16);
      return id;
    };
    window.cancelAnimationFrame = function(id){ clearTimeout(timers[id]); delete timers[id]; };
    window.__diag = { rafCount: 0, errors: [] };
    window.addEventListener('error', function(e){ window.__diag.errors.push('error: '+e.message); });
    window.addEventListener('unhandledrejection', function(e){ window.__diag.errors.push('rejection: '+e.reason); });
    var oe = console.error;
    console.error = function(){ window.__diag.errors.push('console.error: '+Array.prototype.slice.call(arguments).map(String).join(' ')); oe.apply(console, arguments); };
  })();`;
  await call('Page.addScriptToEvaluateOnNewDocument', { source: shim });

  const url = BASE + urlPath;
  await call('Page.navigate', { url });

  // wait for load, then the requested real time
  const t0 = Date.now();
  let loaded = false;
  while (Date.now() - t0 < 15000) {
    await sleep(200);
    if (events.some(e => e.method === 'Page.loadEventFired')) { loaded = true; break; }
  }
  await sleep(WAIT - (Date.now() - t0) > 0 ? WAIT - (Date.now() - t0) : 200);

  if (SCROLL) {
    await call('Runtime.evaluate', { expression: `window.scrollTo(0,${SCROLL}); 'scrolled'`, awaitPromise: false });
    await sleep(1200);
  }

  // diagnostics
  const diagExpr = evalExpr || `(function(){
    var d = window.__diag || {rafCount:-1, errors:['no diag']};
    function st(sel){
      var n = document.querySelector(sel);
      if(!n) return sel+' MISSING';
      var cs = getComputedStyle(n);
      return sel+' opacity='+cs.opacity+' vis='+cs.visibility+' transform='+(cs.transform==='none'?'none':'set');
    }
    var revealed = document.querySelectorAll('[data-reveal]').length;
    var revealedOK = document.querySelectorAll('[data-reveal].is-revealed, [data-reveal][style*="opacity: 1"]').length;
    var out = {
      loaded: document.readyState,
      rafCount: d.rafCount,
      errors: d.errors.slice(0,8),
      errorCount: d.errors.length,
      revealTotal: revealed,
      revealActivated: revealedOK,
      canvases: Array.prototype.map.call(document.querySelectorAll('canvas'), function(c){
        // is the canvas actually painted (any non-transparent pixel)?
        try {
          var ctx = c.getContext('2d');
          var w = c.width, h = c.height;
          var data = ctx.getImageData(0,0,Math.min(w,400),Math.min(h,300)).data;
          var painted = 0;
          for (var i=3;i<data.length;i+=4*37) if (data[i] > 8) painted++;
          return (c.id||'canvas')+' '+w+'x'+h+' painted='+painted;
        } catch(e){ return (c.id||'canvas')+' ERR '+e.message; }
      }),
      probe: [st('h1'), st('.hero-title'), st('.title'), st('.display')].filter(function(s){return s.indexOf('MISSING')<0;}),
      scrollHeight: document.documentElement.scrollHeight,
      bodyBg: getComputedStyle(document.body).backgroundColor
    };
    return JSON.stringify(out, null, 1);
  })()`;

  let diag = '(no diag)';
  try {
    const r = await call('Runtime.evaluate', { expression: diagExpr, returnByValue: true });
    diag = r.result && r.result.value ? r.result.value : JSON.stringify(r.result);
  } catch (e) { diag = 'eval failed: ' + e.message; }

  // console errors captured by CDP
  const cdpLogs = events.filter(e => e.method === 'Log.entryAdded').map(e => e.params.entry.level + ': ' + e.params.entry.text);
  const exceptions = events.filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception || {}).description);

  const shot = await call('Page.captureScreenshot', { format: 'png' });
  const outPng = path.join(OUT, name + '.png');
  fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));

  const txt = [
    'URL: ' + url,
    'runtime: loaded=' + loaded + '  wait=' + WAIT + 'ms  scroll=' + SCROLL,
    '',
    '--- page diagnostics ---',
    diag,
    '',
    '--- CDP console (' + cdpLogs.length + ') ---',
    cdpLogs.slice(0, 20).join('\n') || '(none)',
    '',
    '--- uncaught exceptions (' + exceptions.length + ') ---',
    exceptions.slice(0, 10).join('\n') || '(none)'
  ].join('\n');
  fs.writeFileSync(path.join(OUT, name + '.txt'), txt, 'utf8');

  console.log(txt);
  console.log('\nscreenshot -> ' + outPng + ' (' + fs.statSync(outPng).size + ' bytes)');

  ws.close();
  chrome.kill();
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
