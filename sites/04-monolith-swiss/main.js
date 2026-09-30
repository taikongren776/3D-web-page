/* ==========================================================================
   MONOLITH — Swiss editorial portfolio
   3D: scroll-driven slab stack + calibration rings, drawn on the hero canvas
   ========================================================================== */
(function () {
  'use strict';

  var DSE = window.DSE, FX = window.FX;
  var geom = DSE.geom, mat = DSE.mat, tex = DSE.tex;
  var reduced = FX.prefersReduced();
  var clamp = DSE.utils.clamp, lerp = DSE.utils.lerp;

  /* ================================================================== *
   *  1. 3D monolith — scroll is the timeline
   * ================================================================== */

  var scene = new DSE.Scene(document.getElementById('stage'), {
    autoStart: false,
    alpha: true,
    background: null,
    ambient: '#ffffff',
    ambientIntensity: 0.5,
    bloom: 0,
    sortFaces: true,
    maxFaces: reduced ? 3000 : 7000,
    resolution: window.innerWidth < 720 ? 0.85 : 1
  });

  scene.add(new DSE.Light({ direction: [-0.55, 0.75, 0.4], intensity: 0.95, color: '#ffffff' }));
  scene.add(new DSE.Light({ direction: [0.7, 0.2, -0.5], intensity: 0.35, color: '#cfe0ff' }));
  scene.add(new DSE.Light({ type: 'point', x: -3, y: 2.4, z: 3, intensity: 1.2, radius: 12, color: '#ffe3dc' }));

  /* The slab stack must live in the page's upper-right quadrant: the headline
     occupies a full-width band across the lower-left. Moving the whole stack
     in WORLD space is what shifts it on screen — translating camera.position
     and camera.target by the same amount just pans and changes nothing. */
  var SCENE_X = 3.6, SCENE_Y = 2.9;

  var SLABS = 6;
  var slabStack = [];
  for (var i = 0; i < SLABS; i++) {
    var w = 2.5 - i * 0.22;
    var slab = new DSE.Mesh(
      geom.box({ width: w, height: 0.3, depth: w * 0.72 }),
      mat.phong({
        color: i === 0 ? '#111111' : '#f4f1ea',
        edge: '#111111', edgeWidth: 1,
        shininess: 70, specular: 0.4
      }),
      { y: -1.5 + i * 0.72 + SCENE_Y, x: SCENE_X }
    );
    slab.userData.base = -1.5 + i * 0.72;
    slab.userData.idx = i;
    scene.add(slab);
    slabStack.push(slab);
  }

  // thin "measurement" ring around the stack
  var ringA = new DSE.Mesh(geom.ring({ inner: 2.1, outer: 2.22, segments: 96 }),
    mat.wire({ color: '#111111', opacity: 0.35, edgeWidth: 1 }), { rx: -1.2, ry: 0.1, x: SCENE_X, y: SCENE_Y });
  scene.add(ringA);
  var ringB = new DSE.Mesh(geom.ring({ inner: 2.7, outer: 2.76, segments: 96 }),
    mat.wire({ color: '#ff3b2f', opacity: 0.6, edgeWidth: 1.2 }), { rx: -0.75, rz: 0.5, x: SCENE_X, y: SCENE_Y });
  scene.add(ringB);
  var ringC = new DSE.Mesh(geom.ring({ inner: 3.1, outer: 3.14, segments: 96 }),
    mat.wire({ color: '#3355ff', opacity: 0.4, edgeWidth: 1 }), { rx: -1.5, rz: -0.4, ry: 0.3, x: SCENE_X, y: SCENE_Y });
  scene.add(ringC);

  // calibration marks: small tick boxes at the corners
  var ticks = [];
  for (var t = 0; t < 12; t++) {
    var a = t / 12 * Math.PI * 2;
    var tick = new DSE.Mesh(geom.wire(geom.box({ width: 0.09, height: 0.09, depth: 0.09 })),
      mat.wire({ color: '#111111', opacity: 0.45 }),
      { x: SCENE_X + Math.cos(a) * 3.7, y: SCENE_Y + Math.sin(a * 2) * 0.7, z: Math.sin(a) * 3.7 });
    scene.add(tick); ticks.push(tick);
  }

  // a single red reference cube for scale
  var refCube = new DSE.Mesh(geom.box({ width: 0.34, height: 0.34, depth: 0.34 }),
    mat.flat({ color: '#ff3b2f', edge: '#111111', edgeWidth: 1 }),
    { x: SCENE_X + 2.3, y: SCENE_Y - 1.9, z: 1.4, spinY: 0.5 });
  scene.add(refCube);

  var dust = FX.scene.dust(scene, {
    count: window.innerWidth < 720 ? 90 : 190,
    spread: [9, 8, 9], color: '#111111',
    colors: ['#111111', '#ff3b2f', '#3355ff'],
    shape: 'square', size: 1.1, opacity: 0.32, seed: 4, twinkle: 0.3
  });

  scene.camera.position[2] = 11.2;
  scene.camera.fov = 40;

  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', function (e) {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // hero scroll progress 0..1 across the first viewport
  var scrollP = 0, smoothP = 0;
  function readScroll() {
    var vh = window.innerHeight;
    scrollP = clamp(window.scrollY / (vh * 1.15), 0, 1);
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  var caption = document.getElementById('stageCaption');
  var CAPTIONS = [
    'FIG. 01 — MONOLITH / 立方体序列 / 滚动驱动',
    'FIG. 02 — 自转 24° / 层间距放大',
    'FIG. 03 — 拆解：层间偏移与旋转',
    'FIG. 04 — 校准环激活 / 参考立方体升起'
  ];

  scene.pre(function (sc, dt, t) {
    smoothP += (scrollP - smoothP) * Math.min(1, dt * 3);
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 2.4);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 2.4);
    var p = smoothP;

    // camera pans a little with the pointer; the stack itself already sits in
    // the upper-right via its world offset (SCENE_X / SCENE_Y)
    sc.camera.position[0] = mouse.x * 0.7;
    sc.camera.position[1] = 2.6 - mouse.y * 0.4 + p * 0.45;
    sc.camera.position[2] = 12.6 - p * 1.5;
    sc.camera.target[0] = SCENE_X * 0.5;
    sc.camera.target[1] = 2.4 + p * 0.3;

    // slab choreography
    for (var i = 0; i < slabStack.length; i++) {
      var s = slabStack[i];
      var k = i / (slabStack.length - 1);
      var fanOut = Math.sin(p * Math.PI) * (0.5 + k * 1.5);
      s.position[1] = s.userData.base + Math.sin(t * 0.5 + i * 0.6) * 0.05;
      s.position[0] = Math.sin(p * Math.PI * 1.5 + i) * fanOut * 0.5;
      s.position[2] = Math.cos(p * Math.PI + i * 0.4) * fanOut * 0.35;
      s.rotation[1] = p * (0.7 + k * 1.9) + mouse.x * 0.2;
      s.rotation[2] = Math.sin(p * Math.PI) * (k - 0.5) * 0.9;
      s.rotation[0] = p * 0.24 * (k - 0.5);
    }

    ringA.rotation.z = t * 0.1 + p * 1.6;
    ringB.rotation.y = t * 0.14 - p * 2.4;
    ringC.rotation.z = -t * 0.08 + p * 2.0;
    ringB.mat.opacity = 0.25 + p * 0.55;
    ringC.mat.opacity = 0.15 + p * 0.4;

    refCube.position[1] = -1.9 + p * 1.1;
    refCube.rotation[1] += dt * (0.4 + p);

    for (var j = 0; j < ticks.length; j++) {
      ticks[j].rotation[0] += dt * 0.5;
      ticks[j].rotation[1] += dt * 0.3;
    }

    dust.opacity = 0.22 + p * 0.2;

    if (caption) {
      var idx = Math.min(CAPTIONS.length - 1, Math.floor(p * CAPTIONS.length));
      if (caption.dataset.i !== String(idx)) {
        caption.dataset.i = String(idx);
        caption.textContent = CAPTIONS[idx];
      }
    }
  });

  if (!reduced) scene.start(); else scene.tick(0.016, 0);

  /* ================================================================== *
   *  2. Project index table
   * ================================================================== */

  var PROJECTS = [
    {
      n: '01', title: 'Helios', sub: '实时交易终端 / Trading Terminal', client: 'Nebula Capital',
      year: '2025', role: 'Lead Design Engineer', result: '60fps',
      desc: '把 12 路行情流压进单屏。用深度排序替代弹窗堆叠，交易员的平均决策路径缩短 41%，误操作率下降一半。',
      meta: [['交付周期', '14 周'], ['代码量', '9.4k 行'], ['性能', '60fps / 1.2k 节点'], ['团队', '4 人']],
      viz: 'bars', color: '#111111'
    },
    {
      n: '02', title: 'Ghost HMI', sub: '自动驾驶接管界面', client: '东岚汽车',
      year: '2024', role: '3D Interaction Lead', result: '-27%',
      desc: '为 L3 级接管场景设计的三维感知视图。危险目标的注意力捕获时间从 520ms 降到 380ms，接管确认率显著提升。',
      meta: [['场景数', '36'], ['渲染延迟', '16ms'], ['安全评审', 'Passed'], ['实车验证', '1.8 万 km']],
      viz: 'radar', color: '#3355ff'
    },
    {
      n: '03', title: 'Archive', sub: '数字文物展览库', client: '市立博物馆',
      year: '2023', role: 'Design Engineer', result: 'LCP 1.1s',
      desc: '零依赖的旋转展柜，用逐面着色模拟青铜与陶土材质。4G 网络下 1.1 秒可交互，可访问性达到 AAA。',
      meta: [['文物', '240 件'], ['体积', '62KB'], ['a11y', 'AAA'], ['无障碍评审', '通过']],
      viz: 'cube', color: '#00a37a'
    },
    {
      n: '04', title: 'Prism', sub: '数据叙事平台', client: 'Kite Analytics',
      year: '2023', role: 'Creative Technologist', result: '×2.4',
      desc: '把季度报表变成可旋转的晶体森林。演示场景下的信息留存率提升 2.4 倍，销售团队把它当默认演示稿。',
      meta: [['图表类型', '17'], ['演示转化', '×2.4'], ['维护成本', '-40%'], ['上线', '2023 Q2']],
      viz: 'bars', color: '#ff3b2f'
    },
    {
      n: '05', title: 'Halo', sub: '品牌官网重构', client: 'Halo Studio',
      year: '2022', role: 'Front-end Lead', result: '99 / 100',
      desc: '零第三方动效库的滚动编排系统，在保留电影级转场的同时把 Lighthouse 性能分做到 99。',
      meta: [['Lighthouse', '99'], ['首屏', '0.9s'], ['依赖', '0'], ['动效组件', '31']],
      viz: 'cube', color: '#3355ff'
    }
  ];

  var indexTable = document.getElementById('indexTable');
  var detail = document.getElementById('indexDetail');
  var rows = [];

  function drawThumb(canvas, kind, color) {
    var cx = canvas.getContext('2d');
    var t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts;
      var t = (ts - t0) / 1000;
      var w = canvas.width, h = canvas.height;
      cx.fillStyle = '#111111';
      cx.fillRect(0, 0, w, h);
      cx.strokeStyle = color;
      cx.fillStyle = color;
      cx.lineWidth = 1;
      if (kind === 'bars') {
        for (var i = 0; i < 14; i++) {
          var bh = (Math.sin(i * 1.3 + t * 2) * 0.5 + 0.5) * h * 0.7 + 4;
          cx.fillRect((i / 13) * (w - 6) + 3, h - bh - 4, 3, bh);
        }
      } else if (kind === 'radar') {
        var cxp = w / 2, cyp = h / 2, R = Math.min(w, h) * 0.42;
        cx.strokeStyle = color;
        for (var rr = R / 3; rr <= R + 1; rr += R / 3) { cx.beginPath(); cx.arc(cxp, cyp, rr, 0, 6.283); cx.stroke(); }
        var a = t * 2;
        cx.beginPath(); cx.moveTo(cxp, cyp); cx.lineTo(cxp + Math.cos(a) * R, cyp + Math.sin(a) * R); cx.stroke();
        cx.fillStyle = '#e8e4dc';
        for (var p = 0; p < 4; p++) {
          var pa = p * 1.9, pr = R * (0.35 + (p % 2) * 0.3);
          cx.beginPath(); cx.arc(cxp + Math.cos(pa) * pr, cyp + Math.sin(pa) * pr, 2, 0, 6.283); cx.fill();
        }
      } else {
        cx.save();
        cx.translate(w / 2, h / 2);
        var s = Math.min(w, h) * 0.3;
        cx.rotate(t * 0.5);
        cx.strokeStyle = color;
        cx.strokeRect(-s, -s, s * 2, s * 2);
        cx.beginPath();
        cx.moveTo(-s, -s); cx.lineTo(s, s);
        cx.moveTo(s, -s); cx.lineTo(-s, s);
        cx.stroke();
        cx.restore();
      }
      canvas._raf = requestAnimationFrame(frame);
    }
    canvas._raf = requestAnimationFrame(frame);
  }

  PROJECTS.forEach(function (p, i) {
    var row = document.createElement('div');
    row.className = 'index-row';
    row.setAttribute('data-cursor', '查看 ' + p.title);
    row.innerHTML =
      '<span class="num">' + p.n + '</span>' +
      '<span class="proj">' + p.title + '<small>' + p.sub + '</small></span>' +
      '<span class="client">' + p.client + '</span>' +
      '<span class="year">' + p.year + '</span>' +
      '<span class="role">' + p.role + '</span>' +
      '<span class="result">' + p.result + '</span>' +
      '<span class="thumb"><canvas width="264" height="176"></canvas></span>';

    function select() {
      rows.forEach(function (r) { r.classList.remove('is-active'); });
      row.classList.add('is-active');
      detail.innerHTML =
        '<h3>' + p.n + ' · ' + p.title + ' — ' + p.sub + '</h3>' +
        '<p>' + p.desc + '</p>' +
        '<div class="meta-grid">' + p.meta.map(function (m) {
          return '<div><dt>' + m[0] + '</dt><dd>' + m[1] + '</dd></div>';
        }).join('') + '</div>';
    }
    row.addEventListener('click', select);
    row.addEventListener('pointerenter', function () { if (!row._started) { row._started = true; } });

    var cv = row.querySelector('canvas');
    drawThumb(cv, p.viz, p.color);
    indexTable.appendChild(row);
    rows.push(row);
    if (i === 0) select();
  });

  /* ================================================================== *
   *  3. Horizontal rail with procedural tiles
   * ================================================================== */

  var TILES = [
    { name: 'Grid Study', meta: 'CANVAS · 2025', kind: 'grid', c1: '#111111', c2: '#ff3b2f' },
    { name: 'Waveform', meta: 'MOTION · 2024', kind: 'wave', c1: '#3355ff', c2: '#e8e4dc' },
    { name: 'Halftone', meta: 'PRINT · 2024', kind: 'halftone', c1: '#111111', c2: '#e8e4dc' },
    { name: 'Iso Bars', meta: 'DATA · 2023', kind: 'bars', c1: '#00a37a', c2: '#111111' },
    { name: 'Radial', meta: '3D · 2023', kind: 'radial', c1: '#ff3b2f', c2: '#111111' },
    { name: 'Type Specimen', meta: 'TYPE · 2022', kind: 'type', c1: '#111111', c2: '#e8e4dc' }
  ];
  var rail = document.getElementById('rail');
  TILES.forEach(function (tile) {
    var wrap = document.createElement('figure');
    wrap.className = 'tile';
    wrap.setAttribute('data-cursor', tile.name);
    wrap.innerHTML = '<canvas width="560" height="340"></canvas>' +
      '<figcaption class="tile-meta"><b>' + tile.name + '</b><span>' + tile.meta + '</span></figcaption>';
    rail.appendChild(wrap);
    var cv = wrap.querySelector('canvas'), cx = cv.getContext('2d');
    var t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts;
      var time = (ts - t0) / 1000;
      var w = cv.width, h = cv.height;
      cx.fillStyle = '#f2efe9'; cx.fillRect(0, 0, w, h);
      cx.lineWidth = 1.4;
      if (tile.kind === 'grid') {
        var base = 34, off = (time * 26) % base;
        cx.strokeStyle = 'rgba(17,17,17,.3)';
        for (var gx = -base + off; gx < w; gx += base) { cx.beginPath(); cx.moveTo(gx, 0); cx.lineTo(gx, h); cx.stroke(); }
        for (var gy = -base + off; gy < h; gy += base) { cx.beginPath(); cx.moveTo(0, gy); cx.lineTo(w, gy); cx.stroke(); }
        cx.fillStyle = tile.c2;
        cx.fillRect(w * 0.3, h * 0.3, base * 2, base * 2);
        cx.strokeStyle = '#111'; cx.strokeRect(w * 0.3, h * 0.3, base * 2, base * 2);
      } else if (tile.kind === 'wave') {
        cx.strokeStyle = tile.c1;
        for (var l = 0; l < 5; l++) {
          cx.beginPath();
          for (var x = 0; x <= w; x += 5) {
            var y = h / 2 + Math.sin(x * 0.02 + time * (1 + l * 0.4) + l) * (h * 0.14) * (1 + l * 0.25);
            x === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
          }
          cx.globalAlpha = 1 - l * 0.16;
          cx.stroke();
        }
        cx.globalAlpha = 1;
      } else if (tile.kind === 'halftone') {
        for (var i = 0; i < w; i += 15) {
          for (var j = 0; j < h; j += 15) {
            var r = (1 - j / h) * 7 + Math.sin(time + i * 0.05) * 0.8 + 0.4;
            cx.fillStyle = '#111';
            cx.beginPath(); cx.arc(i + 7, j + 7, Math.max(0.3, r), 0, 6.283); cx.fill();
          }
        }
      } else if (tile.kind === 'bars') {
        cx.fillStyle = tile.c1;
        for (var b = 0; b < 22; b++) {
          var bh = (Math.sin(b * 0.7 + time * 1.6) * 0.5 + 0.5) * h * 0.75 + 8;
          cx.fillRect((b / 21) * (w - 16) + 8, h - bh - 8, 9, bh);
        }
      } else if (tile.kind === 'radial') {
        cx.save(); cx.translate(w / 2, h / 2);
        cx.strokeStyle = '#111';
        for (var k = 0; k < 18; k++) {
          var a = k / 18 * 6.283 + time * 0.4;
          var r1 = 40 + Math.sin(time + k) * 10, r2 = 120 + Math.cos(time * 0.7 + k) * 22;
          cx.beginPath(); cx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          cx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); cx.stroke();
        }
        cx.strokeStyle = tile.c1; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(0, 0, 46, 0, 6.283); cx.stroke();
        cx.restore();
      } else {
        cx.fillStyle = '#111';
        cx.font = '700 108px Helvetica, Arial, sans-serif';
        cx.fillText('Aa', 30, 140);
        cx.font = '400 22px ui-monospace, monospace';
        cx.fillText('HELVETICA / 8PT BASELINE', 30, 190);
        cx.strokeStyle = 'rgba(17,17,17,.2)';
        for (var bl = 220; bl < h - 20; bl += 16) {
          cx.beginPath(); cx.moveTo(30, bl); cx.lineTo(w - 30, bl); cx.stroke();
        }
        cx.fillStyle = tile.c2;
        cx.fillRect(30, 214, w - 60, 4);
      }
      cv._raf = requestAnimationFrame(frame);
    }
    cv._raf = requestAnimationFrame(frame);
  });

  FX.mount(function () {
    FX.dragRail(rail, { wheel: true });
    var railProgress = document.getElementById('railProgress');
    function updRail() {
      var max = rail.scrollWidth - rail.clientWidth;
      var p = max > 0 ? rail.scrollLeft / max : 0;
      railProgress.style.transform = 'translateX(' + (p * 400) + '%)';
      railProgress.style.width = '25%';
    }
    rail.addEventListener('scroll', updRail, { passive: true });
    updRail();

    /* ---------------------------- reveal etc --------------------------- */
    FX.textIn(document.getElementById('heroTitle'), { mode: 'chars', stagger: 42, duration: 1100, distance: '1.1em' });
    FX.reveal({ stagger: 70 });
    FX.scrollBar(document.getElementById('progress'));
    FX.stickyNav(document.getElementById('masthead'));
    FX.marquee(document.getElementById('ticker1'), { speed: 46 });
    FX.magnetic('[data-magnetic]');
    FX.accordion('.accordion');
    FX.counters();
    FX.ripple('.btn');

    if (!('ontouchstart' in window) && window.innerWidth > 1000) {
      FX.cursor();
      document.body.classList.add('fx-custom-cursor');
    }

    function clock() {
      var d = new Date();
      document.getElementById('clock').textContent =
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    setInterval(clock, 1000); clock();

    document.getElementById('enquiryForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      FX.toast('已收到询问 · ' + (fd.get('name') || '') + ' — 我会在两个工作日内回复。', { kind: 'ok', duration: 3800 });
      e.target.reset();
    });

    // keyboard: j/k to walk the index
    var active = 0;
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'j' || e.key === 'k') {
        active = clamp(active + (e.key === 'j' ? 1 : -1), 0, rows.length - 1);
        rows[active].click();
        rows[active].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) scene.stop();
      else if (!reduced) scene.start();
    });

    FX.toast('提示：按 J / K 键可以在索引中上下切换。', { duration: 4200 });
  });
})();
