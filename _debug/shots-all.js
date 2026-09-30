/* Batch-capture hero screenshots of every site in parallel.
   Usage: node _debug/shots-all.js [waitMs] [width] [height] */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const node = process.execPath;
const shot = path.join(__dirname, 'shot.js');
const wait = process.argv[2] || '3500';
const W = process.argv[3] || '1440';
const H = process.argv[4] || '900';

const JOBS = [
  ['/', 'landing-hero'],
  ['/sites/01-aurora-glass/', 'aurora-hero'],
  ['/sites/02-nexus-terminal/', 'nexus-hero'],
  ['/sites/03-miami-vapor/', 'miami-hero'],
  ['/sites/04-monolith-swiss/', 'monolith-hero'],
  ['/sites/05-kinetic-particle/', 'kinetic-hero']
];

const running = JOBS.map(([url, name]) => new Promise(res => {
  const p = spawn(node, [shot, url, name, wait, W, H, '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => out += d);
  p.on('close', () => {
    const errs = (out.match(/errorCount":\s*(\d+)/) || [, '?'])[1];
    const raf = (out.match(/rafCount":\s*(\d+)/) || [, '?'])[1];
    const exc = (out.match(/--- uncaught exceptions \((\d+)\)/) || [, '?'])[1];
    const console404 = /404/.test(out) ? ' 404!' : '';
    console.log(`${name.padEnd(16)} raf=${String(raf).padEnd(6)} errors=${errs} exceptions=${exc}${console404}`);
    if (errs !== '0' || exc !== '0') {
      const m = out.match(/"errors":\s*\[([\s\S]*?)\]/);
      if (m) console.log('    ' + m[1].replace(/\s+/g, ' ').slice(0, 300));
    }
    res();
  });
}));

Promise.all(running).then(() => {
  console.log('\nshots written to _shots/');
});
