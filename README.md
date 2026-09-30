# FIVE WORLDS — 五个手写 3D 个人网站

同一个文件夹里五个**完整、可直接打开**的个人网站，风格、动效语言与组件体系各不相同。
全部由两个自己写的库驱动，**没有任何第三方依赖**：

| 文件 | 体积 | 职责 |
| --- | --- | --- |
| `vendor/dse.js` | ~61 KB | 3D 引擎：矩阵/四元数、20 种程序化几何体、13 种程序化贴图、9 种着色模式、Canvas2D 三角光栅器 |
| `vendor/fx.js` | ~38 KB | 动效组件库：22 个缓动、滚动编排、文本动效、9 种画布背景、12 个交互组件、6 个 Y2K/现代控件 |

> 没有 three.js、没有 GSAP、没有 WebGL、没有构建步骤。所有画面都是 `canvas.getContext('2d')` 上逐个三角形画出来的。

---

## 快速开始

### 方式一：直接双击（最省事）

直接打开根目录的 `index.html`，或者任意站点的 `sites/*/index.html`。
站点用相对路径 `../../vendor/` 引用引擎，所以**整个文件夹要一起移动**。

> `file://` 协议下部分浏览器会禁用 `localStorage`，蒸汽波站点的留言板会退化为内存存储，刷新即重置。

### 方式二：本地静态服务（推荐）

```bash
node serve.js
# → http://127.0.0.1:5178/
```

换端口：`PORT=8080 node serve.js`（Windows PowerShell：`$env:PORT=8080; node serve.js`）

---

## 五个站点

