/**
 * prepare_www.js
 * Bundles the release web files into 'www/' for Capacitor deployment.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

function copyRecursive(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }
  const items = fs.readdirSync(src, { withFileTypes: true });
  for (const item of items) {
    const s = path.join(src, item.name);
    const d = path.join(dst, item.name);

    if (['node_modules', 'android', 'www', '.git', 'scratch'].includes(item.name)) {
      continue;
    }

    if (item.isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log('[WWW] Cleaning and preparing www directory...');
if (fs.existsSync(WWW)) {
  fs.rmSync(WWW, { recursive: true, force: true });
}
fs.mkdirSync(WWW, { recursive: true });

// Copy root game files
const rootFiles = ['index.html', 'style.css', 'manifest.json', 'sw.js'];
for (const file of rootFiles) {
  const s = path.join(ROOT, file);
  const d = path.join(WWW, file);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`  ✔ Copied ${file}`);
  }
}

// Copy game code & assets
const dirs = ['js', 'icons'];
for (const d of dirs) {
  const s = path.join(ROOT, d);
  const dst = path.join(WWW, d);
  if (fs.existsSync(s)) {
    copyRecursive(s, dst);
    console.log(`  ✔ Copied directory ${d}/`);
  }
}

console.log('✔ www/ successfully generated and ready for Capacitor packaging!');
