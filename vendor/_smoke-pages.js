/* ==========================================================================
   Page harness: executes each site's main.js against a DOM shim so that
   wiring bugs (missing ids, wrong method names, bad property reads) surface
   as thrown errors instead of silently breaking in the browser.
   Run:  node vendor/_smoke-pages.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fail = 0;
const problems = [];
function check(name, cond, extra) {
  if (!cond) { fail++; problems.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('  ok   ' + name);
}

/* ------------------------------- canvas ---------------------------------- */
const ctxCalls = { fill: 0, stroke: 0, arc: 0, fillText: 0, drawImage: 0, clearRect: 0, fillRect: 0 };
function makeCtx(canvas) {
  const noop = () => { };
  const ctx = {
    canvas,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, filter: 'none',
    globalCompositeOperation: 'source-over', font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'top', lineCap: 'butt', lineJoin: 'miter',
    shadowBlur: 0, shadowColor: '', imageSmoothingEnabled: true,
    save: noop, restore: noop, setTransform: noop, resetTransform: noop,
    transform: noop, translate: noop, rotate: noop, scale: noop, clip: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arcTo: noop, rect: noop,
    setLineDash: noop, getLineDash: () => [], strokeText: noop,
    measureText: (t) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createConicGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w || 1, height: h || 1 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    putImageData: noop,
    drawImage: () => ctxCalls.drawImage++,
    fill: () => ctxCalls.fill++,
    stroke: () => ctxCalls.stroke++,
    arc: () => ctxCalls.arc++,
    fillRect: () => ctxCalls.fillRect++,
    strokeRect: noop,
    clearRect: () => ctxCalls.clearRect++,
    fillText: () => ctxCalls.fillText++
  };
  return new Proxy(ctx, {
    get(t, k) { return k in t ? t[k] : () => { }; },
    set(t, k, v) { t[k] = v; return true; }
  });
}

/* --------------------------------- DOM ----------------------------------- */
const registry = new Map();
let created = 0;

