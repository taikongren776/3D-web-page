/* ==========================================================================
   KINETIC — particle field, liquid metal, constellation
   ========================================================================== */
(function () {
  'use strict';

  var DSE = window.DSE, FX = window.FX;
  var geom = DSE.geom, mat = DSE.mat;
  var reduced = FX.prefersReduced();
  var clamp = DSE.utils.clamp, lerp = DSE.utils.lerp;
  var isMobile = window.innerWidth <= 720;

  /* ================================================================== *
   *  1. Scene
   * ================================================================== */

  var scene = new DSE.Scene(document.getElementById('stage'), {
    autoStart: false,
    alpha: true,
    fog: { color: '#03050b', near: 6, far: 30, density: 1.15 },
    bloom: 0.65,
    ambient: '#6f8dff',
    ambientIntensity: 0.5,
    maxFaces: reduced ? 3000 : (isMobile ? 5000 : 10000),
    resolution: isMobile ? 0.7 : 1
  });

  scene.add(new DSE.Light({ direction: [-0.45, 0.8, 0.6], intensity: 1.0, color: '#dff1ff' }));
  scene.add(new DSE.Light({ direction: [0.7, -0.3, -0.6], intensity: 0.45, color: '#a78bfa' }));
  scene.add(new DSE.Light({ type: 'point', x: 3.4, y: 2.6, z: 3.2, intensity: 1.5, radius: 14, color: '#ff7ac6' }));

  // ---- liquid metal blob (the hero object) ----
  var blobGeom = FX.blobGeom({
    radius: 1.35, segments: isMobile ? 26 : 40, rings: isMobile ? 18 : 28,
    amp: 0.16, amp2: 0.07, f1: 1.6, f2: 2.3, f3: 3.1, speed: 1
  });
  var blob = new DSE.Mesh(blobGeom, mat.metal({
    color: '#d3ddf5', color2: '#ffffff',
    emissive: '#2b3a72', emissiveIntensity: 0.45,
    // A liquid-metal read wants a *tight* highlight: a low exponent smears
    // the specular over half the sphere and blows out to flat white.
    specular: 0.72, shininess: 82,
    glow: 0.5, glowColor: '#8fb6ff',
    hueAnim: 0, saturate: 1.06,
    smoothShade: true
  }), { spinY: 0.18, spinX: 0.04 });
  scene.add(blob);

  // inner core so the metal reads as solid
  var core = new DSE.Mesh(geom.icosahedron({ radius: 0.5, subdivide: 1 }),
    mat.unlit({ color: '#7c3bff', emissive: '#7c3bff', emissiveIntensity: 1.2, glow: 0.8 }),
    { spinY: -0.6, spinX: 0.3 });
  scene.add(core);

  // orbiting satellite ring of small shapes
  var satellites = [];
  var satColors = ['#6ee7ff', '#a78bfa', '#ff7ac6', '#7cffc4'];
  for (var s = 0; s < 16; s++) {
    var kind = s % 3;
    var g = kind === 0 ? geom.octahedron({ radius: 0.1 })
      : kind === 1 ? geom.tetrahedron({ radius: 0.12 })
        : geom.box({ width: 0.14, height: 0.14, depth: 0.14 });
    var sm = new DSE.Mesh(g, mat.unlit({
      color: satColors[s % 4], emissive: satColors[s % 4], emissiveIntensity: 1, glow: 0.9
    }), {
      orbit: {
        radius: 2.5 + (s % 4) * 0.42, speed: 0.16 + (s % 3) * 0.06,
        phase: s / 16 * Math.PI * 2, height: (s % 5 - 2) * 0.5, axis: 'x'
      },
      spinY: 1.2
    });
    scene.add(sm); satellites.push(sm);
  }

  // ---- particle field with a real force model ----
  var PCOUNT = isMobile ? 320 : 640;
  var field = new DSE.Particles({
    count: PCOUNT,
    spread: [16, 10, 16],
    size: 1.7,
    color: '#9fd8ff',
    colors: ['#6ee7ff', '#a78bfa', '#ff7ac6', '#7cffc4'],
    shape: 'glow',
    opacity: 0.55,
    twinkle: 0.85,
    speed: 0.0,          // velocity is managed manually below
    drift: [0, 0.35, 0],
    depthFade: true,
    seed: 41
  });
  // manual velocity buffer for the force model
  field._vel = new Float32Array(field.count * 3);
  for (var vi = 0; vi < field._vel.length; vi++) field._vel[vi] = (Math.random() - 0.5) * 0.02;
  field._force = { x: 0, y: 0, z: 0, power: 0, radius: 1.5 };
  field.forceAt = function (x, y, z, power) {
    this._force.x = x; this._force.y = y; this._force.z = z;
    this._force.power = power;
  };
  var baseUpdate = field.update.bind(field);
  field.update = function (dt, t) {
    baseUpdate(dt, t);
    var f = this._force, R = f.radius * f.radius;
    var damp = Math.pow(0.965, dt * 60);
    for (var i = 0; i < this.count; i++) {
      var ix = i * 3;
      var px = this._pt[ix], py = this._pt[ix + 1], pz = this._pt[ix + 2];
      var dx = px - f.x, dy = py - f.y, dz = pz - f.z;
      var d2 = dx * dx + dy * dy + dz * dz;
      if (f.power > 0.001 && d2 < R && d2 > 1e-5) {
        var d = Math.sqrt(d2);
        var k = (1 - d / f.radius) * f.power / d;
        this._vel[ix] += dx * k * dt * 60;
        this._vel[ix + 1] += dy * k * dt * 60;
        this._vel[ix + 2] += dz * k * dt * 60;
      }
      this._vel[ix] *= damp; this._vel[ix + 1] *= damp; this._vel[ix + 2] *= damp;
      this._pt[ix] += this._vel[ix];
      this._pt[ix + 1] += this._vel[ix + 1];
      this._pt[ix + 2] += this._vel[ix + 2];
      // soft boundary
      if (px > 11 || px < -11) { this._vel[ix] *= -0.6; this._pt[ix] = clamp(px, -11, 11); }
      if (py > 7 || py < -7) { this._vel[ix + 1] *= -0.6; this._pt[ix + 1] = clamp(py, -7, 7); }
      if (pz > 11 || pz < -11) { this._vel[ix + 2] *= -0.6; this._pt[ix + 2] = clamp(pz, -11, 11); }
    }
    f.power *= Math.pow(0.4, dt); // force decays fast
  };
  scene.add(field);

  // ---- constellation network ----
  var net = FX.scene.constellation(scene, {
    count: isMobile ? 16 : 26,
    radius: 3.4,
    nodeSize: 0.085,
    linkWidth: 0.0075,
    linksPerNode: 2,
    color: '#6ee7ff',
    seed: 5
  });

  // free-floating dust for depth
  var dust = FX.scene.dust(scene, {
    count: isMobile ? 120 : 260,
    spread: [24, 14, 24], color: '#ffffff',
    colors: ['#6ee7ff', '#a78bfa', '#ff7ac6'],
    shape: 'dot', size: 1.2, opacity: 0.3, seed: 77
  });

  var controls = new DSE.Controls(scene, {
    distance: 6.6, azimuth: 0.5, elevation: 0.12,
    autoRotate: 0.16, damping: 0.9, pointerInfluence: 0.42,
    minDistance: 3.6, maxDistance: 16, minElevation: -0.8, maxElevation: 1.0
  });

  /* ---------- pointer ray into world space (approx: z = 0 plane) -------- */
  var pointer = { x: 0, y: 0, has: false, power: 0 };
  var tmp = [0, 0, 0, 0];
  function pointerToWorld() {
    // cast from camera through the pointer, intersect the z=0 plane
    var cam = scene.camera;
    var ndcX = pointer.x, ndcY = -pointer.y;
    // unproject two points using the inverse of the view-projection is heavy;
    // approximate with the camera basis and the fov
    var fovY = cam.fov * Math.PI / 180;
    var dirY = Math.tan(fovY / 2) * ndcY;
    var dirX = dirY * cam.aspect * ndcX;
    var fwd = DSE.V.norm(DSE.V.sub(cam.target, cam.position));
    var right = DSE.V.norm(DSE.V.cross(fwd, [0, 1, 0]));
    var up = DSE.V.cross(right, fwd);
    var dir = DSE.V.norm([
      fwd[0] + right[0] * dirX + up[0] * dirY,
      fwd[1] + right[1] * dirX + up[1] * dirY,
      fwd[2] + right[2] * dirX + up[2] * dirY
    ]);
    // distance to the z = 0 plane
    var dist = dir[2] !== 0 ? (0 - cam.position[2]) / dir[2] : 12;
    if (!isFinite(dist) || dist < 0) dist = 12;
    return [cam.position[0] + dir[0] * dist, cam.position[1] + dir[1] * dist, 0];
  }

  scene.pre(function (sc, dt, t) {
    controls.update(dt, t);
    blobGeom.updateBlob(t * 0.85);
    blob.rotation[1] += dt * 0.12 * (frozen ? 0 : 1);
    var pulse = 1 + Math.sin(t * 1.2) * 0.02;
    blob.scale[0] = blob.scale[1] = blob.scale[2] = pulse;
    core.scale[0] = core.scale[1] = core.scale[2] = 0.9 + Math.sin(t * 2.1) * 0.08;

    // route the pointer force into the particle field
    if (pointer.has && !frozen) {
      var wp = pointerToWorld();
      field.forceAt(wp[0], wp[1], wp[2], 26);
    }

    // network slowly breathes in and out
    var netPulse = 1 + Math.sin(t * 0.4) * 0.045;
    for (var i = 0; i < net.meshes.length; i++) {
      net.meshes[i].scale[0] = net.meshes[i].scale[1] = net.meshes[i].scale[2] = netPulse;
      net.meshes[i].rotation[1] += dt * (0.4 + (i % 5) * 0.2);
    }

    // scroll choreography: blob → field → constellation.
    //
    // Framing: `lookAt` always puts camera.target at the centre of the screen,
    // so to place the blob 2/3 across we aim the camera at a point to the LEFT
    // of it and ease that offset out as the page scrolls. Translating
    // position and target by the same amount would pan the rig and change
    // nothing; moving only `position` slides along the view axis.
    var p = scrollP;
    var wide = sc.cssW > 1024;
    controls.distance = lerp(6.6, 11.5, p) - Math.sin(p * Math.PI) * 1.2;
    controls.update(0.0001, t);
    var aim = wide ? 2.4 * Math.max(0, 1 - p / 0.55) : 0;
    sc.camera.target[0] = aim;
    sc.camera.target[1] = Math.sin(p * Math.PI) * 0.4;
    blob.visible = p < 0.92;
    for (var k = 0; k < satellites.length; k++) satellites[k].visible = p < 0.75;
  });

  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a || 1), 0, 1);
    return t * t * (3 - 2 * t);
  }

  if (!reduced) scene.start(); else scene.tick(0.016, 0);

  /* ---------- pointer + click shockwaves ---------------------------- */
  var trail = document.getElementById('trail');
  var tctx = trail.getContext('2d');
  var trailPts = [];
  function sizeTrail() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    trail.width = Math.round(window.innerWidth * dpr);
    trail.height = Math.round(window.innerHeight * dpr);
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeTrail();
  window.addEventListener('resize', sizeTrail);

  window.addEventListener('pointermove', function (e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.has = true;
    trailPts.push({ x: e.clientX, y: e.clientY, life: 1 });
    if (trailPts.length > 42) trailPts.shift();
  }, { passive: true });

  window.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button, input, .topbar, .fx-toasts')) return;
    shockwaves.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });
    pointer.power = 1;
    field.forceAt(pointerToWorld()[0], pointerToWorld()[1], 0, 90);
    FX.toast('冲击波已施加', { duration: 1400 });
  });

  var shockwaves = [];
  (function trailLoop() {
    var w = window.innerWidth, h = window.innerHeight;
    tctx.clearRect(0, 0, w, h);
    // cursor trail
    for (var i = 0; i < trailPts.length; i++) {
      var p = trailPts[i];
      p.life *= 0.94;
      var r = 2 + p.life * 22;
      var g = tctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, 'rgba(140,220,255,' + (0.1 * p.life).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(140,220,255,0)');
      tctx.fillStyle = g;
      tctx.beginPath(); tctx.arc(p.x, p.y, r, 0, 6.283); tctx.fill();
      p.x *= 0.999; p.y *= 0.999;
    }
    // shockwaves
    for (var j = shockwaves.length - 1; j >= 0; j--) {
      var s = shockwaves[j];
      s.r += (Math.max(w, h) * 0.55 - s.r) * 0.06;
      s.life *= 0.92;
      tctx.strokeStyle = 'rgba(167,139,250,' + (0.5 * s.life).toFixed(3) + ')';
      tctx.lineWidth = 2 + s.life * 3;
      tctx.beginPath(); tctx.arc(s.x, s.y, s.r, 0, 6.283); tctx.stroke();
      if (s.life < 0.03) shockwaves.splice(j, 1);
    }
    if (pointer.has) pointer.power *= 0.94;
    requestAnimationFrame(trailLoop);
  })();

  /* ================================================================== *
   *  2. Scroll state
   * ================================================================== */

  var scrollP = 0, targetP = 0;
  function readScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    targetP = h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();
  (function smooth() {
    scrollP += (targetP - scrollP) * 0.08;
    requestAnimationFrame(smooth);
  })();

  /* ================================================================== *
   *  3. HUD + telemetry
   * ================================================================== */

  var hudFps = document.getElementById('hudFps');
  var hudTris = document.getElementById('hudTris');
  var mParticles = document.getElementById('mParticles');
  var mDraws = document.getElementById('mDraws');
  var mFrame = document.getElementById('mFrame');
  var mAmp = document.getElementById('mAmp');
  var spark = document.getElementById('frameSpark');
  for (var si = 0; si < 26; si++) spark.appendChild(document.createElement('i'));
  var sparkBars = spark.querySelectorAll('i');

  /* Real per-frame timing. The previous version divided a wall-clock delta
     between two setInterval ticks by 6, which reports hundreds of ms on any
     machine that throttles timers and then "optimises" a renderer that was
     never slow. Measure the actual frame delta instead. */
  var frameSamples = [];
  var lastFrameAt = 0;
  (function sampleFrames(ts) {
    if (lastFrameAt) {
      var d = ts - lastFrameAt;
      if (d > 0 && d < 500) {
        frameSamples.push(d);
        if (frameSamples.length > 60) frameSamples.shift();
      }
    }
    lastFrameAt = ts;
    requestAnimationFrame(sampleFrames);
  })(0);

  function medianFrameMs() {
    if (!frameSamples.length) return 16.7;
    var s = frameSamples.slice().sort(function (a, b) { return a - b; });
    return s[Math.floor(s.length / 2)];
  }

  var lastAutoAdjust = 0;
  var autoAdjusts = 0;

  setInterval(function () {
    var fps = scene.stats.fps;
    hudFps.textContent = fps ? Math.round(fps) + ' fps' : '-- fps';
    hudTris.textContent = scene.stats.tris + ' tri';
    mParticles.textContent = field.count;
    mDraws.textContent = scene.objects.length * 2 + scene.stats.tris;
    var med = medianFrameMs();
    mFrame.textContent = med.toFixed(1) + ' ms';
    Array.prototype.forEach.call(sparkBars, function (b, i) {
      var v = frameSamples[i] === undefined ? 8 : clamp(100 - frameSamples[i] * 3.2, 8, 100);
      b.style.height = v + '%';
    });
    mAmp.textContent = parseFloat(document.getElementById('rAmp').value).toFixed(2);

    // Adaptive quality: only trust the measurement once we have a few frames,
    // only act once every few seconds, and cap the number of downgrades so a
    // throttled tab cannot walk the particle count down to nothing.
    var now = FX.now();
    if (frameSamples.length > 12 && med > 26 && field.count > 240 &&
      autoAdjusts < 3 && now - lastAutoAdjust > 5000) {
      lastAutoAdjust = now;
      autoAdjusts++;
      field.count = Math.max(240, Math.round(field.count * 0.85));
      var rc = document.getElementById('rCount');
      if (rc) { rc.value = field.count; rc.dispatchEvent(new Event('input')); }
      FX.toast('帧时间 ' + med.toFixed(0) + 'ms 偏高，粒子数自动降到 ' + field.count,
        { kind: 'warn', duration: 2600 });
    }
  }, 1000);

  /* ================================================================== *
   *  4. Network list
   * ================================================================== */

  var NET = [
    ['dse.js / rasterizer', '20 geometry · 13 textures'],
    ['fx.js / motion', '42 components'],
    ['aurora-glass', 'glassmorphism site'],
    ['nexus-terminal', 'cyberpunk shell'],
    ['miami-1997', 'vaporwave desktop'],
    ['monolith', 'swiss editorial'],
    ['kinetic', 'this site'],
    ['a11y / motion', 'prefers-reduced-motion'],
    ['perf / budget', '12k triangles per frame'],
    ['audio / synth', 'FM voices, no samples']
  ];
  var netList = document.getElementById('netList');
  NET.forEach(function (n, i) {
    var row = document.createElement('div');
    row.className = 'net-node' + (i === 0 ? ' is-active' : '');
    row.setAttribute('data-cursor', 'SELECT');
    row.innerHTML = '<i></i><b>' + n[0] + '</b><span>' + n[1] + '</span>';
    row.addEventListener('click', function () {
      Array.prototype.forEach.call(netList.children, function (c) { c.classList.remove('is-active'); });
      row.classList.add('is-active');
      FX.toast('选中网络节点：' + n[0]);
    });
    netList.appendChild(row);
  });

  /* ================================================================== *
   *  5. Ledger table
   * ================================================================== */

  var LEDGER = [
    ['vendor/dse.js', '1,980', '61 KB', '矩阵/几何/贴图/材质/光栅器'],
    ['vendor/fx.js', '1,240', '38 KB', '缓动/滚动/文本/画布/交互组件'],
    ['sites/05-kinetic', '690', '21 KB', '本页场景与参数面板'],
    ['合计', '3,910', '120 KB', '零运行时依赖']
  ];
  var ledgerRows = document.getElementById('ledgerRows');
  LEDGER.forEach(function (r) {
    var d = document.createElement('div');
    d.className = 'ledger-row';
    d.innerHTML = '<b>' + r[0] + '</b><span>' + r[1] + '</span><span>' + r[2] + '</span><span>' + r[3] + '</span>';
    ledgerRows.appendChild(d);
  });

  /* ================================================================== *
   *  6. Metric rings
   * ================================================================== */

  FX.mount(function () {
    Array.prototype.forEach.call(document.querySelectorAll('.ring'), function (r, i) {
      var target = parseInt(r.getAttribute('data-ring'), 10);
      var ring = r.querySelector('b');
      setTimeout(function () {
        r.style.setProperty('--p', target);
      }, 120 + i * 130);
      setTimeout(function () { if (ring) FX.counter(ring, { to: target, duration: 1200 }); }, 160 + i * 130);
    });
  });
  /* ================================================================== *
   *  7. Control room
   * ================================================================== */

  var frozen = false;
  var params = {
    particles: field.count,
    blobAmp: 0.16,
    blobFreq: 1.6,
    bloom: 0.65,
    fog: 0.7,
    hue: 0
  };
  var codeOut = document.getElementById('codeOut');

  function syncCode() {
    codeOut.textContent = JSON.stringify({
      engine: 'dse.js@1.0.0',
      scene: {
        particles: params.particles,
        bloom: Number(params.bloom.toFixed(2)),
        fogFar: Number((8 + (1 - params.fog) * 32).toFixed(1)),
        maxFaces: scene.maxFaces
      },
      blob: {
        amplitude: Number(params.blobAmp.toFixed(2)),
        frequency: Number(params.blobFreq.toFixed(2)),
        speed: 0.85
      },
      material: {
        hueShift: params.hue,
        mode: 'metal',
        shininess: 46
      },
      camera: {
        distance: Number(controls.distance.toFixed(2)),
        autoRotate: Number(controls.autoRotate.toFixed(2))
      },
      frozen: frozen
    }, null, 2);
  }

  function bind(id, out, fn, fmt) {
    var input = document.getElementById(id), label = document.getElementById(out);
    function apply() {
      var v = parseFloat(input.value);
      if (label) label.textContent = fmt ? fmt(v) : v;
      fn(v);
      syncCode();
    }
    input.addEventListener('input', apply);
    apply();
  }

  bind('rCount', 'vCount', function (v) {
    var n = Math.max(0, Math.round(v));
    field.count = n;
    field._r = new Float32Array(Math.max(1, n) * 4);
    field._pt = new Float32Array(Math.max(1, n) * 3);
    field._vel = new Float32Array(Math.max(1, n) * 3);
    for (var i = 0; i < n; i++) {
      field._r[i * 4] = Math.random() * 2 - 1;
      field._r[i * 4 + 1] = Math.random() * 2 - 1;
      field._r[i * 4 + 2] = Math.random() * 2 - 1;
      field._r[i * 4 + 3] = Math.random();
    }
    params.particles = n;
  }, function (v) { return Math.round(v); });

  bind('rAmp', 'vAmp', function (v) {
    blobGeom.updateBlob(0);
    params.blobAmp = v;
    FX.blobGeomAmp = v;
    // rebuild the blob geometry with new amplitude
    var ng = FX.blobGeom({
      radius: 1.35, segments: isMobile ? 26 : 40, rings: isMobile ? 18 : 28,
      amp: v, amp2: v * 0.45, f1: params.blobFreq, f2: params.blobFreq * 1.44,
      f3: params.blobFreq * 1.94, speed: 1
    });
    blob.geom = ng;
    blob.rebuild();
    blobGeom = ng;
  }, function (v) { return v.toFixed(2); });

  bind('rFreq', 'vFreq', function (v) {
    params.blobFreq = v;
    var ng = FX.blobGeom({
      radius: 1.35, segments: isMobile ? 26 : 40, rings: isMobile ? 18 : 28,
      amp: params.blobAmp, amp2: params.blobAmp * 0.45,
      f1: v, f2: v * 1.44, f3: v * 1.94, speed: 1
    });
    blob.geom = ng; blob.rebuild(); blobGeom = ng;
  }, function (v) { return v.toFixed(2); });

  bind('rBloom', 'vBloom', function (v) { scene.bloom = v; params.bloom = v; }, function (v) { return v.toFixed(2); });
  bind('rFog', 'vFog', function (v) {
    params.fog = v;
    scene.fog.far = 8 + (1 - v) * 32;
    scene.fog.near = 2 + v * 5;
  }, function (v) { return v.toFixed(2); });
  bind('rHue', 'vHue', function (v) {
    params.hue = v;
    blob.mat.hueShift = v;
    core.mat.hueShift = v;
    for (var i = 0; i < satellites.length; i++) satellites[i].mat.hueShift = v;
    for (var k = 0; k < net.meshes.length; k++) net.meshes[k].mat.hueShift = v;
    for (var l = 0; l < net.links.length; l++) net.links[l].mat.hueShift = v;
    field.hueDrift = v * 0.002;
  }, function (v) { return Math.round(v); });

  document.getElementById('resetLab').addEventListener('click', function () {
    var defaults = { rCount: 640, rAmp: 0.16, rFreq: 1.6, rBloom: 0.65, rFog: 0.7, rHue: 0 };
    Object.keys(defaults).forEach(function (id) {
      var el = document.getElementById(id);
      el.value = defaults[id];
      el.dispatchEvent(new Event('input'));
    });
    FX.toast('参数已重置', { kind: 'ok' });
  });

  var spinBtn = document.getElementById('spinToggle');
  spinBtn.addEventListener('click', function () {
    controls.autoRotate = controls.autoRotate > 0.001 ? 0 : 0.16;
    spinBtn.textContent = '自转：' + (controls.autoRotate > 0.001 ? '开' : '关');
    syncCode();
  });

  /* ================================================================== *
   *  8. Misc wiring
   * ================================================================== */

  FX.mount(function () {
    FX.textIn(document.getElementById('heroTitle'), { mode: 'chars', stagger: 30, duration: 1150, distance: '1em' });
    FX.reveal({ stagger: 70 });
    FX.scrollBar(document.getElementById('progress'));
    FX.stickyNav(document.getElementById('topbar'));
    FX.scrollSpy({ rail: '.fx-rail' });
    FX.magnetic('[data-magnetic]');
    FX.tilt('[data-tilt]');
    FX.ripple('.btn');
    FX.counters();
    syncCode();

    if (!('ontouchstart' in window) && window.innerWidth > 900) {
      FX.cursor();
      document.body.classList.add('fx-custom-cursor');
    }

    FX.typewriter(document.getElementById('typed'), [
      'rasterize --particles=' + field.count,
      'blob --amp=0.16 --freq=1.6 --mode=metal',
      'constellation --nodes=26 --links=2',
      'ready — 移动鼠标扰动粒子场 ▸'
    ], { speed: 44, hold: 2000 });

    // shockwave button
    document.getElementById('forceBtn').addEventListener('click', function () {
      var w = window.innerWidth / 2, h = window.innerHeight / 2;
      shockwaves.push({ x: w, y: h, r: 0, life: 1 });
      var f = field._force;
      for (var i = 0; i < field.count; i++) {
        var ix = i * 3;
        var dx = field._pt[ix], dy = field._pt[ix + 1], dz = field._pt[ix + 2];
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        var k = 0.55 / d;
        field._vel[ix] += dx * k;
        field._vel[ix + 1] += dy * k;
        field._vel[ix + 2] += dz * k;
      }
      FX.toast('⚡ 全向冲击：粒子已获得径向速度', { kind: 'ok' });
    });

    // theme swap
    var THEMES = [
      ['#6ee7ff', '#a78bfa', '#ff7ac6', '#7cffc4'],
      ['#ffd166', '#ff7a45', '#ff4d6d', '#ffe9a8'],
      ['#7cffc4', '#4dd4ff', '#7c8cff', '#c7f9ff'],
      ['#ff8fd8', '#c084fc', '#67e8f9', '#fef08a']
    ];
    var themeIdx = 0;
    document.getElementById('themeBtn').addEventListener('click', function () {
      themeIdx = (themeIdx + 1) % THEMES.length;
      var t = THEMES[themeIdx];
      document.documentElement.style.setProperty('--c1', t[0]);
      document.documentElement.style.setProperty('--c2', t[1]);
      document.documentElement.style.setProperty('--c3', t[2]);
      document.documentElement.style.setProperty('--c4', t[3]);
      field.colors = t.map(DSE.utils.hex2rgb);
      for (var i = 0; i < satellites.length; i++) {
        var c = DSE.utils.hex2rgb(t[i % 4]);
        satellites[i].mat.color = c;
        satellites[i].mat.emissive = c;
        satellites[i].mat.glowColor = c;
      }
      blob.mat.glowColor = DSE.utils.hex2rgb(t[1]);
      scene.lights[2].color = DSE.utils.hex2rgb(t[2]);
      FX.toast('配色方案 ' + (themeIdx + 1) + '/' + THEMES.length);
    });

    // freeze motion
    var motionBtn = document.getElementById('motionToggle');
    motionBtn.addEventListener('click', function () {
      frozen = !frozen;
      motionBtn.setAttribute('aria-pressed', frozen ? 'false' : 'true');
      motionBtn.textContent = frozen ? '▶' : '⏸';
      if (frozen) {
        scene.stop();
        scene.tick(0.016, scene.clock); // one last frame so nothing looks stuck mid-draw
      } else if (!reduced) {
        scene.start();
      }
      syncCode();
      FX.toast(frozen ? '动效已冻结（省电模式）' : '动效已恢复');
    });

    document.getElementById('copyMail').addEventListener('click', function () {
      FX.copy('aria@kinetic.studio');
      FX.toast('aria@kinetic.studio 已复制', { kind: 'ok' });
    });
    document.getElementById('toastBtn').addEventListener('click', function () {
      FX.toast('这是一个动效组件：fx-toast', { kind: 'ok' });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) scene.stop();
      else if (!reduced && !frozen) scene.start();
    });

    if (isMobile) FX.toast('移动端已自动降低粒子数与分辨率', { duration: 3200 });
  });
})();
