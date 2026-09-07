/**
 * Iron Titans 3D — Phase 5 Automated Simulation Test Suite
 * Tests Game Modes, Objectives, Multiple Arenas, AI Decision, and Save Stats.
 */

'use strict';

const assert = require('assert');

// Mock browser / DOM / Three.js environment for Node.js test execution
global.window = global;
global.document = {
  createElement: (tag) => ({
    width: 64,
    height: 64,
    style: {},
    classList: { add: () => {}, remove: () => {} },
    getContext: () => ({
      clearRect: () => {},
      beginPath: () => {},
      rect: () => {},
      roundRect: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {}
    })
  }),
  getElementById: (id) => ({
    style: {},
    classList: { add: () => {}, remove: () => {} },
    appendChild: () => {},
    textContent: '',
    innerHTML: '',
    getContext: () => ({
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      strokeRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillText: () => {}
    })
  }),
  querySelectorAll: () => []
};

global.THREE = {
  Vector3: class {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x; this.y = y; this.z = z;
    }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new global.THREE.Vector3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    normalize() {
      const l = this.length();
      if (l > 0) { this.x /= l; this.y /= l; this.z /= l; }
      return this;
    }
  },
  Group: class {
    constructor() {
      this.position = new global.THREE.Vector3();
      this.rotation = { y: 0 };
      this.children = [];
      this.visible = true;
    }
    add(obj) { this.children.push(obj); }
    remove(obj) { const i = this.children.indexOf(obj); if (i !== -1) this.children.splice(i, 1); }
  },
  Mesh: class {
    constructor() { this.position = new global.THREE.Vector3(); this.rotation = { y: 0 }; this.material = { color: { set: () => {} }, opacity: 1 }; }
  },
  CylinderGeometry: class {},
  CircleGeometry: class {},
  RingGeometry: class {},
  PlaneGeometry: class {},
  TorusGeometry: class {},
  BoxGeometry: class {},
  SphereGeometry: class {},
  CanvasTexture: class { constructor() { this.needsUpdate = false; } },
  MeshBasicMaterial: class { constructor() { this.color = { set: () => {}, setHex: () => {} }; } },
  MeshStandardMaterial: class { constructor() { this.color = { set: () => {}, setHex: () => {} }; this.emissive = { set: () => {}, setHex: () => {} }; } },
  PointLight: class { constructor() { this.position = new global.THREE.Vector3(); } },
  SpriteMaterial: class {},
  Sprite: class { constructor() { this.position = new global.THREE.Vector3(); this.scale = new global.THREE.Vector3(); this.material = {}; } },
  DoubleSide: 2
};

global.localStorage = {
  store: {},
  getItem: function (k) { return this.store[k] || null; },
  setItem: function (k, v) { this.store[k] = String(v); },
  removeItem: function (k) { delete this.store[k]; },
  clear: function () { this.store = {}; }
};

// Load dependencies
require('../js/utils/MathUtils.js');
require('../js/data/MechRegistry.js');
require('../js/data/WeaponRegistry.js');
require('../js/utils/SaveManager.js');
require('../js/3d/arenas/ArenaRegistry.js');
require('../js/modes/GameModeBase.js');
require('../js/modes/objectives/CaptureZone.js');
require('../js/modes/objectives/ControlPoint.js');
require('../js/modes/ObjectiveManager.js');
require('../js/modes/TeamSkirmishMode.js');
require('../js/modes/DominationMode.js');
require('../js/modes/ControlPointMode.js');
require('../js/modes/GameModeManager.js');

console.log('=== RUNNING PHASE 5 TEST SUITE ===');

// TEST 1: ArenaRegistry Tests
console.log('\n[TEST 1] ArenaRegistry Verification:');
const arenas = IT.ArenaRegistry.getAll();
assert.strictEqual(arenas.length, 3, 'Must have 3 arenas defined');