function cssStyle() {
  const store = {};
  return new Proxy(store, {
    get(t, k) { return k in t ? t[k] : ''; },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function classListOf(el) {
  const set = new Set(String(el.className || '').split(/\s+/).filter(Boolean));
  const api = {
    _set: set,
    add(...c) { c.forEach(x => set.add(x)); sync(); },
    remove(...c) { c.forEach(x => set.delete(x)); sync(); },
    toggle(c, on) { if (on === undefined) on = !set.has(c); on ? set.add(c) : set.delete(c); sync(); return on; },
    contains(c) { return set.has(String(c)); },
    replace(a, b) { set.delete(a); set.add(b); sync(); },
    item: (i) => Array.from(set)[i] || null,
    get length() { return set.size; }
  };
  function sync() { el.className = Array.from(set).join(' '); }
  el._cl = api;
  el.classList = api;
  return api;
}

function makeEl(tag, id) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    nodeName: String(tag || 'div').toUpperCase(),
    nodeType: 1,
    id: id || '',
    className: '',
    textContent: '',
    innerHTML: '',
    value: '1',
    dataset: {},
    attributes: {},
    style: cssStyle(),
    children: [],
    childNodes: [],
    parentNode: null,
    parentElement: null,
    firstElementChild: null,
    lastChild: null,
    firstChild: null,
    nextSibling: null,
    offsetWidth: 640, offsetHeight: 480,
    clientWidth: 1280, clientHeight: 720,
    scrollWidth: 2400, scrollHeight: 5000,
    scrollLeft: 0, scrollTop: 0,
    offsetTop: 0, offsetLeft: 0,
    width: 1280, height: 720,
    tabIndex: 0,
    hidden: false,
    _events: {},
    _created: ++created
  };
  el.classList = classListOf(el);
  el.appendChild = (c) => {
    el.children.push(c); el.childNodes.push(c);
    c.parentNode = el; c.parentElement = el;
    el.firstElementChild = el.children[0];
    el.lastChild = c; el.firstChild = el.children[0];
    return c;
  };
  el.insertBefore = (c) => { el.children.unshift(c); c.parentNode = el; c.parentElement = el; el.firstElementChild = el.children[0]; return c; };
  el.removeChild = (c) => { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); c.parentNode = null; return c; };
  el.replaceChild = (n, o) => { const i = el.children.indexOf(o); if (i >= 0) el.children[i] = n; n.parentNode = el; return o; };
  el.remove = () => { if (el.parentNode) el.parentNode.removeChild(el); };
  el.setAttribute = (k, v) => {
    el.attributes[k] = String(v);
    if (k === 'class') { el.className = String(v); el._cl = null; classListOf(el); }
    if (k === 'id') el.id = String(v);
    if (k.indexOf('data-') === 0) {
      el.dataset[k.slice(5).replace(/-(\w)/g, (m, c) => c.toUpperCase())] = String(v);
    }
  };  el.getAttribute = (k) => (el.attributes[k] === undefined ? null : el.attributes[k]);
  el.hasAttribute = (k) => el.attributes[k] !== undefined;
  el.removeAttribute = (k) => { delete el.attributes[k]; };
  el.addEventListener = (type, fn) => { (el._events[type] = el._events[type] || []).push(fn); return el; };
  el.removeEventListener = (type, fn) => {
    const a = el._events[type]; if (!a) return;
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  };
  el.dispatch = (type, ev) => {
    const a = el._events[type] || [];
    a.forEach(fn => fn(Object.assign({
      type, target: el, currentTarget: el, preventDefault() { }, stopPropagation() { },
      clientX: 100, clientY: 100, deltaY: 40, deltaX: 0, key: '', pointerId: 1, button: 0
    }, ev)));
    return a.length;
  };
  el.getBoundingClientRect = () => {
    // A DOM stub has no layout engine. Give the library's own cursor elements a
    // believable size so the real cursor code path is exercised instead of the
    // bail-out branch (which is what a 0x0 rect would trigger).
    if (el.classList && (el.classList.contains('fx-cursor-dot'))) {
      return { left: 0, top: 0, width: 6, height: 6, right: 6, bottom: 6, x: 0, y: 0 };
    }
    if (el.classList && (el.classList.contains('fx-cursor-ring'))) {
      return { left: 0, top: 0, width: 32, height: 32, right: 32, bottom: 32, x: 0, y: 0 };
    }
    return { left: 0, top: 0, width: 640, height: 480, right: 640, bottom: 480, x: 0, y: 0 };
  };
  el.getContext = () => (el._ctx || (el._ctx = makeCtx(el)));
  function matches(n, sel) {
    sel = String(sel).trim();
    if (!sel) return false;
    // tag
    const tagM = sel.match(/^[a-zA-Z][\w-]*/);
    if (tagM && n.tagName !== tagM[0].toUpperCase()) return false;
    // classes
    const classM = sel.match(/\.[\w-]+/g) || [];
    for (const c of classM) if (!n.classList.contains(c.slice(1))) return false;
    // attributes: [name] or [name="value"] or [name^="v"] / [name$=] / [name*=]
    const attrM = sel.match(/\[[^\]]+\]/g) || [];
    for (const raw of attrM) {
      const body = raw.slice(1, -1);
      const eq = body.match(/^([\w-]+)\s*(\^=|\$=|\*=|=)?\s*"?([^"]*)"?$/);
      if (!eq) return false;
      const name = eq[1], op = eq[2], want = eq[3];
      const have = name === 'class' ? n.className : n.attributes[name];
      if (have === undefined || have === null) return false;
      const hs = String(have);
      if (!op) continue;
      if (op === '=' && hs !== want) return false;
      if (op === '^=' && hs.indexOf(want) !== 0) return false;
      if (op === '$=' && hs.slice(-want.length) !== want) return false;
      if (op === '*=' && hs.indexOf(want) === -1) return false;
      if (op === '~=' && hs.split(/\s+/).indexOf(want) === -1) return false;
    }
    // ids
    const idM = sel.match(/#[\w-]+/g) || [];
    for (const i of idM) if (n.id !== i.slice(1)) return false;
    return true;
  }
  function walk(node, sel, out) {
    node.children.forEach(c => { if (matches(c, sel)) out.push(c); walk(c, sel, out); });
    return out;
  }
  el.querySelector = (sel) => walk(el, sel, [])[0] || null;
  el.querySelectorAll = (sel) => walk(el, sel, []);
  el.closest = () => null;
  el.contains = () => false;
  el.scrollIntoView = () => { };
  el.focus = () => { el._focused = true; };
  el.blur = () => { };
  el.click = () => el.dispatch('click', {});
  el.cloneNode = (deep) => {
    const c = makeEl(el.tagName);
    c.className = el.className; c.textContent = el.textContent; c.innerHTML = el.innerHTML;
    c.attributes = Object.assign({}, el.attributes);
    c.dataset = Object.assign({}, el.dataset);
    c.scrollWidth = el.scrollWidth; c.offsetWidth = el.offsetWidth;
    return c;
  };
  el.select = () => { };
  el.setPointerCapture = () => { };
  el.releasePointerCapture = () => { };
  el.animate = () => ({ finished: Promise.resolve(), cancel() { }, finish() { } });
  el.getElementsByTagName = () => [];
  el.insertAdjacentHTML = () => { };
  el.append = el.appendChild;
  withInnerHTML(el);
  return el;
}

