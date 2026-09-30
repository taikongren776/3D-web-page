/*!
 * ============================================================================
 *  FX — a component + animation library for the DSE engine.
 *  Shared by all five sites: easings, scroll animation, text effects, canvas
 *  backdrops, notification toasts, magnetic buttons, 3D tilt, counters,
 *  marquees, spotlight cursors, ripple clicks, drag-scroll rails, and ready
 *  made 3D scene builders (crystal garden, wireframe arena, retro grid,
 *  monolith, liquid metal, constellation).
 * ============================================================================
 */
(function (global) {
  'use strict';
  var DSE = global.DSE;
  if (!DSE) throw new Error('FX requires DSE');
  var geom = DSE.geom, mat = DSE.mat, tex = DSE.tex;
  var TAU = Math.PI * 2;
  var clamp = DSE.utils.clamp, lerp = DSE.utils.lerp, rand = DSE.utils.rand;
  var hex2rgb = DSE.utils.hex2rgb, rgbStr = DSE.utils.rgbStr, mixRGB = DSE.utils.mixRGB;

  var FX = { version: '1.0.0' };

  /* ================================================================== *
   *  1. Easings
   * ================================================================== */

  function makeEase(fn, inverse) { fn.inverse = inverse; return fn; }

  var ease = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => t * (2 - t),
    inOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    inCubic: t => t * t * t,
    outCubic: t => (--t) * t * t + 1,
    inOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    outQuart: t => 1 - (--t) * t * t * t,
    inQuart: t => t * t * t * t,
    outQuint: t => 1 + (--t) * t * t * t * t,
    inOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
    outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    inExpo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
    inOutExpo: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    outCirc: t => Math.sqrt(1 - (--t) * t),
    inCirc: t => 1 - Math.sqrt(1 - t * t),
    outBack: t => { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    inBack: t => { var c = 1.70158; return c * t * t * t - c * t * t; },
    outElastic: t => {
      if (t === 0 || t === 1) return t;
      var p = 0.3, s = p / 4;
      return Math.pow(2, -10 * t) * Math.sin((t - s) * TAU / p) + 1;
    },
    outBounce: t => {
      var n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    outSpring: t => {
      t = clamp(t, 0, 1);
      return 1 - Math.cos(t * 4.6) * Math.exp(-t * 5.2);
    },
    outSoft: t => 1 - Math.pow(1 - t, 2.4)
  };
  FX.ease = ease;

  /* ================================================================== *
   *  2. Tiny DOM helper
   * ================================================================== */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  FX.$ = $; FX.$$ = $$;

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style' && typeof attrs[k] === 'object') { for (var s in attrs[k]) n.style[s] = attrs[k][s]; }
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  FX.el = el;
  FX.on = function (node, ev, fn, opts) { if (node) node.addEventListener(ev, fn, opts || false); return node; };

  FX.clamp = clamp; FX.lerp = lerp; FX.rand = rand;
  FX.remap = function (v, a, b, c, d, c2) { var t = clamp((v - a) / (b - a || 1), 0, 1); return c + (d - c) * t; };
  FX.hex2rgb = hex2rgb; FX.rgbStr = rgbStr; FX.mix = mixRGB;

  FX.rgbToHex = function (c) {
    return '#' + c.map(function (v) { var s = clamp(Math.round(v), 0, 255).toString(16); return s.length < 2 ? '0' + s : s; }).join('');
  };
  FX.mixHex = function (a, b, t) { return FX.rgbToHex(mixRGB(hex2rgb(a), hex2rgb(b), t)); };
  FX.hsl = function (h, s, l, a) {
    return 'hsla(' + (h % 360) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')';
  };
  FX.now = function () { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); };

  /* ================================================================== *
   *  3. Scroll animation — reveal, progress, parallax, pin, sticky nav
   * ================================================================== */

  var observers = [];

  FX.reveal = function (opts) {
    opts = opts || {};
    var sel = opts.selector || '[data-reveal]';
    var nodes = $$(sel);
    var root = opts.rootMargin || '0px 0px -12% 0px';
    var once = opts.once === undefined ? true : opts.once;

    function show(n) {
      var d = parseFloat(n.dataset.revealDelay || (opts.stagger ? opts.stagger * (n._fxIndex || 0) : 0)) || 0;
      var dur = parseFloat(n.dataset.revealDuration || opts.duration || 900);
      var kind = n.dataset.reveal || 'up';
      n.style.transitionProperty = 'opacity, transform, filter, clip-path';
      n.style.transitionTimingFunction = opts.easing || 'cubic-bezier(.16,.84,.28,1)';
      n.style.transitionDuration = dur + 'ms';
      n.style.transitionDelay = d + 'ms';
      var from = {
        up: 'translate3d(0,42px,0)', down: 'translate3d(0,-42px,0)',
        left: 'translate3d(48px,0,0)', right: 'translate3d(-48px,0,0)',
        scale: 'scale(.86)', rotate: 'rotate(-6deg) translateY(20px)',
        none: 'none'
      }[kind] || 'translate3d(0,42px,0)';
      n.style.transform = from;
      n.style.opacity = n.dataset.revealOpacity || '0';
      if (n.dataset.reveal === 'clip') { n.style.clipPath = 'inset(0 0 100% 0)'; n.style.transform = 'none'; }
      if (n.dataset.revealBlur !== undefined) n.style.filter = 'blur(14px)';
      // force style flush then animate to rest
      void n.offsetWidth;
      requestAnimationFrame(function () {
        n.style.transform = 'none';
        n.style.opacity = '1';
        n.style.clipPath = 'inset(0 0 0% 0)';
        if (n.dataset.revealBlur !== undefined) n.style.filter = 'blur(0)';
        n.classList.add('is-revealed');
      });
    }

    // assign stagger indexes per parent
    var counts = new Map();
    nodes.forEach(function (n) {
      var p = n.parentElement;
      var i = counts.get(p) || 0;
      n._fxIndex = i; counts.set(p, i + 1);
      if (n.hasAttribute('data-reveal-stagger')) n._fxIndex = i % parseInt(n.getAttribute('data-reveal-stagger'), 10);
    });

    if (!('IntersectionObserver' in window)) { nodes.forEach(show); return { destroy() { } }; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          show(e.target);
          if (once) io.unobserve(e.target);
        } else if (!once) {
          e.target.classList.remove('is-revealed');
          e.target.style.opacity = '0';
        }
      });
    }, { rootMargin: root, threshold: opts.threshold || 0.12 });

    nodes.forEach(function (n) { io.observe(n); });
    observers.push(io);
    return { destroy: function () { nodes.forEach(function (n) { io.unobserve(n); }); }, show: show, nodes: nodes };
  };

  /** Calls fn(progress 0..1, ratio, scrollY) while the element is on screen. */
  FX.scrollProgress = function (node, fn) {
    var ticking = false;
    function upd() {
      ticking = false;
      var r = node.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = r.height + vh;
      var p = clamp((vh - r.top) / total, 0, 1);
      fn(p, r, window.scrollY);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    upd();
    return function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  };

  /** Parallax on scroll: data-speed, data-axis. */
  FX.parallax = function (sel) {
    var nodes = $$(sel || '[data-speed]');
    function upd() {
      var vh = window.innerHeight, sy = window.scrollY;
      nodes.forEach(function (n) {
        var r = n.getBoundingClientRect();
        var c = r.top + r.height / 2 - vh / 2;
        var speed = parseFloat(n.dataset.speed || '0.2');
        var axis = n.dataset.axis || 'y';
        var extra = n.dataset.rotate ? ' rotate(' + (-c / vh * parseFloat(n.dataset.rotate)) + 'deg)' : '';
        if (axis === 'y') n.style.transform = 'translate3d(0,' + (-c * speed).toFixed(2) + 'px,0)' + extra;
        else n.style.transform = 'translate3d(' + (-c * speed).toFixed(2) + 'px,0,0)' + extra;
      });
    }
    var raf = null;
    function onScroll() { if (raf) return; raf = requestAnimationFrame(function () { raf = null; upd(); }); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    upd();
    return function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  };

  /** Progress bar element driven by page scroll. */
  FX.scrollBar = function (node, opts) {
    opts = opts || {};
    function upd() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
      if (node) {
        if (opts.vertical) node.style.transform = 'scaleY(' + p + ')';
        else node.style.transform = 'scaleX(' + p + ')';
      }
      if (opts.onProgress) opts.onProgress(p);
    }
    window.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    upd();
    return upd;
  };

  /** Sticky header that gains a class after scrolling. */
  FX.stickyNav = function (nav, cls) {
    cls = cls || 'is-stuck';
    function upd() { nav.classList.toggle(cls, window.scrollY > 24); }
    window.addEventListener('scroll', upd, { passive: true }); upd();
    return upd;
  };

  /* ================================================================== *
   *  4. Text effects
   * ================================================================== */

  /* ------------------------------------------------------------------ *
   *  Gradient-text support for split animations
   *
   *  A heading styled with `background-clip: text` + `color: transparent`
   *  paints its glyphs from the PARENT's background. Splitting it into
   *  <span> children puts the visible glyphs in elements that have neither
   *  the background nor a text colour, so they render fully transparent —
   *  the heading silently disappears. Copy the gradient down onto each
   *  fragment and give it a safe fallback colour.
   * ------------------------------------------------------------------ */

  function inheritTextPaint(parent, node) {
    var cs = window.getComputedStyle ? getComputedStyle(parent) : null;
    if (!cs) return;
    var clip = cs.webkitBackgroundClip || cs.backgroundClip;
    var img = cs.backgroundImage;
    if (clip !== 'text' || !img || img === 'none') return;
    if (!node._fxPaint) {
      node._fxPaint = true;
      node.style.backgroundImage = img;
      node.style.webkitBackgroundClip = 'text';
      node.style.backgroundClip = 'text';
      node.style.webkitTextFillColor = 'transparent';
      // Lay the gradient out as if it still spanned the parent's box.
      // Vertical (180deg): full parent height, offset by the fragment's y.
      // Horizontal / diagonal: stretched to the parent width, offset by x.
      var pr = parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
      var nr = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
      var pw = (pr && pr.width) || 0;
      var ph = parent.offsetHeight || (pr && pr.height) || 0;
      var dx = pr && nr ? nr.left - pr.left : 0;
      var dy = pr && nr ? nr.top - pr.top : 0;
      var am = img.match(/(\d+(?:\.\d+)?)deg/);
      var deg = am ? parseFloat(am[1]) : 180;
      var horizontal = am ? (deg > 45 && deg < 135) : true;
      if (pw > 0 && ph > 0) {
        if (horizontal) {
          node.style.backgroundSize = pw + 'px ' + ph + 'px';
          node.style.backgroundPosition = (-dx) + 'px ' + (-dy) + 'px';
        } else {
          node.style.backgroundSize = '100% ' + ph + 'px';
          node.style.backgroundPosition = '0px ' + (-dy) + 'px';
        }
        node.style.backgroundRepeat = 'no-repeat';
      } else {
        node.style.backgroundSize = '100% 100%';
      }
    }
    // transparent colour is fatal if a browser drops background-clip:text
    if (!node.style.color) node.style.color = cs.color === 'rgba(0, 0, 0, 0)' ? '#ffffff' : cs.color;
  }

  /** Split into chars/words wrapped in spans (keeps them accessible). */
  FX.split = function (node, mode) {
    if (!node || node._fxSplit) return node && node._fxChars;
    mode = mode || 'chars';
    var text = node.textContent;
    var words = text.split(/(\s+)/);
    var out = '', chars = [];
    node.setAttribute('aria-label', text);
    words.forEach(function (w) {
      if (/^\s+$/.test(w)) { out += w; return; }
      if (mode === 'words') {
        out += '<span class="fx-w" style="display:inline-block;overflow:hidden;vertical-align:top"><span class="fx-wi" style="display:inline-block">' + w + '</span></span>';
        return;
      }
      out += '<span class="fx-w" style="display:inline-block;white-space:nowrap">';
      w.split('').forEach(function (ch) {
        out += '<span class="fx-c" style="display:inline-block;will-change:transform,opacity">' + (ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch) + '</span>';
      });
      out += '</span>';
    });
    node.innerHTML = out;
    node._fxSplit = true;
    node._fxChars = $$('.fx-c', node);
    node._fxWords = $$('.fx-w', node);
    // carry any gradient-text paint down onto every fragment
    for (var i = 0; i < node._fxChars.length; i++) inheritTextPaint(node, node._fxChars[i]);
    for (var j = 0; j < node._fxWords.length; j++) inheritTextPaint(node, node._fxWords[j]);
    return node._fxChars;
  };

  /** Animate a split heading in when it enters the viewport. */
  FX.textIn = function (node, opts) {
    opts = opts || {};
    var chars = FX.split(node, opts.mode);
    if (!chars || !chars.length) return;
    var easeFn = opts.ease || ease.outQuart;
    var sta = opts.stagger === undefined ? 28 : opts.stagger;
    var base = opts.delay || 0;
    chars.forEach(function (c) {
      c.style.opacity = '0';
      c.style.transform = (opts.from || 'translate3d(0,' + (opts.distance || '0.9em') + ',0) rotateX(-70deg)');
      c.style.transformOrigin = '50% 100%';
      c.style.backfaceVisibility = 'hidden';
    });
    function play() {
      chars.forEach(function (c, i) {
        var d = base + i * sta;
        c.style.transition = 'transform ' + (opts.duration || 1100) + 'ms cubic-bezier(.19,1,.22,1) ' + d + 'ms, opacity ' + (opts.duration || 700) + 'ms ease ' + d + 'ms';
        c.style.opacity = '1';
        c.style.transform = 'none';
      });
      if (opts.onDone) setTimeout(opts.onDone, base + chars.length * sta + (opts.duration || 1100));
    }
    if (!('IntersectionObserver' in window)) { play(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { play(); io.disconnect(); } });
    }, { threshold: 0.25 });
    io.observe(node);
    return { play: play };
  };

  /** Typewriter that loops through phrases. */
  FX.typewriter = function (node, phrases, opts) {
    opts = opts || {};
    var speed = opts.speed || 62, del = opts.deleteSpeed || 30, hold = opts.hold || 1700;
    var i = 0, j = 0, dir = 1, caret = opts.caret === false ? '' : (opts.caretChar || '▌');
    var caretEl = el('span', { class: 'fx-caret' }, caret);
    caretEl.style.cssText = 'display:inline-block;margin-left:.08em;animation:fx-blink 1s steps(2,start) infinite';
    node.textContent = '';
    node.appendChild(caretEl);
    var txt = document.createTextNode('');
    node.insertBefore(txt, caretEl);
    var timer = null;
    function step() {
      var phrase = phrases[i % phrases.length];
      if (dir > 0) {
        j++;
        txt.nodeValue = phrase.slice(0, j);
        if (j >= phrase.length) { dir = -1; timer = setTimeout(step, hold); return; }
        timer = setTimeout(step, speed + rand(-18, 34));
      } else {
        j--;
        txt.nodeValue = phrase.slice(0, j);
        if (j <= 0) { dir = 1; i++; timer = setTimeout(step, 340); return; }
        timer = setTimeout(step, del);
      }
    }
    timer = setTimeout(step, opts.delay || 300);
    return function () { clearTimeout(timer); };
  };

  /** Scramble-decode text effect. */
  FX.scramble = function (node, opts) {
    opts = opts || {};
    var final = node.dataset.text || node.textContent;
    var pool = opts.chars || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>[]{}/\\*#@$%&';
    var dur = opts.duration || 1100, t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = clamp((ts - t0) / dur, 0, 1);
      var keep = Math.floor(p * final.length);
      var s = final.slice(0, keep);
      for (var i = keep; i < final.length; i++) s += pool[(Math.random() * pool.length) | 0];
      node.textContent = s;
      if (p < 1) requestAnimationFrame(frame); else node.textContent = final;
    }
    requestAnimationFrame(frame);
  };

  /** Animated number count-up. */
  FX.counter = function (node, opts) {
    opts = opts || {};
    var target = parseFloat(node.dataset.count || opts.to || node.textContent) || 0;
    var dur = opts.duration || 1600, dec = opts.decimals || (String(target).indexOf('.') > -1 ? 2 : 0);
    var suffix = node.dataset.suffix || opts.suffix || '';
    var prefix = node.dataset.prefix || opts.prefix || '';
    var easeFn = opts.ease || ease.outExpo;
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = clamp((ts - t0) / dur, 0, 1);
      var v = target * easeFn(p);
      node.textContent = prefix + v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /** Runs FX.counter on every [data-count] when visible. */
  FX.counters = function (sel) {
    var nodes = $$(sel || '[data-count]');
    if (!('IntersectionObserver' in window)) { nodes.forEach(function (n) { FX.counter(n); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { FX.counter(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  };

  /**
   * Infinite marquee; the content element is duplicated and the pair is
   * translated as one strip of width `w`.
   *
   * Two details matter for it to look right:
   *  - the wrapper is `overflow:hidden`, so copy #2 must sit exactly one
   *    content-width to the right of copy #1 — otherwise a gap scrolls in;
   *  - if a page happens to call this twice, the previous loop must be
   *    cancelled or two rAF loops fight over the same transform.
   */
  FX.marquee = function (node, opts) {
    opts = opts || {};
    if (!node) return function () { };
    if (node._fxMarquee) node._fxMarquee();          // stop any previous run
    var speed = opts.speed || 40;                    // px per second
    var dir = opts.direction === 'right' ? 1 : -1;
    var inner = node.firstElementChild || node;
    // drop a copy left over from a previous call
    var prevCopy = node.querySelector('[data-fx-marquee-copy]');
    if (prevCopy) prevCopy.remove();
    var copy = inner.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute('data-fx-marquee-copy', '');
    var host = inner.parentNode || node;
    host.appendChild(copy);
    inner.style.display = 'inline-block';
    copy.style.display = 'inline-block';
    inner.style.willChange = 'transform';
    copy.style.willChange = 'transform';
    inner.style.verticalAlign = 'top';
    copy.style.verticalAlign = 'top';
    // Stretch the first copy to at least the container width; otherwise a
    // marquee whose text is narrower than the viewport shows a blank gap
    // between the end of copy #1 and the start of copy #2.
    inner.style.minWidth = '100%';

    var x = 0, w = inner.offsetWidth || inner.scrollWidth || node.clientWidth || 1, last = FX.now();
    function loop() {
      var now = FX.now();
      var dt = Math.min(64, now - last) / 1000; last = now;
      x += dir * speed * dt;
      // keep x inside (-w, 0] so the two copies always tile the viewport
      if (x <= -w) x += w;
      if (x > 0) x -= w;
      inner.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      copy.style.transform = 'translate3d(' + (x + w).toFixed(2) + 'px,0,0)';
      node._raf = requestAnimationFrame(loop);
    }
    node._raf = requestAnimationFrame(loop);
    var stop = function () { cancelAnimationFrame(node._raf); node._fxMarquee = null; };
    node._fxMarquee = stop;
    return stop;
  };

  /* ================================================================== *
   *  5. Pointer interactions — cursor, magnetic, tilt, ripple, spotlight
   * ================================================================== */

  /* The custom cursor is opt-in and must never be able to leave the user
     without a pointer: it hides the native cursor with `cursor: none`, so if
     the replacement elements are missing their CSS (a site forgot the rules,
     a stylesheet failed to load) the result is an invisible mouse.
     So: measure the two elements after they are in the DOM, and only then
     commit to hiding the system cursor. Otherwise bail out and leave the
     native pointer alone. */
  var CURSOR_FALLBACK_CSS =
    '.fx-cursor-dot,.fx-cursor-ring{position:fixed;top:0;left:0;pointer-events:none;z-index:9999;' +
    'border-radius:50%;transform:translate3d(-100px,-100px,0)}' +
    '.fx-cursor-dot{width:6px;height:6px;background:#fff;mix-blend-mode:difference}' +
    '.fx-cursor-ring{width:32px;height:32px;border:1px solid rgba(255,255,255,.5);display:grid;place-items:center}';

  function injectCursorFallback() {
    var s = document.getElementById('fx-cursor-base');
    if (s) return;
    s = document.createElement('style');
    s.id = 'fx-cursor-base';
    s.textContent = CURSOR_FALLBACK_CSS;
    document.head.appendChild(s);
  }

  /** True when the element actually occupies space and is painted. */
  function cursorVisible(node) {
    if (!node) return false;
    var r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var cs = getComputedStyle(node);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01;
  }

  FX.cursor = function (opts) {
    opts = opts || {};
    var dot = el('div', { class: 'fx-cursor-dot' });
    var ring = el('div', { class: 'fx-cursor-ring' });
    var label = el('span', { class: 'fx-cursor-label' });
    ring.appendChild(label);
    document.body.appendChild(dot); document.body.appendChild(ring);

    // If the host page has no cursor CSS, supply a minimal base style rather
    // than silently hiding the pointer.
    if (!cursorVisible(dot) || !cursorVisible(ring)) {
      injectCursorFallback();
    }
    if (!cursorVisible(dot) || !cursorVisible(ring)) {
      // still broken (e.g. styles blocked) — remove the nodes and keep the
      // native cursor. Never trade a working pointer for a decorative one.
      dot.remove(); ring.remove();
      if (window.console && console.warn) {
        console.warn('[fx] custom cursor skipped: replacement elements have no size');
      }
      return { dot: null, ring: null, enabled: false };
    }

    document.documentElement.classList.add('fx-custom-cursor');
    document.body.classList.add('fx-custom-cursor');

    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, ds = 1, ts = 1;
    var scaleRing = 1, targetRing = 1;
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      var node = e.target;
      var inter = node && node.closest ? node.closest('[data-cursor]') : null;
      if (inter) {
        targetRing = 2.5;
        var t = inter.getAttribute('data-cursor');
        if (t && t !== 'true') { label.textContent = t; ring.classList.add('has-label'); }
        else ring.classList.remove('has-label');
        ring.classList.add('is-hover');
      } else {
        targetRing = 1; ring.classList.remove('is-hover'); ring.classList.remove('has-label');
      }
    }, { passive: true });
    document.addEventListener('pointerdown', function () { ts = 0.75; });
    document.addEventListener('pointerup', function () { ts = 1; });

    function releaseNativeCursor() {
      document.documentElement.classList.remove('fx-custom-cursor');
      document.body.classList.remove('fx-custom-cursor');
    }

    var lastCheck = 0;
    (function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ds += (ts - ds) * 0.2;
      scaleRing += (targetRing - scaleRing) * 0.14;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) translate(-50%,-50%) scale(' + ds + ')';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%) scale(' + (scaleRing * ds) + ')';
      // Failsafe: never leave the user without a pointer. If we are hiding the
      // native cursor but our own elements have stopped occupying space (a
      // stylesheet was swapped, a class got removed, something covered them),
      // hand the native cursor straight back.
      var now = FX.now();
      if (now - lastCheck > 1500) {
        lastCheck = now;
        if (!cursorVisible(dot) || !cursorVisible(ring)) {
          releaseNativeCursor();
          return;
        }
      }
      requestAnimationFrame(loop);
    })();
    return { dot: dot, ring: ring, enabled: true };
  };

  FX.magnetic = function (sel, opts) {
    opts = opts || {};
    var strength = opts.strength || 0.32, max = opts.max || 26;
    $$(sel || '[data-magnetic]').forEach(function (n) {
      var inner = opts.inner ? $(opts.inner, n) : n;
      n.addEventListener('pointermove', function (e) {
        var r = n.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * strength;
        var dy = (e.clientY - (r.top + r.height / 2)) * strength;
        dx = clamp(dx, -max, max); dy = clamp(dy, -max, max);
        inner.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      });
      n.addEventListener('pointerleave', function () {
        inner.style.transition = 'transform .5s cubic-bezier(.16,.84,.28,1)';
        inner.style.transform = 'translate3d(0,0,0)';
        setTimeout(function () { inner.style.transition = ''; }, 520);
      });
    });
  };

  /** 3D tilt with specular sheen; set data-tilt and optional data-tilt-max. */
  FX.tilt = function (sel, opts) {
    opts = opts || {};
    $$(sel || '[data-tilt]').forEach(function (n) {
      var maxD = parseFloat(n.dataset.tiltMax || opts.max || 14);
      var scale = parseFloat(n.dataset.tiltScale || opts.scale || 1);
      var persp = opts.perspective || 900;
      var panel = $('.tilt-panel', n) || n;
      var sheen = $('.fx-sheen', panel) || el('span', { class: 'fx-sheen' });
      if (opts.sheen !== false && !sheen.parentNode) { panel.appendChild(sheen); panel.classList.add('has-sheen'); }
      var host = n.parentElement;
      if (host) host.style.perspective = persp + 'px';
      n.style.transformStyle = 'preserve-3d';
      n.addEventListener('pointermove', function (e) {
        var r = n.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        var ry = (px - 0.5) * maxD * 2, rx = -(py - 0.5) * maxD * 2;
        var t = 'perspective(' + persp + 'px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) scale(' + scale + ')';
        panel.style.transform = t;
        if (opts.sheen !== false) {
          sheen.style.background = 'radial-gradient(340px circle at ' + (px * 100) + '% ' + (py * 100) + '%, rgba(255,255,255,.22), transparent 62%)';
        }
        n.style.setProperty('--mx', (px * 100) + '%');
        n.style.setProperty('--my', (py * 100) + '%');
      });
      n.addEventListener('pointerleave', function () {
        panel.style.transition = 'transform .7s cubic-bezier(.16,.84,.28,1)';
        panel.style.transform = 'perspective(' + persp + 'px) rotateX(0) rotateY(0) scale(1)';
        setTimeout(function () { panel.style.transition = ''; }, 720);
      });
    });
  };

  /** Material-style ripple on click. */
  FX.ripple = function (sel) {
    $$(sel || '[data-ripple]').forEach(function (n) {
      n.style.position = n.style.position || 'relative';
      n.style.overflow = 'hidden';
      n.addEventListener('pointerdown', function (e) {
        var r = n.getBoundingClientRect();
        var s = el('span', { class: 'fx-ripple' });
        var size = Math.max(r.width, r.height) * 2.2;
        s.style.cssText = 'position:absolute;width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px;border-radius:50%;pointer-events:none;';
        n.appendChild(s);
        requestAnimationFrame(function () {
          s.style.transition = 'transform .7s cubic-bezier(.16,.84,.28,1), opacity .8s ease';
          s.style.transform = 'scale(1)';
          s.style.opacity = '0';
        });
        setTimeout(function () { s.remove(); }, 820);
      });
    });
  };

  /** Radial spotlight follows the pointer across a container. */
  FX.spotlight = function (sel) {
    $$(sel || '[data-spotlight]').forEach(function (n) {
      n.addEventListener('pointermove', function (e) {
        var r = n.getBoundingClientRect();
        n.style.setProperty('--sx', ((e.clientX - r.left) / r.width * 100) + '%');
        n.style.setProperty('--sy', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  };

  /** Draggable / wheel horizontal rail with inertia. */
  FX.dragRail = function (node, opts) {
    opts = opts || {};
    var down = false, sx = 0, sl = 0, vl = 0, last = 0, x = 0;
    function maxScroll() { return Math.max(0, node.scrollWidth - node.clientWidth); }
    node.addEventListener('pointerdown', function (e) {
      down = true; sx = e.clientX; sl = node.scrollLeft; node.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      x = sl - (e.clientX - sx);
      node.scrollLeft = x;
    });
    window.addEventListener('pointerup', function () { down = false; node.classList.remove('is-dragging'); });
    node.addEventListener('wheel', function (e) {
      if (opts.wheel === false) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { node.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    return node;
  };

  /* ================================================================== *
   *  6. Canvas backdrops (2D, behind the 3D scene)
   * ================================================================== */

  function Backdrop(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.mode = this.opts.mode || 'field';
    this.n = this.opts.count || 90;
    this.color = this.opts.color || '#7cc7ff';
    this.accent = this.opts.accent || '#ff5fa2';
    this.linkDist = this.opts.link || 0;
    this.dpr = Math.min(2, (global.devicePixelRatio || 1) * (this.opts.resolution || 1));
    this.parts = [];
    this.t = 0;
    this.running = true;
    this._seed = DSE.utils.seeded(this.opts.seed || 11);
    this._resize();
    this._build();
    var self = this;
    this._onR = function () { self._resize(); self._build(); };
    window.addEventListener('resize', this._onR);
    if (this.opts.autoStart !== false) this.start();
  }

  Backdrop.prototype._resize = function () {
    var c = this.canvas;
    var r = c.getBoundingClientRect ? c.getBoundingClientRect() : { width: 800, height: 600 };
    var w = Math.max(1, r.width || c.clientWidth || 800), h = Math.max(1, r.height || c.clientHeight || 600);
    c.width = Math.round(w * this.dpr); c.height = Math.round(h * this.dpr);
    this.w = w; this.h = h;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  Backdrop.prototype._build = function () {
    var r = this._seed, w = this.w, h = this.h, i, p;
    this.parts.length = 0;
    if (this.mode === 'stars' || this.mode === 'field' || this.mode === 'snow' || this.mode === 'bubbles') {
      for (i = 0; i < this.n; i++) {
        this.parts.push({
          x: r() * w, y: r() * h, z: 0.2 + r() * 0.8, s: 0.4 + r() * 2.4,
          vx: (r() - 0.5) * (this.mode === 'snow' ? 0.3 : 0.16),
          vy: this.mode === 'bubbles' ? -(0.16 + r() * 0.5) : (0.06 + r() * 0.4),
          ph: r() * TAU, hue: r()
        });
      }
    } else if (this.mode === 'grid') {
      this.gs = this.opts.cell || 64;
      this.parts.push({ x: 0, y: 0, z: 1 });
    } else if (this.mode === 'lines') {
      for (i = 0; i < (this.opts.count || 16); i++) {
        this.parts.push({ y: (i + 1) / ((this.opts.count || 16) + 1) * h, sp: 0.3 + r() * 1.6, off: r() * w, len: 60 + r() * 260, alpha: 0.05 + r() * 0.16 });
      }
    } else if (this.mode === 'wave') {
      this.parts.push({ x: 0, y: 0, z: 1 });
    } else if (this.mode === 'noise') {
      this.parts.push({ x: 0, y: 0, z: 1 });
    } else if (this.mode === 'bokeh') {
      for (i = 0; i < this.n; i++) {
        this.parts.push({ x: r() * w, y: r() * h, r: 20 + r() * 120, ph: r() * TAU, hue: r(), sp: 0.06 + r() * 0.2 });
      }
    } else if (this.mode === 'matrix') {
      var cols = Math.floor(w / 16);
      for (i = 0; i < cols; i++) this.parts.push({ x: i * 16 + 4, y: r() * h, sp: 1 + r() * 4, chars: [], len: 6 + Math.floor(r() * 16), seed: r() });
    }
  };

  Backdrop.prototype.start = function () {
    var self = this, last = FX.now();
    this.running = true;
    (function loop() {
      if (!self.running) return;
      var now = FX.now(), dt = Math.min(48, now - last) / 1000; last = now;
      self.t += dt;
      self.frame(dt);
      self._raf = requestAnimationFrame(loop);
    })();
    return this;
  };
  Backdrop.prototype.stop = function () { this.running = false; cancelAnimationFrame(this._raf); return this; };

  Backdrop.prototype.frame = function (dt) {
    var x = this.ctx, w = this.w, h = this.h, t = this.t, i, p;
    x.clearRect(0, 0, w, h);
    var mode = this.mode;

    if (mode === 'field' || mode === 'stars' || mode === 'snow' || mode === 'bubbles') {
      var c = hex2rgb(this.color);
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        p.x += p.vx * dt * 60 * p.z; p.y += p.vy * dt * 60 * p.z;
        if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
        var tw = 0.45 + 0.55 * Math.sin(t * (0.6 + p.z) + p.ph);
        x.globalAlpha = (mode === 'stars' ? 0.75 : 0.5) * p.z * tw;
        x.fillStyle = rgbStr(mixRGB(c, hex2rgb(this.accent), p.hue * 0.6));
        x.beginPath();
        x.arc(p.x, p.y, p.s * p.z * (mode === 'bubbles' ? 3.2 : 1), 0, TAU);
        x.fill();
        if (mode === 'bubbles') {
          x.globalAlpha *= 0.35;
          x.strokeStyle = rgbStr(c);
          x.lineWidth = 1; x.stroke();
        }
      }
      x.globalAlpha = 1;
    } else if (mode === 'grid') {
      var gs = this.gs, off = (t * 14) % gs;
      x.strokeStyle = this.color;
      x.globalAlpha = this.opts.alpha === undefined ? 0.13 : this.opts.alpha;
      x.lineWidth = 1;
      for (var gx = -gs + off % gs; gx < w + gs; gx += gs) {
        x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, h); x.stroke();
      }
      for (var gy = -gs + off; gy < h + gs; gy += gs) {
        x.beginPath(); x.moveTo(0, gy); x.lineTo(w, gy); x.stroke();
      }
      x.globalAlpha = 1;
    } else if (mode === 'lines') {
      x.lineCap = 'round';
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        p.off += p.sp * dt * 160;
        if (p.off > w + p.len) p.off = -p.len;
        var grad = x.createLinearGradient(p.off, 0, p.off + p.len, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, this.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        x.globalAlpha = p.alpha;
        x.strokeStyle = grad;
        x.lineWidth = 1 + p.sp;
        x.beginPath(); x.moveTo(p.off, p.y); x.lineTo(p.off + p.len, p.y); x.stroke();
      }
      x.globalAlpha = 1;
    } else if (mode === 'wave') {
      x.lineWidth = 2;
      for (var k = 0; k < 3; k++) {
        x.beginPath();
        for (var wx = 0; wx <= w; wx += 6) {
          var yy = h * (0.6 + k * 0.08) + Math.sin(wx * 0.008 + t * (0.7 + k * 0.2) + k) * (26 + k * 14)
            + Math.sin(wx * 0.02 - t * 1.4) * 8;
          if (wx === 0) x.moveTo(wx, yy); else x.lineTo(wx, yy);
        }
        x.globalAlpha = 0.35 - k * 0.09;
        x.strokeStyle = k === 0 ? this.color : this.accent;
        x.stroke();
      }
      x.globalAlpha = 1;
    } else if (mode === 'bokeh') {
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        p.y -= p.sp * dt * 40; p.x += Math.sin(t * 0.3 + p.ph) * 0.3;
        if (p.y < -p.r) p.y = h + p.r;
        var g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        var col = mixRGB(hex2rgb(this.color), hex2rgb(this.accent), p.hue);
        g.addColorStop(0, rgbStr(col, 0.16));
        g.addColorStop(0.7, rgbStr(col, 0.05));
        g.addColorStop(1, rgbStr(col, 0));
        x.fillStyle = g;
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, TAU); x.fill();
      }
    } else if (mode === 'matrix') {
      x.font = '14px monospace';
      var chars = this.opts.chars || '01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ<>[]{}/*+-=#@$%&';
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        p.y += p.sp * dt * 60;
        if (p.y > h + p.len * 18) { p.y = -p.len * 18; p.seed = Math.random(); }
        for (var j = 0; j < p.len; j++) {
          var yy2 = p.y - j * 18;
          if (yy2 < -18 || yy2 > h) continue;
          var a = (1 - j / p.len);
          x.globalAlpha = a * a * 0.9;
          x.fillStyle = j === 0 ? '#ffffff' : this.color;
          var ch = chars[Math.floor((p.seed * 977 + j * 31 + Math.floor(t * 4)) % chars.length)];
          x.fillText(ch, p.x, yy2);
        }
      }
      x.globalAlpha = 1;
    } else if (mode === 'noise') {
      // film grain: sparse random dots keep it cheap
      x.globalAlpha = this.opts.alpha === undefined ? 0.05 : this.opts.alpha;
      x.fillStyle = this.color;
      for (i = 0; i < (this.opts.count || 900); i++) {
        x.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
      }
      x.globalAlpha = 1;
    }
  };

  FX.Backdrop = Backdrop;
  FX.backdrop = function (canvas, opts) { return new Backdrop(canvas, opts); };

  /* ================================================================== *
   *  7. 3D helpers
   * ================================================================== */

  /** Organic blob: sphere pushed by layered sine waves (liquid metal look). */
  FX.blobGeom = function (o) {
    o = o || {};
    var r = o.radius || 1, seg = o.segments || 44, rings = o.rings || 30;
    var g = geom.sphere({ radius: r, segments: seg, rings: rings });
    var f1 = o.f1 || 1.6, f2 = o.f2 || 2.3, f3 = o.f3 || 3.1;
    var amp = o.amp === undefined ? 0.16 : o.amp;
    var amp2 = o.amp2 === undefined ? 0.07 : o.amp2;
    var speed = o.speed === undefined ? 1 : o.speed;
    g.meta.blob = true;
    var base = Float32Array.from(g.pos);
    g.updateBlob = function (t) {
      var pos = g.pos;
      for (var i = 0; i < pos.length; i += 3) {
        var x = base[i], y = base[i + 1], z = base[i + 2];
        var l = Math.sqrt(x * x + y * y + z * z) || 1;
        var nx = x / l, ny = y / l, nz = z / l;
        var d = Math.sin(nx * f1 + t * speed) * Math.cos(ny * f2 - t * speed * 0.8) * Math.sin(nz * f3 + t * speed * 0.6);
        var d2 = Math.sin((nx + ny + nz) * (f1 * 2.1) - t * speed * 1.7);
        var k = 1 + d * amp + d2 * amp2;
        pos[i] = x * k; pos[i + 1] = y * k; pos[i + 2] = z * k;
      }
      g._dirty = true;
      return g;
    };
    return g;
  };

  /** Low-poly crystal cluster: icosahedron with faceted, per-face colouring. */
  FX.crystalGeom = function (o) {
    o = o || {};
    var g = geom.icosahedron({ radius: o.radius || 1, subdivide: o.subdivide === undefined ? 1 : o.subdivide });
    // push to sphere then add facets
    for (var i = 0; i < g.pos.length; i += 3) {
      var p = [g.pos[i], g.pos[i + 1], g.pos[i + 2]];
      var l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1;
      var k = (o.radius || 1) * (0.82 + 0.18 * Math.abs(Math.sin(p[0] * 2.3) * Math.cos(p[2] * 1.7)));
      g.pos[i] = p[0] / l * k; g.pos[i + 1] = p[1] / l * k; g.pos[i + 2] = p[2] / l * k;
    }
    g.meta.closed = true;
    g = geom.expandFaces(g);
    if (o.colors !== false) {
      var cols = (o.palette || ['#9fd8ff', '#c8b6ff', '#ffd6e8', '#b8fff0', '#ffffff']);
      geom.faceColors(g, function (c) {
        var v = (Math.sin(c[1] * 3.1) + Math.cos(c[0] * 2.7) + Math.sin(c[2] * 1.9)) / 3;
        return cols[Math.floor(Math.abs(v) * cols.length) % cols.length];
      });
    }
    return g;
  };

  FX.scene = {
    /** Floating shards around the origin; returns { group, meshes } */
    shards: function (scene, o) {
      o = o || {};
      var n = o.count || 22, list = [];
      var palette = o.palette || ['#a5d8ff', '#d0bfff', '#ffd8a8', '#b2f2bb', '#ffffff'];
      var rnd = DSE.utils.seeded(o.seed || 3);
      for (var i = 0; i < n; i++) {
        var kind = rnd();
        var g;
        if (kind < 0.4) g = geom.octahedron({ radius: 0.16 + rnd() * 0.2 });
        else if (kind < 0.7) g = geom.tetrahedron({ radius: 0.18 + rnd() * 0.22 });
        else g = geom.box({ width: 0.12 + rnd() * 0.3, height: 0.12 + rnd() * 0.3, depth: 0.12 + rnd() * 0.3 });
        var mesh = new DSE.Mesh(g, o.material ? o.material(palette[i % palette.length], i) : mat.glass({
          color: palette[i % palette.length], opacity: 0.32, edge: '#ffffff', edgeWidth: 1
        }), {
          x: (rnd() - 0.5) * (o.spread || 9),
          y: (rnd() - 0.5) * (o.spreadY || 5),
          z: (rnd() - 0.5) * (o.spread || 9),
          spinX: (rnd() - 0.5) * 0.7, spinY: (rnd() - 0.5) * 0.9, spinZ: (rnd() - 0.5) * 0.5
        });
        mesh.userData.phase = rnd() * TAU;
        mesh.userData.baseY = mesh.position[1];
        mesh.userData.bob = 0.1 + rnd() * 0.35;
        (function (m) {
          m.onUpdate = function (mesh, dt, t) {
            mesh.position[1] = mesh.userData.baseY + Math.sin(t * 0.7 + mesh.userData.phase) * mesh.userData.bob;
          };
        })(mesh);
        scene.add(mesh); list.push(mesh);
      }
      return list;
    },

    /** Central hero object: crystal, blob, knot or shell with slow rotation. */
    hero: function (scene, o) {
      o = o || {};
      var kind = o.kind || 'crystal';
      var g;
      if (kind === 'blob') g = FX.blobGeom(o.blob || {});
      else if (kind === 'crystal') g = FX.crystalGeom(o.crystal || {});
      else if (kind === 'knot') g = geom.torusKnot({ radius: o.radius || 1, tube: 0.22, p: 2, q: 3, segments: 96, tubeSegments: 9 });
      else if (kind === 'shell') g = geom.shell({ radius: o.radius || 1, subdivide: 2, wobble: 0.12 });
      else g = geom.icosahedron({ radius: o.radius || 1, subdivide: 1 });
      var mesh = new DSE.Mesh(g, o.material || mat.glass({ color: '#bfe3ff', opacity: 0.2, edge: '#ffffff' }), {
        spinY: o.spinY === undefined ? 0.24 : o.spinY, spinX: o.spinX || 0.06
      });
      if (o.float !== false) {
        mesh.onUpdate = function (m, dt, t) {
          m.position[1] = (o.y || 0) + Math.sin(t * 0.65) * (o.bob || 0.16);
          if (g.updateBlob) { g.updateBlob(t * 0.9); m.rebuild(); }
        };
      }
      scene.add(mesh);
      return mesh;
    },

    /** Wireframe starship-arena: floor grid + rotating wire cage. */
    gridArena: function (scene, o) {
      o = o || {};
      var out = {};
      var floor = new DSE.Mesh(geom.plane({ width: o.size || 26, depth: o.size || 26, sx: 40, sz: 40 }),
        mat.wire({ color: o.gridColor || '#1de9ff', opacity: 0.4, edgeWidth: 1 }), { y: -(o.floorY || 2.4) });
      scene.add(floor); out.floor = floor;

      var cage = new DSE.Mesh(geom.wire(geom.icosahedron({ radius: o.cage || 2.6, subdivide: 1 })),
        mat.wire({ color: o.cageColor || '#ff2fb9', opacity: 0.75, edgeWidth: 1.2 }), { spinY: 0.14, spinX: 0.05 });
      scene.add(cage); out.cage = cage;

      var core = new DSE.Mesh(geom.icosahedron({ radius: o.core || 1.15, subdivide: 1 }),
        mat.metal({ color: o.coreColor || '#0b1220', edge: '#1de9ff', edgeWidth: 1, emissive: '#062033', emissiveIntensity: 1.2 }),
        { spinY: -0.3, spinX: 0.2 });
      scene.add(core); out.core = core;
      return out;
    },

    /** Sunset synthwave: perspective floor grid + sun + wire pyramids. */
    retroGrid: function (scene, o) {
      o = o || {};
      var out = {};
      var floor = new DSE.Mesh(geom.plane({ width: 90, depth: 60, sx: 60, sz: 40 }),
        mat.wire({ color: o.gridColor || '#ff2d95', opacity: 0.55, edgeWidth: 1 }), { y: -3 });
      scene.add(floor); out.floor = floor;

      var build = [];
      var rnd = DSE.utils.seeded(o.seed || 21);
      for (var i = 0; i < (o.buildings || 26); i++) {
        var hgt = 0.5 + rnd() * 3.2;
        var b = new DSE.Mesh(geom.box({ width: 0.5 + rnd() * 0.8, height: hgt, depth: 0.5 + rnd() * 0.8 }),
          mat.flat({
            color: '#12061f', edge: rnd() > 0.5 ? '#00e5ff' : '#ff2d95', edgeWidth: 1,
            opacity: 0.85
          }), {
          x: (rnd() - 0.5) * 30, y: -3 + hgt / 2, z: (rnd() - 0.5) * 26 - 2
        });
        scene.add(b); build.push(b);
      }
      out.buildings = build;

      var sun = new DSE.Sprite(tex.fromDraw(256, 256, function (x, w, h) {
        var g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#ffe066'); g.addColorStop(0.5, '#ff7b00'); g.addColorStop(1, '#ff2d95');
        x.fillStyle = g;
        x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 4, 0, TAU); x.fill();
        x.globalCompositeOperation = 'destination-out';
        x.fillStyle = '#000';
        for (var i2 = 6; i2 < 16; i2++) {
          var y2 = h / 2 + i2 * 5.4;
          var hh = 1 + i2 * 0.42;
          x.fillRect(0, y2, w, hh);
        }
      }), { x: 0, y: 1.2, z: -26, scale: 2.2, distanceScale: 0, opacity: 0.95 });
      scene.add(sun); out.sun = sun;
      return out;
    },

    /** Editorial monolith: stacked slabs + orbiting rings. */
    monolith: function (scene, o) {
      o = o || {};
      var out = {};
      var stack = [];
      var n = o.slabs || 5;
      for (var i = 0; i < n; i++) {
        var w = (o.width || 2.4) * (1 - i * 0.1);
        var m = new DSE.Mesh(geom.box({ width: w, height: 0.22, depth: w * 0.8 }),
          mat.phong({ color: o.color || '#f2f0eb', edge: o.edge || '#111111', edgeWidth: 1, shininess: 60, specular: 0.5 }),
          { y: -1 + i * (o.gap || 0.62), spinY: 0 });
        scene.add(m); stack.push(m);
      }
      out.stack = stack;
      var ring = new DSE.Mesh(geom.ring({ inner: 1.5, outer: 2.4, segments: 64 }),
        mat.wire({ color: o.accent || '#ff3b2f', opacity: 0.6, edgeWidth: 1.4 }), { spinX: -1.2, spinY: 0.1 });
      scene.add(ring); out.ring = ring;
      var ring2 = new DSE.Mesh(geom.ring({ inner: 2.6, outer: 3.1, segments: 80 }),
        mat.wire({ color: '#111111', opacity: 0.35, edgeWidth: 1 }), { spinX: -0.6, spinZ: 0.4 });
      scene.add(ring2); out.ring2 = ring2;
      return out;
    },

    /** Constellation: nodes on a sphere linked by tubes + particles. */
    constellation: function (scene, o) {
      o = o || {};
      var rnd = DSE.utils.seeded(o.seed || 5);
      var n = o.count || 26, r = o.radius || 3.2;
      var nodes = [];
      for (var i = 0; i < n; i++) {
        var u = rnd() * 2 - 1, th = rnd() * TAU, s = Math.sqrt(1 - u * u);
        nodes.push([Math.cos(th) * s * r, u * r * 0.7, Math.sin(th) * s * r]);
      }
      var out = { nodes: nodes, meshes: [], links: [] };
      var col = o.color || '#7cf6ff';
      for (var k = 0; k < n; k++) {
        var mesh = new DSE.Mesh(geom.octahedron({ radius: o.nodeSize || 0.09 }),
          mat.unlit({ color: col, glow: 0.9, emissive: col, emissiveIntensity: 1 }), {});
        mesh.position[0] = nodes[k][0]; mesh.position[1] = nodes[k][1]; mesh.position[2] = nodes[k][2];
        mesh.spin[1] = 0.6 + rnd(); mesh.userData.ph = rnd() * TAU;
        scene.add(mesh); out.meshes.push(mesh);
      }
      for (var a = 0; a < n; a++) {
        var best = [];
        for (var b = 0; b < n; b++) if (b !== a) {
          var d = DSE.V.dist(nodes[a], nodes[b]);
          best.push([d, b]);
        }
        best.sort(function (p, q) { return p[0] - q[0]; });
        for (var c = 0; c < (o.linksPerNode || 2); c++) {
          var bIdx = best[c][1];
          if (bIdx < a) continue;
          var A = nodes[a], B = nodes[bIdx];
          var tube = new DSE.Mesh(geom.tube({
            tube: o.linkWidth || 0.008, segments: 12, tubeSegments: 4,
            curve: function (t) { return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; }
          }), mat.unlit({ color: col, opacity: 0.32 }), {});
          scene.add(tube); out.links.push(tube);
        }
      }
      out.group = { nodes: nodes };
      return out;
    },

    /** Motes / dust drifting through the whole scene. */
    dust: function (scene, o) {
      o = o || {};
      var p = new DSE.Particles({
        count: o.count || 420, spread: o.spread || [22, 12, 22], size: o.size || 1.7,
        color: o.color || '#ffffff', colors: o.colors, shape: o.shape || 'dot',
        opacity: o.opacity === undefined ? 0.42 : o.opacity,
        twinkle: o.twinkle === undefined ? 0.9 : o.twinkle,
        drift: o.drift || [0, 0.5, 0], speed: o.speed === undefined ? 0.3 : o.speed,
        seed: o.seed || 9, depthFade: true
      });
      scene.add(p);
      return p;
    }
  };

  /* ================================================================== *
   *  8. UI widgets — toast, tabs, accordion, modal, tooltip, rail dots
   * ================================================================== */

  FX.toast = function (msg, opts) {
    opts = opts || {};
    var host = $('.fx-toasts') || (function () {
      var h = el('div', { class: 'fx-toasts' });
      document.body.appendChild(h); return h;
    })();
    var t = el('div', { class: 'fx-toast' },
      '<span class="fx-toast-dot"></span><span class="fx-toast-msg">' + msg + '</span>');
    if (opts.kind) t.classList.add('fx-toast-' + opts.kind);
    host.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () {
      t.classList.remove('is-in');
      setTimeout(function () { t.remove(); }, 520);
    }, opts.duration || 2600);
    return t;
  };

  FX.tabs = function (root) {
    root = typeof root === 'string' ? $(root) : root;
    if (!root) return;
    var btns = $$('[data-tab]', root), panels = $$('[data-panel]', root);
    function activate(id) {
      btns.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === id); });
      panels.forEach(function (p) {
        var on = p.getAttribute('data-panel') === id;
        p.classList.toggle('is-active', on);
        if (on) { p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; }
      });
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { activate(b.getAttribute('data-tab')); }); });
    if (btns[0]) activate(btns[0].getAttribute('data-tab'));
    return { activate: activate };
  };

  FX.accordion = function (root) {
    root = typeof root === 'string' ? $(root) : root;
    if (!root) return;
    $$('.fx-acc-item', root).forEach(function (item) {
      var head = $('.fx-acc-head', item), body = $('.fx-acc-body', item);
      if (!head || !body) return;
      head.addEventListener('click', function () {
        var open = item.classList.contains('is-open');
        $$('.fx-acc-item', root).forEach(function (o) {
          o.classList.remove('is-open');
          var b = $('.fx-acc-body', o); if (b) b.style.maxHeight = '0px';
        });
        if (!open) {
          item.classList.add('is-open');
          body.style.maxHeight = body.scrollHeight + 'px';
        }
      });
    });
    return root;
  };

  FX.modal = function (triggerSel, modalSel) {
    var m = $(modalSel);
    if (!m) return;
    $$(triggerSel).forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        m.classList.add('is-open');
        document.documentElement.style.overflow = 'hidden';
      });
    });
    $$('[data-modal-close]', m).forEach(function (c) {
      c.addEventListener('click', function () { close(); });
    });
    function close() { m.classList.remove('is-open'); document.documentElement.style.overflow = ''; }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    return { close: close, open: function () { m.classList.add('is-open'); } };
  };

  FX.tooltip = function (sel) {
    $$(sel || '[data-tip]').forEach(function (n) {
      var tip = el('span', { class: 'fx-tip' }, n.getAttribute('data-tip'));
      n.appendChild(tip);
      n.classList.add('has-tip');
      n.addEventListener('pointerenter', function () { tip.classList.add('is-on'); });
      n.addEventListener('pointerleave', function () { tip.classList.remove('is-on'); });
    });
  };

  /** Rail of dots that track sections while scrolling (scrollspy). */
  FX.scrollSpy = function (opts) {
    opts = opts || {};
    var sections = $$(opts.sections || 'section[id]');
    var rail = $(opts.rail || '.fx-rail');
    var dots = [];
    if (rail) {
      sections.forEach(function (s) {
        var d = el('button', { class: 'fx-rail-dot', 'aria-label': s.id });
        d.addEventListener('click', function () { s.scrollIntoView({ behavior: 'smooth' }); });
        rail.appendChild(d); dots.push(d);
      });
    }
    function upd() {
      var mid = window.scrollY + window.innerHeight * 0.4, active = 0;
      sections.forEach(function (s, i) { if (s.offsetTop <= mid) active = i; });
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === active); });
      if (opts.onActive) opts.onActive(active, sections[active]);
    }
    window.addEventListener('scroll', upd, { passive: true });
    upd();
    return upd;
  };

  /* ================================================================== *
   *  9. Micro sound (optional, muted by default)
   * ================================================================== */

  FX.sound = function (opts) {
    opts = opts || {};
    var ctx = null, enabled = !!opts.enabled;
    function ac() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    }
    function blip(freq, dur, type, gain) {
      if (!enabled) return;
      try {
        var c = ac(), o = c.createOscillator(), g = c.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.value = 0;
        o.connect(g); g.connect(c.destination);
        var t = c.currentTime;
        g.gain.linearRampToValueAtTime(gain === undefined ? 0.06 : gain, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.16));
        o.start(t); o.stop(t + (dur || 0.16) + 0.02);
      } catch (e) { }
    }
    return {
      blip: blip,
      hover: function () { blip(880, 0.08, 'triangle', 0.025); },
      click: function () { blip(420, 0.14, 'square', 0.03); },
      toggle: function (v) { enabled = v === undefined ? !enabled : v; return enabled; },
      get enabled() { return enabled; }
    };
  };

  /* ================================================================== *
   *  10. Snippet helpers for demos
   * ================================================================== */

  FX.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var ta = el('textarea'); ta.value = text; document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    ta.remove();
    return Promise.resolve();
  };

  FX.raf = function (fn) {
    var last = FX.now(), run = true;
    (function loop() {
      if (!run) return;
      var now = FX.now(), dt = Math.min(64, now - last) / 1000; last = now;
      fn(dt, now / 1000);
      requestAnimationFrame(loop);
    })();
    return function () { run = false; };
  };

  FX.mount = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  FX.prefersReduced = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  global.FX = FX;
})(typeof window !== 'undefined' ? window : globalThis);
