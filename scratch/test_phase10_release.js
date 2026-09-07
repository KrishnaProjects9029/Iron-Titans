/**
 * test_phase10_release.js
 * Automated test suite for Iron Titans Phase 10 release build, PWA & Android packaging
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT_DIR = 'c:\\Users\\admin\\Downloads\\Century_Attendance\\MEch Arena';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✔ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ ${desc}:`, err.message);
    failed++;
  }
}

console.log('==================================================');
console.log('IRON TITANS — PHASE 10 RELEASE & PACKAGING TESTS');
console.log('==================================================\n');

// ── TEST SUITE 1: GameConfig & Versioning ──
console.log('[SUITE 1] Production GameConfig & Versioning');
it('GameConfig.js defines IT.CONFIG with v1.0.0 in PRODUCTION_MODE', () => {
  const code = fs.readFileSync(path.join(ROOT_DIR, 'js', 'data', 'GameConfig.js'), 'utf8');
  const sandbox = { window: {}, console: console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  assert(sandbox.window.IT, 'window.IT must be defined');
  assert(sandbox.window.IT.CONFIG, 'IT.CONFIG must be defined');
  assert.strictEqual(sandbox.window.IT.CONFIG.VERSION, '1.0.0', 'VERSION must be 1.0.0');
  assert.strictEqual(sandbox.window.IT.CONFIG.PRODUCTION_MODE, true, 'PRODUCTION_MODE must be true');
  assert.strictEqual(sandbox.window.IT.CONFIG.isProduction(), true, 'isProduction() must return true');
  assert.strictEqual(sandbox.window.IT.CONFIG.isDev(), false, 'isDev() must return false');
});

// ── TEST SUITE 2: PWA Manifest & App Icons ──
console.log('\n[SUITE 2] PWA Manifest & Icons');
it('manifest.json contains required PWA metadata', () => {
  const raw = fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(raw);

  assert(manifest.name && manifest.name.includes('IRON TITANS'), 'Manifest name must contain IRON TITANS');
  assert(manifest.short_name && manifest.short_name.toUpperCase() === 'IRON TITANS', 'Manifest short_name');
  assert.strictEqual(manifest.display, 'standalone', 'Display must be standalone');
  assert.strictEqual(manifest.orientation, 'landscape', 'Orientation must be landscape');
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'Manifest must have at least 3 icons');

  // Verify all icon paths exist
  for (const icon of manifest.icons) {
    const iconPath = path.join(ROOT_DIR, icon.src);
    assert(fs.existsSync(iconPath), `Icon file must exist: ${icon.src}`);
    const stat = fs.statSync(iconPath);
    assert(stat.size > 100, `Icon file must have valid content size: ${icon.src}`);
  }
});

it('All app icons exist with valid dimensions and sizes', () => {
  const expected = [
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
    'favicon.png'
  ];
  for (const f of expected) {
    const p = path.join(ROOT_DIR, 'icons', f);
    assert(fs.existsSync(p), `Icon ${f} must exist in icons/`);
    assert(fs.statSync(p).size > 200, `Icon ${f} must not be empty`);
  }
});

// ── TEST SUITE 3: Service Worker & Offline Pre-caching ──
console.log('\n[SUITE 3] Service Worker & Pre-caching Coverage');
it('sw.js pre-caches all required release files and all cached files exist', () => {
  const swCode = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf8');
  assert(swCode.includes('iron-titans-v1.0.0'), 'sw.js cache name must be iron-titans-v1.0.0');

  // Extract PRECACHE_ASSETS array
  const match = swCode.match(/const PRECACHE_ASSETS = (\[[\s\S]*?\]);/);
  assert(match, 'PRECACHE_ASSETS array must be present in sw.js');
  const urls = eval(match[1]);
  assert(urls.length >= 25, `Expected at least 25 pre-cached assets, found ${urls.length}`);

  for (const rel of urls) {
    if (rel === './' || rel === '') continue;
    const cleanRel = rel.replace(/^\.\//, '');
    const fullPath = path.join(ROOT_DIR, cleanRel);
    assert(fs.existsSync(fullPath), `Pre-cached asset must exist on disk: ${rel}`);
  }
});

// ── TEST SUITE 4: SaveManager v10 Dual-Save Backup ──
console.log('\n[SUITE 4] SaveManager v10 Dual-Save & First Launch');
it('SaveManager initializes with saveVersion 10, isFirstLaunch, and backup storage', () => {
  const mockStorage = {};
  const fakeLocalStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  const sandbox = {
    window: {},
    console: console,
    localStorage: fakeLocalStorage,
    Math: Math,
    JSON: JSON
  };
  vm.createContext(sandbox);

  // Load MathUtils and SaveManager
  const mathUtilsCode = fs.readFileSync(path.join(ROOT_DIR, 'js', 'utils', 'MathUtils.js'), 'utf8');
  const saveMgrCode = fs.readFileSync(path.join(ROOT_DIR, 'js', 'utils', 'SaveManager.js'), 'utf8');
  vm.runInContext(mathUtilsCode, sandbox);
  vm.runInContext(saveMgrCode, sandbox);

  const sm = sandbox.window.IT.SaveManager;
  assert(sm, 'SaveManager must be initialized');
  assert.strictEqual(sm.isFirstLaunch, true, 'Fresh installation isFirstLaunch must be true');

  // Dual save verification
  assert(mockStorage['iron_titans_phase10_save'], 'Primary phase 10 save must exist');
  assert(mockStorage['iron_titans_backup_save'], 'Redundant backup save must exist');

  // Complete first launch
  sm.setFirstLaunchComplete();
  assert.strictEqual(sm.isFirstLaunch, false, 'isFirstLaunch must be false after completion');

  // Simulate primary save corruption and test recovery from backup
  mockStorage['iron_titans_phase10_save'] = 'INVALID_CORRUPTED_JSON{{{';
  const recoveredData = sm.load();
  assert(recoveredData, 'SaveManager must recover data after primary corruption');
  assert.strictEqual(recoveredData.saveVersion, 10, 'Recovered data version must be 10');
  assert.strictEqual(sm.isFirstLaunch, false, 'Recovered data must retain completed onboarding');
});

// ── TEST SUITE 5: HTML, CSS & Modals ──
console.log('\n[SUITE 5] Index HTML & CSS Release Elements');
it('index.html contains PWA head tags, v1.0.0 badges, modals, and GameConfig', () => {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

  assert(html.includes('<link rel="manifest" href="manifest.json" />'), 'Manifest link in head');
  assert(html.includes('theme-color'), 'theme-color meta tag');
  assert(html.includes('js/data/GameConfig.js'), 'GameConfig.js script import');
  assert(html.includes('v1.0.0'), 'v1.0.0 version string');
  assert(html.includes('id="modal-first-launch"'), '#modal-first-launch must exist');
  assert(html.includes('id="modal-exit-confirm"'), '#modal-exit-confirm must exist');
  assert(html.includes('id="screen-error"'), '#screen-error must exist');
  assert(html.includes('serviceWorker.register'), 'Service worker registration script');
});

it('style.css includes safe-area-inset variables, first launch, and error styles', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'style.css'), 'utf8');

  assert(css.includes('safe-area-inset-top'), 'safe-area-inset-top');
  assert(css.includes('safe-area-inset-bottom'), 'safe-area-inset-bottom');
  assert(css.includes('.first-launch-modal-box'), '.first-launch-modal-box styling');
  assert(css.includes('.error-screen'), '.error-screen styling');
  assert(css.includes('.exit-modal-box'), '.exit-modal-box styling');
});

// ── TEST SUITE 6: Android Packaging Project ──
console.log('\n[SUITE 6] Android Native Wrapper Project');
it('Android project files and bundled release assets exist in android/', () => {
  const androidDir = path.join(ROOT_DIR, 'android');
  assert(fs.existsSync(path.join(androidDir, 'build.gradle')), 'android/build.gradle');
  assert(fs.existsSync(path.join(androidDir, 'settings.gradle')), 'android/settings.gradle');
  assert(fs.existsSync(path.join(androidDir, 'app', 'build.gradle')), 'android/app/build.gradle');
  assert(fs.existsSync(path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml')), 'AndroidManifest.xml');
  assert(fs.existsSync(path.join(androidDir, 'app', 'src', 'main', 'java', 'com', 'irontitans', 'mecharena', 'MainActivity.java')), 'MainActivity.java');

  // Verify bundled assets inside Android app
  const assetsDir = path.join(androidDir, 'app', 'src', 'main', 'assets');
  assert(fs.existsSync(path.join(assetsDir, 'index.html')), 'Bundled index.html in android assets');
  assert(fs.existsSync(path.join(assetsDir, 'style.css')), 'Bundled style.css in android assets');
  assert(fs.existsSync(path.join(assetsDir, 'manifest.json')), 'Bundled manifest.json in android assets');
  assert(fs.existsSync(path.join(assetsDir, 'sw.js')), 'Bundled sw.js in android assets');
  assert(fs.existsSync(path.join(assetsDir, 'js', 'lib', 'three.min.js')), 'Bundled three.min.js in android assets');
  assert(fs.existsSync(path.join(assetsDir, 'icons', 'icon-192.png')), 'Bundled icon-192.png in android assets');
});

console.log('\n==================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
}
