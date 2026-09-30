/* ==========================================================================
   NEXUS//NULL — cyberpunk terminal portfolio
   3D: wireframe cage / killer-grid arena / floating data shards
   ========================================================================== */
(function () {
  'use strict';

  var DSE = window.DSE, FX = window.FX;
  var geom = DSE.geom, mat = DSE.mat, tex = DSE.tex;
  var reduced = FX.prefersReduced();

  /* ================================================================== *
   *  1. Boot sequence
   * ================================================================== */

  var bootLines = [
    ['[ OK ] mounting /dev/creativity', 'ok'],
    ['[ OK ] loading dse.js :: software rasterizer', 'ok'],
    ['[ OK ] shaders: none required', 'ok'],
    ['[ .. ] calibrating neon grid', ''],
    ['[ OK ] fx.js :: 40+ motion components online', 'ok'],
    ['[ OK ] security: prefers-reduced-motion honored', 'ok'],
    ['[ >> ] BOOT COMPLETE — welcome, visitor.', 'ok']
  ];
  var bootEl = document.getElementById('boot');
  var bootLinesEl = document.getElementById('bootLines');
  var bootBar = document.getElementById('bootBar');
  var logFeed = document.getElementById('logFeed');

  function feed(html, cls) {
    if (!logFeed) return;
    var li = document.createElement('li');
    if (cls) li.className = cls;
    li.innerHTML = html;
    logFeed.insertBefore(li, logFeed.firstChild);
    while (logFeed.children.length > 7) logFeed.removeChild(logFeed.lastChild);
  }

  (function runBoot() {
    function finish() {
      bootEl.classList.add('is-done');
      setTimeout(function () { bootEl.style.display = 'none'; }, 900);
      FX.toast('系统已就绪 · NEXUS//NULL v2.0.7', { kind: 'ok', duration: 3200 });
    }
    if (reduced) { finish(); return; }
    // Hard failsafe so a stalled boot sequence can never lock the page
    var done = false;
    var failsafe = setTimeout(function () { if (!done) { done = true; finish(); } }, 7000);
    var i = 0;
    (function step() {
      if (i < bootLines.length) {
        var d = document.createElement('div');
        d.className = bootLines[i][1];
        d.textContent = bootLines[i][0];
        bootLinesEl.appendChild(d);
        bootBar.style.width = Math.round((i + 1) / bootLines.length * 100) + '%';
        i++;
        setTimeout(step, 130 + Math.random() * 90);
      } else {
        setTimeout(function () {
          if (done) return;
          done = true;
          clearTimeout(failsafe);
          finish();
        }, 420);
      }
    })();
  })();

  /* ================================================================== *
   *  2. 3D scene — wireframe arena
   * ================================================================== */

  var scene = new DSE.Scene(document.getElementById('stage'), {
    autoStart: false,
    alpha: true,
    fog: { color: '#05070a', near: 5, far: 30, density: 1.2 },
    bloom: 0.55,
    ambient: '#1d3b46',
    ambientIntensity: 0.5,
    maxFaces: reduced ? 3500 : 9000,
    resolution: window.innerWidth < 720 ? 0.7 : 1
  });

  scene.add(new DSE.Light({ direction: [-0.4, 0.9, 0.5], intensity: 0.9, color: '#5fffd0' }));
  scene.add(new DSE.Light({ direction: [0.8, -0.4, -0.5], intensity: 0.45, color: '#ff2fb9' }));
  scene.add(new DSE.Light({ type: 'point', x: -2.5, y: 1.5, z: 3.2, intensity: 1.6, radius: 9, color: '#1de9ff' }));

  var arena = FX.scene.gridArena(scene, {
    size: 30, gridColor: '#12d6a8', cageColor: '#ff2fb9',
    cage: 2.9, core: 1.2, coreColor: '#06131a', floorY: 2.7
  });

  // orbiting data shards (wire boxes)
  var shards = [];
  for (var s = 0; s < 14; s++) {
    var sz = 0.12 + Math.random() * 0.26;
    var m = new DSE.Mesh(geom.wire(geom.box({ width: sz, height: sz, depth: sz })),
      mat.wire({ color: s % 3 === 0 ? '#1de9ff' : (s % 3 === 1 ? '#4dffc3' : '#ff2fb9'), opacity: 0.8, edgeWidth: 1 }),
      {
        x: Math.cos(s / 14 * Math.PI * 2) * 5.4,
        y: (Math.random() - 0.5) * 4.2,
        z: Math.sin(s / 14 * Math.PI * 2) * 5.4
      });
    m.userData.ph = Math.random() * 6.28;
    m.onUpdate = function (mesh, dt, t) {
      var a = t * 0.22 + mesh.userData.ph;
      var r = 5.4;
      mesh.position[0] = Math.cos(a + mesh.userData.ph) * r;
      mesh.position[2] = Math.sin(a + mesh.userData.ph) * r;
      mesh.rotation[1] += dt * 0.9;
      mesh.rotation[0] += dt * 0.4;
    };
    scene.add(m); shards.push(m);
  }

  // rotating wire "node" markers at the bottom
  var markers = [];
  for (var k = 0; k < 9; k++) {
    var ang = k / 9 * Math.PI * 2;
    var mk = new DSE.Mesh(geom.wire(geom.octahedron({ radius: 0.24 })),
      mat.wire({ color: '#4dffc3', opacity: 0.55, edgeWidth: 1 }),
      { x: Math.cos(ang) * 8.5, y: -2.55, z: Math.sin(ang) * 8.5 });
    mk.userData.base = -2.55;
    mk.userData.ph = ang;
    mk.onUpdate = function (mesh, dt, t) {
      mesh.position[1] = mesh.userData.base + Math.abs(Math.sin(t * 1.1 + mesh.userData.ph)) * 0.5;
      mesh.rotation[1] += dt * 1.4;
    };
    scene.add(mk); markers.push(mk);
  }

  var dust = FX.scene.dust(scene, {
    count: window.innerWidth < 720 ? 180 : 380,
    spread: [22, 12, 22], color: '#4dffc3',
    colors: ['#4dffc3', '#1de9ff', '#ff2fb9', '#ffffff'],
    shape: 'square', size: 1.4, opacity: 0.4, seed: 33
  });

  var controls = new DSE.Controls(scene, {
    distance: 10.5, azimuth: 0.4, elevation: 0.16,
    autoRotate: 0.13, damping: 0.9, pointerInfluence: 0.32,
    minDistance: 5, maxDistance: 20, minElevation: -0.5, maxElevation: 0.9
  });
  scene.pre(function (sc, dt, t) { controls.update(dt, t); });

  // grid pulse driven by live "load"
  var load = 0.4;
  scene.pre(function (sc, dt, t) {
    load += (Math.abs(Math.sin(t * 0.24)) * 0.7 + 0.3 - load) * Math.min(1, dt);
    arena.cage.rotation[1] += dt * 0.1;
    arena.cage.scale[0] = arena.cage.scale[1] = arena.cage.scale[2] = 1 + Math.sin(t * 0.9) * 0.02 * load;
    arena.core.mat.emissiveIntensity = 0.7 + load * 0.9;
    arena.floor.mat.opacity = 0.24 + load * 0.3;
  });

  if (!reduced) scene.start();
  else scene.tick(0.016, 0);

  // matrix rain backdrop
  FX.backdrop(document.getElementById('rain'), {
    mode: 'matrix', count: 1, chars: '01ｱｲｳｴｵｶｷｸｹｺ<>[]{}/*+-=#@$%&', color: '#4dffc3',
    seed: 8, resolution: 0.8
  });

  /* ================================================================== *
   *  3. Telemetry widgets
   * ================================================================== */

  var barNames = ['CPU', 'GPU', 'MEM', 'NET', 'RAST', 'GC'];
  var barsEl = document.getElementById('bars');
  var barNodes = [];
  barNames.forEach(function (n) {
    var row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = '<span>' + n + '</span><span class="bar-track"><i class="bar-fill"></i></span><b>0%</b>';
    barsEl.appendChild(row);
    barNodes.push({ row: row, fill: row.querySelector('.bar-fill'), val: row.querySelector('b'), v: 0.3 + Math.random() * 0.4 });
  });

  setInterval(function () {
    var fps = scene.stats.fps || 60;
    barNodes.forEach(function (b, i) {
      var target = i === 4 ? Math.min(1, scene.stats.tris / scene.maxFaces)
        : 0.22 + Math.random() * 0.55;
      b.v += (target - b.v) * 0.4;
      var pct = Math.round(b.v * 100);
      b.fill.style.width = pct + '%';
      b.val.textContent = pct + '%';
      b.row.classList.toggle('warn', pct > 78);
    });
    document.getElementById('memLabel').textContent = 'MEM ' + Math.round(38 + Math.random() * 16) + '%';
    document.getElementById('netLabel').textContent = 'NET ' + (8 + Math.random() * 12).toFixed(1) + ' Mb/s';
    document.getElementById('fpsReadout').textContent = Math.round(fps) + ' fps';
    document.getElementById('triReadout').textContent = scene.stats.tris;
  }, 900);

  var logMsgs = [
    ['info', 'rasterizer: ' + 'frame batch sorted'],
    ['info', 'camera rig damped'],
    ['warn', 'thermal margin 18%'],
    ['info', 'fx.marquee() attached'],
    ['info', 'palette index rebuilt'],
    ['err', 'chromatic aberration spike'],
    ['info', 'reduced-motion probe: false'],
    ['warn', 'pointer velocity high']
  ];
  var li = 0;
  setInterval(function () {
    var m = logMsgs[li++ % logMsgs.length];
    var d = new Date();
    var ts = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (v) { return String(v).padStart(2, '0'); }).join(':');
    feed('<b>' + ts + '</b><span class="lvl">[' + m[0].toUpperCase() + ']</span><span>' + m[1] + '</span>', m[0]);
  }, 2100);
  feed('<b>--:--:--</b><span class="lvl">[INFO]</span><span>stdout attached</span>');

  // clock
  function tickClock() {
    var d = new Date();
    document.getElementById('clock').textContent =
      [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (v) { return String(v).padStart(2, '0'); }).join(':');
  }
  setInterval(tickClock, 1000); tickClock();

  /* ================================================================== *
   *  4. Ops cards (generated + mini canvas visuals)
   * ================================================================== */

  var OPS = [
    {
      id: 'OP-4412', title: 'Helios · 实时交易终端', year: '2025',
      desc: '把 12 路行情流压进单屏：用深度排序替代弹窗，关键操作路径缩短 41%。',
      tags: ['CANVAS', 'REALTIME', 'DESIGN SYSTEM'],
      stats: [['FPS', '60'], ['节点', '1.2k'], ['体积', '48KB']],
      viz: 'wave'
    },
    {
      id: 'OP-3907', title: 'Ghost · 自动驾驶 HMI', year: '2024',
      desc: '为 L3 级接管场景设计的三维感知视图，危险目标的注意力捕获时间缩短到 380ms。',
      tags: ['AUTOMOTIVE', '3D UI', 'SAFETY'],
      stats: [['场景', '36'], ['延迟', '16ms'], ['测试', 'AA']],
      viz: 'radar'
    },
    {
      id: 'OP-2261', title: 'Archive · 数字文物库', year: '2023',
      desc: '零依赖的旋转展柜，用逐面着色模拟材质，首屏在 4G 网络下 1.1 秒可交互。',
      tags: ['CULTURE', 'PERF', 'A11Y'],
      stats: [['LCP', '1.1s'], ['体积', '62KB'], ['a11y', 'AAA']],
      viz: 'grid'
    }
  ];

  var opsGrid = document.getElementById('opsGrid');
  OPS.forEach(function (op, i) {
    var card = document.createElement('article');
    card.className = 'op-card';
    card.setAttribute('data-cursor', 'OPEN ' + op.id);
    card.innerHTML =
      '<div class="op-visual"><canvas></canvas></div>' +
      '<div class="op-top"><span class="op-id">' + op.id + '</span><span>' + op.year + '</span></div>' +
      '<h3>' + op.title + '</h3>' +
      '<p>' + op.desc + '</p>' +
      '<div class="op-meta">' + op.tags.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>' +
      '<div class="op-stats">' + op.stats.map(function (s) { return '<span>' + s[0] + ' <b>' + s[1] + '</b></span>'; }).join('') + '</div>';

    card.addEventListener('pointerenter', function () {
      card.classList.add('glitching');
      setTimeout(function () { card.classList.remove('glitching'); }, 720);
    });
    card.addEventListener('click', function () {
      FX.toast(op.id + ' :: ' + op.title + ' — 详情页在演示中省略', { kind: 'ok' });
    });
    opsGrid.appendChild(card);

    // local 2D canvas visualisations
    var cv = card.querySelector('canvas');
    var cx = cv.getContext('2d');
    var w = 0, h = 0, t0 = 0;
    function size() {
      var r = cv.getBoundingClientRect();
      w = cv.width = Math.max(1, Math.round(r.width)); h = cv.height = Math.max(1, Math.round(r.height));
    }
    size();
    window.addEventListener('resize', size);
    function draw(ts) {
      if (!t0) t0 = ts;
      var t = (ts - t0) / 1000;
      cx.clearRect(0, 0, w, h);
      cx.strokeStyle = 'rgba(77,255,195,.75)';
      cx.lineWidth = 1;
      if (op.viz === 'wave') {
        for (var l = 0; l < 3; l++) {
          cx.beginPath();
          for (var x = 0; x <= w; x += 4) {
            var y = h / 2 + Math.sin(x * 0.03 + t * (2 + l) + l) * (h * 0.18) * (1 + l * 0.2);
            x === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
          }
          cx.strokeStyle = l === 0 ? 'rgba(77,255,195,.85)' : 'rgba(29,233,255,.5)';
          cx.stroke();
        }
      } else if (op.viz === 'radar') {
        var cxp = w / 2, cyp = h / 2, R = Math.min(w, h) * 0.42;
        cx.strokeStyle = 'rgba(77,255,195,.28)';
        for (var rr = R / 3; rr <= R; rr += R / 3) { cx.beginPath(); cx.arc(cxp, cyp, rr, 0, 6.283); cx.stroke(); }
        var a = t * 1.6;
        cx.strokeStyle = 'rgba(77,255,195,.9)';
        cx.beginPath(); cx.moveTo(cxp, cyp); cx.lineTo(cxp + Math.cos(a) * R, cyp + Math.sin(a) * R); cx.stroke();
        cx.fillStyle = 'rgba(255,47,185,.9)';
        for (var p = 0; p < 5; p++) {
          var pa = p * 1.7, pr = R * (0.3 + (p % 3) * 0.22);
          cx.beginPath(); cx.arc(cxp + Math.cos(pa) * pr, cyp + Math.sin(pa) * pr, 2, 0, 6.283); cx.fill();
        }
      } else {
        cx.strokeStyle = 'rgba(77,255,195,.22)';
        for (var gx = 0; gx < w; gx += 14) { cx.beginPath(); cx.moveTo(gx, 0); cx.lineTo(gx, h); cx.stroke(); }
        for (var gy = 0; gy < h; gy += 14) { cx.beginPath(); cx.moveTo(0, gy); cx.lineTo(w, gy); cx.stroke(); }
        cx.strokeStyle = 'rgba(255,47,185,.85)';
        cx.beginPath();
        for (var i2 = 0; i2 < 26; i2++) {
          var bx = (i2 / 25) * w;
          var bh = (Math.sin(i2 * 1.1 + t) * 0.5 + 0.5) * h * 0.7 + 4;
          cx.moveTo(bx, h); cx.lineTo(bx, h - bh);
        }
        cx.stroke();
      }
      cv._raf = requestAnimationFrame(draw);
    }
    cv._raf = requestAnimationFrame(draw);
  });

  /* ================================================================== *
   *  5. Capability matrix
   * ================================================================== */

  var MATRIX = {
    render: [
      ['软件光栅器 / 排序', 92], ['程序化几何体', 88], ['着色与材质', 80],
      ['贴图与 UV', 74], ['性能剖析', 86], ['动效编排', 94]
    ],
    logic: [
      ['TypeScript', 90], ['React / Vue', 86], ['构建工具链', 78],
      ['Node / 边缘函数', 72], ['测试与 CI', 76], ['状态建模', 82]
    ],
    craft: [
      ['设计系统', 88], ['动效设计', 90], ['可访问性', 84],
      ['信息架构', 74], ['原型验证', 86], ['跨团队协作', 88]
    ]
  };
  var matrixBody = document.getElementById('matrixBody');
  function renderMatrix(key) {
    matrixBody.innerHTML = MATRIX[key].map(function (row, i) {
      return '<div class="skill" style="animation-delay:' + (i * 60) + 'ms">' +
        '<div class="skill-head"><span>' + row[0] + '</span><b>' + row[1] + '%</b></div>' +
        '<div class="skill-track"><i class="skill-fill" data-w="' + row[1] + '"></i></div></div>';
    }).join('');
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(matrixBody.querySelectorAll('.skill-fill'), function (f, i) {
        setTimeout(function () { f.style.width = f.getAttribute('data-w') + '%'; }, 80 + i * 70);
      });
    });
  }
  renderMatrix('render');
  document.getElementById('matrixTabs').addEventListener('click', function (e) {
    var b = e.target.closest('.mtab');
    if (!b) return;
    Array.prototype.forEach.call(this.querySelectorAll('.mtab'), function (x) { x.classList.remove('is-active'); });
    b.classList.add('is-active');
    renderMatrix(b.getAttribute('data-tab'));
  });

  /* ================================================================== *
   *  6. Interactive shell
   * ================================================================== */

  var termOut = document.getElementById('termOut');
  var termInput = document.getElementById('termInput');
  var termBody = document.getElementById('termBody');
  var history = [], hIdx = -1;

  function termPrint(html, cls) {
    var div = document.createElement('div');
    div.className = 'term-line out ' + (cls || '');
    div.innerHTML = html;
    termOut.appendChild(div);
    termBody.scrollTop = termBody.scrollHeight;
  }

  var COMMANDS = {
    help: function () {
      termPrint([
        '<span class="ok">可用命令</span>',
        '  <span class="cmd">whoami</span>      — 我是谁',
        '  <span class="cmd">skills</span>      — 技能清单',
        '  <span class="cmd">projects</span>    — 项目概览',
        '  <span class="cmd">contact</span>     — 联系方式',
        '  <span class="cmd">theme pink</span>  — 切换强调色',
        '  <span class="cmd">stats</span>       — 当前渲染统计',
        '  <span class="cmd">clear</span>       — 清屏',
        '  <span class="cmd">sudo …</span>      — 你猜'
      ].join('\n'));
    },
    whoami: function () {
      termPrint('<span class="ok">KAI</span> — creative front-end engineer\n' +
        '8 年经验 / 3 年图形 / 喜欢把数学画成界面\n' +
        '当前状态: <span class="ok">available</span> (2025 Q4)');
    },
    skills: function () {
      termPrint('canvas ████████████████████ 92%\n' +
        'typescript ██████████████████░░ 90%\n' +
        'motion ███████████████████░ 94%\n' +
        'shaders(soft) ██████████████░░░░ 74%\n' +
        'a11y ████████████████░░░░ 84%');
    },
    projects: function () {
      OPS.forEach(function (o) { termPrint('<span class="cmd">' + o.id + '</span> ' + o.title + ' <span class="dim">(' + o.year + ')</span>'); });
    },
    contact: function () {
      termPrint('mail  <span class="ok">kai@nexus.dev</span>\ngithub github.com/kai\ntg    @kai_dev\n' +
        '<span class="dim">你可以直接点上方表单，也可以执行 contact 复制邮箱。</span>');
      FX.copy('kai@nexus.dev');
    },
    stats: function () {
      termPrint('fps      <span class="ok">' + Math.round(scene.stats.fps || 60) + '</span>\n' +
        'tris     <span class="ok">' + scene.stats.tris + '</span>\n' +
        'objects  <span class="ok">' + scene.objects.length + '</span>\n' +
        'bloom    <span class="ok">' + scene.bloom + '</span>');
    },
    clear: function () { termOut.innerHTML = ''; },
    theme: function (args) {
      var c = (args[0] || 'green').toLowerCase();
      var map = {
        green: ['#4dffc3', '#1de9ff'], pink: ['#ff2fb9', '#ffc857'],
        cyan: ['#1de9ff', '#4dffc3'], amber: ['#ffc857', '#ff2fb9']
      };
      var pick = map[c] || map.green;
      document.documentElement.style.setProperty('--neon', pick[0]);
      document.documentElement.style.setProperty('--cyan', pick[1]);
      termPrint('theme → <span class="ok">' + (map[c] ? c : 'green (fallback)') + '</span>');
    },
    sudo: function (args) {
      termPrint('<span class="err">sudo: ' + (args.join(' ') || 'nice try') + ': permission denied (and rightly so)</span>');
    },
    ls: function () { termPrint('<span class="cmd">ops/</span>  <span class="cmd">stack/</span>  <span class="cmd">shell/</span>  <span class="cmd">README.md</span>'); },
    cat: function (args) {
      if ((args[0] || '') === 'README.md') termPrint('这是一个手写 3D 引擎的演示站点。\n没有依赖，没有构建，只有 canvas。');
      else termPrint('<span class="err">cat: ' + (args[0] || '') + ': No such file</span>');
    }
  };

  function runCommand(raw) {
    var line = raw.trim();
    if (!line) return;
    termPrint('<span class="cmd">kai@nexus:~$</span> ' + line.replace(/</g, '&lt;'));
    var parts = line.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var args = parts.slice(1);
    if (COMMANDS[cmd]) COMMANDS[cmd](args);
    else termPrint('<span class="err">command not found: ' + cmd.replace(/</g, '&lt;') + '</span> — 试试 <span class="cmd">help</span>');
  }

  termInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var v = termInput.value;
      history.push(v); hIdx = history.length;
      runCommand(v);
      termInput.value = '';
    } else if (e.key === 'ArrowUp') {
      if (hIdx > 0) { hIdx--; termInput.value = history[hIdx] || ''; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (hIdx < history.length - 1) { hIdx++; termInput.value = history[hIdx] || ''; }
      else { hIdx = history.length; termInput.value = ''; }
      e.preventDefault();
    }
  });
  termBody.addEventListener('click', function () { termInput.focus(); });

  termPrint('<span class="ok">NEXUS//NULL shell v2.0.7</span> — 输入 <span class="cmd">help</span> 查看命令。');

  /* ================================================================== *
   *  7. Command palette
   * ================================================================== */

  var ACTIONS = [
    { label: '跳转到 任务记录', hint: '#ops', run: function () { go('#ops'); } },
    { label: '跳转到 能力矩阵', hint: '#stack', run: function () { go('#stack'); } },
    { label: '跳转到 交互终端', hint: '#terminal', run: function () { go('#terminal'); } },
    { label: '跳转到 联系', hint: '#contact', run: function () { go('#contact'); } },
    { label: '复制邮箱', hint: 'clipboard', run: function () { FX.copy('kai@nexus.dev'); FX.toast('邮箱已复制', { kind: 'ok' }); } },
    { label: '切换强调色：粉', hint: 'theme pink', run: function () { COMMANDS.theme(['pink']); } },
    { label: '切换强调色：青', hint: 'theme cyan', run: function () { COMMANDS.theme(['cyan']); } },
    { label: '切换强调色：绿', hint: 'theme green', run: function () { COMMANDS.theme(['green']); } },
    { label: '切换强调色：琥珀', hint: 'theme amber', run: function () { COMMANDS.theme(['amber']); } },
    { label: '重放启动序列', hint: 'boot', run: function () { location.reload(); } },
    { label: '在终端执行 stats', hint: 'shell', run: function () { go('#terminal'); COMMANDS.stats(); } },
    { label: '打开/关闭矩阵雨', hint: 'fx', run: function () { toggleRain(); } }
  ];

  function go(sel) {
    var n = document.querySelector(sel);
    if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  var palette = document.getElementById('palette');
  var paletteInput = document.getElementById('paletteInput');
  var paletteList = document.getElementById('paletteList');
  var sel = 0, filtered = ACTIONS.slice();

  function drawPalette() {
    paletteList.innerHTML = filtered.map(function (a, i) {
      return '<li class="' + (i === sel ? 'is-sel' : '') + '">' + a.label + '<span>' + (a.hint || '') + '</span></li>';
    }).join('') || '<li>没有匹配项</li>';
  }
  function openPalette() {
    palette.classList.add('is-open');
    paletteInput.value = '';
    filtered = ACTIONS.slice(); sel = 0; drawPalette();
    setTimeout(function () { paletteInput.focus(); }, 60);
  }
  function closePalette() { palette.classList.remove('is-open'); }
  function runSel() {
    if (!filtered[sel]) return;
    closePalette();
    filtered[sel].run();
  }

  document.getElementById('paletteOpen').addEventListener('click', openPalette);
  document.getElementById('paletteOpen2').addEventListener('click', openPalette);
  palette.addEventListener('click', function (e) { if (e.target === palette) closePalette(); });
  paletteInput.addEventListener('input', function () {
    var q = paletteInput.value.toLowerCase();
    filtered = ACTIONS.filter(function (a) { return (a.label + ' ' + (a.hint || '')).toLowerCase().indexOf(q) > -1; });
    sel = 0; drawPalette();
  });
  paletteInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, filtered.length - 1); drawPalette(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); drawPalette(); e.preventDefault(); }
    else if (e.key === 'Enter') { runSel(); }
  });
  paletteList.addEventListener('click', function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    sel = Array.prototype.indexOf.call(paletteList.children, li);
    runSel();
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    else if (e.key === 'Escape') closePalette();
  });

  var rainOn = true;
  function toggleRain() {
    rainOn = !rainOn;
    document.getElementById('rain').style.opacity = rainOn ? '0.42' : '0';
    FX.toast('矩阵雨 ' + (rainOn ? 'ON' : 'OFF'));
  }

  /* ================================================================== *
   *  8. Misc wiring
   * ================================================================== */

  FX.mount(function () {
    FX.reveal({ stagger: 70 });
    FX.scrollBar(document.getElementById('progress'));
    FX.stickyNav(document.getElementById('topbar'));
    FX.scrollSpy({ rail: '.fx-rail' });
    FX.marquee(document.getElementById('ticker1'), { speed: 70 });
    FX.magnetic('[data-magnetic]');
    FX.ripple('.btn');
    FX.counters();
    FX.tilt('[data-tilt]');
    FX.spotlight('[data-spotlight]');

    if (!('ontouchstart' in window) && window.innerWidth > 900) {
      FX.cursor();
      document.body.classList.add('fx-custom-cursor');
    }

    // typewriter in hero
    FX.typewriter(document.getElementById('typed'), [
      'init --profile=kai --mode=creative',
      'rasterize --geometry=20 --textures=13',
      'animate --components=fx.js --easing=22',
      'ready. scroll down to inspect ▸'
    ], { speed: 46, hold: 1900 });

    // Status pill reflects the real renderer, but only once the engine has
    // accumulated a statistically meaningful sample. Right after boot
    // `scene.stats.fps` is 0, and a single early low reading (first paint,
    // a slow device waking up) would otherwise flash "THROTTLED" on a
    // perfectly healthy page.
    var bootAt = FX.now();
    setInterval(function () {
      var fps = scene.stats.fps;
      var pill = document.getElementById('statusPill');
      var txt = document.getElementById('statusText');
      var warm = FX.now() - bootAt > 4000 && scene.frame > 60;
      if (!fps || !warm) { txt.textContent = 'SYNCING'; pill.style.color = ''; return; }
      if (fps < 40) { txt.textContent = 'THROTTLED'; pill.style.color = '#ffc857'; }
      else { txt.textContent = 'ONLINE'; pill.style.color = ''; }
    }, 1800);

    // contact form
    document.getElementById('pingForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (new FormData(e.target).get('name') || '').toString().trim();
      FX.toast('信号已发送 · ' + (name || 'anonymous') + ' :: 24h 内回信', { kind: 'ok', duration: 3400 });
      e.target.reset();
      feed('<b>now</b><span class="lvl">[SEND]</span><span>packet from ' + (name || 'anon') + '</span>', 'info');
    });
    document.getElementById('copyMail').addEventListener('click', function () {
      FX.copy('kai@nexus.dev');
      FX.toast('kai@nexus.dev 已复制到剪贴板', { kind: 'ok' });
    });

    // pause rendering while the tab is hidden
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) scene.stop();
      else if (!reduced) scene.start();
    });

    // keyboard: g then section number
    var gPressed = false;
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'g') { gPressed = true; setTimeout(function () { gPressed = false; }, 700); return; }
      if (gPressed) {
        var m = { '1': '#hero', '2': '#ops', '3': '#stack', '4': '#terminal', '5': '#contact' }[e.key];
        if (m) { go(m); FX.toast('跳转 ' + m); gPressed = false; }
      }
    });
  });
})();
