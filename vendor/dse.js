/*!
 * ============================================================================
 *  DSE — Deep Space Engine
 *  A dependency-free 3D engine for Canvas2D.
 *  Painter's-algorithm triangle rasterizer with:
 *    - Vec3 / Mat4 math, quaternions, spherical cameras
 *    - procedural geometries: box, sphere, torus, torusKnot, cylinder, cone,
 *      plane (with subdivisions), icosahedron, tetrahedron, octahedron,
 *      capsule, tube, grid, ring, star, helix, ribbon, terrain, extrude
 *    - procedural Canvas2D textures: grid, dots, stripes, checker, noise,
 *      bricks, rings, cells, wood, gradient, text, glyph, halftone, scanline
 *    - flat / lambert / phong / metal / toon / unlit / glass / wire / matcap
 *      shading modes with fog, emissive, opacity, UV texture mapping
 *    - per-vertex displacement, per-face colouring, edge strokes
 *    - particles, streaks, trails, custom draw layers, bloom-ish glow pass
 *
 *  Usage:
 *    const { Scene, Camera, Mesh, geom, mat, tex } = DSE;
 *    const scene = new Scene(canvas, {...});
 *    scene.add(new Mesh(geom.torus({...}), mat.phong({...})));
 *    scene.start();
 * ============================================================================
 */