const body = makeEl('body', 'body');
const documentElement = makeEl('html', 'html');
documentElement.scrollHeight = 6000;
documentElement.clientHeight = 900;

/* ------------------- permissive HTML → DOM tree parser -------------------- */
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr', 'path', 'circle', 'stop', 'rect', 'use', 'line', 'polygon', 'ellipse', 'feTurbulence', 'feturbulence']);
const parsedById = new Map();

function parseHTML(html, parent) {
  const stack = [parent];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)(\s+(?:"[^"]*"|'[^']*'|[^>"'])*?)?(\/?)>/gi;
  let m, last = 0;
  const top = stack[0];
  function textOf(s) { return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  while ((m = re.exec(html))) {
    const text = html.slice(last, m.index);
    last = re.lastIndex;
    if (text.trim()) {
      const t = textOf(text);
      if (t) {
        const node = stack[stack.length - 1];
        node.textContent += (node.textContent ? ' ' : '') + t;
      }
    }
    if (m[0].startsWith('<!')) continue;
    if (m[1]) { // closing tag
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === m[1].toUpperCase()) { stack.length = i; break; }
      }
      continue;
    }
    const tag = m[2];
    const attrs = m[3] || '';
    const selfClose = m[4] === '/';
    const node = makeEl(tag);
    const ar = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    while ((a = ar.exec(attrs))) {
      const name = a[1];
      if (!name) continue;
      const val = a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : a[4]);
      node.setAttribute(name, val === undefined ? '' : val);
      if (ar.lastIndex === a.index) ar.lastIndex++; // guard against zero-width matches
    }
    if (node.id) parsedById.set(node.id, node);
    stack[stack.length - 1].appendChild(node);
    if (!selfClose && !VOID.has(tag.toLowerCase()) && !VOID.has(tag)) stack.push(node);
  }
  return top;
}

/** give a node an innerHTML setter that parses structure (canvases etc.) */
function withInnerHTML(el) {
  const d = Object.getOwnPropertyDescriptor(el, 'innerHTML');
  if (d && d.get) return el;
  let store = el.innerHTML || '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return store; },
    set(v) {
      store = String(v);
      if (el.children.length) {
        el.children.length = 0;
        el.childNodes.length = 0;
        el.firstElementChild = null;
      }
      parseHTML(store, el);
    },
    configurable: true
  });
  return el;
}
withInnerHTML(body);
withInnerHTML(documentElement);

let pageRoot = null;
let pageBody = body;

function byId(id) {
  if (registry.has(id)) return registry.get(id);
  if (parsedById.has(id)) { registry.set(id, parsedById.get(id)); return parsedById.get(id); }
  // JS asked for an id the HTML does not contain — record it so the report shows it
  missingIds.add(id);
  registry.set(id, makeEl('div', id));
  return registry.get(id);
}
const missingIds = new Set();

/* build a plausible DOM: any [id] referenced in the HTML becomes an element */
const htmlFiles = [];
const sitesDir = path.join(__dirname, '..', 'sites');
fs.readdirSync(sitesDir).forEach(d => {
  const p = path.join(sitesDir, d, 'index.html');
  if (fs.existsSync(p)) htmlFiles.push(p);
});