const neon = IT.ArenaRegistry.get('NEON_FORGE');
assert(neon, 'Neon Forge must exist');
assert.strictEqual(neon.blueSpawns.length, 5, 'Neon Forge has 5 blue spawns');
assert.strictEqual(neon.redSpawns.length, 5, 'Neon Forge has 5 red spawns');
assert(neon.objectives.domination.length === 3, 'Neon Forge has 3 domination zones');
assert(neon.objectives.controlPoint.length >= 4, 'Neon Forge has rotating control point sectors');

const docks = IT.ArenaRegistry.get('TITAN_DOCKS');
assert(docks, 'Titan Docks must exist');
assert.strictEqual(docks.blueSpawns.length, 5, 'Titan Docks has 5 blue spawns');
assert.strictEqual(docks.redSpawns.length, 5, 'Titan Docks has 5 red spawns');

const reactor = IT.ArenaRegistry.get('ASHEN_REACTOR');
assert(reactor, 'Ashen Reactor must exist');
assert.strictEqual(reactor.blueSpawns.length, 5, 'Ashen Reactor has 5 blue spawns');
assert.strictEqual(reactor.redSpawns.length, 5, 'Ashen Reactor has 5 red spawns');
console.log('✔ ArenaRegistry verified with 3 arenas, spawns, and objective configurations.');

// TEST 2: GameModeManager Router
console.log('\n[TEST 2] GameModeManager Routing:');
const gmm = new IT.GameModeManager();
assert.strictEqual(gmm.getActiveMode().modeId, 'SKIRMISH');
gmm.setMode('DOMINATION');
assert.strictEqual(gmm.getActiveMode().modeId, 'DOMINATION');
gmm.setMode('CONTROL_POINT');
assert.strictEqual(gmm.getActiveMode().modeId, 'CONTROL_POINT');
console.log('✔ GameModeManager correctly routes Skirmish, Domination, and Control Point.');

// TEST 3: Team Skirmish Lifecycle & Scoring
console.log('\n[TEST 3] Team Skirmish Lifecycle & Killstreaks:');
const skirmish = new IT.TeamSkirmishMode();
skirmish.initialize({
  arenaConfig: neon,
  allMechs: []
});
assert.strictEqual(skirmish.state, IT.MODE_STATES.COUNTDOWN);
skirmish.update(3.1); // Finish countdown
assert.strictEqual(skirmish.state, IT.MODE_STATES.ACTIVE);

const playerMech = { name: 'PILOT-PLAYER', team: 'blue', isPlayer: true };
const enemyMech1 = { name: 'BOT-RED-1', team: 'red', isPlayer: false };
const enemyMech2 = { name: 'BOT-RED-2', team: 'red', isPlayer: false };

let lastAnnouncement = null;
skirmish.onAnnouncement = (evt) => { lastAnnouncement = evt; };

skirmish.handleKill(enemyMech1, playerMech);
assert.strictEqual(skirmish.blueScore, 1, 'Blue score should be 1');
assert.strictEqual(skirmish.streaks.get(playerMech), 1);

skirmish.handleKill(enemyMech2, playerMech);
assert.strictEqual(skirmish.blueScore, 2, 'Blue score should be 2');
assert.strictEqual(skirmish.streaks.get(playerMech), 2);
assert(lastAnnouncement && lastAnnouncement.text.includes('DOUBLE STRIKE'), 'Must announce DOUBLE STRIKE');
console.log('✔ Team Skirmish scored kills and triggered DOUBLE STRIKE streak announcement.');

// TEST 4: Domination Mode Objective Captures & Ticks
console.log('\n[TEST 4] Domination Mode Objective Captures & Scoring:');
const mockScene = new global.THREE.Group();
const domMode = new IT.DominationMode();
domMode.initialize({
  scene: mockScene,
  arenaConfig: neon,
  allMechs: [playerMech, enemyMech1]
});
domMode.start();
assert.strictEqual(domMode.state, IT.MODE_STATES.ACTIVE);

const objectives = domMode.getObjectives();
assert.strictEqual(objectives.length, 3, 'Must have 3 domination objectives');
assert.strictEqual(objectives[0].id, 'A');
assert.strictEqual(objectives[1].id, 'B');
assert.strictEqual(objectives[2].id, 'C');

// Place player inside Zone A
playerMech.position = objectives[0].position.clone();
enemyMech1.position = new global.THREE.Vector3(999, 0, 999); // far away

