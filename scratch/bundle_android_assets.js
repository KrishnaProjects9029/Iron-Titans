/**
 * bundle_android_assets.js
 * Copies all release game assets into android/app/src/main/assets/
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = 'c:\\Users\\admin\\Downloads\\Century_Attendance\\MEch Arena';
const TARGET_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'assets');

function copyDirRecursive(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    // Exclude node_modules, android, git, scratch, test directories
    if (['android', 'node_modules', '.git', 'scratch'].includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

console.log('[BUNDLE] Packaging Iron Titans assets for Android...');
console.log('Source:', ROOT_DIR);
console.log('Target:', TARGET_DIR);

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Copy top-level release files
const topLevelFiles = ['index.html', 'style.css', 'manifest.json', 'sw.js'];
for (const file of topLevelFiles) {
  const s = path.join(ROOT_DIR, file);
  const d = path.join(TARGET_DIR, file);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`✔ Bundled ${file}`);
  }
}

// Copy subdirectories (js/, icons/)
const subDirs = ['js', 'icons'];
for (const dir of subDirs) {
  const s = path.join(ROOT_DIR, dir);
  const d = path.join(TARGET_DIR, dir);
  if (fs.existsSync(s)) {
    copyDirRecursive(s, d);
    console.log(`✔ Bundled directory ${dir}/`);
  }
}

console.log('=========================================');
console.log('ANDROID ASSET BUNDLING COMPLETED!');
console.log('=========================================');
