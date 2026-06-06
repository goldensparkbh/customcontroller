/**
 * One-off helper: replace hardcoded admin neutrals with CSS variables.
 * Run from repo root: node server/scripts/apply-admin-theme-vars.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const TARGETS = [
  path.join(ROOT, 'src/pages/Admin.jsx'),
  path.join(ROOT, 'src/pages/admin')
];

const REPLACEMENTS = [
  ['#0e1117', 'var(--admin-app-bg)'],
  ['#161b22', 'var(--admin-surface)'],
  ['#0d1117', 'var(--admin-raised)'],
  ['#21262d', 'var(--admin-hover)'],
  ['#111827', 'var(--admin-hover-alt)'],
  ['#30363d', 'var(--admin-border)'],
  ['#3b4452', 'var(--admin-border-strong)'],
  ['#6e7681', 'var(--admin-muted-dim)'],
  ['#8b949e', 'var(--admin-muted)'],
  ['#c9d1d9', 'var(--admin-text-secondary)'],
  ['#e6edf3', 'var(--admin-text)'],
  ['rgba(0,0,0,0.8)', 'var(--admin-overlay)'],
  ['rgba(0, 0, 0, 0.8)', 'var(--admin-overlay)'],
  ['rgba(3, 7, 18, 0.78)', 'var(--admin-overlay-soft)'],
  ['0 4px 12px rgba(0,0,0,0.15)', 'var(--admin-shadow)'],
  ['0 8px 32px rgba(0,0,0,0.5)', 'var(--admin-shadow-lg)'],
  ['0 8px 24px rgba(0,0,0,0.3)', 'var(--admin-shadow-lg)'],
  ['#11141b', 'var(--admin-preview-bg)'],
  ["color: '#fff'", "color: 'var(--admin-text-strong)'"],
  ['color: "#fff"', 'color: "var(--admin-text-strong)"'],
  ["color: '#ffffff'", "color: 'var(--admin-text-strong)'"],
  ['background: \'#fff\'', 'background: \'var(--admin-surface)\''],
  ['background: "#fff"', 'background: "var(--admin-surface)"']
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (/\.(jsx|js)$/.test(dir) && !dir.includes('AdminSidebarIcons')) {
      files.push(dir);
    }
    return files;
  }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'node_modules') continue;
    walk(full, files);
  }
  return files;
}

const files = [];
for (const target of TARGETS) {
  walk(target, files);
}

let changed = 0;
for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (text !== before) {
    fs.writeFileSync(file, text, 'utf8');
    changed += 1;
    console.log('updated', path.relative(ROOT, file));
  }
}
console.log(`Done. ${changed} file(s) updated.`);
