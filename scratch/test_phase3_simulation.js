/**
 * Headless Phase 3 Simulation Test
 * Validates 10-mech 5v5 team skirmish, 4 archetypes, line-of-sight raycasting,
 * friendly-fire immunity, safe spawn selection, and match flow.
 */

const fs = require('fs');
const path = require('path');

// Minimal browser/DOM mock for Node.js
global.window = global;
global.document = {
  getElementById: () => ({
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      fillText: () => {}
    }),
    style: {},
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {}
  }),
  createElement: () => ({
    style: {},
    classList: { add: () => {}, remove: () => {} },
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      fillText: () => {}
    }),
    appendChild: () => {}
  })
};
global.navigator = { vibrate: () => {} };

// Mock Three.js essentials
const THREE = {
  Vector2: class { constructor(x=0,y=0){this.x=x;this.y=y;} },
  Vector3: class {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
    copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
    clone(){return new THREE.Vector3(this.x,this.y,this.z);}
    add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
    sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
    subVectors(a,b){this.x=a.x-b.x;this.y=a.y-b.y;this.z=a.z-b.z;return this;}
    multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
    addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
    normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;}
    length(){return Math.hypot(this.x,this.y,this.z);}
    lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}
    distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
    lerp(v,alpha){this.x+=(v.x-this.x)*alpha;this.y+=(v.y-this.y)*alpha;this.z+=(v.z-this.z)*alpha;return this;}
  },
  Group: class {
    constructor(){this.position=new THREE.Vector3();this.rotation={x:0,y:0,z:0};this.scale=new THREE.Vector3(1,1,1);this.children=[];}
    add(child){this.children.push(child);child.parent=this;}
    remove(child){const idx=this.children.indexOf(child);if(idx>=0)this.children.splice(idx,1);}
  },
  Mesh: class {
    constructor(geo,mat){this.position=new THREE.Vector3();this.rotation={x:0,y:0,z:0};this.scale=new THREE.Vector3(1,1,1);this.children=[];this.quaternion={setFromUnitVectors:()=>{}};}
    add(c){this.children.push(c);c.parent=this;}
  },
  Sprite: class { constructor(){this.position=new THREE.Vector3();this.scale=new THREE.Vector3(1,1,1);} },
  SpriteMaterial: class {},
  CanvasTexture: class { constructor(){this.needsUpdate=false;} },
  MeshStandardMaterial: class { constructor(opts={}){this.color=opts.color;this.emissive={setHex:()=>{}};this.emissiveIntensity=opts.emissiveIntensity||0;} },
  MeshBasicMaterial: class { constructor(opts={}){this.color=opts.color;} },
  BoxGeometry: class {},
  CylinderGeometry: class {},
  SphereGeometry: class {},
  PlaneGeometry: class {},
  PointLight: class { constructor(){this.position=new THREE.Vector3();} },
  Object3D: class {
    constructor(){this.position=new THREE.Vector3();}
    getWorldPosition(target){target.copy(this.position);return target;}
  },
  Raycaster: class {
    constructor(orig,dir,n,f){this.origin=orig;this.direction=dir;this.near=n;this.far=f;}
    setFromCamera(){}
    intersectObjects(){return [];}
  }
};
global.THREE = THREE;

// Load Iron Titans modules
require('../js/3d/TeamManager.js');
require('../js/3d/MechBuilder3D.js');
require('../js/3d/Mech3D.js');
require('../js/3d/BotAI.js');
require('../js/3d/SpawnManager.js');
require('../js/3d/Combat3D.js');
require('../js/3d/MatchManager.js');

const IT = global.IT;

console.log('=== IRON TITANS PHASE 3 HEADLESS SIMULATION TEST ===\n');

let passed = 0;
let total = 0;
function assert(desc, condition) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
  }
}

// ── TEST 1: Archetypes & Stat Scaling ──
console.log('1. Archetypes and Stat Configurations:');
const assaultCfg = IT.MechBuilder3D.getArchetypeConfig('ASSAULT');
const tankCfg = IT.MechBuilder3D.getArchetypeConfig('TANK');
const scoutCfg = IT.MechBuilder3D.getArchetypeConfig('SCOUT');
const strikerCfg = IT.MechBuilder3D.getArchetypeConfig('STRIKER');

