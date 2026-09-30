/* Cross-checks class names across CSS / HTML / JS so a typo like .winbar
   cannot silently leave a component unstyled.
   Run: node vendor/_check-classes.js */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  { name: 'landing', html: 'index.html', css: 'styles.css', js: 'landing.js' },
  ...fs.readdirSync(path.join(ROOT, 'sites')).sort().map(d => ({
    name: d,
    html: path.join('sites', d, 'index.html'),
    css: path.join('sites', d, 'styles.css'),
    js: path.join('sites', d, 'main.js')
  }))
];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* classes created/queried by the shared library rather than by page markup */
const LIB = new Set([
  'fx-custom-cursor', 'fx-cursor-dot', 'fx-cursor-ring', 'fx-cursor-label', 'is-hover', 'has-label',
  'fx-toasts', 'fx-toast', 'fx-toast-dot', 'fx-toast-ok', 'fx-toast-warn', 'is-in',
  'fx-ripple', 'fx-sheen', 'fx-w', 'fx-wi', 'fx-c', 'fx-caret', 'has-sheen',
  'fx-rail-dot', 'fx-rail', 'fx-acc', 'fx-acc-item', 'fx-acc-head', 'fx-acc-body', 'chev',
  'fx-tip', 'is-on', 'is-open', 'is-active', 'is-revealed', 'is-stuck', 'is-dragging', 'has-tip'
]);

let fail = 0;
PAGES.forEach(page => {
  const html = read(page.html);
  const css = read(page.css);
  const js = read(page.js);

  // classes present in the markup / created by scripts
  const inMarkup = new Set();
  const classAttr = /class\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = classAttr.exec(html))) m[1].split(/\s+/).filter(Boolean).forEach(c => inMarkup.add(c));
  // classList.add('x') / className = 'x y' / class="x" built in JS strings
  const jsAdds = /(?:classList\.(?:add|remove|toggle|contains)\(|className\s*=\s*'|class=")([^'"`)]+)/g;
  while ((m = jsAdds.exec(js))) m[1].split(/\s+/).filter(Boolean).forEach(c => inMarkup.add(c));

  // class selectors used in CSS
  const cssClasses = new Set();
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selRe = /\.(-?[_a-zA-Z][\w-]*)/g;
  while ((m = selRe.exec(noComments))) cssClasses.add(m[1]);

  // classes queried from JS
  const queried = new Set();
  const qRe = /(?:querySelector(?:All)?\(|closest\(|matches\()\s*['"`]([^'"`]+)['"`]/g;
  while ((m = qRe.exec(js))) {
    const parts = m[1].match(/\.(-?[_a-zA-Z][\w-]*)/g) || [];
    parts.forEach(p => queried.add(p.slice(1)));
  }

  const missingInDom = Array.from(queried).filter(c => !inMarkup.has(c) && !LIB.has(c));
  const unused = Array.from(cssClasses).filter(c => !inMarkup.has(c) && !queried.has(c));

  const ok = missingInDom.length === 0;
  if (!ok) fail++;
  console.log((ok ? 'ok   ' : 'FAIL ') + page.name +
    ' | css classes: ' + cssClasses.size +
    ' | dom+js classes: ' + inMarkup.size +
    (missingInDom.length ? ' | JS queries classes not in DOM: ' + missingInDom.join(', ') : '') +
    (unused.length ? ' | css-only: ' + unused.join(', ') : ''));
});

console.log('\n' + (fail === 0 ? 'ALL CLASS WIRING OK' : fail + ' PAGE(S) WITH UNRESOLVED CLASS QUERIES'));
process.exit(fail === 0 ? 0 : 1);