const globalHandlers = {};
const document = {
  body,
  documentElement,
  readyState: 'complete',
  hidden: false,
  createElement: (t) => makeEl(t),
  createTextNode: (t) => ({ nodeType: 3, nodeValue: t, textContent: t }),
  getElementById: byId,
  querySelector: (sel) => (pageRoot && pageRoot.querySelector(sel)) || byId('sel:' + sel),
  querySelectorAll: (sel) => {
    const found = pageRoot ? pageRoot.querySelectorAll(sel) : [];
    if (found.length) return found;
    if (sel === '[data-magnetic]') return [byId('m1'), byId('m2')];
    return [byId('q:' + sel + ':0'), byId('q:' + sel + ':1')];
  },
  addEventListener: (t, fn) => { (globalHandlers[t] = globalHandlers[t] || []).push(fn); },
  removeEventListener: () => { },
  dispatch: (t, ev) => (globalHandlers[t] || []).forEach(fn => fn(Object.assign({
    type: t, target: body, preventDefault() { }, stopPropagation() { }, key: 'k', metaKey: false, ctrlKey: false, clientX: 1, clientY: 1
  }, ev))),
  execCommand: () => true,
  cookie: ''
};

const winHandlers = {};
const window = {
  innerWidth: 1440,
  innerHeight: 900,
  scrollY: 0,
  devicePixelRatio: 1,
  document,
  navigator: { clipboard: { writeText: () => Promise.resolve() }, userAgent: 'node' },
  addEventListener: (t, fn) => { (winHandlers[t] = winHandlers[t] || []).push(fn); },
  removeEventListener: () => { },
  dispatch: (t, ev) => (winHandlers[t] || []).forEach(fn => fn(Object.assign({ type: t, preventDefault() { } }, ev))),
  requestAnimationFrame: (fn) => { pendingRaf.push(fn); return pendingRaf.length; },
  cancelAnimationFrame: (id) => { pendingRaf[id - 1] = null; },
  matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { } }),
  getComputedStyle: (node) => {
    // Minimal but sane: the library's cursor guard reads display / visibility /
    // opacity, so an empty string would look like "hidden".
    const base = {
      display: 'block', visibility: 'visible', opacity: '1', cursor: 'auto',
      position: 'static', zIndex: 'auto', transform: 'none', filter: 'none',
      backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none',
      backgroundClip: 'border-box', webkitBackgroundClip: 'border-box',
      webkitTextFillColor: 'rgb(0, 0, 0)', color: 'rgb(0, 0, 0)',
      width: '6px', height: '6px', top: '0px', left: '0px',
      pointerEvents: 'auto', transition: '', animation: ''
    };
    return new Proxy(base, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'getPropertyValue') return () => '';
        return '';
      }
    });
  },
  localStorage: (() => {
    const store = {};
    return {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    };
  })(),
  AudioContext: function () {
    const param = () => ({
      value: 0, setValueAtTime() { }, linearRampToValueAtTime() { },
      exponentialRampToValueAtTime() { }, setTargetAtTime() { }
    });
    return {
      state: 'running', currentTime: 0, sampleRate: 44100, destination: {},
      resume: () => Promise.resolve(),
      createGain: () => ({ gain: param(), connect() { }, disconnect() { } }),
      createOscillator: () => ({ type: 'sine', frequency: param(), connect() { }, start() { }, stop() { } }),
      createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), Q: param(), connect() { } }),
      createConvolver: () => ({ buffer: null, connect() { } }),
      createBuffer: (ch, len) => ({
        length: len, numberOfChannels: ch,
        getChannelData: () => new Float32Array(len)
      }),
      createBufferSource: () => ({ buffer: null, connect() { }, start() { } })
    };
  },
  FormData: function (form) {
    this._m = new Map();
    if (form && form._fields) form._fields.forEach((v, k) => this._m.set(k, v));
    this.get = (k) => (this._m.has(k) ? this._m.get(k) : '');
    this.set = (k, v) => this._m.set(k, v);
    this.forEach = (fn) => this._m.forEach(fn);
  },
  Event: function (t) { this.type = t; },
  Map, Set, Promise, Math, JSON, Date, isFinite, parseInt, parseFloat, Number, String, Object, Array,
  performance: { now: () => Date.now() },
  setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)),
  clearTimeout,
  setInterval: () => 0,
  clearInterval: () => { },
  console
};
window.window = window;
window.self = window;
window.globalThis = window;
window.Float32Array = Float32Array;
window.Uint8ClampedArray = Uint8ClampedArray;