// Update zone for 4.5 seconds (capture speed is 4.0s)
for (let i = 0; i < 9; i++) {
  domMode.update(0.5);
}

const activeObjs = domMode.getObjectives();
assert.strictEqual(activeObjs[0].controllingTeam, 'blue', 'Zone A should now be BLUE controlled');

// Now simulate 2 seconds of match ticks -> blue controls 1 zone, so should score +1 pt/sec = 2 pts
const prevBlueScore = domMode.blueScore;
domMode.update(1.0);
domMode.update(1.0);
assert.strictEqual(domMode.blueScore, prevBlueScore + 2, 'Blue should receive +1 pt/s per controlled zone');
console.log('✔ Domination Zone A captured by Blue; generated +1 pt/sec successfully.');

// TEST 5: Control Point Rotation & Warning
console.log('\n[TEST 5] Control Point Rotation & Sector Warnings:');
const cpMode = new IT.ControlPointMode();
let cpAnnouncement = null;
cpMode.onAnnouncement = (evt) => { cpAnnouncement = evt; };

cpMode.initialize({
  scene: mockScene,
  arenaConfig: neon,
  allMechs: [playerMech]
});
cpMode.start();

const cp = cpMode.getControlPoint();
assert(cp, 'Control Point descriptor must exist');
assert.strictEqual(cp.id, 'CP');
assert.strictEqual(cp.label, 'CENTER PLATFORM');

// Place player on point to capture it
playerMech.position = cp.position.clone();
for (let i = 0; i < 9; i++) {
  cpMode.update(0.5);
}
assert.strictEqual(cpMode.getControlPoint().controllingTeam, 'blue', 'Control Point should be captured by Blue');

// Fast forward timer to test 10s warning
// Cycle duration is 60s, warning is at 10s remaining (advance 51s)
for (let i = 0; i < 51; i++) {
  cpMode.update(1.0);
}
assert(cpAnnouncement && cpAnnouncement.text.includes('NEXT OBJECTIVE'), 'Must announce next objective sector warning');

// Advance another 10s to trigger relocation
for (let i = 0; i < 10; i++) {
  cpMode.update(1.0);
}
assert(cpAnnouncement && cpAnnouncement.text.includes('NEW OBJECTIVE ACTIVE'), 'Must announce relocation');
console.log('✔ Control Point captured, warned 10s prior, and relocated to next sector.');

// TEST 6: SaveManager Phase 5 Career Progression
console.log('\n[TEST 6] SaveManager Career & Objective Tracking:');
IT.SaveManager.reset();
assert.strictEqual(IT.SaveManager.career.objectiveCaptures, 0);

const outcome = IT.SaveManager.recordMatchOutcome({
  won: true,
  kills: 8,
  deaths: 1,
  assists: 3,
  damageDealt: 12000,
  captures: 4,
  defenses: 2,
  timeOnPoint: 45,
  score: 180,
  bestStreak: 6,
  modeId: 'DOMINATION',
  arenaId: 'TITAN_DOCKS',
  creditsEarned: 850,
  xpEarned: 650
});

assert.strictEqual(IT.SaveManager.career.objectiveCaptures, 4, 'Captures recorded');
assert.strictEqual(IT.SaveManager.career.objectiveDefenses, 2, 'Defenses recorded');
assert.strictEqual(IT.SaveManager.career.objectiveTime, 45, 'Time on point recorded');
assert.strictEqual(IT.SaveManager.career.bestStreak, 6, 'Best streak recorded');
assert.strictEqual(IT.SaveManager.career.bestScore, 180, 'Best score recorded');
assert.strictEqual(IT.SaveManager.preferredMode, 'DOMINATION', 'Preferred mode saved');
assert.strictEqual(IT.SaveManager.preferredArena, 'TITAN_DOCKS', 'Preferred arena saved');
console.log('✔ SaveManager accurately persisted Phase 5 stats, best streaks, and preferred mode/arena.');

console.log('\n=== ALL PHASE 5 SIMULATION TESTS PASSED! ===\n');
