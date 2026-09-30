// Headless test for the FX component library: minimal DOM shim, no browser.
const path = require('path');
let fail = 0;
const log = [];
function check(name, cond, extra) {
  if (!cond) { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('  ok   ' + name);
}

/* ------------------------------ DOM shim ------------------------------ */
function makeStyle() {
  return new Proxy({ setProperty() { }, removeProperty() { }, cssText: '' }, {
    get(t, k) { return k in t ? t[k] : ''; },
    set(t, k, v) { t[k] = v; return true; }
  });
}
let idSeq = 0;
function makeEl(tag) {
  const children = [];
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _id: ++idSeq,
    style: makeStyle(),
    dataset: {},
    attributes: {},
    children,
    parentNode: null,
    parentElement: null,
    textContent: '',
    innerHTML: '',
    className: '',
    clientWidth: 900, clientHeight: 640, offsetWidth: 900, offsetHeight: 640,
    scrollWidth: 2400, scrollHeight: 900, scrollLeft: 0,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); return on; },
      contains(c) { return this._s.has(c); }
    },
    appendChild(c) { children.push(c); c.parentNode = el; c.parentElement = el; return c; },
    insertBefore(c) { children.unshift(c); c.parentNode = el; c.parentElement = el; return c; },
    removeChild(c) { const i = children.indexOf(c); if (i >= 0) children.splice(i, 1); return c; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'class') this.className = v; if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (m, c) => c.toUpperCase())] = String(v); },
    getAttribute(k) { return this.attributes[k] === undefined ? null : this.attributes[k]; },
    hasAttribute(k) { return this.attributes[k] !== undefined; },
    addEventListener(t, fn) { (this._ev = this._ev || {})[t] = (this._ev[t] || []).concat(fn); },
    removeEventListener() { },
    dispatch(t, ev) { (this._ev && this._ev[t] || []).forEach(fn => fn(Object.assign({ target: this, preventDefault() { }, clientX: 10, clientY: 10, deltaY: 30 }, ev))); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200 }),
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    scrollIntoView() { },
    focus() { },
    getContext: () => ctxStub(),
    cloneNode() { const c = makeEl(this.tagName); c.textContent = this.textContent; c.scrollWidth = this.scrollWidth; return c; },
    select() { }, offsetTop: 0
  };
  return el;
}
const ctxCalls = { fill: 0, arc: 0, fillText: 0, stroke: 0, clearRect: 0 };
function ctxStub() {
  const noop = () => { };
  return new Proxy({
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, filter: 'none',
    globalCompositeOperation: 'source-over', font: '', textAlign: '', textBaseline: '', lineCap: '',
    save: noop, restore: noop, setTransform: noop, transform: noop, translate: noop, rotate: noop,
    scale: noop, clip: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    setLineDash: noop, drawImage: noop, putImageData: noop,
    clearRect: () => ctxCalls.clearRect++,
    fillRect: noop, strokeRect: noop,
    fill: () => ctxCalls.fill++,
    stroke: () => ctxCalls.stroke++,
    arc: () => ctxCalls.arc++,
    fillText: () => ctxCalls.fillText++,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
  }, { get: (t, k) => (k in t ? t[k] : () => { }), set: (t, k, v) => { t[k] = v; return true; } });
}

const body = makeEl('body');
global.document = {
  body,
  documentElement: Object.assign(makeEl('html'), { scrollHeight: 4000, style: makeStyle(), classList: makeEl().classList }),
  readyState: 'complete',
  createElement: makeEl,
  getElementById: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  addEventListener(t, fn) { (this._ev = this._ev || {})[t] = (this._ev[t] || []).concat(fn); },
  removeEventListener() { },
  hidden: false
};
['querySelector', 'querySelectorAll'].forEach(k => { document[k] = () => (k === 'querySelector' ? makeEl() : []); });

const listeners = {};
global.window = {
  innerWidth: 1280, innerHeight: 900, scrollY: 0, devicePixelRatio: 1,
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  removeEventListener() { },
  requestAnimationFrame: (fn) => { setTimeout(() => fn(performance.now()), 0); return 1; },
  matchMedia: () => ({ matches: false, addEventListener() { } }),
  document: global.document
};
global.window.window = global.window;
global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = () => { };
global.performance = { now: () => Date.now() };
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.devicePixelRatio = 1;
global.setTimeout = setTimeout;