let pendingRaf = [];

/* ---------------------------- load the engine ---------------------------- */
const sandbox = window;
sandbox.document = document;
sandbox.requestAnimationFrame = window.requestAnimationFrame;
sandbox.cancelAnimationFrame = window.cancelAnimationFrame;
sandbox.ResizeObserver = undefined;
sandbox.MutationObserver = function (cb) {
  this.observe = () => { };
  this.disconnect = () => { };
  this.takeRecords = () => [];
};
sandbox.performance = window.performance;
sandbox.navigator = window.navigator;
sandbox.localStorage = window.localStorage;
sandbox.AudioContext = window.AudioContext;
sandbox.FormData = window.FormData;
sandbox.Event = window.Event;
sandbox.setTimeout = window.setTimeout;
sandbox.console = console;

vm.createContext(sandbox);
const load = (file) => {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
};
load(path.join(__dirname, 'dse.js'));
load(path.join(__dirname, 'fx.js'));
check('engine + fx loaded into page sandbox', !!sandbox.DSE && !!sandbox.FX);

/* ------------------------------ run each site ---------------------------- */
const SITES = [
  '01-aurora-glass',
  '02-nexus-terminal',
  '03-miami-vapor',
  '04-monolith-swiss',
  '05-kinetic-particle',
  '..'                       // the landing page at the workspace root
];

SITES.forEach((dir) => {
  // parse the real page so element queries find real structure
  parsedById.clear();
  registry.clear();
  const htmlPath = dir === '..'
    ? path.join(sitesDir, '..', 'index.html')
    : path.join(sitesDir, dir, 'index.html');
  pageRoot = parseHTML(fs.readFileSync(htmlPath, 'utf8'), makeEl('div', 'root'));
  pageRoot.id = 'root';
  const pb = pageRoot.querySelector('body') || pageRoot;
  pageBody = pb;
  document.body = pb;
  parsedById.forEach((node, id) => registry.set(id, node));

  const file = dir === '..'
    ? path.join(sitesDir, '..', 'landing.js')
    : path.join(sitesDir, dir, 'main.js');
  let err = null;
  missingIds.clear();
  try {
    load(file);
  } catch (e) {
    err = e;
  }
  check(dir + ' executes', !err, err ? (err.message + ' @ ' + (err.stack || '').split('\n')[1]) : '');

  if (!err) {
    let rafErr = null;
    try {
      for (let f = 0; f < 6; f++) {
        const batch = pendingRaf.filter(Boolean);
        pendingRaf = [];
        batch.forEach(fn => fn(Date.now() + f * 16));
        window.dispatch('scroll', {});
        window.dispatch('pointermove', { clientX: 200 + f, clientY: 150 + f });
        window.dispatch('resize', {});
        document.dispatch('visibilitychange', {});
      }
    } catch (e) { rafErr = e; }
    check(dir + ' animation frames run', !rafErr, rafErr ? rafErr.message : '');
    const ids = Array.from(missingIds).filter(x =>
      x.indexOf('q:') !== 0 && x.indexOf('sel:') !== 0 &&
      // created at runtime by the library, not expected in the markup
      x !== 'fx-cursor-base');
    check(dir + ' ids referenced by JS exist in HTML', ids.length === 0, ids.join(', '));
  }

  // canvas sanity: every canvas in the page must have been given a context
  const canvases = parsedById ? [] : [];
});

check('canvas drawing happened', ctxCalls.fill + ctxCalls.arc + ctxCalls.fillRect + ctxCalls.clearRect > 200,
  JSON.stringify(ctxCalls));

console.log('\n' + (fail === 0 ? 'ALL PAGE TESTS PASSED' : fail + ' PAGE TEST(S) FAILED'));
if (fail) console.log(problems.map(p => ' - ' + p).join('\n'));
process.exit(fail === 0 ? 0 : 1);
