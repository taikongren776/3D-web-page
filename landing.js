/* ==========================================================================
   FIVE WORLDS — landing page for the five hand-written 3D sites
   ========================================================================== */
(function () {
  'use strict';

  var DSE = window.DSE, FX = window.FX;
  var geom = DSE.geom, mat = DSE.mat;
  var reduced = FX.prefersReduced();
  var isMobile = window.innerWidth <= 720;

  /* ================================================================== *
   *  Site catalogue — the single source of truth for cards + table
   * ================================================================== */

  var SITES = [
    {
      dir: 'sites/01-aurora-glass/index.html',
      n: '01', name: 'AURORA', cn: '极光玻璃',
      style: 'Glassmorphism / 柔和',
      body: '玻璃拟态、极光渐变与悬浮水晶群。滚动驱动相机，指针可拖拽整个场景；包含磁性按钮、三维倾斜卡片与实时调参面板。',
      three: '水晶群 / 碎片 / 光圈',
      for: '作品集 · 个人品牌',
      chips: ['玻璃拟态', '极光渐变', '调参面板', '倾斜卡片'],
      g1: 'rgba(124,240,255,.85)', g2: 'rgba(255,168,216,.7)',
      viz: 'shards'
    },
    {
      dir: 'sites/02-nexus-terminal/index.html',
      n: '02', name: 'NEXUS//NULL', cn: '赛博终端',
      style: 'Cyberpunk / 故障艺术',
      body: '线框竞技场、矩阵雨与真正的交互式终端。带启动序列、⌘K 命令面板、系统监控面板与故障抖动卡片。',
      three: '线框笼 / 参考网格 / 数据碎片',
      for: '工程师主页 · 技术作品',
      chips: ['交互终端', '命令面板', '矩阵雨', '故障艺术'],
      g1: 'rgba(77,255,195,.8)', g2: 'rgba(255,47,185,.7)',
      viz: 'wire'
    },
    {
      dir: 'sites/03-miami-vapor/index.html',
      n: '03', name: 'MIAMI_1997', cn: '蒸汽波桌面',
      style: 'Vaporwave / Y2K 桌面',
      body: '把个人网站做成 1997 年的操作系统：可拖拽窗口、任务栏、开机自检，还有一个用 Web Audio 实时合成的 FM 音序器与游客留言板。',
      three: '霓虹地平线 / 线框棕榈 / 光晕星球',
      for: '创意个人页 · 趣味展示',
      chips: ['窗口管理', '实时合成器', '留言板', 'Webring'],
      g1: 'rgba(255,45,149,.8)', g2: 'rgba(255,224,102,.7)',
      viz: 'sun'
    },
    {
      dir: 'sites/04-monolith-swiss/index.html',
      n: '04', name: 'MONOLITH', cn: '瑞士编辑',
      style: 'Swiss / 国际主义排版',
      body: '严格网格、巨大字阶与滚动驱动的立体石碑。含项目索引表、J/K 键浏览、拖拽画廊与真实数据表格。最克制也最考验排版的一版。',
      three: '石碑堆叠 / 校准环 / 参考方块',
      for: '设计工作室 · 顾问主页',
      chips: ['网格系统', '索引表格', '拖拽画廊', '键盘导航'],
      g1: 'rgba(255,59,47,.55)', g2: 'rgba(51,85,255,.5)',
      viz: 'slabs'
    },
    {
      dir: 'sites/05-kinetic-particle/index.html',
      n: '05', name: 'KINETIC', cn: '粒子动能',
      style: 'Motion graphics / 深色实验',
      body: '粒子场有真实受力模型：光标是斥力源，点击是冲击波。搭配液态金属球、星座网络与一个直连渲染管线的实时参数面板。',
      three: '液态金属球 / 粒子场 / 星座网络',
      for: '动效作品集 · 实验室主页',
      chips: ['受力粒子', '液态金属', '星座网络', '实时参数'],
      g1: 'rgba(110,231,255,.8)', g2: 'rgba(255,122,198,.7)',
      viz: 'particles'
    }
  ];

  /* ================================================================== *
   *  Background 3D: a slowly rotating cluster of mixed primitives
   * ================================================================== */

  var scene = new DSE.Scene(document.getElementById('stage'), {
    autoStart: false,
    alpha: true,
    fog: { color: '#04060c', near: 9, far: 40, density: 0.9 },
    bloom: 0.5,
    ambient: '#7d9bff',
    ambientIntensity: 0.62,
    maxFaces: reduced ? 3000 : (isMobile ? 4500 : 9000),
    resolution: isMobile ? 0.72 : 1
  });

  scene.add(new DSE.Light({ direction: [-0.5, 0.8, 0.6], intensity: 1.0, color: '#e6f2ff' }));
  scene.add(new DSE.Light({ direction: [0.7, -0.3, -0.6], intensity: 0.4, color: '#a78bfa' }));
  scene.add(new DSE.Light({ type: 'point', x: 3.4, y: 2.6, z: 3.4, intensity: 1.4, radius: 14, color: '#ff7ac6' }));

  // central wireframe icosahedron "engine core"
  var core = new DSE.Mesh(geom.wire(geom.icosahedron({ radius: 1.9, subdivide: 1 })),
    mat.wire({ color: '#7ff0ff', opacity: 0.62, edgeWidth: 1.2 }),
    { spinY: 0.14, spinX: 0.05 });
  scene.add(core);

  var innerCore = new DSE.Mesh(geom.icosahedron({ radius: 0.72, subdivide: 1 }),
    mat.metal({ color: '#2b3a7a', emissive: '#5c7bff', emissiveIntensity: 1.4, glow: 1, specular: 1 }),
    { spinY: -0.4, spinX: 0.25 });
  scene.add(innerCore);

  // five satellite shapes — one per site, each in that site's colour
  var SAT_COLORS = ['#7cf0ff', '#4dffc3', '#ff2d95', '#ff3b2f', '#a78bfa'];
  var SAT_GEOMS = [
    function () { return geom.octahedron({ radius: 0.34 }); },
    function () { return geom.box({ width: 0.5, height: 0.5, depth: 0.5 }); },
    function () { return geom.torus({ radius: 0.3, tube: 0.1, segments: 20, tubeSegments: 8 }); },
    function () { return geom.cylinder({ radius: 0.28, height: 0.6, segments: 6 }); },
    function () { return geom.tetrahedron({ radius: 0.42 }); }
  ];
  var satellites = [];
  for (var i = 0; i < 5; i++) {
    var m = new DSE.Mesh(SAT_GEOMS[i](), mat.metal({
      color: SAT_COLORS[i], emissive: SAT_COLORS[i], emissiveIntensity: 0.35,
      glow: 0.5, glowColor: SAT_COLORS[i], specular: 1, shininess: 50
    }), {
      orbit: {
        radius: 3.1 + (i % 2) * 0.5, speed: 0.13 + i * 0.022,
        phase: i / 5 * Math.PI * 2, height: ((i % 3) - 1) * 0.9, axis: 'x'
      },
      spinY: 0.7, spinX: 0.3
    });
    scene.add(m); satellites.push(m);
  }

  var ring = new DSE.Mesh(geom.ring({ inner: 2.6, outer: 2.66, segments: 90 }),
    mat.wire({ color: '#ffffff', opacity: 0.22, edgeWidth: 1 }), { rx: -1.15, ry: 0.1, spinZ: 0.06 });
  scene.add(ring);
  var ring2 = new DSE.Mesh(geom.ring({ inner: 3.4, outer: 3.44, segments: 90 }),
    mat.wire({ color: '#ff7ac6', opacity: 0.22, edgeWidth: 1 }), { rx: -0.7, rz: 0.45, spinY: -0.05 });
  scene.add(ring2);

  var dust = FX.scene.dust(scene, {
    count: isMobile ? 140 : 320,
    spread: [22, 13, 22],
    colors: ['#6ee7ff', '#a78bfa', '#ff7ac6', '#7cffc4', '#ffffff'],
    shape: 'glow', size: 1.5, opacity: 0.42, seed: 99
  });

  var controls = new DSE.Controls(scene, {
    distance: 10.4, azimuth: 0.5, elevation: 0.14,
    autoRotate: 0.14, damping: 0.9, pointerInfluence: 0.4,
    minDistance: 4.6, maxDistance: 20, minElevation: -0.8, maxElevation: 1.0
  });

  var scrollP = 0, smoothP = 0;
  function readScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    scrollP = h > 0 ? DSE.utils.clamp(window.scrollY / h, 0, 1) : 0;
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  scene.pre(function (sc, dt, t) {
    controls.update(dt, t);
    smoothP += (scrollP - smoothP) * Math.min(1, dt * 2.2);
    var p = smoothP;
    // The hero copy spans the left two thirds, so the cluster is pushed to the
    // right by aiming the camera left of it (a shared pan of position+target
    // would move nothing). Below 1024px the copy stacks and the scene is
    // centred again.
    var wide = sc.cssW > 1024;
    var shift = wide ? 4.2 : 0;
    sc.camera.target[0] = shift;
    sc.camera.target[1] = p * 2.4;
    controls.target[0] = shift;
    controls.distance = 10.4 + p * 4.5;
    controls.elevation = 0.14 - p * 0.25;
    core.rotation[1] += dt * (0.1 + p * 0.3);
    innerCore.scale[0] = innerCore.scale[1] = innerCore.scale[2] = 1 + Math.sin(t * 1.6) * 0.06;
    ring.rotation.z += dt * 0.08;
    ring2.rotation.z -= dt * 0.06;
    for (var k = 0; k < satellites.length; k++) {
      satellites[k].mat.emissiveIntensity = 0.25 + Math.abs(Math.sin(t * 0.6 + k)) * 0.5;
    }
    dust.opacity = 0.42 * (1 - p * 0.5);
  });

  if (!reduced) scene.start(); else scene.tick(0.016, 0);

  FX.backdrop(document.getElementById('bg2d'), {
    mode: 'field', count: 90, color: '#9fd8ff', accent: '#ffb0d8',
    shape: 'glow', seed: 5
  });

  /* ================================================================== *
   *  Card previews — tiny 2D sketches, one per site
   * ================================================================== */

  function preview(canvas, kind, t0) {
    var cx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var start = null;

    function frame(ts) {
      if (!start) start = ts;
      var t = (ts - start) / 1000;
      cx.clearRect(0, 0, w, h);
      cx.lineWidth = 1.4;

      if (kind === 'shards') {
        // glass shards drifting
        cx.strokeStyle = 'rgba(190,235,255,.85)';
        for (var i = 0; i < 9; i++) {
          var a = t * 0.4 + i * 0.7;
          var x = w / 2 + Math.cos(a + i) * (40 + (i % 3) * 34);
          var y = h / 2 + Math.sin(a * 1.3 + i) * (24 + (i % 4) * 12);
          var s = 10 + (i % 3) * 6;
          cx.fillStyle = 'rgba(160,215,255,' + (0.10 + (i % 4) * 0.05).toFixed(2) + ')';
          cx.beginPath();
          cx.moveTo(x, y - s); cx.lineTo(x + s * 0.8, y); cx.lineTo(x, y + s); cx.lineTo(x - s * 0.8, y);
          cx.closePath(); cx.fill(); cx.stroke();
        }
      } else if (kind === 'wire') {
        // wireframe cage + scan line
        cx.strokeStyle = 'rgba(77,255,195,.75)';
        var R = Math.min(w, h) * 0.32;
        for (var k = 0; k < 4; k++) {
          cx.beginPath();
          for (var j = 0; j <= 48; j++) {
            var th = j / 48 * 6.283;
            var rr = R * (0.6 + k * 0.16) * (1 + Math.sin(th * 3 + t * 1.4 + k) * 0.09);
            var px = w / 2 + Math.cos(th + t * 0.3) * rr;
            var py = h / 2 + Math.sin(th + t * 0.3) * rr * 0.72;
            j === 0 ? cx.moveTo(px, py) : cx.lineTo(px, py);
          }
          cx.closePath(); cx.stroke();
        }
        var sy = (t * 70) % h;
        cx.strokeStyle = 'rgba(255,47,185,.8)';
        cx.beginPath(); cx.moveTo(0, sy); cx.lineTo(w, sy); cx.stroke();
      } else if (kind === 'sun') {
        // vaporwave sun + grid
        var cxp = w / 2, cyp = h * 0.42, R2 = Math.min(w, h) * 0.26;
        var g = cx.createLinearGradient(0, cyp - R2, 0, cyp + R2);
        g.addColorStop(0, 'rgba(255,224,102,.95)');
        g.addColorStop(0.55, 'rgba(255,123,0,.9)');
        g.addColorStop(1, 'rgba(255,45,149,.9)');
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(cxp, cyp, R2, 0, 6.283); cx.fill();
        cx.fillStyle = 'rgba(11,4,32,.95)';
        for (var b = 0; b < 7; b++) {
          var yy = cyp + 6 + b * 5.4;
          cx.fillRect(cxp - R2, yy, R2 * 2, 1.4 + b * 0.5);
        }
        cx.strokeStyle = 'rgba(255,45,149,.6)';
        for (var gl = 0; gl < 9; gl++) {
          var ly = h - 4 - Math.pow(gl / 8, 1.9) * h * 0.5;
          cx.beginPath(); cx.moveTo(0, ly); cx.lineTo(w, ly); cx.stroke();
        }
        for (var gx = -4; gx <= 4; gx++) {
          cx.beginPath();
          cx.moveTo(w / 2 + gx * 12, h);
          cx.lineTo(w / 2 + gx * 70, h - h * 0.5);
          cx.stroke();
        }
      } else if (kind === 'slabs') {
        // stacked slabs rotating with the pointer-ish motion
        cx.strokeStyle = 'rgba(20,20,20,.85)';
        for (var s = 0; s < 6; s++) {
          var sw = 92 - s * 11;
          var sh = 9;
          var sx = w / 2 - sw / 2 + Math.sin(t * 0.8 + s * 0.5) * (6 + s * 2);
          var sy2 = h / 2 + 26 - s * 15;
          cx.fillStyle = s === 0 ? 'rgba(255,59,47,.9)' : 'rgba(245,242,235,.95)';
          cx.beginPath();
          cx.moveTo(sx + sw * 0.12, sy2 - sh / 2);
          cx.lineTo(sx + sw, sy2 - sh / 2);
          cx.lineTo(sx + sw * 0.88, sy2 + sh / 2);
          cx.lineTo(sx, sy2 + sh / 2);
          cx.closePath(); cx.fill(); cx.stroke();
        }
      } else {
        // particle field with a swirl
        for (var pi = 0; pi < 90; pi++) {
          var rnd = ((pi * 9301 + 49297) % 233280) / 233280;
          var rnd2 = ((pi * 4523 + 7919) % 104729) / 104729;
          var ang = t * (0.3 + rnd * 0.5) + rnd * 6.283;
          var rad = 14 + rnd2 * Math.min(w, h) * 0.42;
          var pxx = w / 2 + Math.cos(ang) * rad;
          var pyy = h / 2 + Math.sin(ang) * rad * 0.72;
          var cols = ['110,231,255', '167,139,250', '255,122,198', '124,255,196'];
          cx.fillStyle = 'rgba(' + cols[pi % 4] + ',' + (0.25 + rnd * 0.6).toFixed(2) + ')';
          cx.beginPath(); cx.arc(pxx, pyy, 1 + rnd2 * 2.1, 0, 6.283); cx.fill();
        }
        cx.strokeStyle = 'rgba(110,231,255,.55)';
        cx.beginPath();
        cx.arc(w / 2, h / 2, 26 + Math.sin(t) * 2, 0, 6.283);
        cx.stroke();
      }
      canvas._raf = requestAnimationFrame(frame);
    }
    canvas._raf = requestAnimationFrame(frame);
  }

  /* ================================================================== *
   *  Build the DOM
   * ================================================================== */

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  FX.mount(function () {
    var grid = document.getElementById('siteGrid');
    SITES.forEach(function (s, i) {
      var card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('data-tilt', '');
      card.setAttribute('data-tilt-max', '7');
      card.setAttribute('data-reveal', 'up');
      card.setAttribute('data-reveal-delay', String(i * 70));
      card.innerHTML =
        '<div class="card-visual" style="--g1:' + s.g1 + ';--g2:' + s.g2 + '">' +
        '<span class="glow"></span>' +
        '<canvas width="640" height="344"></canvas>' +
        '</div>' +
        '<div class="card-body">' +
        '<span class="style">' + esc(s.style) + '</span>' +
        '<h3>' + esc(s.name) + ' <span style="opacity:.55;font-size:.8em">/ ' + esc(s.cn) + '</span></h3>' +
        '<p>' + esc(s.body) + '</p>' +
        '</div>' +
        '<div class="card-foot">' +
        '<div class="chips">' + s.chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
        '<a class="open-link" href="' + s.dir + '" data-cursor="进入 ' + esc(s.name) + '">打开 →</a>' +
        '</div>';
      grid.appendChild(card);

      preview(card.querySelector('canvas'), s.viz);
    });

    // table rows
    var rows = document.getElementById('tableRows');
    SITES.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'trow';
      d.innerHTML = '<span class="n">' + s.n + '</span>' +
        '<span class="name"><a href="' + s.dir + '" data-cursor="打开">' + esc(s.name) + '</a>' +
        '<br><span class="dim">' + esc(s.cn) + '</span></span>' +
        '<span class="dim">' + esc(s.style) + '</span>' +
        '<span class="dim">' + esc(s.three) + '</span>' +
        '<span class="dim">' + esc(s.for) + '</span>';
      rows.appendChild(d);
    });

    /* ------------------------------ interactions ----------------------- */
    FX.textIn(document.getElementById('title'), { mode: 'chars', stagger: 40, duration: 1100, distance: '1.05em' });
    FX.reveal({ stagger: 70 });
    FX.tilt('[data-tilt]');
    FX.magnetic('[data-magnetic]');
    FX.ripple('.btn');
    FX.scrollBar(document.getElementById('progress'));
    FX.stickyNav(document.getElementById('topbar'));
    FX.counters();
    FX.tabs('#libTabs');
    FX.spotlight('[data-spotlight]');

    if (!('ontouchstart' in window) && window.innerWidth > 900) {
      FX.cursor();
      document.body.classList.add('fx-custom-cursor');
    }

    document.getElementById('randomBtn').addEventListener('click', function () {
      var pick = SITES[Math.floor(Math.random() * SITES.length)];
      FX.toast('随机选中：' + pick.name + ' — 正在打开…', { kind: 'ok', duration: 1600 });
      setTimeout(function () { location.href = pick.dir; }, 620);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) scene.stop();
      else if (!reduced) scene.start();
    });
  });
})();
