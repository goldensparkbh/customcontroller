const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const PRIMARIES = ["'#238636'", "'#1f6feb'", 'var(--button-primary-bg)', 'var(--button-primary-bg, #238636)'];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  if (fs.statSync(dir).isFile()) {
    if (/\.(jsx|js)$/.test(dir) && !dir.includes('AdminSidebarIcons') && !dir.includes('AdminThemeContext')) {
      files.push(dir);
    }
    return files;
  }
  for (const name of fs.readdirSync(dir)) {
    walk(path.join(dir, name), files);
  }
  return files;
}

function fixStyleBlocks(text) {
  return text.replace(/style=\{\{([\s\S]*?)\}\}/g, (block) => {
    let next = block;
    const hasPrimary = PRIMARIES.some((bg) => next.includes(`background: ${bg}`));
    if (!hasPrimary) return block;
    next = next.replace(/color:\s*'var\(--admin-text-strong\)'/g, "color: 'var(--admin-on-primary)'");
    next = next.replace(/color:\s*"var\(--admin-text-strong\)"/g, 'color: "var(--admin-on-primary)"');
    return next;
  });
}

const files = [...walk(path.join(ROOT, 'src/pages/admin')), path.join(ROOT, 'src/pages/Admin.jsx')];
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = fixStyleBlocks(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed += 1;
    console.log('updated', path.relative(ROOT, file));
  }
}
console.log(`Done. ${changed} file(s).`);
