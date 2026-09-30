/* ==========================================================================
   MIAMI_1997 — vaporwave 3D horizon + Y2K window manager
   ========================================================================== */
(function () {
  'use strict';

  var DSE = window.DSE, FX = window.FX;
  var geom = DSE.geom, mat = DSE.mat;
  var reduced = FX.prefersReduced();
  var isMobile = window.innerWidth <= 860;

  /* ================================================================== *
   *  1. Boot
   * ================================================================== */

  var bootLines = [
    'MIAMI BIOS v1.997  Copyright (C) 1997 Neon Systems Inc.',
    'CPU    : Pentium(tm) MMX 233MHz ............ OK',
    'Memory : 65536 KB .......................... OK',
    'Detecting IDE drives ....................... 2 found',
    'Loading DSE.SYS (software rasterizer) ...... OK',
    'Loading FX.DRV (motion components) ......... OK',
    'Sound  : OPL3-FM synth ..................... READY',
    'Starting MIAMI_1997 desktop ................ GO'
  ];
  var bootEl = document.getElementById('boot');
  var bootMem = document.getElementById('bootMem');
  var bootBar = document.getElementById('bootBar');

  (function runBoot() {
    function finish() {
      bootEl.classList.add('is-done');
      setTimeout(function () {
        // belt and braces: drop it from the hit-testing tree entirely
        bootEl.style.display = 'none';
      }, 900);
      FX.toast('欢迎回到 1997 · 试试拖动窗口', { kind: 'ok', duration: 4200 });
    }
    if (reduced) { finish(); return; }
    // Hard failsafe: whatever happens to the sequence, the desktop becomes
    // reachable within 7s. A stalled animation must never lock the user out.
    var done = false;
    var failsafe = setTimeout(function () { if (!done) { done = true; finish(); } }, 7000);
    var i = 0;
    (function step() {
      if (i < bootLines.length) {
        bootMem.textContent += bootLines[i] + '\n';
        bootBar.style.width = Math.round((i + 1) / bootLines.length * 100) + '%';
        i++;
        setTimeout(step, 120 + Math.random() * 110);
      } else {
        setTimeout(function () {
          if (done) return;
          done = true;
          clearTimeout(failsafe);
          finish();
        }, 500);
      }
    })();
  })();

  /* ================================================================== *
   *  2. 3D vaporwave horizon
   * ================================================================== */

  var scene = new DSE.Scene(document.getElementById('stage'), {
    autoStart: false,
    alpha: true,
    background: null,
    fog: { color: '#1b0330', near: 10, far: 54, density: 1.35 },
    bloom: 0.7,
    ambient: '#7b3f9d',
    ambientIntensity: 0.48,
    maxFaces: reduced ? 3500 : (isMobile ? 5000 : 11000),
    resolution: isMobile ? 0.7 : 1
  });

  scene.add(new DSE.Light({ direction: [-0.3, 0.7, 0.65], intensity: 0.75, color: '#ffb0e0' }));
  scene.add(new DSE.Light({ direction: [0.6, -0.2, -0.7], intensity: 0.5, color: '#5ce1ff' }));
  scene.add(new DSE.Light({ type: 'point', x: 0, y: 4.4, z: -8, intensity: 2.4, radius: 30, color: '#ff5fa2' }));

  // perspective floor
  var floor = new DSE.Mesh(geom.plane({ width: 120, depth: 90, sx: 60, sz: 46 }),
    mat.wire({ color: '#ff2d95', opacity: 0.5, edgeWidth: 1 }), { y: -3.2 });
  scene.add(floor);

  // second, finer grid for a moire "sun glint"
  var floor2 = new DSE.Mesh(geom.plane({ width: 120, depth: 90, sx: 120, sz: 92 }),
    mat.wire({ color: '#22e3ff', opacity: 0.16, edgeWidth: 1 }), { y: -3.18 });
  scene.add(floor2);

  // skyline of boxes
  var rnd = DSE.utils.seeded(1997);
  var buildings = [];
  for (var b = 0; b < (isMobile ? 16 : 34); b++) {
    var hgt = 0.6 + rnd() * 4.6;
    var wid = 0.5 + rnd() * 1.1;
    var bm = new DSE.Mesh(geom.box({ width: wid, height: hgt, depth: wid }),
      mat.flat({
        color: '#150327',
        edge: rnd() > 0.5 ? '#22e3ff' : '#ff2d95',
        edgeWidth: 1,
        opacity: 0.9
      }),
      { x: (rnd() - 0.5) * 46, y: -3.2 + hgt / 2, z: (rnd() - 0.5) * 30 - 8 });
    scene.add(bm); buildings.push(bm);
  }

  // palm-tree-ish wire cones at the sides
  for (var p = 0; p < 8; p++) {
    var px = (p % 2 === 0 ? -1 : 1) * (7 + rnd() * 9);
    var pz = -4 - rnd() * 14;
    var ph = 2.2 + rnd() * 2.4;
    var trunk = new DSE.Mesh(geom.wire(geom.cylinder({ radius: 0.07, height: ph, segments: 7 })),
      mat.wire({ color: '#6ff9e0', opacity: 0.6 }), { x: px, y: -3.2 + ph / 2, z: pz });
    scene.add(trunk);
    var crown = new DSE.Mesh(geom.wire(geom.cone({ radius: 0.9 + rnd() * 0.5, height: 0.9, segments: 8, caps: false })),
      mat.wire({ color: '#ffe066', opacity: 0.7 }), { x: px, y: -3.2 + ph + 0.3, z: pz, spinY: 0.3 });
    scene.add(crown);
  }

  // big chrome torus "planet" ring far away
  var ring = new DSE.Mesh(geom.torus({ radius: 7, tube: 0.16, segments: 90, tubeSegments: 8 }),
    mat.metal({ color: '#ffd6f5', emissive: '#ff2d95', emissiveIntensity: 0.55, glow: 0.7, specular: 1 }),
    { z: -34, y: 9, rx: 1.15, spinZ: 0.06 });
  scene.add(ring);

  // floating wire pyramids
  var pyramids = [];
  for (var q = 0; q < 10; q++) {
    var pm = new DSE.Mesh(geom.wire(geom.tetrahedron({ radius: 0.35 + rnd() * 0.5 })),
      mat.wire({ color: q % 2 ? '#ff2d95' : '#22e3ff', opacity: 0.75 }),
      { x: (rnd() - 0.5) * 26, y: 1 + rnd() * 6, z: -4 - rnd() * 18, spinX: 0.4, spinY: 0.6 });
    pm.userData.baseY = pm.position[1];
    pm.userData.ph = rnd() * 6.28;
    pm.onUpdate = function (m, dt, t) {
      m.position[1] = m.userData.baseY + Math.sin(t * 0.8 + m.userData.ph) * 0.5;
      m.position[0] += Math.sin(t * 0.4 + m.userData.ph) * dt * 0.6;
    };
    scene.add(pm); pyramids.push(pm);
  }

  var dust = FX.scene.dust(scene, {
    count: isMobile ? 140 : 340,
    spread: [40, 16, 40], color: '#ffd6f5',
    colors: ['#ff2d95', '#22e3ff', '#ffe066', '#ffffff'],
    shape: 'glow', size: 1.6, opacity: 0.5, seed: 1997
  });

  // slow cinematic camera drift + scroll-driven descent
  var camScroll = 0, camTarget = 0;
  if (!isMobile) {
    window.addEventListener('wheel', function (e) { camTarget = DSE.utils.clamp(camTarget + e.deltaY * 0.0016, -1, 1); }, { passive: true });
  }
  var controls = new DSE.Controls(scene, {
    distance: 13, azimuth: 0, elevation: 0.1,
    autoRotate: 0.05, damping: 0.92, pointerInfluence: 0.22,
    minDistance: 6, maxDistance: 26, minElevation: -0.25, maxElevation: 0.7,
    drag: true, zoom: false
  });
  scene.pre(function (sc, dt, t) {
    controls.update(dt, t);
    camScroll += (camTarget - camScroll) * Math.min(1, dt * 1.6);
    sc.camera.target[1] = 0.4 + camScroll * 1.6;
    controls.elevation = 0.1 + camScroll * 0.22;
    ring.rotation.z += dt * 0.05;
    floor.mat.opacity = 0.36 + Math.abs(Math.sin(t * 0.5)) * 0.2;
    floor2.mat.opacity = 0.1 + Math.abs(Math.cos(t * 0.7)) * 0.12;
    dust.opacity = 0.36 + Math.abs(Math.sin(t * 0.4)) * 0.2;
  });

  if (!reduced) scene.start(); else scene.tick(0.016, 0);

  /* ================================================================== *
   *  3. Window manager
   * ================================================================== */

  var zTop = 20;
  var taskItems = document.getElementById('taskItems');
  var openWins = {};

  function openWindow(name, opts) {
    var win = document.getElementById('win-' + name);
    if (!win) return;
    win.classList.add('is-open');
    win.classList.remove('is-min');
    win.style.zIndex = ++zTop;
    openWins[name] = win;
    if (opts && opts.focus !== false) bringToFront(win, name);

    // initial placement (cascading), only the first time
    if (!win.dataset.placed && !isMobile) {
      win.dataset.placed = '1';
      var idx = Object.keys(openWins).length - 1;
      var vw = window.innerWidth, vh = window.innerHeight;
      var w = win.offsetWidth || 520;
      // The desktop icon rail occupies the left ~220px. Keep every window
      // clear of it, otherwise the first opened window sits on top of the
      // SKILLS / WEBRING icons and they become unreachable.
      var railRight = 232;
      var x = Math.min(vw - w - 24, railRight + 36 + idx * 52);
      x = Math.max(railRight + 8, x);
      var y = Math.max(74, Math.min(vh - 300, 84 + idx * 54));
      win.style.left = x + 'px';
      win.style.top = y + 'px';
    }
    syncTasks();
  }
  function closeWindow(win, name) {
    win.classList.remove('is-open');
    delete openWins[name];
    syncTasks();
  }
  function bringToFront(win, name) {
    win.style.zIndex = ++zTop;
    syncTasks();
  }
  function syncTasks() {
    taskItems.innerHTML = '';
    Object.keys(openWins).forEach(function (n) {
      var w = openWins[n];
      var chip = document.createElement('button');
      chip.className = 'task-chip' + (w.classList.contains('is-min') ? '' : ' is-active');
      chip.textContent = (w.querySelector('.win-title') || {}).textContent || n;
      chip.addEventListener('click', function () {
        if (w.classList.contains('is-min')) { w.classList.remove('is-min'); bringToFront(w, n); }
        else if (parseInt(w.style.zIndex, 10) === zTop) { w.classList.add('is-min'); syncTasks(); }
        else bringToFront(w, n);
      });
      taskItems.appendChild(chip);
    });
  }

  // dragging (pointer events, works for mouse + touch)
  Array.prototype.forEach.call(document.querySelectorAll('.win'), function (win) {
    var bar = win.querySelector('.win-bar');
    var name = win.getAttribute('data-win');
    var dx = 0, dy = 0, dragging = false;

    win.addEventListener('pointerdown', function () { bringToFront(win, name); });

    bar.addEventListener('pointerdown', function (e) {
      if (isMobile) return;
      dragging = true;
      win.classList.add('is-dragging');
      var r = win.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      bar.setPointerCapture && bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var vw = window.innerWidth, vh = window.innerHeight;
      var x = DSE.utils.clamp(e.clientX - dx, -40, vw - 120);
      var y = DSE.utils.clamp(e.clientY - dy, 0, vh - 70);
      win.style.left = x + 'px';
      win.style.top = y + 'px';
    });
    bar.addEventListener('pointerup', function () { dragging = false; win.classList.remove('is-dragging'); });
    bar.addEventListener('pointercancel', function () { dragging = false; win.classList.remove('is-dragging'); });

    win.querySelector('[data-win-close]').addEventListener('click', function () { closeWindow(win, name); });
    win.querySelector('[data-win-min]').addEventListener('click', function () { win.classList.add('is-min'); syncTasks(); });
  });

  // desktop icons + start menu + data-open-win buttons
  var ICONS = [
    { win: 'about', label: 'ABOUT_ME', icon: '▣', kind: 'txt' },
    { win: 'projects', label: 'PROJECTS', icon: '▤', kind: 'dir' },
    { win: 'player', label: 'SYNTH_PLAYER', icon: '♫', kind: 'music' },
    { win: 'skills', label: 'SKILLS.TXT', icon: '▥', kind: 'txt' },
    { win: 'guest', label: 'GUESTBOOK', icon: '✎', kind: 'web' },
    { win: 'ring', label: 'WEBRING', icon: '◎', kind: 'web' },
    { win: 'contact', label: 'CONTACT', icon: '✉', kind: 'txt' }
  ];
  var iconsEl = document.getElementById('desktopIcons');
  ICONS.forEach(function (it) {
    var b = document.createElement('button');
    b.className = 'dicon';
    b.setAttribute('data-icon', it.kind);
    b.innerHTML = '<i>' + it.icon + '</i><span>' + it.label + '</span>';
    b.addEventListener('click', function () { openWindow(it.win); });
    b.addEventListener('dblclick', function () { openWindow(it.win); });
    iconsEl.appendChild(b);
  });

  var startMenu = document.getElementById('startMenu');
  startMenu.innerHTML = ICONS.map(function (i) {
    return '<button data-open="' + i.win + '">' + i.icon + '  ' + i.label + '</button>';
  }).join('') + '<div class="sep"></div><button data-act="closeall">✕  关闭全部窗口</button>' +
    '<button data-act="reload">↻  重启工作站</button>';

  document.getElementById('startBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    startMenu.classList.toggle('is-open');
  });
  startMenu.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var w = b.getAttribute('data-open');
    if (w) openWindow(w);
    var act = b.getAttribute('data-act');
    if (act === 'closeall') { Object.keys(openWins).forEach(function (n) { closeWindow(openWins[n], n); }); }
    if (act === 'reload') location.reload();
    startMenu.classList.remove('is-open');
  });
  document.addEventListener('click', function () { startMenu.classList.remove('is-open'); });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open-win]');
    if (t) { e.preventDefault(); openWindow(t.getAttribute('data-open-win')); }
  });

  /* ================================================================== *
   *  4. Projects explorer
   * ================================================================== */

  var PROJECTS = [
    {
      file: 'HELIOS.EXE', size: '48 KB', date: '2025-03-11', title: 'Helios · 实时交易终端',
      desc: '12 路行情流压进单屏，用深度排序替代弹窗堆叠，关键路径缩短 41%。',
      tags: ['REALTIME', 'CANVAS', 'SYSTEM'], metric: '60 FPS / 1.2k 节点'
    },
    {
      file: 'GHOST.SYS', size: '36 KB', date: '2024-08-02', title: 'Ghost · 自动驾驶 HMI',
      desc: 'L3 级接管场景的三维感知视图，危险目标注意力捕获 380ms。',
      tags: ['AUTOMOTIVE', '3D UI', 'SAFETY'], metric: '接管确认 -27%'
    },
    {
      file: 'ARCHIVE.DIR', size: '62 KB', date: '2023-11-20', title: 'Archive · 数字文物库',
      desc: '零依赖旋转展柜，逐面着色模拟材质，4G 下 1.1 秒可交互。',
      tags: ['CULTURE', 'PERF', 'A11Y'], metric: 'LCP 1.1s'
    },
    {
      file: 'NEON_RADIO.APP', size: '21 KB', date: '2023-04-07', title: 'Neon Radio · 网页合成器',
      desc: '纯 Web Audio 的 8 轨步进音序器，无采样、无依赖，全部实时合成。',
      tags: ['AUDIO', 'WEB API', 'TOY'], metric: '8 轨 / 0 采样'
    }
  ];
  var fileList = document.getElementById('fileList');
  var projPreview = document.getElementById('projPreview');
  document.getElementById('fileCount').textContent = PROJECTS.length + ' 个对象';

  PROJECTS.forEach(function (p, i) {
    var li = document.createElement('li');
    li.innerHTML = '<i class="file-ico">▤</i><span>' + p.file + '</span>' +
      '<span class="fmeta">' + p.size + '</span><span class="fmeta">' + p.date + '</span>';
    li.addEventListener('click', function () {
      Array.prototype.forEach.call(fileList.children, function (c) { c.classList.remove('is-sel'); });
      li.classList.add('is-sel');
      projPreview.innerHTML = '<h4>' + p.title + '</h4><p>' + p.desc + '</p>' +
        '<p>' + p.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</p>' +
        '<p class="metric">▸ ' + p.metric + '</p>';
      FX.toast('打开 ' + p.file);
    });
    fileList.appendChild(li);
    if (i === 0) li.click();
  });

  /* ================================================================== *
   *  5. Skills window
   * ================================================================== */

  var SKILLS = [
    ['3D / 光栅器', 92], ['动效编排', 94], ['TypeScript', 90],
    ['设计系统', 86], ['Web Audio', 78], ['可访问性', 82]
  ];
  var skillGrid = document.getElementById('skillGrid');
  skillGrid.innerHTML = SKILLS.map(function (s) {
    return '<div class="skill-row"><span>' + s[0] + '</span><span class="skill-track"><i data-w="' + s[1] + '"></i></span><b>' + s[1] + '%</b></div>';
  }).join('');
  // animate bars when the window opens
  var skillsWin = document.getElementById('win-skills');
  var skillObserver = new MutationObserver(function () {
    if (skillsWin.classList.contains('is-open')) {
      Array.prototype.forEach.call(skillGrid.querySelectorAll('i'), function (f, i) {
        setTimeout(function () { f.style.width = f.getAttribute('data-w') + '%'; }, 90 + i * 90);
      });
    }
  });
  skillObserver.observe(skillsWin, { attributes: true, attributeFilter: ['class'] });

  /* ================================================================== *
   *  6. Webring
   * ================================================================== */

  var RING = ['YOU ARE HERE · MIAMI_1997', 'neon-garden.net', 'bbs.vinyl.cafe', 'pixel-arcade.jp',
    'sunset-drive.org', 'tape-deck.io', 'mallsoft.fm', 'crt-dreams.net'];
  var ringIdx = 0;
  var ringWheel = document.getElementById('ringWheel');

  function layoutRing() {
    var nodes = ringWheel.querySelectorAll('.ring-node');
    var R = isMobile ? 90 : 130;
    Array.prototype.forEach.call(nodes, function (n, i) {
      var ang = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      n.style.left = 'calc(50% + ' + (Math.cos(ang) * R).toFixed(1) + 'px)';
      n.style.top = 'calc(50% + ' + (Math.sin(ang) * R * 0.52).toFixed(1) + 'px)';
      n.style.transform = 'translate(-50%,-50%)';
      n.classList.toggle('is-active', i === ringIdx);
    });
  }
  RING.forEach(function (name, i) {
    var s = document.createElement('span');
    s.className = 'ring-node';
    s.textContent = name;
    s.addEventListener('click', function () { ringIdx = i; layoutRing(); FX.toast('访问 ' + name + ' （演示）'); });
    ringWheel.appendChild(s);
  });
  layoutRing();
  document.getElementById('ringPrev').addEventListener('click', function () { ringIdx = (ringIdx - 1 + RING.length) % RING.length; layoutRing(); });
  document.getElementById('ringNext').addEventListener('click', function () { ringIdx = (ringIdx + 1) % RING.length; layoutRing(); });
  document.getElementById('ringRandom').addEventListener('click', function () {
    ringIdx = Math.floor(Math.random() * RING.length); layoutRing();
    FX.toast('随机跳转 → ' + RING[ringIdx]);
  });

  /* ================================================================== *
   *  7. Guestbook (localStorage with safe fallback)
   * ================================================================== */

  var guestList = document.getElementById('guestList');
  var KEY = 'miami1997.guestbook.v1';
  var seed = [
    { n: 'xX_neon_Xx', m: '这个站太酷了！已加入收藏夹 ★', t: '1997-08-14 23:41' },
    { n: 'vinyl_cat', m: '请问背景音乐是什么合成器？', t: '1997-08-15 09:02' },
    { n: 'webmaster', m: '欢迎来到我的主页，签名请轻一点 :)', t: '1997-08-15 12:30' }
  ];
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { }
    return seed.slice();
  }
  var entries = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 40))); } catch (e) { } }
  function renderGuest() {
    guestList.innerHTML = entries.map(function (e) {
      return '<li><b>' + e.n.replace(/</g, '&lt;') + '</b><span class="when">' + e.t + '</span><br>' +
        e.m.replace(/</g, '&lt;') + '</li>';
    }).join('');
  }
  renderGuest();
  document.getElementById('guestForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var d = new Date();
    var ts = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    entries.unshift({ n: (fd.get('name') || 'anon').toString(), m: (fd.get('msg') || '').toString(), t: ts });
    save(); renderGuest();
    e.target.reset();
    FX.toast('签名已写入本地留言板', { kind: 'ok' });
  });

  /* ================================================================== *
   *  8. Web Audio FM synth player (no audio files)
   * ================================================================== */

  var TRACKS = [
    { name: 'MIDNIGHT MALL (112 BPM)', root: 55, mode: [0, 3, 5, 7, 10], arp: [0, 2, 4, 2, 1, 3, 5, 3], bass: [0, 0, 3, 5] },
    { name: 'NEON HIGHWAY (124 BPM)', root: 62, mode: [0, 2, 3, 7, 9], arp: [0, 3, 2, 4, 1, 2, 3, 4], bass: [0, -2, 3, -2] },
    { name: 'CRT DREAM (96 BPM)', root: 48, mode: [0, 4, 7, 11, 14], arp: [0, 2, 4, 3, 1, 4, 2, 0], bass: [0, 2, 4, 2] }
  ];
  var trackIdx = 0;

  var Synth = (function () {
    var ctx = null, master = null, filter = null, convGain = null, convolver = null;
    var playing = false, step = 0, timer = null;
    var tempo = 112, cutoff = 2200, reverbAmt = 0.35;
    var listeners = [];

    function ensure() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.16;
      filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = 6;
      convolver = ctx.createConvolver();
      // procedural impulse response for reverb
      var len = Math.floor(ctx.sampleRate * 1.4);
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var data = buf.getChannelData(c);
        for (var i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
      }
      convolver.buffer = buf;
      convGain = ctx.createGain(); convGain.gain.value = reverbAmt;
      master.connect(filter);
      filter.connect(ctx.destination);
      filter.connect(convGain);
      convGain.connect(convolver);
      convolver.connect(ctx.destination);
      return ctx;
    }

    function note(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

    function voice(freq, time, dur, type, gain, detune) {
      var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sawtooth'; o.frequency.value = freq;
      o2.type = 'square'; o2.frequency.value = freq * (detune || 1.005);
      g.gain.value = 0;
      o.connect(g); o2.connect(g); g.connect(master);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gain || 0.3, time + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
      o.start(time); o2.start(time);
      o.stop(time + dur + 0.03); o2.stop(time + dur + 0.03);
      return g;
    }

    function kick(time) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, time);
      o.frequency.exponentialRampToValueAtTime(42, time + 0.14);
      g.gain.setValueAtTime(0.9, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
      o.connect(g); g.connect(master);
      o.start(time); o.stop(time + 0.26);
    }
    function hat(time, gain) {
      var len = Math.floor(ctx.sampleRate * 0.05);
      var b = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var s = ctx.createBufferSource(); s.buffer = b;
      var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      var g = ctx.createGain(); g.gain.value = gain || 0.12;
      s.connect(f); f.connect(g); g.connect(master);
      s.start(time);
    }

    function schedule() {
      if (!playing || !ctx) return;
      var tr = TRACKS[trackIdx];
      var spb = 60 / tempo / 2; // 8th notes
      var t0 = ctx.currentTime + 0.06;
      for (var i = 0; i < 8; i++) {
        var t = t0 + i * spb;
        var lead = tr.mode[tr.arp[i] % tr.mode.length] + tr.root + 12;
        voice(note(lead), t, spb * 1.5, 'sawtooth', 0.16, 1.006);
        if (i % 2 === 0) {
          var bassN = tr.mode[tr.bass[(i / 2) % tr.bass.length] % tr.mode.length] + tr.root - 12;
          voice(note(bassN), t, spb * 1.7, 'triangle', 0.4, 1.001);
        }
        if (i % 4 === 0) kick(t);
        if (i % 2 === 1) hat(t, 0.1);
        if (i === 6) hat(t + spb * 0.5, 0.07);
      }
      step++;
      listeners.forEach(function (fn) { fn(step); });
      timer = setTimeout(schedule, spb * 8 * 1000);
    }

    return {
      toggle: function () {
        var c = ensure();
        if (!c) { FX.toast('这个浏览器没有 Web Audio', { kind: 'warn' }); return false; }
        if (c.state === 'suspended') c.resume();
        playing = !playing;
        if (playing) { schedule(); } else { clearTimeout(timer); }
        return playing;
      },
      stop: function () { playing = false; clearTimeout(timer); },
      isPlaying: function () { return playing; },
      setTempo: function (v) { tempo = v; },
      setCutoff: function (v) { cutoff = v; if (filter) filter.frequency.setTargetAtTime(v, ctx.currentTime, 0.05); },
      setReverb: function (v) { reverbAmt = v; if (convGain) convGain.gain.value = v; },
      setTrack: function (i) { trackIdx = i; },
      onStep: function (fn) { listeners.push(fn); },
      bpm: function () { return tempo; }
    };
  })();

  var eq = document.getElementById('eq');
  var BARS = 34;
  for (var e = 0; e < BARS; e++) eq.appendChild(document.createElement('i'));
  var eqBars = eq.querySelectorAll('i');
  var eqT = 0;

  Synth.onStep(function (s) {
    Array.prototype.forEach.call(eqBars, function (b, i) {
      var base = Math.abs(Math.sin(i * 0.4 + s * 0.6)) * 62;
      var jitter = Math.random() * 34;
      b.style.height = Math.max(6, Math.min(100, base + jitter)) + '%';
    });
  });

  function idleEq() {
    eqT += 0.04;
    Array.prototype.forEach.call(eqBars, function (b, i) {
      var v = 10 + Math.abs(Math.sin(eqT + i * 0.35)) * 16;
      b.style.height = v + '%';
    });
    requestAnimationFrame(idleEq);
  }
  idleEq();

  var playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', function () {
    var on = Synth.toggle();
    playBtn.textContent = on ? '❚❚ 暂停' : '▶ 播放';
    eq.classList.toggle('off', !on);
    FX.toast(on ? '正在播放：' + TRACKS[trackIdx].name : '已暂停', { kind: on ? 'ok' : undefined });
  });

  var trackList = document.getElementById('trackList');
  TRACKS.forEach(function (t, i) {
    var li = document.createElement('li');
    li.textContent = (i + 1) + '. ' + t.name;
    li.addEventListener('click', function () {
      trackIdx = i;
      Synth.setTrack(i);
      document.getElementById('trackName').textContent = t.name;
      Array.prototype.forEach.call(trackList.children, function (c) { c.classList.remove('is-sel'); });
      li.classList.add('is-sel');
      if (Synth.isPlaying()) { Synth.stop(); Synth.toggle(); }
      FX.toast('已选曲：' + t.name);
    });
    trackList.appendChild(li);
    if (i === 0) li.classList.add('is-sel');
  });
  document.getElementById('trackName').textContent = TRACKS[0].name;

  function bindSlider(id, out, fn, fmt) {
    var el = document.getElementById(id), lab = document.getElementById(out);
    function apply() { var v = parseFloat(el.value); lab.textContent = fmt ? fmt(v) : v; fn(v); }
    el.addEventListener('input', apply);
    apply();
  }
  bindSlider('tempo', 'tempoVal', function (v) { Synth.setTempo(v); }, function (v) { return Math.round(v); });
  bindSlider('cutoff', 'cutoffVal', function (v) { Synth.setCutoff(v); }, function (v) { return Math.round(v); });
  bindSlider('reverb', 'revVal', function (v) { Synth.setReverb(v / 100); }, function (v) { return Math.round(v); });

  document.getElementById('volBtn').addEventListener('click', function () {
    this.classList.toggle('is-on');
    FX.toast('音量图标切换（演示）');
  });

  var trayFps = document.getElementById('trayFps');
  setInterval(function () {
    trayFps.textContent = Math.round(scene.stats.fps || 60) + 'fps';
    var tri = document.getElementById('triReadout');
    if (tri) tri.textContent = scene.stats.tris;
  }, 1000);

  function clock() {
    var d = new Date();
    document.getElementById('trayClock').textContent =
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  setInterval(clock, 1000); clock();

  /* ================================================================== *
   *  9. Misc
   * ================================================================== */

  FX.mount(function () {
    FX.counters();
    FX.magnetic('[data-magnetic]');
    FX.ripple('.btn');
    FX.toast('演示站：所有窗口都可以拖动、最小化、关闭');

    document.getElementById('copyMail').addEventListener('click', function () {
      FX.copy('rei@miami1997.net');
      FX.toast('rei@miami1997.net 已复制', { kind: 'ok' });
    });

    // open the main window once the boot is done
    setTimeout(function () { openWindow('about'); }, reduced ? 100 : 1900);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { scene.stop(); Synth.stop(); playBtn.textContent = '▶ 播放'; eq.classList.add('off'); }
      else if (!reduced) scene.start();
    });

    // keyboard shortcuts 1-7 open windows
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= ICONS.length) openWindow(ICONS[n - 1].win);
      if (e.key === 'Escape') { startMenu.classList.remove('is-open'); }
    });
  });
})();