assert('Assault HP is 500, Speed is 16', assaultCfg.hp === 500 && assaultCfg.speed === 16.0);
assert('Tank has highest HP (850) and larger scale (1.22)', tankCfg.hp === 850 && tankCfg.scale > 1.2);
assert('Scout has highest speed (22.5) and compact scale (0.85)', scoutCfg.speed === 22.5 && scoutCfg.scale < 0.9);
assert('Striker has high damage (58) and precision role', strikerCfg.damage === 58 && strikerCfg.role.includes('Striker'));

// ── TEST 2: 10-Mech Team Rosters (5v5) ──
console.log('\n2. Team Rosters & Friendly-Fire Queries:');
const teamMgr = new IT.TeamManager();

const blueMechs = [
  new IT.Mech3D({ name: 'IRONCLAD-X1', archetype: 'ASSAULT', team: 'blue', isPlayer: true }),
  new IT.Mech3D({ name: 'TITAN-COLOSSUS', archetype: 'TANK', team: 'blue' }),
  new IT.Mech3D({ name: 'AERO-ZEPHYR', archetype: 'SCOUT', team: 'blue' }),
  new IT.Mech3D({ name: 'APEX-VANGUARD', archetype: 'STRIKER', team: 'blue' }),
  new IT.Mech3D({ name: 'AEGIS-ASSAULT', archetype: 'ASSAULT', team: 'blue' })
];

const redMechs = [
  new IT.Mech3D({ name: 'CRIMSON-COLOSSUS', archetype: 'TANK', team: 'red' }),
  new IT.Mech3D({ name: 'VIPER-ZEPHYR', archetype: 'SCOUT', team: 'red' }),
  new IT.Mech3D({ name: 'RAVEN-VANGUARD', archetype: 'STRIKER', team: 'red' }),
  new IT.Mech3D({ name: 'WARLORD-ASSAULT', archetype: 'ASSAULT', team: 'red' }),
  new IT.Mech3D({ name: 'DREAD-ASSAULT', archetype: 'ASSAULT', team: 'red' })
];

blueMechs.forEach(m => teamMgr.addMech(m, 'blue'));
redMechs.forEach(m => teamMgr.addMech(m, 'red'));

assert('Blue team roster has 5 mechs', teamMgr.getTeamMembers('blue').length === 5);
assert('Red team roster has 5 mechs', teamMgr.getTeamMembers('red').length === 5);
assert('Total active mechs is 10', teamMgr.getAllMechs().length === 10);
assert('Blue ally is NOT enemy of Blue player', !teamMgr.isEnemy(blueMechs[0], blueMechs[1]));
assert('Red bot IS enemy of Blue player', teamMgr.isEnemy(blueMechs[0], redMechs[0]));

// ── TEST 3: Bot AI Realistic Line-of-Sight (NO WALL HACKING) ──
console.log('\n3. Bot AI Perception & Obstacle Line-of-Sight:');
const bot = redMechs[0];
const botAI = new IT.MechAIController(bot);
bot.position.set(0, 0, 30);
bot.heading = Math.PI; // Looking South (towards negative Z)

const targetBehindWall = blueMechs[0];
targetBehindWall.position.set(0, 0, -30);

// A solid obstacle crate placed right in between (at z=0)
const mockColliders = [
  { minX: -10, maxX: 10, minZ: -5, maxZ: 5, minY: 0, maxY: 6 }
];

const losBlocked = botAI.hasLineOfSight(targetBehindWall, mockColliders);
assert('Line-of-Sight is FALSE when wall blocks view (no wall hacking)', losBlocked === false);

// Target moves to flank unobstructed (at x=25, z=0)
targetBehindWall.position.set(25, 0, 0);
const losClear = botAI.hasLineOfSight(targetBehindWall, mockColliders);
assert('Line-of-Sight is TRUE when clear line exists around obstacle', losClear === true);

// ── TEST 4: Friendly Fire Immunity & Projectile Collisions ──
console.log('\n4. Combat Friendly-Fire Immunity:');
const fakeScene = new THREE.Group();
const combat = new IT.Combat3D(fakeScene, { position: new THREE.Vector3() });

