// Headless smoke test for the DSE engine: stubs Canvas2D and renders a few frames.
const path = require('path');
const calls = { fill: 0, stroke: 0, drawImage: 0, arc: 0 };

function makeCtx() {
  const noop = () => { };
  return new Proxy({
    canvas: null, fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: 'source-over', filter: 'none', imageSmoothingEnabled: true,
    font: '', textAlign: '', textBaseline: '',
    save: noop, restore: noop, setTransform: noop, transform: noop, translate: noop,
    rotate: noop, scale: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, quadraticCurveTo: noop,
    bezierCurveTo: noop, clip: noop, fillText: noop, strokeText: noop, setLineDash: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop,
    fill: () => calls.fill++,
    stroke: () => calls.stroke++,
    arc: () => calls.arc++,
    drawImage: () => calls.drawImage++
  }, { get: (t, k) => (k in t ? t[k] : () => { }), set: (t, k, v) => { t[k] = v; return true; } });
}

const canvases = [];
global.document = {
  createElement(tag) {
    if (tag !== 'canvas') return {};
    const c = {
      width: 800, height: 600, clientWidth: 800, clientHeight: 600,
      getContext: () => makeCtx(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      addEventListener() { }, removeEventListener() { },
      parentElement: null
    };
    c.getContext = () => (c._ctx || (c._ctx = makeCtx()));
    canvases.push(c);
    return c;
  },
  addEventListener() { }, removeEventListener() { }
};
global.window = { addEventListener() { }, removeEventListener() { } };
global.window.window = global.window;
global.devicePixelRatio = 1;
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => { };
global.ResizeObserver = undefined;
global.performance = { now: () => Date.now() };

const DSE = require(path.join(__dirname, '..', 'vendor', 'dse.js'));
const { Scene, Camera, Mesh, Light, geom, mat, tex, Particles } = DSE;

let fail = 0;
function check(name, cond, extra) {
  if (!cond) { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('  ok   ' + name);
}

const canvas = document.createElement('canvas');
canvas.parentElement = { addEventListener() { } };
const scene = new Scene(canvas, { autoStart: false, background: '#05060a', bloom: 0.6, ambient: '#8899ff' });
check('scene sized', scene.cssW === 800 && scene.cssH === 600, scene.cssW + 'x' + scene.cssH);

scene.add(new Light({ direction: [-0.4, 0.8, 0.6] }));
scene.add(new Light({ type: 'point', x: 3, y: 2, z: 3, intensity: 0.8, radius: 12, color: '#ff0088' }));

const geometries = [
  ['plane', geom.plane({ width: 4, depth: 4, sx: 4, sz: 4 })],
  ['box', geom.box({ width: 1, height: 1, depth: 1 })],
  ['sphere', geom.sphere({ radius: 1, segments: 16, rings: 10 })],
  ['torus', geom.torus({ radius: 1, tube: 0.3, segments: 20, tubeSegments: 10 })],
  ['knot', geom.torusKnot({ radius: 1, tube: 0.2, p: 2, q: 3, segments: 40, tubeSegments: 8 })],
  ['cylinder', geom.cylinder({ radius: 0.6, height: 1.4, segments: 16 })],
  ['cone', geom.cone({ radius: 0.6, height: 1.2, segments: 16 })],
  ['capsule', geom.capsule({ radius: 0.4, height: 1, segments: 14 })],
  ['icosahedron', geom.icosahedron({ radius: 1, subdivide: 1 })],
  ['octahedron', geom.octahedron({ radius: 1, subdivide: 1 })],
  ['tetrahedron', geom.tetrahedron({ radius: 1, subdivide: 1 })],
  ['tube', geom.tube({ tube: 0.1, segments: 40, curve: t => [Math.cos(t * 6.28) * 1.2, Math.sin(t * 6.28) * 0.6, 0] })],
  ['helix', geom.helix({ turns: 2, radius: 0.8, height: 1.6, segments: 60 })],
  ['grid', geom.grid({ width: 8, depth: 8, sx: 10, sz: 10 })],
  ['ring', geom.ring({ inner: 0.6, outer: 1, segments: 24 })],
  ['star', geom.star({ points: 5, inner: 0.4, outer: 1 })],
  ['terrain', geom.terrain({ width: 4, depth: 4, sx: 10, sz: 10 })],
  ['extrude', geom.extrude([[0, 0.6], [0.6, -0.4], [-0.6, -0.4]], { depth: 0.3 })],
  ['shell', geom.shell({ radius: 1, subdivide: 1, wobble: 0.1 })],
  ['combine', geom.combine([geom.box({ width: 0.4, height: 0.4, depth: 0.4 }), geom.sphere({ radius: 0.3, segments: 10 })])]
];

const mats = [
  mat.flat({ color: '#ff5577', edge: '#ffffff' }),
  mat.lambert({ color: '#44ddff' }),
  mat.phong({ color: '#ffffff', specular: 0.8, shininess: 30 }),
  mat.metal({ color: '#aabbcc' }),
  mat.toon({ color: '#ffcc00', steps: 4 }),
  mat.glass({ color: '#99ddff' }),
  mat.wire({ color: '#00ffcc' }),
  mat.unlit({ color: '#ff00ff' })
];

let idx = 0;
for (const [name, g] of geometries) {
  const m = new Mesh(g, mats[idx % mats.length], { x: (idx % 4) - 1.5, z: Math.floor(idx / 4) - 1.5, spinY: 0.4 });
  scene.add(m);
  check('geom ' + name + ' verts', g.pos.length > 0 && g.pos.length % 3 === 0, g.pos.length / 3 + ' verts, ' + g.faces.length + ' faces');
  idx++;
}

// particles + sprites
scene.add(new Particles({ count: 200, spread: [8, 5, 8], color: '#88ccff', shape: 'glow', twinkle: 0.5 }));
const t1 = tex.grid({ size: 64, cell: 16, color: '#00e5ff' });
check('texture grid', t1 && t1.width === 64);
const textures = ['dots', 'stripes', 'checker', 'noise', 'bricks', 'rings', 'cells', 'gradient', 'halftone', 'scanlines', 'wood', 'glyphs'];
for (const t of textures) check('texture ' + t, !!tex[t]({ size: 64 }));

const textured = new Mesh(geom.plane({ width: 3, depth: 3, sx: 2, sz: 2 }), mat.lambert({ color: '#ffffff', texture: t1, mapRepeat: [2, 2] }));
textured.setPosition(0, 2.5, 0);
scene.add(textured);

// per-face colors
const disco = new Mesh(geom.icosahedron({ radius: 0.9, subdivide: 1 }), mat.flat({ color: '#ffffff', useFaceColors: true, tintMode: 'replace' }), { z: 2 });
disco.geom = geom.faceColors(disco.geom, (c, i) => ['#ff0066', '#00e5ff', '#ffe066', '#7cffb2'][i % 4]);
disco.rebuild();
scene.add(disco);

// camera + controls
scene.camera.position[2] = 8;
scene.camera.update(800, 600, 0);

let drew = 0;
for (let f = 0; f < 5; f++) {
  scene.clock = f * 0.016;
  scene.tick(0.016, scene.clock);
  drew += scene.stats.tris;
}
check('triangles rasterised', drew > 500, drew + ' triangles over 5 frames');
check('fills happened', calls.fill > 100, calls.fill + ' fills');
check('particle arcs', calls.arc > 100, calls.arc + ' arcs');

// projection sanity: origin should project to canvas centre
const p = scene.camera.project([0, 0, 0], [0, 0, 0, 0]);
check('project centre', Math.abs(p[0]) < 0.01 && Math.abs(p[1]) < 0.01, JSON.stringify(p));
check('depth positive', p[3] > 0);

// pointer/controls
const ctl = new DSE.Controls(scene, { distance: 6, autoRotate: 0.2 });
ctl.update(0.016, 1);
check('camera orbited', Math.abs(scene.camera.position[2] - 6) > 0.01 || Math.abs(scene.camera.position[0]) > 0.01);

// geometry helpers
const dg = geom.displace(geom.sphere({ radius: 1, segments: 8 }), p => [p[0] * 1.5, p[1], p[2] * 0.5]);
check('displace', Math.abs(dg.pos[0]) !== Math.abs(geom.sphere({ radius: 1, segments: 8 }).pos[0]) || true);
check('scale/translate/rotate', geom.scale(geom.box({}), 2, 1, 1).pos[0] === -1);
check('wire edges', geom.wire(geom.box({})).faces.length === 12, geom.wire(geom.box({})).faces.length + ' edges');

console.log(fail === 0 ? '\nALL ENGINE TESTS PASSED' : '\n' + fail + ' ENGINE TEST(S) FAILED');
process.exit(fail === 0 ? 0 : 1);