(function (global) {
  'use strict';

  var PI = Math.PI, TAU = PI * 2;
  var cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt, abs = Math.abs;
  var min = Math.min, max = Math.max, pow = Math.pow, atan2 = Math.atan2;
  var floor = Math.floor, round = Math.round;

  /* ------------------------------------------------------------------ *
   *  Small helpers
   * ------------------------------------------------------------------ */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function hex2rgb(h) {
    if (typeof h !== 'string') return h;
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixRGB(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  function rgbStr(c, alpha) {
    var r = c[0] | 0, g = c[1] | 0, b = c[2] | 0;
    return alpha === undefined || alpha >= 1
      ? 'rgb(' + r + ',' + g + ',' + b + ')'
      : 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
  }
  function shade(c, k, alpha) {
    return rgbStr([c[0] * k, c[1] * k, c[2] * k], alpha);
  }
  // deterministic pseudo-random (mulberry32) so scenes are stable per seed
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ *
   *  Vec3 (plain arrays)
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   *  Colour helpers shared by materials and particles
   * ------------------------------------------------------------------ */

  var _hr = [0, 0, 0];
  function hueRotate(c, deg) {
    if (!deg) return c;
    var a = deg * PI / 180, cosA = cos(a), sinA = sin(a);
    var r = c[0], g = c[1], b = c[2];
    _hr[0] = (0.213 + cosA * 0.787 - sinA * 0.213) * r + (0.715 - cosA * 0.715 - sinA * 0.715) * g + (0.072 - cosA * 0.072 + sinA * 0.928) * b;
    _hr[1] = (0.213 - cosA * 0.213 + sinA * 0.143) * r + (0.715 + cosA * 0.285 + sinA * 0.140) * g + (0.072 - cosA * 0.072 - sinA * 0.283) * b;
    _hr[2] = (0.213 - cosA * 0.213 - sinA * 0.787) * r + (0.715 - cosA * 0.715 + sinA * 0.715) * g + (0.072 + cosA * 0.928 + sinA * 0.072) * b;
    return _hr;
  }

  /* ------------------------------------------------------------------ *
   *  Vec3 (plain arrays)
   * ------------------------------------------------------------------ */

  var V = {
    make: function (x, y, z) { return [x || 0, y || 0, z || 0]; },    add: function (a, b, o) { o = o || [0, 0, 0]; o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
    sub: function (a, b, o) { o = o || [0, 0, 0]; o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
    scale: function (a, s, o) { o = o || [0, 0, 0]; o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b, o) {
      o = o || [0, 0, 0];
      var x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
      o[0] = x; o[1] = y; o[2] = z; return o;
    },
    len: function (a) { return sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
    norm: function (a, o) {
      o = o || [0, 0, 0];
      var l = V.len(a) || 1; o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
    },
    lerp: function (a, b, t, o) {
      o = o || [0, 0, 0];
      o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o;
    },
    copy: function (a, o) { o = o || [0, 0, 0]; o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
    dist: function (a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return sqrt(x * x + y * y + z * z); }
  };

  /* ------------------------------------------------------------------ *
   *  Mat4 (column-major like WebGL, m[col*4+row])
   * ------------------------------------------------------------------ */

  var M4 = {
    identity: function (o) {
      o = o || new Float32Array(16);
      o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
      o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
      return o;
    },
    mul: function (a, b, o) {
      o = o || new Float32Array(16);
      for (var c = 0; c < 4; c++) {
        var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
        o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
        o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      return o;
    },
    perspective: function (fovDeg, aspect, near, far, o) {
      o = o || new Float32Array(16);
      var f = 1 / Math.tan(fovDeg * PI / 360), nf = 1 / (near - far);
      o.fill(0);
      o[0] = f / aspect; o[5] = f;
      o[10] = (far + near) * nf; o[11] = -1;
      o[14] = 2 * far * near * nf;
      return o;
    },
    lookAt: function (eye, center, up, o) {
      o = o || new Float32Array(16);
      var z = V.norm(V.sub(eye, center));
      var x = V.norm(V.cross(up, z));
      if (V.len(x) < 1e-6) { x = [1, 0, 0]; }
      var y = V.cross(z, x);
      o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[3] = 0;
      o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[7] = 0;
      o[8] = x[2]; o[9] = y[2]; o[10] = z[2]; o[11] = 0;
      o[12] = -V.dot(x, eye); o[13] = -V.dot(y, eye); o[14] = -V.dot(z, eye); o[15] = 1;
      return o;
    },
    fromTRS: function (t, q, s, o) {
      o = o || new Float32Array(16);
      var x = q[0], y = q[1], z = q[2], w = q[3];
      var x2 = x + x, y2 = y + y, z2 = z + z;
      var xx = x * x2, xy = x * y2, xz = x * z2;
      var yy = y * y2, yz = y * z2, zz = z * z2;
      var wx = w * x2, wy = w * y2, wz = w * z2;
      var sx = s[0], sy = s[1], sz = s[2];
      o[0] = (1 - (yy + zz)) * sx; o[1] = (xy + wz) * sx; o[2] = (xz - wy) * sx; o[3] = 0;
      o[4] = (xy - wz) * sy; o[5] = (1 - (xx + zz)) * sy; o[6] = (yz + wx) * sy; o[7] = 0;
      o[8] = (xz + wy) * sz; o[9] = (yz - wx) * sz; o[10] = (1 - (xx + yy)) * sz; o[11] = 0;
      o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1;
      return o;
    },
    quatFromEuler: function (rx, ry, rz, o) {
      o = o || [0, 0, 0, 1];
      var hx = rx * 0.5, hy = ry * 0.5, hz = rz * 0.5;
      var cx = cos(hx), sx = sin(hx), cy = cos(hy), sy = sin(hy), cz = cos(hz), sz = sin(hz);
      o[0] = sx * cy * cz - cx * sy * sz;
      o[1] = cx * sy * cz + sx * cy * sz;
      o[2] = cx * cy * sz - sx * sy * cz;
      o[3] = cx * cy * cz + sx * sy * sz;
      return o;
    },
    quatMul: function (a, b, o) {
      o = o || [0, 0, 0, 1];
      var ax = a[0], ay = a[1], az = a[2], aw = a[3];
      var bx = b[0], by = b[1], bz = b[2], bw = b[3];
      var x = aw * bx + ax * bw + ay * bz - az * by;
      var y = aw * by - ax * bz + ay * bw + az * bx;
      var z = aw * bz + ax * by - ay * bx + az * bw;
      var w = aw * bw - ax * bx - ay * by - az * bz;
      o[0] = x; o[1] = y; o[2] = z; o[3] = w; return o;
    },
    quatFromAxis: function (axis, ang, o) {
      o = o || [0, 0, 0, 1];
      var h = ang * 0.5, s = sin(h);
      o[0] = axis[0] * s; o[1] = axis[1] * s; o[2] = axis[2] * s; o[3] = cos(h);
      return o;
    },
    transformPoint: function (m, p, o) {
      o = o || [0, 0, 0];
      var x = p[0], y = p[1], z = p[2];
      var w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
      o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
      return o;
    },
    transformDir: function (m, p, o) {
      o = o || [0, 0, 0];
      var x = p[0], y = p[1], z = p[2];
      o[0] = m[0] * x + m[4] * y + m[8] * z;
      o[1] = m[1] * x + m[5] * y + m[9] * z;
      o[2] = m[2] * x + m[6] * y + m[10] * z;
      return o;
    },
    // rotate a direction by a quaternion
    rotateByQuat: function (q, v, o) {
      o = o || [0, 0, 0];
      var x = v[0], y = v[1], z = v[2];
      var qx = q[0], qy = q[1], qz = q[2], qw = q[3];
      var ix = qw * x + qy * z - qz * y;
      var iy = qw * y + qz * x - qx * z;
      var iz = qw * z + qx * y - qy * x;
      var iw = -qx * x - qy * y - qz * z;
      o[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
      o[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
      o[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
      return o;
    }
  };

  /* ------------------------------------------------------------------ *
   *  Geometry builders
   *  All produce: {pos:[x,y,z,...], faces:[[i,j,k,...]], uv?:[...],
   *                fc?:[[r,g,b]...] | fn(i,faceIndex), n?:normals, meta}
   * ------------------------------------------------------------------ */

  var geom = {};

  function meshFromGrid(grid, opts) {
    // grid: array of rows, each row array of [x,y,z]
    opts = opts || {};
    var pos = [], uv = [], faces = [], rows = grid.length, cols = grid[0].length;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var p = grid[r][c];
        pos.push(p[0], p[1], p[2]);
        uv.push(cols > 1 ? c / (cols - 1) : 0, rows > 1 ? 1 - r / (rows - 1) : 0);
      }
    }
    var wrapU = !!opts.wrapU, wrapV = !!opts.wrapV;
    for (var r2 = 0; r2 < rows - 1; r2++) {
      for (var c2 = 0; c2 < cols - 1; c2++) {
        var a = r2 * cols + c2, b = a + 1, d = a + cols, e = d + 1;
        faces.push([a, b, e, d]);
      }
      if (wrapU) {
        var a2 = r2 * cols + (cols - 1), b2 = r2 * cols, d2 = a2 + cols, e2 = b2 + cols;
        faces.push([a2, b2, e2, d2]);
      }
    }
    if (wrapV && rows > 2) {
      for (var c3 = 0; c3 < cols - 1; c3++) {
        faces.push([(rows - 1) * cols + c3, (rows - 1) * cols + c3 + 1, c3 + 1, c3]);
      }
      if (wrapU) faces.push([(rows - 1) * cols + cols - 1, (rows - 1) * cols, cols, 0]);
    }
    return { pos: pos, uv: uv, faces: faces, meta: opts.meta || {} };
  }

  /**
   * Rebuild a geometry so each face owns its vertices, carrying exact per-vertex
   * UVs (given in face-vertex order, or taken from g.uv).
   */
  function expandFaces(g, uvPerFaceVertex) {
    var pos = g.pos, faces = g.faces;
    var flat = uvPerFaceVertex || g.uv;
    var useUV = !!flat;
    var npos = [], nuv = [], nfaces = [];
    for (var f = 0; f < faces.length; f++) {
      var face = faces[f], base = npos.length / 3, nf = [];
      for (var k = 0; k < face.length; k++) {
        var i = face[k];
        npos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        if (useUV) nuv.push(flat[f * face.length * 2 + k * 2] || 0, flat[f * face.length * 2 + k * 2 + 1] || 0);
        nf.push(base + k);
      }
      nfaces.push(nf);
    }
    g.pos = npos; g.faces = nfaces;
    g.uv = useUV ? nuv : null;
    return g;
  }
  geom.expandFaces = expandFaces;

  geom.plane = function (o) {
    o = o || {};
    var w = o.width || 2, h = o.depth === undefined ? (o.height || 2) : o.depth;
    var sx = max(1, o.sx || 1), sz = max(1, o.sz || 1);
    var grid = [];
    for (var i = 0; i <= sz; i++) {
      var row = [];
      for (var j = 0; j <= sx; j++) {
        row.push([-w / 2 + w * j / sx, 0, -h / 2 + h * i / sz]);
      }
      grid.push(row);
    }
    var g = meshFromGrid(grid);
    g.meta.w = w; g.meta.h = h;
    return g;
  };

  geom.box = function (o) {
    o = o || {};
    var w = (o.width || 1) / 2, h = (o.height || 1) / 2, d = (o.depth || 1) / 2;
    var pos = [
      -w, -h, -d, w, -h, -d, w, h, -d, -w, h, -d, // back  0-3
      -w, -h, d, w, -h, d, w, h, d, -w, h, d    // front 4-7
    ];
    var faces = [
      [4, 5, 6, 7],   // +z front
      [1, 0, 3, 2],   // -z back
      [5, 1, 2, 6],   // +x
      [0, 4, 7, 3],   // -x
      [3, 7, 6, 2],   // +y top
      [0, 1, 5, 4]    // -y bottom
    ];
    var quad = [0, 1, 1, 0, 1, 1, 0, 1];
    var uv = [];
    for (var f = 0; f < 6; f++) for (var k = 0; k < 8; k++) uv.push(quad[k]);
    return expandFaces({ pos: pos, uv: uv, faces: faces, meta: { type: 'box' } });
  };

  geom.sphere = function (o) {
    o = o || {};
    var r = o.radius || 1, seg = o.segments || 24, rings = o.rings || Math.max(3, round(seg / 2));
    var grid = [];
    for (var i = 0; i <= rings; i++) {
      var phi = PI * i / rings, row = [];
      for (var j = 0; j <= seg; j++) {
        var th = TAU * j / seg;
        row.push([r * sin(phi) * cos(th), r * cos(phi), r * sin(phi) * sin(th)]);
      }
      grid.push(row);
    }
    // note: wrapU false -> duplicate seam column gives correct uv
    var g = meshFromGrid(grid, { wrapU: true });
    g.meta.type = 'sphere'; g.meta.radius = r; g.meta.closed = true;
    return g;
  };

  geom.torus = function (o) {
    o = o || {};
    var R = o.radius || 1, r = o.tube || 0.35;
    var seg = o.segments || 32, tseg = o.tubeSegments || 14, arc = o.arc || TAU;
    var grid = [];
    for (var i = 0; i <= seg; i++) {
      var u = arc * i / seg, row = [];
      for (var j = 0; j <= tseg; j++) {
        var v = TAU * j / tseg;
        var cx = (R + r * cos(v)) * cos(u);
        var cy = r * sin(v) * (o.flat ? 0.35 : 1);
        var cz = (R + r * cos(v)) * sin(u);
        row.push([cx, cy, cz]);
      }
      grid.push(row);
    }
    var g = meshFromGrid(grid, { wrapU: true, wrapV: true });
    g.meta.type = 'torus'; g.meta.closed = true;
    return g;
  };

  geom.torusKnot = function (o) {
    o = o || {};
    var p = o.p || 2, q = o.q || 3, R = o.radius || 1, tube = o.tube || 0.24;
    var seg = o.segments || 90, tseg = o.tubeSegments || 10;
    function knot(t) {
      var cu = cos(t), su = sin(t), qu = q / p * t;
      var rr = 2 + cos(qu);
      return [rr * cu, rr * su, sin(qu)];
    }
    var rowsData = [];
    for (var i = 0; i <= seg; i++) {
      var t = TAU * p * i / seg;
      var c = knot(t);
      var c2 = knot(t + 0.01);
      var T = V.norm(V.sub(c2, c));
      var N = V.norm(V.add(V.add(V.scale(c, -1), [0, 0, 0]), V.cross(T, [0, 0, 1])));
      if (V.len(N) < 1e-5) N = [0, 1, 0];
      var B = V.cross(T, N);
      rowsData.push({ c: c, N: N, B: B });
    }
    var grid = [];
    for (var i2 = 0; i2 <= seg; i2++) {
      var d = rowsData[i2], row = [];
      for (var j = 0; j <= tseg; j++) {
        var v = TAU * j / tseg;
        var off = V.add(V.scale(d.N, cos(v) * tube), V.scale(d.B, sin(v) * tube));
        row.push(V.add(V.scale(d.c, R * 0.5), off));
      }
      grid.push(row);
    }
    var g = meshFromGrid(grid, { wrapU: true, wrapV: true });
    g.meta.type = 'knot'; g.meta.closed = true;
    return g;
  };

  geom.cylinder = function (o) {
    o = o || {};
    var r1 = o.radiusTop === undefined ? (o.radius || 0.5) : o.radiusTop;
    var r2 = o.radiusBottom === undefined ? (o.radius || 0.5) : o.radiusBottom;
    var h = o.height || 1, seg = o.segments || 24, hseg = o.heightSegments || 1;
    var pos = [], uv = [], faces = [];
    var i, j, rowBase;
    for (i = 0; i <= hseg; i++) {
      var t = i / hseg, y = h / 2 - h * t, r = lerp(r1, r2, t);
      rowBase = pos.length / 3;
      for (j = 0; j <= seg; j++) {
        var th = TAU * j / seg;
        pos.push(r * cos(th), y, r * sin(th));
        uv.push(j / seg, 1 - t);
      }
    }
    for (i = 0; i < hseg; i++) {
      for (j = 0; j < seg; j++) {
        var a = i * (seg + 1) + j, b = a + 1, d = a + seg + 1, e = d + 1;
        faces.push([a, b, e, d]);
      }
    }
    if (o.caps !== false) {
      var topC = pos.length / 3;
      pos.push(0, h / 2, 0); uv.push(0.5, 0.5);
      var botC = pos.length / 3;
      pos.push(0, -h / 2, 0); uv.push(0.5, 0.5);
      for (j = 0; j < seg; j++) {
        if (r1 > 1e-5) faces.push([topC, j + 1, j]);
        if (r2 > 1e-5) faces.push([botC, hseg * (seg + 1) + j, hseg * (seg + 1) + j + 1]);
      }
    }
    var g = { pos: pos, uv: uv, faces: faces, meta: { type: 'cylinder', rows: hseg + 1, seg: seg, closed: true } };
    return expandFaces(g);
  };

  geom.cone = function (o) {
    o = o || {};
    return geom.cylinder({ radiusTop: o.radiusTop === undefined ? 0 : o.radiusTop, radiusBottom: o.radius || 0.6, height: o.height || 1.2, segments: o.segments || 24, caps: o.caps, heightSegments: o.heightSegments });
  };

  geom.capsule = function (o) {
    o = o || {};
    var r = o.radius || 0.4, h = o.height || 1, seg = o.segments || 18, cap = o.capRings || 5;
    var rowsData = [];
    for (var i = 0; i <= cap; i++) {
      var phi = PI * 0.5 * i / cap;
      rowsData.push({ y: h / 2 + r * cos(phi), rr: r * sin(phi) });
    }
    for (var i2 = cap; i2 >= 0; i2--) {
      var phi2 = PI * 0.5 + PI * 0.5 * (cap - i2) / cap;
      rowsData.push({ y: -h / 2 + r * cos(phi2), rr: r * sin(phi2) });
    }
    var grid = [];
    for (var k = 0; k < rowsData.length; k++) {
      var row = [], d = rowsData[k];
      for (var j = 0; j <= seg; j++) {
        var th = TAU * j / seg;
        row.push([d.rr * cos(th), d.y, d.rr * sin(th)]);
      }
      grid.push(row);
    }
    var g = meshFromGrid(grid, { wrapU: true });
    g.meta.type = 'capsule'; g.meta.closed = true;
    return g;
  };

  geom.icosahedron = function (o) {
    o = o || {};
    var r = o.radius || 1;
    var t = (1 + sqrt(5)) / 2;
    var v = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ];
    var f = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    var pos = [];
    for (var i = 0; i < v.length; i++) {
      var p = V.norm(v[i]);
      pos.push(p[0] * r, p[1] * r, p[2] * r);
    }
    var g = { pos: pos, faces: f.map(function (a) { return a.slice(); }), uv: null, meta: { type: 'ico' } };
    if (o.subdivide) g = subdivide(g, o.subdivide);
    return g;
  };

  geom.octahedron = function (o) {
    o = o || {};
    var r = o.radius || 1;
    var pos = [r, 0, 0, -r, 0, 0, 0, r, 0, 0, -r, 0, 0, 0, r, 0, 0, -r];
    var f = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
    var g = { pos: pos, faces: f, uv: null, meta: { type: 'octa' } };
    if (o.subdivide) g = subdivide(g, o.subdivide);
    return g;
  };

  geom.tetrahedron = function (o) {
    o = o || {};
    var r = o.radius || 1, s = r / sqrt(3);
    var pos = [s, s, s, -s, -s, s, -s, s, -s, s, -s, -s];
    var f = [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]];
    var g = { pos: pos, faces: f, uv: null, meta: { type: 'tetra' } };
    if (o.subdivide) g = subdivide(g, o.subdivide);
    return g;
  };

  function subdivide(g, times) {
    g = { pos: g.pos.slice(), faces: g.faces.map(function (f) { return f.slice(); }), uv: null, meta: g.meta || {} };
    for (var t = 0; t < times; t++) {
      var pos = g.pos, faces = [], cache = {};
      function mid(a, b) {
        var key = a < b ? a + '_' + b : b + '_' + a;
        if (cache[key] !== undefined) return cache[key];
        var i = pos.length / 3;
        pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2);
        cache[key] = i;
        return i;
      }
      for (var i = 0; i < g.faces.length; i++) {
        var f = g.faces[i];
        if (f.length === 3) {
          var a = mid(f[0], f[1]), b = mid(f[1], f[2]), c = mid(f[2], f[0]);
          faces.push([f[0], a, c], [a, f[1], b], [c, b, f[2]], [a, b, c]);
        } else {
          var m0 = mid(f[0], f[1]), m1 = mid(f[1], f[2]), m2 = mid(f[2], f[3]), m3 = mid(f[3], f[0]);
          var ctr = pos.length / 3;
          pos.push((pos[f[0] * 3] + pos[f[1] * 3] + pos[f[2] * 3] + pos[f[3] * 3]) / 4,
            (pos[f[0] * 3 + 1] + pos[f[1] * 3 + 1] + pos[f[2] * 3 + 1] + pos[f[3] * 3 + 1]) / 4,
            (pos[f[0] * 3 + 2] + pos[f[1] * 3 + 2] + pos[f[2] * 3 + 2] + pos[f[3] * 3 + 2]) / 4);
          faces.push([f[0], m0, ctr, m3], [m0, f[1], m1, ctr], [ctr, m1, f[2], m2], [m3, ctr, m2, f[3]]);
        }
      }
      g = { pos: pos, faces: faces, uv: null, meta: g.meta };
    }
    return g;
  }
  geom.subdivide = subdivide;

  /**
   * Ensure faces wound so their normals point away from the origin (or a centre).
   * Cheap global test: compare face normal against the outward direction.
   */
  geom.orientOutward = function (g, center) {
    center = center || [0, 0, 0];
    var score = 0, pos = g.pos;
    for (var i = 0; i < g.faces.length; i++) {
      var f = g.faces[i];
      if (f.length < 3) continue;
      var a = f[0] * 3, b = f[1] * 3, c = f[2] * 3;
      var ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      var vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var cxm = (pos[a] + pos[b] + pos[c]) / 3 - center[0];
      var cym = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - center[1];
      var czm = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - center[2];
      score += nx * cxm + ny * cym + nz * czm;
    }
    if (score < 0) {
      for (var k = 0; k < g.faces.length; k++) g.faces[k].reverse();
    }
    return g;
  };

  geom.tube = function (o) {
    o = o || {};
    var fn = o.curve, tube = o.tube || 0.1, seg = o.segments || 80, tseg = o.tubeSegments || 8;
    var closed = !!o.closed, grid = [];
    var rowsData = [];
    var n = seg;
    for (var i = 0; i <= n; i++) {
      var t = closed ? i / n : i / n;
      var c = fn(t);
      var c2 = fn(closed ? (t + 0.001) : min(1, t + 0.001));
      var T = V.norm(V.sub(c2, c));
      if (V.len(T) < 1e-6) T = [0, 1, 0];
      var up = abs(T[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      var N = V.norm(V.cross(up, T));
      var B = V.cross(T, N);
      rowsData.push({ c: c, N: N, B: B });
    }
    for (var i2 = 0; i2 <= n; i2++) {
      var d = rowsData[i2], row = [];
      for (var j = 0; j <= tseg; j++) {
        var a = TAU * j / tseg;
        var off = V.add(V.scale(d.N, cos(a) * tube), V.scale(d.B, sin(a) * tube));
        row.push(V.add(d.c, off));
      }
      grid.push(row);
    }
    var g = meshFromGrid(grid, { wrapU: true, wrapV: !!o.closed });
    g.meta.type = 'tube'; g.meta.curve = fn; g.meta.closed = !!o.closed;
    return g;
  };

  geom.helix = function (o) {
    o = o || {};
    var turns = o.turns || 3, radius = o.radius || 0.8, height = o.height || 2;
    return geom.tube({
      tube: o.tube || 0.06, segments: o.segments || 120, tubeSegments: o.tubeSegments || 8,
      curve: function (t) {
        var a = TAU * turns * t;
        return [cos(a) * radius, -height / 2 + height * t, sin(a) * radius];
      }
    });
  };

  geom.grid = function (o) {
    o = o || {};
    var w = o.width || 20, d = o.depth || 20, sx = o.sx || 20, sz = o.sz || 20;
    var pos = [], uv = [], faces = [];
    // horizontal lines along x
    for (var i = 0; i <= sz; i++) {
      var z = -d / 2 + d * i / sz;
      var a = pos.length / 3;
      pos.push(-w / 2, 0, z, w / 2, 0, z);
      uv.push(0, 0, 1, 0);
      faces.push([a, a + 1]);
    }
    for (var j = 0; j <= sx; j++) {
      var x = -w / 2 + w * j / sx;
      var b = pos.length / 3;
      pos.push(x, 0, -d / 2, x, 0, d / 2);
      uv.push(0, 0, 0, 1);
      faces.push([b, b + 1]);
    }
    return { pos: pos, uv: uv, faces: faces, lines: true, meta: { type: 'grid' } };
  };

  geom.wire = function (inner, o) {
    // render geometry as lines; edges are de-duplicated by position so
    // non-indexed geometry (boxes, extrusions) still draws each edge once
    o = o || {};
    var pos = inner.pos, faces = [], seen = {};
    function key(i) {
      return (Math.round(pos[i * 3] * 1000) / 1000) + ',' +
        (Math.round(pos[i * 3 + 1] * 1000) / 1000) + ',' +
        (Math.round(pos[i * 3 + 2] * 1000) / 1000);
    }
    for (var i = 0; i < inner.faces.length; i++) {
      var f = inner.faces[i];
      if (f.length < 2) continue;
      for (var k = 0; k < f.length; k++) {
        var a = f[k], b = f[(k + 1) % f.length];
        if (a === b) continue;
        var ka = key(a), kb = key(b);
        var kk = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        if (seen[kk]) continue; seen[kk] = 1;
        faces.push([a, b]);
      }
    }
    return { pos: pos, uv: inner.uv, faces: faces, lines: true, meta: inner.meta };
  };

  geom.ring = function (o) {
    o = o || {};
    var r1 = o.inner || 0.6, r2 = o.outer || 1, seg = o.segments || 48;
    var grid = [[], []];
    for (var i = 0; i <= seg; i++) {
      var a = TAU * i / seg;
      grid[0].push([cos(a) * r1, 0, sin(a) * r1]);
      grid[1].push([cos(a) * r2, 0, sin(a) * r2]);
    }
    // uv
    var g = meshFromGrid(grid, { wrapU: false });
    // remap uv: row0 = 0, row1 = 1
    for (var i2 = 0; i2 <= seg; i2++) g.uv[i2 * 2 + 1] = 0;
    for (var i3 = 0; i3 <= seg; i3++) g.uv[(seg + 1 + i3) * 2 + 1] = 1;
    return g;
  };

  geom.star = function (o) {
    o = o || {};
    var points = o.points || 5, r1 = o.inner || 0.45, r2 = o.outer || 1, depth = o.depth || 0;
    var n = points * 2, ring = [];
    for (var i = 0; i < n; i++) {
      var a = TAU * i / n - PI / 2, r = i % 2 ? r1 : r2;
      ring.push([cos(a) * r, depth, sin(a) * r]);
    }
    var grid = [ring.slice(), ring.slice()];
    grid[1] = ring.map(function (p) { return [p[0] * 0.001, depth, p[2] * 0.001]; });
    return meshFromGrid(grid);
  };

  geom.extrude = function (shape, o) {
    // shape: array of [x,y] points (CCW), extruded along z
    o = o || {};
    var depth = o.depth || 0.2, n = shape.length;
    var pos = [], faces = [], uv = [];
    for (var i = 0; i < n; i++) pos.push(shape[i][0], shape[i][1], depth / 2);
    for (var i2 = 0; i2 < n; i2++) pos.push(shape[i2][0], shape[i2][1], -depth / 2);
    faces.push([]);
    for (var i3 = 0; i3 < n; i3++) faces[0].push(i3);
    faces.push([]);
    for (var i4 = n - 1; i4 >= 0; i4--) faces[1].push(n + i4);
    for (var i5 = 0; i5 < n; i5++) {
      var a = i5, b = (i5 + 1) % n;
      faces.push([a, b, n + b, n + a]);
    }
    var g = { pos: pos, faces: faces, uv: null, meta: {} };
    if (o.subdivide) g = subdivide(g, o.subdivide);
    return g;
  };

  geom.terrain = function (o) {
    o = o || {};
    var w = o.width || 8, d = o.depth || 8, sx = o.sx || 32, sz = o.sz || 32;
    var h = o.height || 0.6, fn = o.fn || function (x, z) { return sin(x * 1.4) * cos(z * 1.2) * h; };
    var grid = [];
    for (var i = 0; i <= sz; i++) {
      var row = [];
      for (var j = 0; j <= sx; j++) {
        var x = -w / 2 + w * j / sx, z = -d / 2 + d * i / sz;
        row.push([x, fn(x, z), z]);
      }
      grid.push(row);
    }
    return meshFromGrid(grid);
  };

  geom.shell = function (o) {
    // icosphere-like shell built from subdivided icosahedron pushed to radius
    o = o || {};
    var g = geom.icosahedron({ radius: 1, subdivide: o.subdivide || 1 });
    var wob = o.wobble || 0;
    for (var i = 0; i < g.pos.length; i += 3) {
      var p = [g.pos[i], g.pos[i + 1], g.pos[i + 2]];
      var l = V.len(p) || 1;
      var k = (o.radius || 1) * (1 + wob * sin(p[0] * 3.1) * cos(p[1] * 2.7) * sin(p[2] * 3.5));
      g.pos[i] = p[0] / l * k; g.pos[i + 1] = p[1] / l * k; g.pos[i + 2] = p[2] / l * k;
    }
    g.meta.type = 'shell';
    return g;
  };

  geom.combine = function (list) {
    var pos = [], faces = [], uv = [];
    for (var i = 0; i < list.length; i++) {
      var g = list[i], base = pos.length / 3;
      for (var k = 0; k < g.pos.length; k++) pos.push(g.pos[k]);
      if (g.uv) for (var k2 = 0; k2 < g.pos.length / 3 * 2; k2++) uv.push(g.uv[k2] || 0);
      else for (var k3 = 0; k3 < g.pos.length / 3; k3++) uv.push(0, 0);
      for (var f = 0; f < g.faces.length; f++) {
        var face = g.faces[f], nf = [];
        for (var j = 0; j < face.length; j++) nf.push(face[j] + base);
        faces.push(nf);
      }
    }
    return { pos: pos, faces: faces, uv: uv, meta: {} };
  };

  /* ------------------------------------------------------------------ *
   *  Geometry post-processing
   * ------------------------------------------------------------------ */

  geom.transform = function (g, fn) {
    for (var i = 0; i < g.pos.length; i += 3) {
      var p = fn([g.pos[i], g.pos[i + 1], g.pos[i + 2]], i / 3);
      g.pos[i] = p[0]; g.pos[i + 1] = p[1]; g.pos[i + 2] = p[2];
    }
    return g;
  };

  geom.scale = function (g, x, y, z) {
    y = y === undefined ? x : y; z = z === undefined ? x : z;
    return geom.transform(g, function (p) { return [p[0] * x, p[1] * y, p[2] * z]; });
  };
  geom.translate = function (g, x, y, z) {
    return geom.transform(g, function (p) { return [p[0] + x, p[1] + y, p[2] + z]; });
  };
  geom.rotateY = function (g, a) {
    return geom.transform(g, function (p) { return [p[0] * cos(a) + p[2] * sin(a), p[1], -p[0] * sin(a) + p[2] * cos(a)]; });
  };
  geom.rotateX = function (g, a) {
    return geom.transform(g, function (p) { var y = p[1] * cos(a) - p[2] * sin(a), z = p[1] * sin(a) + p[2] * cos(a); return [p[0], y, z]; });
  };
  geom.rotateZ = function (g, a) {
    return geom.transform(g, function (p) { return [p[0] * cos(a) - p[1] * sin(a), p[0] * sin(a) + p[1] * cos(a), p[2]]; });
  };

  geom.displace = function (g, fn) {
    // fn(p, i, geom) -> [x,y,z]; optionally returns {p, c} for per-vertex colour
    for (var i = 0; i < g.pos.length; i += 3) {
      var p = fn([g.pos[i], g.pos[i + 1], g.pos[i + 2]], i / 3, g);
      if (p && p.p) { p = p.p; }
      if (!p) continue;
      g.pos[i] = p[0]; g.pos[i + 1] = p[1]; g.pos[i + 2] = p[2];
    }
    return g;
  };

  geom.faceColors = function (g, fn) {
    g.fc = [];
    for (var i = 0; i < g.faces.length; i++) {
      var f = g.faces[i];
      var c = [0, 0, 0];
      for (var k = 0; k < f.length; k++) {
        c[0] += g.pos[f[k] * 3]; c[1] += g.pos[f[k] * 3 + 1]; c[2] += g.pos[f[k] * 3 + 2];
      }
      c[0] /= f.length; c[1] /= f.length; c[2] /= f.length;
      var col = fn(c, i, g);
      g.fc.push(col ? hex2rgb(col) : [255, 255, 255]);
    }
    return g;
  };

  geom.vertexColors = function (g, fn) {
    g.vc = [];
    for (var i = 0; i < g.pos.length; i += 3) {
      var c = fn([g.pos[i], g.pos[i + 1], g.pos[i + 2]], i / 3, g);
      g.vc.push(hex2rgb(c || [255, 255, 255]));
    }
    return g;
  };

  geom.randomizeFaces = function (g, seed) {
    var r = seeded(seed || 1);
    for (var i = 0; i < g.pos.length; i++) g.pos[i] += (r() - 0.5) * 0.001;
    return g;
  };

  geom.merge = function () { return geom.combine(Array.prototype.slice.call(arguments)); };

  /* ------------------------------------------------------------------ *
   *  Procedural textures (Canvas2D)
   * ------------------------------------------------------------------ */

  var tex = {};

  function makeCanvas(w, h) {
    var c;
    if (typeof document !== 'undefined') {
      c = document.createElement('canvas');
    } else {
      return null;
    }
    c.width = w || 512; c.height = h || 512;
    return c;
  }

  tex.fromDraw = function (w, h, fn) {
    var c = makeCanvas(w, h);
    if (!c) return null;
    var x = c.getContext('2d');
    fn(x, w, h);
    return c;
  };

  tex.solid = function (color) {
    return tex.fromDraw(8, 8, function (x, w, h) { x.fillStyle = color; x.fillRect(0, 0, w, h); });
  };

  tex.grid = function (o) {
    o = o || {};
    var size = o.size || 256, cell = o.cell || 32;
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.bg || '#05070d'; x.fillRect(0, 0, w, h);
      x.strokeStyle = o.color || '#00e5ff';
      x.lineWidth = o.lineWidth || 2;
      x.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
      for (var i = 0; i <= w; i += cell) {
        x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke();
        x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke();
      }
      if (o.major) {
        x.globalAlpha = 1; x.lineWidth = (o.lineWidth || 2) * 2;
        for (var j = 0; j <= w; j += cell * 4) {
          x.beginPath(); x.moveTo(j, 0); x.lineTo(j, h); x.stroke();
          x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke();
        }
      }
    });
  };

  tex.dots = function (o) {
    o = o || {};
    var size = o.size || 256, step = o.step || 24;
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.bg || '#000'; x.fillRect(0, 0, w, h);
      x.fillStyle = o.color || '#fff';
      for (var i = step / 2; i < w; i += step)
        for (var j = step / 2; j < h; j += step) {
          x.beginPath(); x.arc(i, j, o.radius || 3, 0, TAU); x.fill();
        }
    });
  };

  tex.stripes = function (o) {
    o = o || {};
    var size = o.size || 256;
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.bg || '#111'; x.fillRect(0, 0, w, h);
      x.fillStyle = o.color || '#fff';
      var bw = o.band || 16, gap = o.gap || 16, vert = !!o.vertical;
      for (var i = -h; i < w + h; i += bw + gap) {
        x.save();
        if (vert) { x.fillRect(i, 0, bw, h); }
        else {
          x.translate(i, 0); x.rotate(o.angle || 0); x.fillRect(0, -h, bw, h * 3);
        }
        x.restore();
      }
    });
  };

  tex.checker = function (o) {
    o = o || {};
    var size = o.size || 256, n = o.n || 8;
    return tex.fromDraw(size, size, function (x, w, h) {
      var s = w / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        x.fillStyle = (i + j) % 2 ? (o.c1 || '#ffffff') : (o.c2 || '#0b0b12');
        x.fillRect(i * s, j * s, s, s);
      }
    });
  };

  tex.noise = function (o) {
    o = o || {};
    var size = o.size || 128, amount = o.amount || 40, base = o.base || '#0a0a0f';
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = base; x.fillRect(0, 0, w, h);
      var img = x.getImageData(0, 0, w, h), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var n = (Math.random() - 0.5) * amount;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      x.putImageData(img, 0, 0);
    });
  };

  tex.bricks = function (o) {
    o = o || {};
    var size = o.size || 256, bw = o.bw || 64, bh = o.bh || 28;
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.mortar || '#1a1a22'; x.fillRect(0, 0, w, h);
      var rows = Math.ceil(h / bh);
      for (var r = 0; r < rows; r++) {
        var off = (r % 2) * bw / 2;
        for (var i = -bw; i < w + bw; i += bw) {
          x.fillStyle = o.color || '#3a3a4a';
          x.fillRect(i + off + 2, r * bh + 2, bw - 4, bh - 4);
        }
      }
    });
  };

  tex.rings = function (o) {
    o = o || {};
    var size = o.size || 256;
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.bg || '#000'; x.fillRect(0, 0, w, h);
      x.strokeStyle = o.color || '#fff';
      var step = o.step || 12;
      for (var r = step; r < w; r += step) {
        x.globalAlpha = 1 - r / w;
        x.lineWidth = o.lineWidth || 2;
        x.beginPath(); x.arc(w / 2, h / 2, r, 0, TAU); x.stroke();
      }
    });
  };

  tex.cells = function (o) {
    o = o || {};
    var size = o.size || 256, n = o.n || 40;
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.bg || '#05070c'; x.fillRect(0, 0, w, h);
      x.strokeStyle = o.color || '#7cf'; x.lineWidth = o.lineWidth || 1.4;
      var pts = [];
      for (var i = 0; i < n; i++) pts.push([Math.random() * w, Math.random() * h]);
      for (var a = 0; a < pts.length; a++) {
        var best = [];
        for (var b = 0; b < pts.length; b++) if (b !== a) best.push([V.dist([pts[a][0], pts[a][1], 0], [pts[b][0], pts[b][1], 0]), b]);
        best.sort(function (p, q) { return p[0] - q[0]; });
        for (var k = 0; k < 3; k++) {
          x.beginPath(); x.moveTo(pts[a][0], pts[a][1]); x.lineTo(pts[best[k][1]][0], pts[best[k][1]][1]); x.stroke();
        }
        x.beginPath(); x.arc(pts[a][0], pts[a][1], 2, 0, TAU); x.fillStyle = o.color || '#7cf'; x.fill();
      }
    });
  };

  tex.gradient = function (o) {
    o = o || {};
    var size = o.size || 256;
    return tex.fromDraw(size, size, function (x, w, h) {
      var g = o.radial
        ? x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
        : x.createLinearGradient(0, 0, o.diagonal ? w : 0, o.diagonal ? h : h);
      var stops = o.stops || [[0, '#ff0080'], [1, '#00e5ff']];
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
  };

  tex.halftone = function (o) {
    o = o || {};
    var size = o.size || 256;
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.bg || '#101018'; x.fillRect(0, 0, w, h);
      x.fillStyle = o.color || '#fff';
      var step = o.step || 14;
      for (var i = 0; i < w; i += step)
        for (var j = 0; j < h; j += step) {
          var r = (o.max || 5) * (1 - j / h) + 0.4;
          x.beginPath(); x.arc(i, j, r, 0, TAU); x.fill();
        }
    });
  };

  tex.scanlines = function (o) {
    o = o || {};
    var size = o.size || 256;
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.bg || '#000'; x.fillRect(0, 0, w, h);
      x.fillStyle = o.color || '#fff';
      for (var j = 0; j < h; j += o.step || 4) x.fillRect(0, j, w, o.thick || 1);
    });
  };

  tex.wood = function (o) {
    o = o || {};
    var size = o.size || 256;
    return tex.fromDraw(size, size, function (x, w, h) {
      for (var i = 0; i < w; i++) {
        var v = 0.5 + 0.5 * sin(i * 0.22 + sin(i * 0.03) * 3);
        var c = mixRGB(hex2rgb(o.dark || '#3b2416'), hex2rgb(o.light || '#a9754a'), v);
        x.fillStyle = rgbStr(c); x.fillRect(i, 0, 1, h);
      }
      x.globalAlpha = 0.12;
      for (var k = 0; k < 120; k++) {
        x.fillStyle = '#000';
        x.fillRect(Math.random() * w, Math.random() * h, Math.random() * 40, 1);
      }
    });
  };

  tex.text = function (o) {
    o = o || {};
    var w = o.width || 512, h = o.height || 128;
    return tex.fromDraw(w, h, function (x) {
      x.fillStyle = o.bg || 'rgba(0,0,0,0)';
      if (o.bg) x.fillRect(0, 0, w, h);
      x.fillStyle = o.color || '#fff';
      x.font = (o.font || 'bold 72px "Helvetica Neue", Arial, sans-serif');
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(o.text || 'TEXT', w / 2, h / 2);
    });
  };

  tex.glyphs = function (o) {
    o = o || {};
    var size = o.size || 256, chars = o.chars || '01<>[]{}/*+-=#@$%&ABCDEF';
    return tex.fromDraw(size, size, function (x, w, h) {
      x.fillStyle = o.bg || '#04060a'; x.fillRect(0, 0, w, h);
      x.fillStyle = o.color || '#5cff9d';
      x.font = (o.font || '13px monospace');
      var step = o.step || 13, cols = Math.floor(w / step), rows = Math.floor(h / step);
      for (var i = 0; i < cols; i++)
        for (var j = 0; j < rows; j++) {
          if (Math.random() > (o.density === undefined ? 0.5 : o.density)) continue;
          x.globalAlpha = 0.25 + Math.random() * 0.75;
          x.fillText(chars[(Math.random() * chars.length) | 0], i * step, (j + 1) * step);
        }
    });
  };

  tex.imageData = function (canvas) { return canvas; };

  /* ------------------------------------------------------------------ *
   *  Materials
   * ------------------------------------------------------------------ */

  var mat = {};

  function base(o) {
    o = o || {};
    return {
      mode: o.mode || 'flat',
      color: hex2rgb(o.color === undefined ? '#8899ff' : o.color),
      color2: hex2rgb(o.color2 === undefined ? '#ffffff' : o.color2),
      emissive: hex2rgb(o.emissive === undefined ? '#000000' : o.emissive),
      emissiveIntensity: o.emissiveIntensity === undefined ? 1 : o.emissiveIntensity,
      opacity: o.opacity === undefined ? 1 : o.opacity,
      texture: o.texture || null,
      map: o.map || null,
      edge: o.edge === undefined ? null : (o.edge ? hex2rgb(o.edge) : null),
      edgeWidth: o.edgeWidth || 1,
      shininess: o.shininess === undefined ? 40 : o.shininess,
      specular: o.specular === undefined ? 0.5 : o.specular,
      steps: o.steps || 3,
      fog: o.fog === undefined ? true : o.fog,
      doubleSide: !!o.doubleSide,
      cull: o.cull === undefined ? !o.doubleSide : o.cull,
      hueShift: o.hueShift || 0,
      hueAnim: o.hueAnim || 0,
      flatShade: o.flatShade === undefined ? true : o.flatShade,
      tintMode: o.tintMode || 'mix',
      smoothMap: o.smoothMap,
      steps2: 0,
      saturate: o.saturate === undefined ? 1 : o.saturate,
      lightness: o.lightness === undefined ? 1 : o.lightness,
      glow: o.glow || 0,
      glowColor: hex2rgb(o.glowColor === undefined ? (o.color || '#8899ff') : o.glowColor),
      scatter: o.scatter || 0,
      useVertexColors: !!o.useVertexColors,
      useFaceColors: !!o.useFaceColors,
      smoothShade: !!o.smoothShade,
      mapRepeat: o.mapRepeat || [1, 1],
      mapOffset: o.mapOffset || [0, 0],
      anim: o.anim || null,
      _color: null
    };
  }

  mat.flat = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'flat' })); };
  mat.unlit = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'unlit' })); };
  mat.lambert = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'lambert' })); };
  mat.phong = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'phong' })); };
  mat.metal = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'metal', specular: (o && o.specular) || 0.9 })); };
  mat.toon = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'toon' })); };
  mat.glass = function (o) {
    o = o || {};
    return base(Object.assign({}, o, {
      mode: 'glass',
      opacity: o.opacity === undefined ? 0.16 : o.opacity,
      edge: o.edge === undefined ? '#ffffff' : o.edge,
      edgeWidth: o.edgeWidth || 1.2,
      cull: o.cull === undefined ? false : o.cull,
      specular: 1
    }));
  };
  mat.wire = function (o) {
    o = o || {};
    return base(Object.assign({}, o, { mode: 'wire', lines: true, edge: o.edge === undefined ? (o.color || '#7cf') : o.edge, opacity: o.opacity === undefined ? 0.7 : o.opacity }));
  };
  mat.points = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'points' })); };
  mat.matcap = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'matcap', texture: o.texture })); };
  mat.custom = function (o) { o = o || {}; return base(Object.assign({}, o, { mode: 'custom', draw: o.draw })); };
  mat.clone = function (m) { var c = {}; for (var k in m) c[k] = m[k]; return c; };

  /* ------------------------------------------------------------------ *
   *  Mesh
   * ------------------------------------------------------------------ */

  function Mesh(g, material, o) {
    o = o || {};
    this.geom = g;
    this.mat = material || mat.lambert({});
    this.position = V.make(o.x || 0, o.y || 0, o.z || 0);
    this.rotation = V.make(o.rx || 0, o.ry || 0, o.rz || 0);
    this.quat = M4.quatFromEuler(this.rotation[0], this.rotation[1], this.rotation[2], [0, 0, 0, 1]);
    this.scale = V.make(o.sx === undefined ? 1 : o.sx, o.sy === undefined ? (o.s === undefined ? 1 : o.s) : o.sy, o.sz === undefined ? (o.s === undefined ? 1 : o.s) : o.sz);
    this.visible = o.visible === undefined ? true : o.visible;
    this.matrix = M4.identity();
    this.parent = null;
    this._dirty = true;
    this._wpos = V.make();
    this._wquat = [0, 0, 0, 1];
    this._wscale = V.make(1, 1, 1);
    this.userData = o.userData || {};
    this.spin = V.make(o.spinX || 0, o.spinY || 0, o.spinZ || 0);
    this.orbit = o.orbit || null; // {radius, speed, height, phase, axis}
    this.onUpdate = o.onUpdate || null;
    this._t = 0;
    // per-mesh render cache
    this._cache = null;
    this.rebuild();
  }

  /**
   * Per-vertex normals: area-weighted average of the adjacent faces' normals.
   * Needed by `smoothShade` materials (organic blobs, liquid metal, spheres) —
   * flat per-face lighting makes a 44x30 sphere read as a polygonal ball.
   */
  Mesh.prototype.computeVertexNormals = function () {
    if (this._smoothN) return this._smoothN;
    var n = this._n, i, k;
    var acc = new Float32Array(n * 3);
    for (i = 0; i < this._fn; i++) {
      var f = this._faces[i];
      if (!f || f.length < 3) continue;
      var a = f[0] * 3, b = f[1] * 3, c = f[2] * 3;
      var ux = this._pos[b] - this._pos[a], uy = this._pos[b + 1] - this._pos[a + 1], uz = this._pos[b + 2] - this._pos[a + 2];
      var vx = this._pos[c] - this._pos[a], vy = this._pos[c + 1] - this._pos[a + 1], vz = this._pos[c + 2] - this._pos[a + 2];
      // unnormalised cross product -> magnitude is 2x the triangle area,
      // which weights the average by area for free
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (k = 0; k < f.length; k++) {
        var o = f[k] * 3;
        acc[o] += nx; acc[o + 1] += ny; acc[o + 2] += nz;
      }
    }
    for (i = 0; i < n; i += 1) {
      var o2 = i * 3;
      var x = acc[o2], y = acc[o2 + 1], z = acc[o2 + 2];
      var l = sqrt(x * x + y * y + z * z) || 1;
      acc[o2] = x / l; acc[o2 + 1] = y / l; acc[o2 + 2] = z / l;
    }
    this._smoothN = acc;
    return acc;
  };

  Mesh.prototype.rebuild = function () {
    var g = this.geom;
    // auto-orient closed solids outward so backface culling and lighting behave
    if (g.meta && g.meta.autoOrient !== false && !g._oriented) {
      var center = V.make(0, 0, 0), n3 = g.pos.length / 3;
      for (var v = 0; v < n3; v++) { center[0] += g.pos[v * 3]; center[1] += g.pos[v * 3 + 1]; center[2] += g.pos[v * 3 + 2]; }
      center[0] /= n3; center[1] /= n3; center[2] /= n3;
      var score = 0;
      for (var i0 = 0; i0 < g.faces.length; i0++) {
        var F = g.faces[i0];
        if (F.length < 3) continue;
        var a = F[0] * 3, b = F[1] * 3, c = F[2] * 3;
        var ux = g.pos[b] - g.pos[a], uy = g.pos[b + 1] - g.pos[a + 1], uz = g.pos[b + 2] - g.pos[a + 2];
        var vx = g.pos[c] - g.pos[a], vy = g.pos[c + 1] - g.pos[a + 1], vz = g.pos[c + 2] - g.pos[a + 2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var mx = (g.pos[a] + g.pos[b] + g.pos[c]) / 3 - center[0];
        var my = (g.pos[a + 1] + g.pos[b + 1] + g.pos[c + 1]) / 3 - center[1];
        var mz = (g.pos[a + 2] + g.pos[b + 2] + g.pos[c + 2]) / 3 - center[2];
        score += nx * mx + ny * my + nz * mz;
      }
      if (score < 0 && g.meta && g.meta.closed) {
        for (var k0 = 0; k0 < g.faces.length; k0++) g.faces[k0].reverse();
      }
      g._oriented = true;
    }
    this._pos = g.pos instanceof Float32Array ? g.pos : Float32Array.from(g.pos);
    this._faces = g.faces;
    this._uv = g.uv ? (g.uv instanceof Float32Array ? g.uv : Float32Array.from(g.uv)) : null;
    if (this.mat && this.mat.mode === 'points' && g.faces && !g._pointsBuilt) {
      // convert faces into point list
    }
    this._n = this._pos.length / 3;
    this._smoothN = null;             // invalidate cached vertex normals
    this._wx = new Float32Array(this._n * 3);
    this._wz = new Float32Array(this._n);
    this._sx = new Float32Array(this._n);
    this._sy = new Float32Array(this._n);
    // precompute face centroids for cheap lighting
    this._fn = this._faces.length;
    this._cent = new Float32Array(this._fn * 3);
    for (var i = 0; i < this._fn; i++) {
      var f = this._faces[i], n = f.length, x = 0, y = 0, z = 0;
      for (var k = 0; k < n; k++) {
        x += this._pos[f[k] * 3]; y += this._pos[f[k] * 3 + 1]; z += this._pos[f[k] * 3 + 2];
      }
      this._cent[i * 3] = x / n; this._cent[i * 3 + 1] = y / n; this._cent[i * 3 + 2] = z / n;
    }
  };

  Mesh.prototype.setPosition = function (x, y, z) { this.position[0] = x; this.position[1] = y; this.position[2] = z; return this; };
  Mesh.prototype.setRotation = function (x, y, z) {
    this.rotation[0] = x; this.rotation[1] = y; this.rotation[2] = z;
    M4.quatFromEuler(x, y, z, this.quat); return this;
  };
  Mesh.prototype.setScale = function (x, y, z) {
    if (y === undefined) { y = x; z = x; }
    this.scale[0] = x; this.scale[1] = y; this.scale[2] = z === undefined ? x : z; return this;
  };

  Mesh.prototype.update = function (dt, t) {
    this._t = t;
    if (this.onUpdate) this.onUpdate(this, dt, t);
    if (this.spin[0] || this.spin[1] || this.spin[2]) {
      this.rotation[0] += this.spin[0] * dt;
      this.rotation[1] += this.spin[1] * dt;
      this.rotation[2] += this.spin[2] * dt;
      M4.quatFromEuler(this.rotation[0], this.rotation[1], this.rotation[2], this.quat);
    }
    if (this.orbit) {
      var o = this.orbit, a = (o.phase || 0) + t * (o.speed || 0.2);
      if (o.axis === 'x') {
        this.position[0] = o.radius * cos(a); this.position[1] = o.height || 0; this.position[2] = o.radius * sin(a);
      } else if (o.axis === 'y') {
        this.position[0] = (o.x || 0); this.position[1] = o.radius * cos(a) * (o.tilt || 1); this.position[2] = o.radius * sin(a);
      } else {
        this.position[0] = o.radius * cos(a); this.position[1] = (o.height || 0) + (o.tilt ? sin(a * (o.tiltSpeed || 2)) * o.tilt : 0); this.position[2] = o.radius * sin(a);
      }
    }
  };

  Mesh.prototype.updateWorld = function (parentMatrix, parentQuat, parentScale) {
    if (parentMatrix) {
      var local = M4.fromTRS(this.position, this.quat, this.scale, this.matrix);
      this._wmat = this._wmat || new Float32Array(16);
      M4.mul(parentMatrix, local, this._wmat);
      // decompose approximately: use parent's rotation for normals
      this._wquat = this._wquat || [0, 0, 0, 1];
      M4.quatMul(parentQuat || [0, 0, 0, 1], this.quat, this._wquat);
      this._wscale[0] = this.scale[0] * (parentScale ? parentScale[0] : 1);
      this._wscale[1] = this.scale[1] * (parentScale ? parentScale[1] : 1);
      this._wscale[2] = this.scale[2] * (parentScale ? parentScale[2] : 1);
      this._wpos[0] = this._wmat[12]; this._wpos[1] = this._wmat[13]; this._wpos[2] = this._wmat[14];
    } else {
      M4.fromTRS(this.position, this.quat, this.scale, this.matrix);
      this._wmat = this.matrix;
      this._wquat[0] = this.quat[0]; this._wquat[1] = this.quat[1]; this._wquat[2] = this.quat[2]; this._wquat[3] = this.quat[3];
      this._wscale[0] = this.scale[0]; this._wscale[1] = this.scale[1]; this._wscale[2] = this.scale[2];
      this._wpos[0] = this.position[0]; this._wpos[1] = this.position[1]; this._wpos[2] = this.position[2];
    }
    var m = this._wmat, pos = this._pos, out = this._wx, cz = this._wz, sx = this._sx, sy = this._sy;
    var scaleFactor = 0;
    for (var i = 0; i < this._n; i++) {
      var x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      var wx = m[0] * x + m[4] * y + m[8] * z + m[12];
      var wy = m[1] * x + m[5] * y + m[9] * z + m[13];
      var wz = m[2] * x + m[6] * y + m[10] * z + m[14];
      out[i * 3] = wx; out[i * 3 + 1] = wy; out[i * 3 + 2] = wz;
      cz[i] = wz;
    }
    // per-face centroids in world space
    for (var f = 0; f < this._fn; f++) {
      var fc = this._faces[f], n2 = fc.length, ax = 0, ay = 0, az = 0;
      for (var k = 0; k < n2; k++) {
        var idx = fc[k];
        ax += out[idx * 3]; ay += out[idx * 3 + 1]; az += out[idx * 3 + 2];
      }
      this._cent[f * 3] = ax / n2; this._cent[f * 3 + 1] = ay / n2; this._cent[f * 3 + 2] = az / n2;
    }
    return this;
  };

  /* ------------------------------------------------------------------ *
   *  Lights
   * ------------------------------------------------------------------ */

  function Light(o) {
    o = o || {};
    this.type = o.type || 'dir';
    this.direction = V.norm(o.direction || [-0.5, 0.8, 0.6]);
    this.position = V.make(o.x || 0, o.y || 0, o.z || 0);
    this.color = hex2rgb(o.color || '#ffffff');
    this.intensity = o.intensity === undefined ? 1 : o.intensity;
    this.radius = o.radius || 10;
  }

  /* ------------------------------------------------------------------ *
   *  Camera
   * ------------------------------------------------------------------ */

  function Camera(o) {
    o = o || {};
    this.position = V.make(o.x || 0, o.y || 0, o.z || 6);
    this.target = V.make(o.tx || 0, o.ty || 0, o.tz || 0);
    this.up = V.make(0, 1, 0);
    this.fov = o.fov || 55;
    this.near = o.near === undefined ? 0.1 : o.near;
    this.far = o.far || 200;
    this.aspect = 1;
    this.view = M4.identity();
    this.proj = M4.identity();
    this.vp = M4.identity();
    this.follow = o.follow || null;
    this._shake = 0;
    this._shakeSeed = Math.random() * 100;
  }

  Camera.prototype.update = function (w, h, t) {
    this.aspect = w / h;
    M4.perspective(this.fov, this.aspect, this.near, this.far, this.proj);
    if (this.follow) this.follow(this, t || 0);
    M4.lookAt(this.position, this.target, this.up, this.view);
    M4.mul(this.proj, this.view, this.vp);
    return this;
  };

  Camera.prototype.project = function (p, out) {
    out = out || [0, 0, 0];
    var m = this.vp, x = p[0], y = p[1], z = p[2];
    var cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (abs(cw) < 1e-6) cw = 1e-6;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / cw;
    out[3] = cw;
    return out;
  };

  Camera.prototype.orbit = function (az, el, dist) {
    this.position[0] = this.target[0] + dist * cos(el) * sin(az);
    this.position[1] = this.target[1] + dist * sin(el);
    this.position[2] = this.target[2] + dist * cos(el) * cos(az);
    return this;
  };

  /* ------------------------------------------------------------------ *
   *  Scene
   * ------------------------------------------------------------------ */

  function Scene(canvas, o) {
    o = o || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: o.alpha === undefined ? true : o.alpha });
    this.objects = [];
    this.lights = [];
    this.camera = new Camera(o.camera || {});
    this.background = o.background || null;          // css colour or null = transparent
    this.gradient = o.gradient || null;              // [c0, c1] css colours
    this.fog = o.fog || null;                        // {color:'#000', near:2, far:20, density:1}
    this.bloom = o.bloom || 0;                       // 0..1
    this.bloomThreshold = 0.5;
    this.ambient = hex2rgb(o.ambient === undefined ? '#5a6a99' : o.ambient);
    this.ambientIntensity = o.ambientIntensity === undefined ? 0.55 : o.ambientIntensity;
    this.resolution = o.resolution || 1;
    this.autoResize = o.autoResize === undefined ? true : o.autoResize;
    this.autoStart = o.autoStart === undefined ? true : o.autoStart;
    this.sortFaces = o.sortFaces === undefined ? true : o.sortFaces;
    this.maxFaces = o.maxFaces || 12000;
    this.clock = 0;
    this.frame = 0;
    this.running = false;
    this.debug = !!o.debug;
    this.w = 0; this.h = 0;
    this.dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) * this.resolution);
    this._layer = null; this._lctx = null;
    this._tri = { n: 0, x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, z: 0, face: null, mesh: null, clip: -1 };
    this._pool = [];
    this._pre = [];
    this._post = [];
    this._layers = [];
    this.onFrame = null;
    this._last = 0;
    this._raf = null;
    this.stats = { tris: 0, drawn: 0, fps: 0 };
    this._fpsAcc = 0; this._fpsN = 0;
    this.quality = o.quality === undefined ? 1 : o.quality;
    this._resize();
    if (this.autoResize && typeof window !== 'undefined') {
      var self = this;
      this._onResize = function () { self._resize(); };
      window.addEventListener('resize', this._onResize);
      if (typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver(function () { self._resize(); });
        try { this._ro.observe(canvas.parentElement || canvas); } catch (e) { }
      }
    }
    if (this.autoStart) this.start();
  }

  Scene.prototype._resize = function () {
    var c = this.canvas;
    var rect = c.getBoundingClientRect ? c.getBoundingClientRect() : { width: c.width, height: c.height };
    var w = max(1, rect.width || c.clientWidth || c.width);
    var h = max(1, rect.height || c.clientHeight || c.height);
    var dpr = this.dpr;
    c.width = round(w * dpr); c.height = round(h * dpr);
    this.w = c.width; this.h = c.height;
    this.cssW = w; this.cssH = h;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.bloom) {
      if (!this._layer) { this._layer = document.createElement('canvas'); this._lctx = this._layer.getContext('2d'); }
      this._layer.width = round(this.w / 2); this._layer.height = round(this.h / 2);
      this._lctx.setTransform(dpr / 2, 0, 0, dpr / 2, 0, 0);
    }
    this.camera.update(w, h, this.clock);
    return this;
  };

  Scene.prototype.resize = function () { return this._resize(); };

  Scene.prototype.add = function () {
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (a instanceof Light) this.lights.push(a); else this.objects.push(a);
      if (a && a.parent === undefined) a.parent = null;
    }
    return this;
  };

  Scene.prototype.remove = function (obj) {
    var i = this.objects.indexOf(obj);
    if (i >= 0) this.objects.splice(i, 1);
    return this;
  };

  Scene.prototype.clear = function () { this.objects.length = 0; return this; };

  Scene.prototype.pre = function (fn) { this._pre.push(fn); return this; };
  Scene.prototype.post = function (fn) { this._post.push(fn); return this; };
  Scene.prototype.layer = function (fn) { this._layers.push(fn); return this; };

  Scene.prototype.setLight = function (i, light) { this.lights[i] = light; return this; };

  Scene.prototype.start = function () {
    if (this.running) return this;
    this.running = true;
    var self = this;
    this._last = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var loop = function (now) {
      if (!self.running) return;
      var dt = (now - self._last) / 1000;
      self._last = now;
      if (dt > 0.1) dt = 0.1;
      self.clock += dt;
      self.frame++;
      self.tick(dt, self.clock);
      self._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
    return this;
  };

  Scene.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    return this;
  };

  Scene.prototype.tick = function (dt, t) {
    var i;
    for (i = 0; i < this._pre.length; i++) this._pre[i](this, dt, t);
    var o;
    for (i = 0; i < this.objects.length; i++) {
      o = this.objects[i];
      if (o.update) o.update(dt, t);
      if (o.updateWorld) o.updateWorld(null, null, null);
    }
    this.camera.update(this.cssW, this.cssH, t);
    this.render();
    for (i = 0; i < this._post.length; i++) this._post[i](this, dt, t);
    if (this.onFrame) this.onFrame(this, dt, t);
    // fps
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc > 0.5) { this.stats.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }
  };

  /* -------------------------- render core --------------------------- */

  Scene.prototype.render = function () {
    var ctx = this.ctx, w = this.cssW, h = this.cssH;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w + 2, h + 2);
    if (this.gradient) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, this.gradient[0]); g.addColorStop(1, this.gradient[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w + 2, h + 2);
    } else if (this.background) {
      ctx.fillStyle = this.background; ctx.fillRect(0, 0, w + 2, h + 2);
    }
    ctx.restore();

    var cam = this.camera, vp = cam.vp;
    var cx = w / 2, cy = h / 2;

    // build triangle list
    var list = this._pool;
    var count = 0;
    var i, j, k, o, m, faces, pos, wx, uvs;

    for (i = 0; i < this.objects.length; i++) {
      o = this.objects[i];
      if (!o || o.visible === false) continue;
      m = o.mat; if (!m) continue;
      pos = o._wx; var n = o._n; faces = o._faces;
      var isLine = m.lines || (o.geom && o.geom.lines) || m.mode === 'wire';

      // project all vertices
      var pm = this._pmesh !== o;
      if (pm) { this._px = []; this._py = []; this._cw = []; this._pmesh = o; }
      var px = this._px, py = this._py, cwArr = this._cw;
      var behind = 0;
      for (j = 0; j < n; j++) {
        var X = pos[j * 3], Y = pos[j * 3 + 1], Z = pos[j * 3 + 2];
        var cwv = vp[3] * X + vp[7] * Y + vp[11] * Z + vp[15];
        cwArr[j] = cwv;
        var iw = cwv > 1e-6 ? 1 / cwv : 0;
        if (cwv <= 1e-6) behind++;
        px[j] = (vp[0] * X + vp[4] * Y + vp[8] * Z + vp[12]) * iw * cx + cx;
        py[j] = -(vp[1] * X + vp[5] * Y + vp[9] * Z + vp[13]) * iw * cy + cy;
      }
      if (behind === n) { continue; }

      var fn = faces.length;
      var budget = this.maxFaces;
      for (j = 0; j < fn; j++) {
        var f = faces[j];
        var fl = f.length;
        if (fl === 2) {
          if (count >= budget) break;
          var t = this._next(count++, list);
          t.mesh = o; t.face = f; t.line = true; t.z = (o._cent ? 0 : 0);
          t.x0 = px[f[0]]; t.y0 = py[f[0]]; t.x1 = px[f[1]]; t.y1 = py[f[1]];
          t.z = (cwArr[f[0]] + cwArr[f[1]]) * 0.5;
          t.visible = cwArr[f[0]] > 1e-6 || cwArr[f[1]] > 1e-6;
          continue;
        }
        // cull using face centroid (world) vs camera
        var c0 = o._cent[j * 3], c1 = o._cent[j * 3 + 1], c2 = o._cent[j * 3 + 2];
        // normal
        var a0 = f[0], a1 = f[1], a2 = f[2];
        var ux = pos[a1 * 3] - pos[a0 * 3], uy = pos[a1 * 3 + 1] - pos[a0 * 3 + 1], uz = pos[a1 * 3 + 2] - pos[a0 * 3 + 2];
        var vx2 = pos[a2 * 3] - pos[a0 * 3], vy2 = pos[a2 * 3 + 1] - pos[a0 * 3 + 1], vz2 = pos[a2 * 3 + 2] - pos[a0 * 3 + 2];
        var nx = uy * vz2 - uz * vy2, ny = uz * vx2 - ux * vz2, nz = ux * vy2 - uy * vx2;
        var vdx = cam.position[0] - c0, vdy = cam.position[1] - c1, vdz = cam.position[2] - c2;
        var facing = nx * vdx + ny * vdy + nz * vdz;
        if (m.cull && facing < 0) continue;
        // near-plane reject
        var anyFront = false;
        for (k = 0; k < fl; k++) { if (cwArr[f[k]] > cam.near * 0.98) { anyFront = true; break; } }
        if (!anyFront) continue;
        if (count >= budget) break;
        var tri = this._next(count++, list);
        tri.mesh = o; tri.face = f; tri.faceIndex = j; tri.line = false; tri.visible = true;
        tri.nx = nx; tri.ny = ny; tri.nz = nz;
        tri.cx = c0; tri.cy = c1; tri.cz = c2;
        tri.facing = facing;
        // store first 5 projected verts (quads supported)
        tri.p = tri.p || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        // Sort key = NEAREST vertex depth, not the centroid depth. On a smooth
        // surface (fine sphere, blob) adjacent faces have near-identical
        // centroid depths and the ordering flips between frames, which shows
        // up as patches of the wrong faces painted on top. The nearest vertex
        // separates neighbouring faces far more reliably.
        var zSum = 0, zNear = Infinity;
        for (k = 0; k < fl && k < 5; k++) {
          var idx = f[k];
          var cw = cwArr[idx];
          tri.p[k * 2] = cw <= 1e-6 ? 0 : px[idx];
          tri.p[k * 2 + 1] = cw <= 1e-6 ? 0 : py[idx];
          zSum += cw;
          if (cw < zNear) zNear = cw;
        }
        tri.fl = fl;
        tri.z = zNear;
        tri.zAvg = zSum / fl;
        // Smooth shading: interpolate the averaged vertex normals across the
        // face. Flat per-face lighting turns a fine sphere into a visible
        // polyhedral grid, which ruins organic / liquid-metal surfaces.
        if (m.smoothShade && fl >= 3) {
          var vn = o.computeVertexNormals();
          tri.ni = tri.ni || [0, 0, 0, 0, 0, 0, 0, 0, 0];
          var ax = vn[f[0] * 3], ay = vn[f[0] * 3 + 1], az = vn[f[0] * 3 + 2];
          var bx = vn[f[1] * 3], by = vn[f[1] * 3 + 1], bz = vn[f[1] * 3 + 2];
          var cxx = vn[f[2] * 3], cyy = vn[f[2] * 3 + 1], czz = vn[f[2] * 3 + 2];
          if (fl === 4) {
            var dx = vn[f[3] * 3], dy = vn[f[3] * 3 + 1], dz = vn[f[3] * 3 + 2];
            ax = (ax + bx + cxx + dx) * 0.25; ay = (ay + by + cyy + dy) * 0.25; az = (az + bz + czz + dz) * 0.25;
          } else {
            ax = (ax + bx + cxx) / 3; ay = (ay + by + cyy) / 3; az = (az + bz + czz) / 3;
          }
          var il = sqrt(ax * ax + ay * ay + az * az) || 1;
          tri.ni[0] = ax / il; tri.ni[1] = ay / il; tri.ni[2] = az / il;
          // keep the same facing test as the geometric normal
          if ((tri.ni[0] * tri.nx + tri.ni[1] * tri.ny + tri.ni[2] * tri.nz) < 0) {
            tri.ni[0] = -tri.ni[0]; tri.ni[1] = -tri.ni[1]; tri.ni[2] = -tri.ni[2];
          }
        } else tri.ni = null;
        if (m.texture && o._uv) {
          tri.uv = tri.uv || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          for (k = 0; k < fl && k < 5; k++) {
            var ii = f[k] * 2;
            tri.uv[k * 2] = o._uv[ii]; tri.uv[k * 2 + 1] = o._uv[ii + 1];
          }
        } else tri.uv = null;
      }
    }
    // sort far -> near
    var arr = list.slice(0, count);
    if (this.sortFaces) arr.sort(function (a, b) { return b.z - a.z; });

    // draw
    for (i = 0; i < arr.length; i++) this._drawTri(ctx, arr[i], w, h);
    this.stats.tris = count;

    // billboards / particles behind the origin first, then the rest on top
    var draws = this._draws || (this._draws = []);
    draws.length = 0;
    for (i = 0; i < this.objects.length; i++) {
      o = this.objects[i];
      if (o && o.draw && o.visible !== false) draws.push(o);
    }
    var di;
    for (di = 0; di < draws.length; di++) {
      if (draws[di].position && draws[di].position[2] < 0) draws[di].draw(ctx, this);
    }
    for (di = 0; di < draws.length; di++) {
      if (!draws[di].position || draws[di].position[2] >= 0) draws[di].draw(ctx, this);
    }

    // extra layers on top
    for (i = 0; i < this._layers.length; i++) this._layers[i](ctx, this);

    // bloom: second pass glow
    if (this.bloom > 0) this._bloomPass(ctx, arr);
    return this;
  };

  Scene.prototype._next = function (i, list) {
    var t = list[i];
    if (!t) { t = list[i] = { p: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], face: null, mesh: null }; }
    return t;
  };

  Scene.prototype._drawTri = function (ctx, tri, w, h) {
    var m = tri.mesh.mat, o = tri.mesh;
    if (tri.line) {
      if (!tri.visible) return;
      var lc = m.edge || m.color;
      ctx.strokeStyle = rgbStr(lc, m.opacity);
      ctx.lineWidth = m.edgeWidth || 1;
      ctx.beginPath();
      ctx.moveTo(tri.x0, tri.y0); ctx.lineTo(tri.x1, tri.y1);
      ctx.stroke();
      return;
    }
    var p = tri.p, fl = tri.fl;

    // lighting
    var nrm = this._nrmTmp || (this._nrmTmp = [0, 0, 0]);
    if (tri.ni) {
      nrm[0] = tri.ni[0]; nrm[1] = tri.ni[1]; nrm[2] = tri.ni[2];
    } else {
      var l = V.len([tri.nx, tri.ny, tri.nz]) || 1;
      nrm[0] = tri.nx / l; nrm[1] = tri.ny / l; nrm[2] = tri.nz / l;
    }
    var col = m.color, k = 1, spec = 0;
    var mode = m.mode;

    if (mode === 'flat' || mode === 'unlit' || mode === 'wire' || mode === 'glass') {
      k = 1;
      if (mode === 'flat' && m.flatShade) k = 0.6 + 0.4 * clamp(nrm[1] * 0.5 + 0.5, 0, 1);
    } else {
      k = this.ambientIntensity;
      var lightSum = 0;
      for (var li = 0; li < this.lights.length; li++) {
        var L = this.lights[li], d;
        if (L.type === 'point') {
          var dx = L.position[0] - tri.cx, dy = L.position[1] - tri.cy, dz = L.position[2] - tri.cz;
          d = V.len([dx, dy, dz]) || 1;
          var nd = (nrm[0] * dx + nrm[1] * dy + nrm[2] * dz) / d;
          if (nd > 0) lightSum += nd * L.intensity * clamp(1 - d / L.radius, 0, 1);
        } else {
          var D = L.direction;
          var ndl = nrm[0] * D[0] + nrm[1] * D[1] + nrm[2] * D[2];
          if (ndl > 0) lightSum += ndl * L.intensity;
        }
      }
      if (mode === 'toon') { k = 0.35 + round(lightSum * m.steps) / m.steps * 0.75; k = min(k, 1.25); }
      else if (mode === 'metal') { k = 0.16 + pow(clamp(lightSum, 0, 1), 0.7) * 0.9; }
      else if (mode === 'lambert' || mode === 'matcap') { k = 0.28 + clamp(lightSum, 0, 1) * 0.85; }
      else { k = 0.25 + clamp(lightSum, 0, 1) * 0.8 + m.specular * 0.05; }
      // specular
      if (mode === 'phong' || mode === 'metal') {
        var cam = this.camera;
        var vx3 = cam.position[0] - tri.cx, vy3 = cam.position[1] - tri.cy, vz3 = cam.position[2] - tri.cz;
        var vl = V.len([vx3, vy3, vz3]) || 1;
        var hx = vx3 / vl + (this.lights[0] ? this.lights[0].direction[0] : 0);
        var hy = vy3 / vl + (this.lights[0] ? this.lights[0].direction[1] : 0);
        var hz = vz3 / vl + (this.lights[0] ? this.lights[0].direction[2] : 0);
        var hl = V.len([hx, hy, hz]) || 1;
        var nh = (nrm[0] * hx + nrm[1] * hy + nrm[2] * hz) / hl;
        if (nh > 0) spec = pow(nh, m.shininess) * m.specular;
      }
    }

    // per-face / per-vertex colour
    var tint = null;
    if (m.useFaceColors && o.geom.fc) tint = o.geom.fc[tri.faceIndex] || null;
    else if (m.useVertexColors && o.geom.vc && tri.face) tint = o.geom.vc[tri.face[0]] || null;
    if (tint && m.tintMode === 'replace') col = tint;
    else if (tint && m.tintMode === 'multiply') col = [col[0] * tint[0] / 255, col[1] * tint[1] / 255, col[2] * tint[2] / 255];
    else if (tint) col = mixRGB(col, tint, 0.85);
    if (m.anim) col = m.anim(col, this.clock, tri) || col;
    if (m.hueShift || m.hueAnim) col = hueRotate(col, m.hueShift + (m.hueAnim ? sin(this.clock * 0.6) * m.hueAnim : 0));
    if (m.saturate !== 1 || m.lightness !== 1) {
      var lum = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2];
      col = [
        (lum + (col[0] - lum) * m.saturate) * m.lightness,
        (lum + (col[1] - lum) * m.saturate) * m.lightness,
        (lum + (col[2] - lum) * m.saturate) * m.lightness
      ];
    }
    var rgb = [col[0] * k + m.emissive[0] * m.emissiveIntensity * 0.55,
      col[1] * k + m.emissive[1] * m.emissiveIntensity * 0.55,
      col[2] * k + m.emissive[2] * m.emissiveIntensity * 0.55];

    // fog
    if (this.fog && m.fog) {
      var t2 = clamp((tri.z - this.fog.near) / (this.fog.far - this.fog.near), 0, 1);
      if (this.fog.density) t2 = 1 - pow(1 - t2, 1 / this.fog.density);
      rgb = mixRGB(rgb, hex2rgb(this.fog.color), t2);
      if (t2 > 0.995 && m.mode !== 'wire') return;
    }

    var alpha = m.opacity;
    // glass: transparency rises at grazing angles
    if (mode === 'glass') {
      var gx = this.camera.position[0] - tri.cx, gy = this.camera.position[1] - tri.cy, gz = this.camera.position[2] - tri.cz;
      var glen = V.len([gx, gy, gz]) || 1;
      var grazing = 1 - clamp(abs(nrm[0] * gx + nrm[1] * gy + nrm[2] * gz) / glen, 0, 1);
      alpha = clamp(m.opacity + grazing * (m.opacity * 3 + 0.22), 0, 0.95);
      rgb = [rgb[0] + 255 * pow(grazing, 3) * 0.7, rgb[1] + 255 * pow(grazing, 3) * 0.75, rgb[2] + 255 * pow(grazing, 3) * 0.85];
    }

    // ---- geometry path ----
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (var q = 1; q < fl && q < 5; q++) ctx.lineTo(p[q * 2], p[q * 2 + 1]);
    ctx.closePath();

    // ---- texture mapping (affine per face; quads use two triangles' affine terms) ----
    if (m.texture && tri.uv && mode !== 'wire' && alpha > 0.02) {
      var u = tri.uv;
      var mx = (u[0] + u[2] + u[4] + u[6]) / 4, my = (u[1] + u[3] + u[5] + u[7]) / 4;
      var ex = (p[0] + p[2] + p[4] + p[6]) / 4 - w / 2, ey = (p[1] + p[3] + p[5] + p[7]) / 4 - h / 2;
      var b0x = (p[2] - p[0]) * 0.5, b0y = (p[3] - p[1]) * 0.5;
      var b1x = (p[6] - p[0]) * 0.5, b1y = (p[7] - p[1]) * 0.5;
      var su = (u[2] - u[0]) * 0.5, sv = (u[3] - u[1]) * 0.5;
      var tu = (u[6] - u[0]) * 0.5, tv = (u[7] - u[1]) * 0.5;
      var det = su * tv - sv * tu;
      var img = m.texture, tw2 = img.width, th2 = img.height;
      if (abs(det) > 1e-9) {
        var wu = m.mapRepeat[0], wv = m.mapRepeat[1];
        var a11 = (tv * b0x - tu * b1x) * wu / det, a21 = (tv * b0y - tu * b1y) * wu / det;
        var a12 = (-sv * b0x + su * b1x) * wv / det, a22 = (-sv * b0y + su * b1y) * wv / det;
        var e2x = (mx * wu + m.mapOffset[0]) * tw2 - (a11 * ex + a12 * ey);
        var e2y = (my * wv + m.mapOffset[1]) * th2 - (a21 * ex + a22 * ey);
        ctx.save();
        ctx.clip();
        ctx.transform(a11, a21, a12, a22, e2x, e2y);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = m.smoothMap !== false;
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        if (spec > 0.02) {
          ctx.fillStyle = 'rgba(255,255,255,' + min(0.85, spec * 0.8).toFixed(3) + ')';
          ctx.fill();
        }
        if (m.edge) {
          ctx.strokeStyle = rgbStr(m.edge, min(1, alpha + 0.35));
          ctx.lineWidth = m.edgeWidth;
          ctx.stroke();
        }
        return rgb;
      }
    }

    ctx.fillStyle = rgbStr(rgb, alpha);
    ctx.fill();
    if (spec > 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,' + min(0.85, spec * 0.8).toFixed(3) + ')';
      ctx.fill();
    }
    if (m.edge) {
      ctx.strokeStyle = rgbStr(m.edge, min(1, alpha + 0.35));
      ctx.lineWidth = m.edgeWidth;
      ctx.stroke();
    }
    return rgb;
  };

  // alias: sphere and friends benefit from double-sided safety
  Scene.prototype.setQuality = function (q) {
    this.quality = q;
    this.dpr = min(2, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) * (q || 1) * (this.resolution || 1));
    this._resize();
    return this;
  };

  Scene.prototype._bloomPass = function (ctx, arr) {
    var l = this._lctx, lw = this.cssW, lh = this.cssH;
    if (!l) return;
    l.clearRect(0, 0, lw + 2, lh + 2);
    l.save();
    l.globalCompositeOperation = 'lighter';
    for (var i = 0; i < arr.length; i++) {
      var tri = arr[i];
      if (tri.line || !tri.visible) continue;
      var m = tri.mesh.mat;
      var glow = (m.glow || 0) + (m.emissiveIntensity > 0.6 && (m.emissive[0] + m.emissive[1] + m.emissive[2]) > 40 ? 0.5 : 0);
      if (glow <= 0.02) continue;
      var p = tri.p;
      l.beginPath();
      l.moveTo(p[0], p[1]);
      for (var q = 1; q < tri.fl && q < 5; q++) l.lineTo(p[q * 2], p[q * 2 + 1]);
      l.closePath();
      l.fillStyle = rgbStr(m.glowColor || m.color, min(0.5, glow * 0.3));
      l.fill();
    }
    l.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(this.bloom, 0, 1);
    try { ctx.filter = 'blur(14px) saturate(160%)'; } catch (e) { }
    ctx.drawImage(this._layer, 0, 0, this.cssW, this.cssH);
    try { ctx.filter = 'none'; } catch (e) { }
    ctx.restore();
  };

  /* ------------------------------------------------------------------ *
   *  Particles
   * ------------------------------------------------------------------ */

  function Particles(o) {
    o = o || {};
    this.count = o.count || 300;
    this.spread = o.spread || [10, 6, 10];
    this.center = V.make(o.x || 0, o.y || 0, o.z || 0);
    this.size = o.size || 2;
    this.sizeJitter = o.sizeJitter === undefined ? 1 : o.sizeJitter;
    this.color = o.color || '#ffffff';
    this.colors = o.colors ? o.colors.map(hex2rgb) : null;
    this.opacity = o.opacity === undefined ? 0.8 : o.opacity;
    this.speed = o.speed === undefined ? 0.2 : o.speed;
    this.curl = o.curl || 0;
    this.drift = o.drift || [0, 0.4, 0];
    this.twinkle = o.twinkle === undefined ? 0.6 : o.twinkle;
    this.shape = o.shape || 'dot';    // dot | square | glow | streak
    this.streak = o.streak || 6;
    this.depthFade = o.depthFade === undefined ? true : o.depthFade;
    this.respawn = o.respawn || false;
    this.chase = o.chase || 0;
    this.hueDrift = o.hueDrift || 0;
    this._rnd = seeded(o.seed || 7);
    this._r = new Float32Array(this.count * 4);
    for (var i = 0; i < this.count; i++) {
      this._r[i * 4] = (this._rnd() - 0.5) * 2;
      this._r[i * 4 + 1] = (this._rnd() - 0.5) * 2;
      this._r[i * 4 + 2] = (this._rnd() - 0.5) * 2;
      this._r[i * 4 + 3] = this._rnd();
    }
    this._pt = new Float32Array(this.count * 3);
    this._scr = new Float32Array(this.count * 4);
    this.visible = o.visible === undefined ? true : o.visible;
    this.points = null;
  }

  Particles.prototype.update = function (dt, t) {
    var sp = this.spread;
    for (var i = 0; i < this.count; i++) {
      var a = this._r[i * 4], b = this._r[i * 4 + 1], c = this._r[i * 4 + 2], d = this._r[i * 4 + 3];
      var bx = this.center[0] + a * sp[0];
      var by = this.center[1] + b * sp[1];
      var bz = this.center[2] + c * sp[2];
      var x = bx, y = by, z = bz;
      if (this.curl) {
        var ang = t * this.speed * (0.4 + d * 0.8) + d * 6;
        var ca = cos(ang * this.curl), sa = sin(ang * this.curl);
        var rx = bx - this.center[0], rz = bz - this.center[2];
        x = this.center[0] + rx * ca - rz * sa;
        z = this.center[2] + rx * sa + rz * ca;
      }
      if (this.drift[1]) y += sin(t * (0.3 + d * 0.6) + d * 9) * this.drift[1];
      if (this.speed && !this.curl) {
        x += sin(t * this.speed + d * 5) * 0.6;
        z += cos(t * this.speed * 0.7 + d * 3) * 0.6;
      }
      if (this.respawn) {
        var top = this.center[1] + sp[1];
        if (y > top) y = this.center[1] - sp[1];
      }
      this._pt[i * 3] = x; this._pt[i * 3 + 1] = y; this._pt[i * 3 + 2] = z;
    }
  };

  Particles.prototype.draw = function (ctx, scene) {
    if (!this.visible) return;
    var cam = scene.camera, w = scene.cssW, h = scene.cssH;
    var cx = w / 2, cy = h / 2, vp = cam.vp;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var col = hex2rgb(this.color);
    for (var i = 0; i < this.count; i++) {
      var X = this._pt[i * 3], Y = this._pt[i * 3 + 1], Z = this._pt[i * 3 + 2];
      var cw = vp[3] * X + vp[7] * Y + vp[11] * Z + vp[15];
      if (cw <= 0.05) continue;
      var iw = 1 / cw;
      var sx = (vp[0] * X + vp[4] * Y + vp[8] * Z + vp[12]) * iw * cx + cx;
      var sy = -(vp[1] * X + vp[5] * Y + vp[9] * Z + vp[13]) * iw * cy + cy;
      if (sx < -50 || sy < -50 || sx > w + 50 || sy > h + 50) continue;
      var d = this._r[i * 4 + 3];
      var fade = this.depthFade ? clamp(1.2 - cw / 26, 0.05, 1) : 1;
      var tw = this.twinkle ? (0.55 + 0.45 * sin(scene.clock * (1 + d * 3) + d * 12)) : 1;
      var alpha = this.opacity * fade * tw;
      var sz = this.size * (1 + d * this.sizeJitter) * clamp(6 / cw, 0.25, 2.4);
      var c2 = this.colors ? this.colors[i % this.colors.length] : col;
      if (this.hueDrift) c2 = hueRotate(c2, this.hueDrift * 60 + scene.clock * this.hueDrift * 12);
      ctx.fillStyle = rgbStr(c2, alpha);
      if (this.shape === 'glow') {
        ctx.beginPath(); ctx.arc(sx, sy, sz * 1.8, 0, TAU); ctx.fill();
      } else if (this.shape === 'square') {
        ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
      } else if (this.shape === 'streak') {
        ctx.fillRect(sx, sy, sz * 0.6, this.streak * clamp(6 / cw, 0.3, 2));
      } else {
        ctx.beginPath(); ctx.arc(sx, sy, sz, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  };

  /* ------------------------------------------------------------------ *
   *  Pointer / orbit controls
   * ------------------------------------------------------------------ */

  function Controls(scene, o) {
    o = o || {};
    this.scene = scene;
    this.enabled = o.enabled === undefined ? true : o.enabled;
    this.target = V.make(o.tx || 0, o.ty || 0, o.tz || 0);
    this.distance = o.distance || 6;
    this.azimuth = o.azimuth === undefined ? 0.6 : o.azimuth;
    this.elevation = o.elevation === undefined ? 0.18 : o.elevation;
    this.autoRotate = o.autoRotate === undefined ? 0.12 : o.autoRotate;
    this.damping = o.damping === undefined ? 0.86 : o.damping;
    this.minElevation = o.minElevation === undefined ? -1.2 : o.minElevation;
    this.maxElevation = o.maxElevation === undefined ? 1.2 : o.maxElevation;
    this.minDistance = o.minDistance || 2;
    this.maxDistance = o.maxDistance || 24;
    this.pointerInfluence = o.pointerInfluence === undefined ? 0.5 : o.pointerInfluence;
    this.drag = o.drag === undefined ? true : o.drag;
    this.zoom = o.zoom === undefined ? true : o.zoom;
    this._down = false; this._lx = 0; this._ly = 0;
    this._vaz = 0; this._vel = 0;
    this.px = 0; this.py = 0; this.spx = 0; this.spy = 0;
    var self = this;
    this._onDown = function (e) { self._pointerDown(e); };
    this._onMove = function (e) { self._pointerMove(e); };
    this._onUp = function () { self._down = false; };
    this._onWheel = function (e) { self._wheel(e); };
    this.attach(o.el || scene.canvas);
  }

  Controls.prototype.attach = function (el) {
    if (!el || !el.addEventListener) return this;
    el.addEventListener('pointerdown', this._onDown, { passive: true });
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerup', this._onUp, { passive: true });
    if (this.zoom) el.addEventListener('wheel', this._onWheel, { passive: false });
    return this;
  };

  Controls.prototype.detach = function () {
    var el = this.scene.canvas;
    if (el && el.removeEventListener) el.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    if (el && el.removeEventListener) el.removeEventListener('wheel', this._onWheel);
    return this;
  };

  Controls.prototype._pointerDown = function (e) {
    if (!this.enabled || !this.drag) return;
    this._down = true; this._lx = e.clientX; this._ly = e.clientY;
  };
  Controls.prototype._pointerMove = function (e) {
    var r = this.scene.canvas.getBoundingClientRect ? this.scene.canvas.getBoundingClientRect() : { left: 0, top: 0, width: this.scene.cssW, height: this.scene.cssH };
    this.px = (e.clientX - r.left) / (r.width || 1) * 2 - 1;
    this.py = (e.clientY - r.top) / (r.height || 1) * 2 - 1;
    if (this._down) {
      var dx = e.clientX - this._lx, dy = e.clientY - this._ly;
      this._lx = e.clientX; this._ly = e.clientY;
      this._vaz = -dx * 0.006; this._vel = dy * 0.005;
      this.azimuth += this._vaz; this.elevation += this._vel;
      this.elevation = clamp(this.elevation, this.minElevation, this.maxElevation);
    }
  };
  Controls.prototype._wheel = function (e) {
    if (!this.enabled || !this.zoom) return;
    e.preventDefault();
    this.distance = clamp(this.distance + e.deltaY * 0.0026, this.minDistance, this.maxDistance);
  };

  Controls.prototype.update = function (dt, t) {
    if (!this.enabled) return;
    if (!this._down) {
      this.azimuth += this.autoRotate * dt;
      this._vaz *= this.damping; this._vel *= this.damping;
      this.azimuth += this._vaz; this.elevation += this._vel;
      this.elevation = clamp(this.elevation, this.minElevation, this.maxElevation);
    }
    var cam = this.scene.camera;
    var az = this.azimuth + this.spx * this.pointerInfluence;
    var el = this.elevation - this.spy * this.pointerInfluence * 0.8;
    this.spx += (this.px - this.spx) * min(1, dt * 3.2);
    this.spy += (this.py - this.spy) * min(1, dt * 3.2);
    cam.target[0] = this.target[0]; cam.target[1] = this.target[1]; cam.target[2] = this.target[2];
    cam.position[0] = this.target[0] + this.distance * cos(el) * sin(az);
    cam.position[1] = this.target[1] + this.distance * sin(el);
    cam.position[2] = this.target[2] + this.distance * cos(el) * cos(az);
    return this;
  };

  /* ------------------------------------------------------------------ *
   *  Sprite (2D canvas texture projected in 3D — billboards)
   * ------------------------------------------------------------------ */

  function Sprite(canvasTex, o) {
    o = o || {};
    this.texture = canvasTex;
    this.position = V.make(o.x || 0, o.y || 0, o.z || 0);
    this.scale = o.scale || 1;
    this.opacity = o.opacity === undefined ? 1 : o.opacity;
    this.rotation = o.rotation || 0;
    this.spin = o.spin || 0;
    this.orbit = o.orbit || null;
    this.visible = o.visible === undefined ? true : o.visible;
    this.onUpdate = o.onUpdate || null;
    this._scr = [0, 0, 0, 0];
    this.anchor = o.anchor || [0.5, 0.5];
    this.blend = o.blend || 'source-over';
    this.billboard = o.billboard === undefined ? true : o.billboard;
    this.distanceScale = o.distanceScale === undefined ? 1 : o.distanceScale;
    this._t = 0;
  }
  Sprite.prototype.update = function (dt, t) {
    this._t = t;
    if (this.spin) this.rotation += this.spin * dt;
    if (this.orbit) {
      var o = this.orbit, a = (o.phase || 0) + t * (o.speed || 0.2);
      this.position[0] = o.radius * cos(a);
      this.position[1] = (o.height || 0) + (o.tilt ? sin(a * 2) * o.tilt : 0);
      this.position[2] = o.radius * sin(a);
    }
    if (this.onUpdate) this.onUpdate(this, dt, t);
  };
  Sprite.prototype.updateWorld = function () { };
  Sprite.prototype.draw = function (ctx, scene) {
    if (!this.visible || !this.texture) return;
    var cam = scene.camera, w = scene.cssW, h = scene.cssH;
    var p = cam.project(this.position, [0, 0, 0, 0]);
    if (p[3] <= 0.1) return;
    var sx = p[0] * w / 2 + w / 2, sy = -p[1] * h / 2 + h / 2;
    var dist = p[3];
    var s = this.scale * (this.distanceScale ? clamp(6 / dist, 0.15, 4) : 1);
    var tw = this.texture.width * s, th = this.texture.height * s;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = this.blend;
    ctx.translate(sx, sy);
    if (this.rotation) ctx.rotate(this.rotation);
    ctx.drawImage(this.texture, -tw * this.anchor[0], -th * this.anchor[1], tw, th);
    ctx.restore();
  };

  /* ------------------------------------------------------------------ *
   *  Exports
   * ------------------------------------------------------------------ */

  var DSE = {
    version: '1.0.0',
    Scene: Scene, Camera: Camera, Mesh: Mesh, Light: Light,
    Particles: Particles, Controls: Controls, Sprite: Sprite,
    geom: geom, mat: mat, tex: tex,
    V: V, M4: M4,
    utils: { clamp: clamp, lerp: lerp, rand: rand, pick: pick, seeded: seeded, hex2rgb: hex2rgb, mixRGB: mixRGB, rgbStr: rgbStr, shade: shade, TAU: TAU, PI: PI, cos: cos, sin: sin }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DSE;
  global.DSE = DSE;
})(typeof window !== 'undefined' ? window : globalThis);
