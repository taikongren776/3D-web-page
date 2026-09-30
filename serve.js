#!/usr/bin/env node
/* ==========================================================================
   serve.js — zero-dependency static server for the FIVE WORLDS collection.
   Usage:   node serve.js            → http://127.0.0.1:5178/
            PORT=8080 node serve.js → http://127.0.0.1:8080/
   ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '5178', 10);
const HOST = process.env.HOST || '127.0.0.1';
const LOG = !!process.env.LOG;

/* an inline favicon so pages never trigger a 404 for it */
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6ee7ff"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#ff7ac6"/>
  </linearGradient></defs>
  <rect width="32" height="32" rx="7" fill="#05070f"/>
  <path d="M16 4 L27 12 L16 28 L5 12 Z" fill="url(#g)"/>
  <path d="M16 4 L16 28 M5 12 L27 12" stroke="#05070f" stroke-width="1.2" opacity=".6"/>
</svg>`;

function favicon(res) {
  res.writeHead(200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=86400'
  });
  res.end(FAVICON);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function safeJoin(root, target) {
  const p = path.normalize(path.join(root, decodeURIComponent(target)));
  const rel = path.relative(root, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return p;
}

function listing(dir, reqPath) {
  const items = fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => !d.name.startsWith('.'))
    .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
  const rows = items.map(d => {
    const href = path.posix.join(reqPath, encodeURIComponent(d.name)) + (d.isDirectory() ? '/' : '');
    return `<li><a href="${href}">${d.isDirectory() ? '📁' : '📄'} ${d.name}</a></li>`;
  }).join('\n');
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>${reqPath}</title><style>
body{background:#05070f;color:#eef3ff;font:15px/1.6 ui-monospace,Menlo,Consolas,monospace;padding:40px}
a{color:#6ee7ff;text-decoration:none}a:hover{color:#ff7ac6}
h1{font-size:17px;color:#a78bfa;margin:0 0 18px}ul{list-style:none;padding:0;display:grid;gap:6px}
.note{margin-top:26px;color:rgba(232,240,255,.5);font-size:13px}
</style></head><body><h1>INDEX ${reqPath}</h1><ul>${rows}</ul>
<p class="note">FIVE WORLDS 静态服务 · 回到 <a href="/">首页</a></p></body></html>`;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let reqPath = decodeURIComponent(parsed.pathname);
  if (LOG) console.log(new Date().toISOString().slice(11, 19) + '  ' + req.method + ' ' + reqPath);
  if (reqPath === '/favicon.ico') return favicon(res);
  if (reqPath.endsWith('/')) reqPath += 'index.html';

  const file = safeJoin(ROOT, reqPath);
  if (!file) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(file, (err, stat) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!DOCTYPE html><meta charset="utf-8">
<body style="background:#05070f;color:#eef3ff;font:15px ui-monospace;padding:40px">
<h1 style="color:#ff7ac6">404</h1><p>${reqPath} 不存在。</p>
<p><a style="color:#6ee7ff" href="/">回到首页</a></p></body>`);
    }

    if (stat.isDirectory()) {
      const idx = path.join(file, 'index.html');
      if (fs.existsSync(idx)) return sendFile(idx, res);
      const html = listing(file, parsed.pathname.endsWith('/') ? parsed.pathname : parsed.pathname + '/');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }
    return sendFile(file, res);
  });
});

function sendFile(file, res) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(file).pipe(res);
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用。换一个：PORT=5179 node serve.js`);
  } else {
    console.error(e);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const base = `http://${HOST}:${PORT}/`;
  console.log('');
  console.log('  FIVE WORLDS · 静态服务已启动');
  console.log('  ' + base);
  console.log('');
  console.log('  首页            ' + base);
  console.log('  01 极光玻璃     ' + base + 'sites/01-aurora-glass/');
  console.log('  02 赛博终端     ' + base + 'sites/02-nexus-terminal/');
  console.log('  03 蒸汽波桌面   ' + base + 'sites/03-miami-vapor/');
  console.log('  04 瑞士编辑     ' + base + 'sites/04-monolith-swiss/');
  console.log('  05 粒子动能     ' + base + 'sites/05-kinetic-particle/');
  console.log('');
  console.log('  Ctrl+C 停止');
  console.log('');
});