| # | 站点 | 风格 | 核心 3D | 特色组件 |
| --- | --- | --- | --- | --- |
| 01 | [AURORA 极光玻璃](sites/01-aurora-glass/index.html) | Glassmorphism / 柔和 | 水晶群、漂浮碎片、双层光圈 | 实时调参面板、磁性按钮、三维倾斜卡片、模态表单 |
| 02 | [NEXUS//NULL 赛博终端](sites/02-nexus-terminal/index.html) | Cyberpunk / 故障艺术 | 线框竞技场、参考网格、数据碎片 | 启动序列、**可交互终端**、⌘K 命令面板、系统监控、矩阵雨 |
| 03 | [MIAMI_1997 蒸汽波桌面](sites/03-miami-vapor/index.html) | Vaporwave / Y2K | 霓虹地平线、线框棕榈、光晕星球 | **可拖拽窗口系统**、任务栏、Web Audio FM 音序器、游客留言板、Webring |
| 04 | [MONOLITH 瑞士编辑](sites/04-monolith-swiss/index.html) | Swiss / 国际主义排版 | 滚动驱动的石碑堆叠、校准环 | 项目索引表（J/K 键盘浏览）、拖拽画廊、数据表格、实时调色板 |
| 05 | [KINETIC 粒子动能](sites/05-kinetic-particle/index.html) | Motion graphics / 深色实验 | 液态金属球、**受力粒子场**、星座网络 | 冲击波按钮、实时参数面板 + 参数 JSON 回显、指标环、主题切换 |

---

## 引擎是怎么工作的

`dse.js` 每帧做四件事：

1. **顶点变换** — 局部坐标 × 模型矩阵 × 视图投影矩阵，结果写进复用的 `Float32Array`，避免每帧分配。
2. **背面剔除 + 光照** — 面法线与视线方向点积剔除背面；`lambert / phong / metal / toon / flat / unlit / glass / wire / matcap` 九种模式逐面计算漫反射与高光。
3. **画家算法排序** — 本帧所有可见三角形按深度从远到近排序后依次绘制。半透明材质因此天然正确，不需要深度缓冲。
4. **可选泛光** — 带自发光的三角形额外画到半分辨率图层，模糊后以 `lighter` 合成，得到霓虹辉光。

```html
<canvas id="stage"></canvas>
<script src="vendor/dse.js"></script>
<script src="vendor/fx.js"></script>
<script>
  const { Scene, Mesh, Light, geom, mat } = DSE;

  const scene = new Scene(document.getElementById('stage'), {
    bloom: 0.6, fog: { color: '#04060d', near: 5, far: 26 }
  });
  scene.add(new Light({ direction: [-0.5, 0.8, 0.6] }));

  // 液态金属球：每帧被正弦波推动的球体
  const g = FX.blobGeom({ radius: 1.4, amp: 0.16 });
  const blob = new Mesh(g, mat.metal({ color: '#c9d8ff', specular: 1 }));
  blob.spinY = 0.2;
  blob.onUpdate = () => g.updateBlob(scene.clock);
  scene.add(blob);

  scene.add(new DSE.Particles({ count: 360, shape: 'glow', twinkle: 0.8 }));
  scene.start();
</script>
```

### 引擎 API 速查

```js
// 场景与渲染
new DSE.Scene(canvas, { bloom, fog, ambient, maxFaces, resolution, sortFaces })
new DSE.Camera({ fov, near, far })          // scene.camera
new DSE.Light({ type:'dir'|'point', direction, color, intensity, radius })
new DSE.Mesh(geometry, material, { x, y, z, spinY, orbit, onUpdate })
new DSE.Particles({ count, spread, shape:'dot'|'square'|'glow'|'streak', twinkle })
new DSE.Controls(scene, { distance, azimuth, elevation, autoRotate, pointerInfluence })
new DSE.Sprite(canvasTexture, { scale, billboard })

// 几何体（20 种）
DSE.geom.box | sphere | torus | torusKnot | cylinder | cone | capsule
        | icosahedron | octahedron | tetrahedron | tube | helix | grid
        | ring | star | extrude | terrain | shell | plane | combine
// 变形与着色
DSE.geom.displace | transform | scale | translate | rotateX/Y/Z
        | faceColors | vertexColors | wire | subdivide | expandFaces

// 材质（9 种）与贴图（14 种）
DSE.mat.flat | unlit | lambert | phong | metal | toon | glass | wire | points | matcap
DSE.tex.grid | dots | stripes | checker | noise | bricks | rings | cells
       | gradient | halftone | scanlines | wood | text | glyphs
```

**两个容易踩的渲染细节**（都在引擎里处理好了，但改代码时需要知道）：

- `mat.*({ smoothShade: true })` 会用**逐顶点平均法线**着色。球体/液态金属这类
  高细分曲面必须开它，否则逐面光照会把球渲染成一格一格的可见多边形。
- 深度排序用的是**最近顶点深度**而不是面中心深度。曲面上相邻面的中心深度几乎相同，
  用中心深度排序会在帧之间反复翻转，表现为表面出现随机色块。
- 相机 `position` 和 `target` **同时平移等于没动**（`lookAt` 只是把 target 放到屏幕中心）。
  要把主体推到画面某一侧，只能改 `target`。

### 组件库 API 速查

```js
// 动效
FX.ease.outExpo(t)                       // 22 个缓动函数
FX.reveal({ selector, stagger, once })   // 基于 IntersectionObserver 的入场
FX.textIn(el, { mode:'chars', stagger }) // 字符级标题动画
FX.typewriter(el, [..phrases])           // 循环打字机
FX.scramble(el) | FX.counter(el) | FX.marquee(el)
FX.parallax('[data-speed]') | FX.scrollBar(el) | FX.scrollSpy()

// 交互
FX.cursor() | FX.magnetic(sel) | FX.tilt(sel) | FX.ripple(sel)
FX.spotlight(sel) | FX.dragRail(el) | FX.stickyNav(el)

// 画布背景（9 种）
FX.backdrop(canvas, { mode:'field|stars|snow|bubbles|grid|lines|wave|bokeh|matrix|noise' })

// 现成 3D 场景
FX.scene.hero | gridArena | retroGrid | monolith | constellation | shards | dust
FX.blobGeom() | FX.crystalGeom()

// 控件
FX.toast(msg) | FX.tabs(root) | FX.accordion(root) | FX.modal(trigger, modal)
FX.tooltip(sel) | FX.sound() | FX.copy(text) | FX.mount(fn) | FX.prefersReduced()
```

---

## 目录结构

```
.
├── index.html                  ← 集合首页（含五个站点的实时缩略图）
├── styles.css
├── landing.js
├── serve.js                    ← 零依赖静态服务器
├── README.md
├── _debug/                     ← 开发期工具（可以整个删掉，站点不依赖它）
│   ├── shot.js                 ← 无头 Chrome 截图 + 运行时诊断
│   ├── shots-all.js            ← 一次拍完六个页面
│   ├── cursor-check.js         ← 检查自定义光标是否可用（单页）
│   ├── cursor-all.js           ← 检查全部页面
│   └── audit-overlay.js        ← 扫描有没有透明层挡住点击
├── _shots/                     ← 截图输出目录（可删）
├── vendor/
│   ├── dse.js                  ← 3D 引擎
│   ├── fx.js                   ← 动效组件库
│   ├── _smoke.js               ← 引擎自测
│   ├── _smoke-fx.js            ← 组件库自测
│   ├── _smoke-pages.js         ← 页面装配自测（用 DOM 模拟跑六个页面脚本）
│   ├── _csscheck.js            ← 样式表括号平衡检查
│   └── _check-classes.js       ← CSS / HTML / JS 类名交叉校验
└── sites/
    ├── 01-aurora-glass/        index.html + styles.css + main.js
    ├── 02-nexus-terminal/
    ├── 03-miami-vapor/
    ├── 04-monolith-swiss/
    └── 05-kinetic-particle/
```

---

## 自测

五个测试脚本都是纯 Node（无需安装任何东西）：前三个用一个手写的 Canvas2D / DOM 替身把代码**真正跑起来**，
后两个做静态一致性检查。

```bash
node vendor/_smoke.js          # 引擎：20 种几何体、14 种贴图、投影、粒子、控制
node vendor/_smoke-fx.js       # 组件库：缓动、文本动效、9 种背景、3D 场景装配、控件
node vendor/_smoke-pages.js    # 首页 + 五个站点的脚本在模拟 DOM 中执行，并跑 6 帧动画
node vendor/_csscheck.js       # 六份样式表的括号/注释平衡
node vendor/_check-classes.js  # CSS 里定义的类 vs HTML/JS 里出现的类
```

`_smoke-pages.js` 会解析每个站点**真实的** `index.html` 建树，再执行它的 `main.js`，
因此能抓出「JS 引用了 HTML 里不存在的 id」「方法名写错」「在 undefined 上挂事件」这类问题；
它同时会检查所有动画帧回调和绘制调用是否真的执行过。

### 视觉回归（可选，需要装了 Chrome）

静态检查抓不到"东西画出来了但被盖住了"这一类问题，所以带了一个基于
Chrome DevTools Protocol 的截图工具（零 npm 依赖，自己实现了最小 WebSocket 客户端）：

```bash
node serve.js &                        # 先起服务
node _debug/shot.js /sites/05-kinetic-particle/ kinetic 4000 1440 900
node _debug/shots-all.js 4000 1440 900 # 一次拍完六个页面
node _debug/cursor-all.js              # 自定义光标是否真的可见、是否跟随指针
node _debug/audit-overlay.js           # 有没有透明层吃掉点击
```

它会输出 PNG，以及一份诊断：真实的 rAF 帧数、页面内异常、控制台报错、
每个 canvas 的绘制像素占比、以及 reveal 元素的激活数量。

> 为什么不用 `--virtual-time-budget`：它会快进定时器但**饿死 requestAnimationFrame**
> （实测 2.5 秒只跑 2 帧），所有 rAF 驱动的动画都会冻在第 0 帧，截图会骗人。
> 这个工具用 `Page.addScriptToEvaluateOnNewDocument` 在任何页面脚本之前装一个
> `setTimeout` 版的 rAF 垫片，再等真实时间，动画才会真正推进。

### 两个已经踩过的坑（改代码时请注意）

**自定义光标必须自证可用。** 站点用 `body.fx-custom-cursor { cursor: none !important }`
隐藏系统光标。只要替代元素因为任何原因不可见（首页曾经漏写了 `.fx-cursor-dot` /
`.fx-cursor-ring` 的样式，元素没有宽高），用户就会**彻底失去鼠标指针**。
现在 `FX.cursor()` 会先把两个元素量一遍，量不到就注入一份兜底样式；
还是不行就直接放弃自定义光标、保留系统光标。运行期间每 1.5 秒复查一次，
一旦自己不可见立刻把系统光标还回来。
（`03-miami-vapor` 是例外：桌面 OS 风格，故意保留系统光标。）

**启动遮罩不能锁死页面。** 02 和 03 有全屏启动序列。它必须保证：
完成时 `pointer-events: none` + 从 DOM 移除，并且 JS 侧有 7 秒硬兜底。
否则动画一旦卡住，用户连桌面都点不进去。

---

## 可访问性与性能

- **动效降级**：五个站点全部响应 `prefers-reduced-motion`，开启后停止 3D 循环、取消所有过渡、内容直接可见。
- **键盘可达**：导航、终端、命令面板、索引表（J/K）、窗口切换（数字键）、模态（ESC）都支持键盘。
- **性能自适应**：移动端自动减半粒子数并把分辨率降到 0.7；帧时间超过 22 ms 时继续降粒子数；标签页隐藏时暂停渲染循环。
- **体积**：整个集合（含五个站点）约 120 KB JavaScript，无网络请求、可离线运行。

---

## 许可

引擎与组件库（`vendor/`）为 MIT，可自由复制到自己的项目。五个站点的文案、配色与品牌名均为演示占位内容。