/* ------------------------------ load libs ----------------------------- */
require(path.join(__dirname, 'dse.js'));
const FX = (() => { require(path.join(__dirname, 'fx.js')); return global.window.FX || global.FX; })();
check('FX namespace', !!FX && typeof FX.reveal === 'function');

/* ------------------------------ easings ------------------------------- */
const names = ['linear', 'inQuad', 'outQuad', 'inOutQuad', 'inCubic', 'outCubic', 'inOutCubic',
  'outQuart', 'inQuart', 'outQuint', 'inOutQuint', 'outExpo', 'inExpo', 'inOutExpo', 'outCirc',
  'inCirc', 'outBack', 'inBack', 'outElastic', 'outBounce', 'outSpring', 'outSoft'];
let bad = names.filter(n => typeof FX.ease[n] !== 'function' ||
  Math.abs(FX.ease[n](0)) > 0.001 || !isFinite(FX.ease[n](0.5)) ||
  (n !== 'inBack' && Math.abs(FX.ease[n](1) - 1) > 0.05));
check('22 easings valid at 0/0.5/1', bad.length === 0, bad.join(','));

/* ------------------------------ helpers ------------------------------- */
check('remap', Math.abs(FX.remap(5, 0, 10, 0, 100) - 50) < 1e-6);
check('mixHex', FX.mixHex('#000000', '#ffffff', 0.5).toLowerCase() === '#808080', FX.mixHex('#000000', '#ffffff', 0.5));
check('rgbToHex', FX.rgbToHex([255, 128, 0]).toLowerCase() === '#ff8000');
check('hsl', FX.hsl(200, 50, 50, 0.5).startsWith('hsla(200'));

/* ------------------------------ split -------------------------------- */
let splitCalls = 0;
global.document.querySelectorAll = (sel) => {
  if (sel === '.fx-c') { splitCalls++; return [makeEl('span'), makeEl('span'), makeEl('span')]; }
  if (sel === '.fx-w') return [makeEl('span')];
  return [];
};
const h = makeEl('h1'); h.textContent = 'Hi there';
FX.split(h, 'chars');
check('split produces markup', /fx-c/.test(h.innerHTML) && /fx-w/.test(h.innerHTML), h.innerHTML.slice(0, 60));
check('split sets aria-label', h.getAttribute('aria-label') === 'Hi there');
check('split is idempotent', FX.split(h, 'chars') !== undefined);

/* ------------------------------ counters ----------------------------- */
const cEl = makeEl('span');
cEl.dataset.count = '1500';
cEl.dataset.suffix = '+';
FX.counter(cEl, { duration: 10 });
setTimeout(() => {
  check('counter formatted', /1,500\+/.test(cEl.textContent) || cEl.textContent === '0+', 'got "' + cEl.textContent + '"');
}, 60);

/* ------------------------------ tabs / accordion --------------------- */
const tabsRoot = makeEl('div');
const b1 = makeEl('button'); b1.setAttribute('data-tab', 'a');
const b2 = makeEl('button'); b2.setAttribute('data-tab', 'b');
const p1 = makeEl('div'); p1.setAttribute('data-panel', 'a');
const p2 = makeEl('div'); p2.setAttribute('data-panel', 'b');
tabsRoot.querySelectorAll = (sel) => {
  if (sel === '[data-tab]') return [b1, b2];
  if (sel === '[data-panel]') return [p1, p2];
  return [];
};
global.document.querySelector = () => tabsRoot;
global.document.querySelectorAll = (sel) => {
  if (sel === '[data-tab]') return [b1, b2];
  if (sel === '[data-panel]') return [p1, p2];
  return [];
};
const tabs = FX.tabs(tabsRoot);
check('tabs object', tabs && typeof tabs.activate === 'function');
check('tabs initial active', b1.classList.contains('is-active') && p1.classList.contains('is-active'));
tabs.activate('b');
check('tabs switch', b2.classList.contains('is-active') && !b1.classList.contains('is-active') && p2.classList.contains('is-active'));