// Firing Blue projectile at Blue teammate
const bluePlayer = blueMechs[0];
const blueAlly = blueMechs[1];
bluePlayer.position.set(0, 0, 0);
blueAlly.position.set(0, 0, 10);

const projBlue = new IT.Projectile3D(fakeScene, bluePlayer.position, blueAlly.position, {
  sourceMech: bluePlayer,
  team: 'blue',
  damage: 45
});

let friendlyHit = false;
projBlue.update(0.1, [], [blueAlly], () => { friendlyHit = true; });
assert('Blue projectile ignores Blue teammate (friendly fire immune)', friendlyHit === false && blueAlly.hp === blueAlly.maxHp);

// Firing Blue projectile at Red enemy
const redEnemy = redMechs[1];
redEnemy.position.set(0, 0, 10);
const enemyStartHp = redEnemy.hp;

const projEnemy = new IT.Projectile3D(fakeScene, bluePlayer.position, redEnemy.position, {
  sourceMech: bluePlayer,
  team: 'blue',
  damage: 45
});

let enemyHit = false;
projEnemy.update(0.1, [], [redEnemy], () => { enemyHit = true; });
assert('Blue projectile damages Red enemy (damages shield first)', enemyHit === true && (redEnemy.hp < enemyStartHp || redEnemy.shield < redEnemy.maxShield));

// ── TEST 5: Invulnerability Protection on Spawn ──
console.log('\n5. Spawn Invulnerability Protection:');
redEnemy.setInvulnerable(2.0);
const hpBefore = redEnemy.hp;
const projAgainstShield = new IT.Projectile3D(fakeScene, bluePlayer.position, redEnemy.position, {
  sourceMech: bluePlayer,
  team: 'blue',
  damage: 45
});

projAgainstShield.update(0.1, [], [redEnemy], () => {});
assert('Invulnerable mech absorbs shots with 0 damage taken', redEnemy.hp === hpBefore);

// ── TEST 6: Safe Spawn Selection & Respawns ──
console.log('\n6. Safe Spawn Selection & Respawn System:');
const spawnMgr = new IT.SpawnManager();

// Living enemies clustered at North base
redMechs[0].position.set(0, 0, 50);
redMechs[1].position.set(-20, 0, 48);

const safeSpawn = spawnMgr.selectSafeSpawn('blue', [redMechs[0], redMechs[1]], blueMechs);
assert('Safe spawn is in Blue South territory (z < -40)', safeSpawn.z < -40);

// Respawn queue check
let respawned = false;
spawnMgr.queueRespawn(blueMechs[2], (mech, spawn) => {
  respawned = true;
});
assert('Respawn queued with initial 3s delay', spawnMgr.respawnQueue.length === 1);
spawnMgr.update(3.1, () => [redMechs[0]], blueMechs);
assert('Respawn triggered after 3 seconds', respawned === true && blueMechs[2].isInvulnerable === true);

// ── TEST 7: Match Flow, Kill Feed & Win Condition ──
console.log('\n7. Match Flow, Kill Feed & Win Condition:');
const matchMgr = new IT.MatchManager(teamMgr, spawnMgr, null);
matchMgr.targetKills = 25;
matchMgr.state = IT.MATCH_STATES.ACTIVE;

// Record a kill
const victim = redMechs[2];
const killer = bluePlayer;
matchMgr.recordKill(victim, killer);

assert('Team score incremented to 1', teamMgr.getScore('blue') === 1);
assert('Kill feed recorded item', matchMgr.killFeed.length === 1);
assert('Kill feed correctly tags killer and victim', matchMgr.killFeed[0].killerName === 'IRONCLAD-X1' && matchMgr.killFeed[0].victimName === victim.name);

// Win Condition (Simulate reaching 25 kills)
let matchEnded = false;
let winner = null;
matchMgr.onMatchOver = (result) => {
  matchEnded = true;
  winner = result.winningTeam;
};

for (let i = 2; i <= 25; i++) {
  matchMgr.recordKill(victim, killer);
}

assert('Match ends when Blue reaches 25 kills', matchEnded === true && winner === 'blue');
assert('Match state is MATCH_OVER', matchMgr.state === IT.MATCH_STATES.MATCH_OVER);

console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
process.exit(passed === total ? 0 : 1);
