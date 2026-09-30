/* ==========================================================================
   AURORA — glassmorphism 3D portfolio
   Engine: vendor/dse.js   Components: vendor/fx.js
   ========================================================================== */
(function () {
  'use strict';

  var DSE = window.DSE, FX = window.FX;
  var geom = DSE.geom, mat = DSE.mat, tex = DSE.tex;
  var reduced = FX.prefersReduced();

  /* ------------------------------------------------------------------ *
   *  3D scene
   * ------------------------------------------------------------------ */

  var stage = document.getElementById('stage');
  var scene = new DSE.Scene(stage, {
    autoStart: false,
    alpha: true,
    background: null,
    fog: { color: '#060a1a', near: 6, far: 26, density: 1.1 },
    bloom: 0.45,
    ambient: '#8fb4ff',
    ambientIntensity: 0.62,
    maxFaces: reduced ? 4000 : 11000,
    resolution: window.innerWidth < 720 ? 0.72 : 1
  });

  scene.add(new DSE.Light({ direction: [-0.5, 0.85, 0.55], intensity: 1.05, color: '#dcefff' }));
  scene.add(new DSE.Light({ direction: [0.7, -0.35, -0.6], intensity: 0.4, color: '#a48cff' }));
  scene.add(new DSE.Light({ type: 'point', x: 4, y: 3.4, z: 3, intensity: 1.1, radius: 15, color: '#ff9ecb' }));

  var controls = new DSE.Controls(scene, {
    distance: 9, azimuth: 0.62, elevation: 0.14,
    autoRotate: 0.18, damping: 0.9, pointerInfluence: 0.42,
    minDistance: 4.4, maxDistance: 16, minElevation: -0.9, maxElevation: 1.0
  });
  scene.pre(function (s, dt, t) { controls.update(dt, t); });

  // hero crystal — faceted, translucent, faintly self-lit
  var hero = FX.scene.hero(scene, {
    kind: 'crystal',
    radius: 1.5,
    crystal: { radius: 1.5, subdivide: 2, palette: ['#9fd8ff', '#c8b6ff', '#ffd6e8', '#ffffff'] },
    material: mat.glass({
      color: '#cfe6ff', opacity: 0.17, edge: '#ffffff', edgeWidth: 0.9,
      glow: 0.55, glowColor: '#9fd8ff', useFaceColors: true, tintMode: 'mix'
    }),
    spinY: 0.22, spinX: 0.05, bob: 0.18
  });

  // inner solid core so the glass has something to refract against
  var core = new DSE.Mesh(geom.icosahedron({ radius: 0.62, subdivide: 1 }),
    mat.metal({ color: '#1a2350', emissive: '#3d5cff', emissiveIntensity: 0.9, glow: 0.5, specular: 0.9 }),
    { spinY: -0.5, spinX: 0.3 });
  core.onUpdate = function (m, dt, t) {
    var s = 1 + Math.sin(t * 1.6) * 0.06;
    m.scale[0] = m.scale[1] = m.scale[2] = s;
  };
  scene.add(core);

  // orbiting shards
  var shards = FX.scene.shards(scene, {
    count: window.innerWidth < 720 ? 12 : 22,
    spread: 10, spreadY: 6, seed: 3,
    material: function (color) {
      return mat.glass({ color: color, opacity: 0.3, edge: '#ffffff', edgeWidth: 0.9, glow: 0.3, glowColor: color });
    }
  });

  // a slowly rotating torus "aperture" ring
  var aperture = new DSE.Mesh(geom.torus({ radius: 3.1, tube: 0.045, segments: 96, tubeSegments: 6 }),
    mat.glass({ color: '#bfe0ff', opacity: 0.35, edge: '#ffffff', edgeWidth: 1, glow: 0.4, glowColor: '#9fd8ff' }),
    { rx: 1.16, spinZ: 0.12 });
  scene.add(aperture);

  var aperture2 = new DSE.Mesh(geom.torus({ radius: 4.1, tube: 0.03, segments: 110, tubeSegments: 5 }),
    mat.glass({ color: '#ffc8e4', opacity: 0.28, edge: '#ffd6e8', edgeWidth: 1, glow: 0.35, glowColor: '#ffa8d8' }),
    { rx: -1.35, rz: 0.5, spinY: -0.08 });
  scene.add(aperture2);

  // drifting motes
  var dust = FX.scene.dust(scene, {
    count: window.innerWidth < 720 ? 220 : 460,
    spread: [20, 12, 20], color: '#ffffff',
    colors: ['#9fd8ff', '#c8b6ff', '#ffd6e8', '#ffffff'],
    shape: 'glow', size: 1.5, opacity: 0.4, seed: 12
  });

  // scroll drives camera framing
  var scrollState = { p: 0, targetP: 0 };
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    scrollState.targetP = h > 0 ? window.scrollY / h : 0;
  }, { passive: true });

  scene.pre(function (s, dt, t) {
    scrollState.p += (scrollState.targetP - scrollState.p) * Math.min(1, dt * 2.4);
    var p = scrollState.p;
    // Framing: the hero copy owns the left half of the viewport, so the
    // crystal cluster is pushed into the right half by aiming the camera well
    // to the left of it. Without this the crystal sits on top of the headline
    // and the body copy, and both become hard to read.
    var wide = s.cssW > 1024;
    var shift = wide ? 5.2 : 0;
    s.camera.target[0] = shift;
    s.camera.target[1] = Math.sin(p * Math.PI) * 0.5;
    controls.target[0] = shift;              // keep the orbit centred on the shift
    controls.distance = (wide ? 12.6 : 9.4) + p * 2.2 - Math.sin(p * Math.PI * 1.6) * 1.4;
    controls.elevation = 0.14 + p * 0.42;
    hero.spin[1] = 0.22 + p * 0.55;
    aperture.rotation.z = p * 1.4;
    aperture2.rotation.y = -0.5 + p * 1.8;
    var fade = 1 - Math.min(1, Math.max(0, (p - 0.72) / 0.26));
    dust.opacity = 0.4 * (0.35 + fade * 0.65);
  });

  if (!reduced) scene.start();
  else { scene.tick(0.016, 0); }

  /* ------------------------------------------------------------------ *
   *  2D aurora backdrop behind the 3D layer
   * ------------------------------------------------------------------ */

  FX.backdrop(document.getElementById('bg2d'), {
    mode: 'field', count: 120, color: '#9fd8ff', accent: '#ffb0d8',
    shape: 'glow', resolution: 1, seed: 21
  });

  /* ------------------------------------------------------------------ *
   *  UI wiring
   * ------------------------------------------------------------------ */

  FX.mount(function () {
    // --- text + reveal orchestration ---
    FX.textIn(document.getElementById('heroTitle'), {
      mode: 'chars', stagger: 34, duration: 1200, distance: '1.05em'
    });
    FX.reveal({ stagger: 80 });
    FX.parallax('[data-speed]');
    FX.scrollBar(document.getElementById('progress'));
    FX.stickyNav(document.getElementById('topbar'));
    FX.scrollSpy({ rail: '.fx-rail' });
    FX.marquee(document.getElementById('marquee1'), { speed: 58 });

    if (!('ontouchstart' in window) && window.innerWidth > 900) {
      FX.cursor();
      document.body.classList.add('fx-custom-cursor');
    }
    FX.magnetic('[data-magnetic]');
    FX.tilt('[data-tilt]');
    FX.ripple('.btn');
    FX.spotlight('[data-spotlight]');
    FX.counters();
    FX.tooltip('[data-tip]');

    // --- tabs / accordion / rail ---
    FX.tabs('#stackTabs');
    FX.accordion('.accordion');
    FX.dragRail(document.querySelector('.tab-bar'), { wheel: false });
    var modal = FX.modal('[data-modal-open]', '#contactModal');

    document.getElementById('contactForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(e.target);
      var name = (data.get('name') || '').toString().trim();
      FX.toast('谢谢，' + (name || '朋友') + '！我通常 24 小时内回复。', { kind: 'ok', duration: 3600 });
      e.target.reset();
      if (modal) modal.close();
    });

    // --- toasts + clipboard ---
    FX.on(document.getElementById('toastDemo'), 'click', function () {
      FX.toast('这是一个动效组件：fx-toast', { kind: 'ok' });
    });
    function copyMail() {
      FX.copy('hi@aurora.dev').then(function () {
        FX.toast('邮箱已复制：hi@aurora.dev', { kind: 'ok' });
      });
    }
    FX.on(document.getElementById('copyEmail'), 'click', copyMail);
    FX.on(document.getElementById('copyEmail2'), 'click', copyMail);

    // --- optional UI sound ---
    var sound = FX.sound({ enabled: false });
    var sBtn = document.getElementById('soundToggle');
    FX.on(sBtn, 'click', function () {
      var on = sound.toggle();
      sBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      sBtn.innerHTML = '<span class="icon-sound"></span> ' + (on ? '音效开' : '音效');
      if (on) sound.click();
      FX.toast(on ? '界面音效已开启' : '界面音效已关闭');
    });
    FX.$$('.btn, .tab-btn, .fx-rail-dot').forEach(function (n) {
      FX.on(n, 'pointerenter', function () { sound.hover(); });
      FX.on(n, 'click', function () { sound.click(); });
    });

    /* ---------------------------------------------------------------- *
     *  Lab sliders wired straight into the render pipeline
     * ---------------------------------------------------------------- */

    function bind(id, out, fn, fmt) {
      var input = document.getElementById(id), label = document.getElementById(out);
      if (!input) return;
      function apply() {
        var v = parseFloat(input.value);
        if (label) label.textContent = fmt ? fmt(v) : v;
        fn(v);
      }
      input.addEventListener('input', apply);
      apply();
    }

    bind('rCount', 'vCount', function (v) {
      dust.count = Math.max(0, Math.round(v));
      dust._r = new Float32Array(Math.max(1, dust.count) * 4);
      dust._pt = new Float32Array(Math.max(1, dust.count) * 3);
      for (var i = 0; i < dust.count; i++) {
        dust._r[i * 4] = Math.random() * 2 - 1;
        dust._r[i * 4 + 1] = Math.random() * 2 - 1;
        dust._r[i * 4 + 2] = Math.random() * 2 - 1;
        dust._r[i * 4 + 3] = Math.random();
      }
    }, function (v) { return Math.round(v); });

    bind('rBloom', 'vBloom', function (v) { scene.bloom = v; }, function (v) { return v.toFixed(2); });
    bind('rSpin', 'vSpin', function (v) { controls.autoRotate = v; }, function (v) { return v.toFixed(2); });
    bind('rDist', 'vDist', function (v) { controls.distance = v; }, function (v) { return v.toFixed(1); });
    bind('rFog', 'vFog', function (v) {
      scene.fog.far = 8 + (1 - v) * 34;
      scene.fog.near = 3 + v * 6;
    }, function (v) { return v.toFixed(2); });

    // accent light colour swatches
    var pointLight = scene.lights[2];
    FX.$$('#swatches button').forEach(function (b) {
      b.addEventListener('click', function () {
        FX.$$('#swatches button').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        var c = DSE.utils.hex2rgb(b.getAttribute('data-color'));
        pointLight.color = c;
        hero.mat.glowColor = c;
        hero.mat.color = [c[0] * 0.85, c[1] * 0.92, c[2]];
        FX.toast('主光色 → ' + b.getAttribute('data-color'));
      });
    });
    FX.$$('#swatches button')[0].classList.add('is-active');

    // pause the loop when the tab is hidden (battery friendly)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) scene.stop();
      else if (!reduced) scene.start();
    });

    // reload guard for very small screens
    if (window.innerWidth < 620) {
      scene.setQuality(0.7);
      FX.toast('已为小屏切换到省电渲染', { duration: 3200 });
    }
  });
})();