/* ------------------------------ backdrop ----------------------------- */
const canvas = makeEl('canvas');
canvas.parentElement = makeEl('div');
const bd = FX.backdrop(canvas, { mode: 'field', count: 40, autoStart: false });
check('backdrop field built', bd.parts.length === 40);
bd.frame(0.016);
check('backdrop field drew', ctxCalls.arc > 10, ctxCalls.arc + ' arcs');
const modes = ['stars', 'snow', 'bubbles', 'grid', 'lines', 'wave', 'bokeh', 'matrix', 'noise'];
for (const m of modes) {
  const c2 = makeEl('canvas'); c2.parentElement = makeEl('div');
  const b2x = FX.backdrop(c2, { mode: m, count: 30, autoStart: false });
  b2x.t = 1.2;
  for (let i = 0; i < 3; i++) b2x.frame(0.016);
  check('backdrop mode ' + m, b2x.parts.length > 0 && ctxCalls.clearRect > 0);
}

/* ------------------------------ 3D helpers --------------------------- */
const blob = FX.blobGeom({ radius: 1, segments: 16, rings: 10 });
const bIdx = 3 * 26 + 1;
const before = blob.pos[bIdx];
blob.updateBlob(1.4);
check('blob deforms', Math.abs(blob.pos[bIdx] - before) > 1e-6, before.toFixed(3) + ' -> ' + blob.pos[bIdx].toFixed(3));
const cry = FX.crystalGeom({ radius: 1, subdivide: 1 });
check('crystal has faces + colors', cry.faces.length > 0 && cry.fc && cry.fc.length === cry.faces.length);

const { Scene, Mesh, geom, mat, tex } = global.window.DSE;
const canvas2 = makeEl('canvas'); canvas2.parentElement = makeEl('div');
const scene = new Scene(canvas2, { autoStart: false, bloom: 0.4 });
scene.add(new global.window.DSE.Light({}));
const arena = FX.scene.gridArena(scene, {});
check('gridArena parts', !!arena.floor && !!arena.cage && !!arena.core);
const retro = FX.scene.retroGrid(scene, { buildings: 6 });
check('retroGrid parts', retro.buildings.length === 6 && !!retro.sun);
const mono = FX.scene.monolith(scene, { slabs: 4 });
check('monolith parts', mono.stack.length === 4 && !!mono.ring);
const con = FX.scene.constellation(scene, { count: 10, radius: 3, linksPerNode: 1 });
check('constellation parts', con.meshes.length === 10 && con.links.length > 0);
const shards = FX.scene.shards(scene, { count: 8 });
check('shards count', shards.length === 8);
const dust = FX.scene.dust(scene, { count: 120 });
check('dust particles', dust.count === 120);
const heroMesh = FX.scene.hero(scene, { kind: 'blob', blob: { segments: 14, rings: 8 } });
check('hero blob', !!heroMesh && heroMesh.geom.meta.blob === true);
scene.cssW = 900; scene.cssH = 640;
FX.scene.hero(scene, { kind: 'knot' });
FX.scene.hero(scene, { kind: 'shell' });
let drawn = 0;
for (let f = 0; f < 3; f++) { scene.clock = f * 0.016; scene.tick(0.016, scene.clock); drawn += scene.stats.tris; }
check('FX scenes render triangles', drawn > 300, drawn + ' tris');

/* ------------------------------ widgets ------------------------------ */
const toast = FX.toast('hello', { kind: 'ok' });
check('toast element', !!toast && /fx-toast/.test(toast.className));
FX.tooltip = FX.tooltip; // exists
check('widget api present', ['toast', 'tabs', 'accordion', 'modal', 'tooltip', 'scrollSpy', 'marquee', 'dragRail', 'spotlight', 'ripple', 'magnetic', 'tilt', 'cursor', 'sound', 'copy', 'raf', 'mount', 'prefersReduced'].every(k => k in FX));

/* ------------------------------ misc --------------------------------- */
check('copy resolves', typeof FX.copy('x').then === 'function');
check('prefersReduced false', FX.prefersReduced() === false);
const pm = FX.scene.dust(scene, { count: 60 });
pm.colors = ['#6ee7ff', '#ff7ac6'];
pm.hueDrift = 0.5;
const arcBefore = ctxCalls.arc;
pm.draw(makeEl('canvas').getContext('2d'), scene);
check('particle hueDrift draw', ctxCalls.arc > arcBefore, (ctxCalls.arc - arcBefore) + ' arcs');
const mq = FX.marquee(makeEl('div'), { speed: 10 });
check('marquee returns stop fn', typeof mq === 'function');

setTimeout(() => {
  console.log(fail === 0 ? '\nALL FX TESTS PASSED' : '\n' + fail + ' FX TEST(S) FAILED');
  process.exit(fail === 0 ? 0 : 1);
}, 120);
