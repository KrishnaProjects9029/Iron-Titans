/**
 * Headless Phase 4 Simulation Test
 * Validates 5 mechs, 6 weapons, loadouts, upgrades, XP/levels,
 * modular 3D mounting, weapon combat behaviors, and economy.
 */

const fs = require('fs');
const path = require('path');

// Mock browser / DOM environment
global.window = global;
global.document = {
  getElementById: () => ({
    style: {},
    classList: { add: () => {}, remove: () => {} },
    getContext: () => ({
      clearRect: () => {}, fillRect: () => {}, beginPath: () => {}, arc: () => {},
      fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
      fillText: () => {}, strokeRect: () => {}, measureText: () => ({ width: 20 })
    }),
    addEventListener: () => {},
    appendChild: () => {}
  }),
  createElement: () => ({
    style: {},
    classList: { add: () => {}, remove: () => {} },
    getContext: () => ({
      clearRect: () => {}, fillRect: () => {}, beginPath: () => {}, arc: () => {},
      fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
      fillText: () => {}, strokeRect: () => {}, measureText: () => ({ width: 20 })
    }),
    appendChild: () => {},
    addEventListener: () => {}
  }),
  querySelectorAll: () => []
};
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

// Mock Three.js
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
    remove(child){const i=this.children.indexOf(child);if(i>=0)this.children.splice(i,1);}
  },
  Mesh: class {
    constructor(geo,mat){this.position=new THREE.Vector3();this.rotation={x:0,y:0,z:0,set:()=>{}};this.scale=new THREE.Vector3(1,1,1);this.children=[];this.quaternion={setFromUnitVectors:()=>{}};}
    add(c){this.children.push(c);c.parent=this;}
    remove(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);}
  },
  Sprite: class { constructor(){this.position=new THREE.Vector3();this.scale=new THREE.Vector3(1,1,1);} },
  SpriteMaterial: class {},
  CanvasTexture: class { constructor(){this.needsUpdate=false;} },
  MeshStandardMaterial: class { constructor(opts={}){this.color=opts.color;this.emissive={setHex:()=>{}};this.emissiveIntensity=opts.emissiveIntensity||0;} },
  MeshBasicMaterial: class { constructor(opts={}){this.color=opts.color;} },
  BoxGeometry: class {},
  CylinderGeometry: class {},
  ConeGeometry: class {},
  TorusGeometry: class {},
  SphereGeometry: class {},
  PlaneGeometry: class {},
  PointLight: class { constructor(){this.position=new THREE.Vector3();} },
  Object3D: class {
    constructor(){this.position=new THREE.Vector3();}
    getWorldPosition(target){target.copy(this.position);return target;}
  },
  Raycaster: class {
    constructor(){this.ray={};}
    setFromCamera(){}
    intersectObjects(){return [];}
  }
};
global.THREE = THREE;

// Load modules
require('../js/data/MechRegistry.js');
require('../js/data/WeaponRegistry.js');
require('../js/utils/SaveManager.js');
require('../js/3d/WeaponBuilder3D.js');
require('../js/3d/MechBuilder3D.js');
require('../js/3d/Mech3D.js');
require('../js/3d/Combat3D.js');

const IT = global.IT;

console.log('=== IRON TITANS PHASE 4 HEADLESS SIMULATION TEST ===\n');

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

// ── TEST 1: Mech Registry & Scaling ──
console.log('1. Mech Registry (5 Original Mechs):');
const mechs = IT.MechRegistry.getAll();
assert('Exactly 5 original mechs exist in registry', mechs.length === 5);

const ironclad = IT.MechRegistry.get('ironclad');
const vortex = IT.MechRegistry.get('vortex');
const bastion = IT.MechRegistry.get('bastion');
const striker = IT.MechRegistry.get('striker');
const nova = IT.MechRegistry.get('nova');

assert('IRONCLAD-X1 is Tank role with 5000 HP and Energy Charge', ironclad.role === 'Tank' && ironclad.baseHp === 5000 && ironclad.abilityId === 'energy_charge');
assert('VORTEX-9 is Scout role with 22.5 Speed and Phase Dash (Unlock Lvl 5)', vortex.role === 'Scout' && vortex.baseSpeed === 22.5 && vortex.unlockLevel === 5);
assert('BASTION-R is Defender role with 6000 HP and Deploy Shield (Unlock Lvl 10)', bastion.role === 'Defender' && bastion.baseHp === 6000 && bastion.unlockLevel === 10);
assert('STRIKER-X is Assault role with Overdrive (Unlock Lvl 15)', striker.role === 'Assault' && striker.abilityId === 'overdrive' && striker.unlockLevel === 15);
assert('NOVA-7 is Long Range role with Precision Lock (Unlock Lvl 20)', nova.role === 'Long Range' && nova.abilityId === 'precision_lock' && nova.unlockLevel === 20);

// Upgrade curve test
const ironcladLvl5 = IT.MechRegistry.getStatsForLevel('ironclad', 5);
assert('Ironclad Level 5 has upgraded HP (6000 HP)', ironcladLvl5.maxHp === 6000);

// ── TEST 2: Weapon Registry & Scaling ──
console.log('\n2. Weapon Registry (6 Original Weapons):');
const weapons = IT.WeaponRegistry.getAll();
assert('Exactly 6 original weapons exist in registry', weapons.length === 6);

const pulse = IT.WeaponRegistry.get('pulseCannon');
const scatter = IT.WeaponRegistry.get('scatterBlaster');
const plasma = IT.WeaponRegistry.get('plasmaLauncher');
const arc = IT.WeaponRegistry.get('arcRifle');
const missile = IT.WeaponRegistry.get('missileRack');
const rail = IT.WeaponRegistry.get('railSpear');

assert('PULSE CANNON is fast projectile with 45 damage', pulse.projectileType === 'PULSE' && pulse.baseDamage === 45);
assert('SCATTER BLASTER has 7 pellets for close-range burst', scatter.projectileType === 'SCATTER' && scatter.pelletCount === 7);
assert('PLASMA LAUNCHER has area explosion (AOE) radius 8.5m', plasma.projectileType === 'PLASMA_ORB' && plasma.explosionRadius > 8.0);
assert('ARC RIFLE has dielectric lightning beam (ARC_BEAM)', arc.projectileType === 'ARC_BEAM');
assert('MISSILE RACK has 4 homing missiles (MISSILE)', missile.projectileType === 'MISSILE' && missile.missilesPerBurst === 4);
assert('RAIL SPEAR has massive precision damage (185 DMG)', rail.projectileType === 'RAIL_SPEAR' && rail.baseDamage === 185);

// ── TEST 3: SaveManager, Upgrades, XP & Progression ──
console.log('\n3. Player Progression, Economy & Unlocks:');
IT.SaveManager.reset();

assert('New player starts with 1000 credits', IT.SaveManager.credits === 1000);
assert('New player starts at Player Level 1 and 0 XP', IT.SaveManager.playerLevel === 1 && IT.SaveManager.playerXP === 0);
assert('Default loadout equipped: Ironclad + Pulse Cannon + Scatter Blaster',
  IT.SaveManager.getLoadout().mechId === 'ironclad' &&
  IT.SaveManager.getLoadout().primaryId === 'pulseCannon' &&
  IT.SaveManager.getLoadout().secondaryId === 'scatterBlaster'
);

// Upgrade Mech
const upMech = IT.SaveManager.upgradeMech('ironclad');
assert('Upgraded Ironclad to Level 2 (cost 250 credits deducted)', upMech.success && IT.SaveManager.getMechLevel('ironclad') === 2 && IT.SaveManager.credits === 750);

// Upgrade Weapon
const upWep = IT.SaveManager.upgradeWeapon('pulseCannon');
assert('Upgraded Pulse Cannon to Level 2 (cost 200 credits deducted)', upWep.success && IT.SaveManager.getWeaponLevel('pulseCannon') === 2 && IT.SaveManager.credits === 550);

// Add XP and level up to Level 5 (800+1100+1400+1700 = 5000 XP)
const xpRes = IT.SaveManager.addXP(5000);
assert('Adding 5000 XP leveled up player past Level 5', IT.SaveManager.playerLevel >= 5);
assert('VORTEX-9 unlocked automatically at Level 5', IT.SaveManager.isMechUnlocked('vortex'));
assert('PLASMA LAUNCHER unlocked automatically at Level 4', IT.SaveManager.isWeaponUnlocked('plasmaLauncher'));

// ── TEST 4: Procedural 3D Weapon Models & Dynamic Mounting ──
console.log('\n4. Modular 3D Weapon Hardpoint Mounting:');
const mechRig = IT.MechBuilder3D.buildMech('vortex', {
  team: 'blue',
  primaryWeapon: 'plasmaLauncher',
  secondaryWeapon: 'missileRack'
});

assert('Mech rig has 2 weapon mounts', mechRig.weaponMounts && mechRig.weaponMounts.length === 2);
assert('Mech rig mounted Plasma Launcher in slot 0', mechRig.weapons[0].weaponId === 'plasmaLauncher');
assert('Mech rig mounted Missile Rack in slot 1', mechRig.weapons[1].weaponId === 'missileRack');
assert('Muzzle points dynamically positioned on weapons', mechRig.muzzlePoints[0].position.z > 1.5);

// Test dynamic weapon swapping
IT.MechBuilder3D.mountWeapons(mechRig, 'railSpear', 'arcRifle', { team: 'blue' });
assert('Dynamic weapon swap successfully attached Rail Spear to Slot 0', mechRig.weapons[0].weaponId === 'railSpear');
assert('Dynamic weapon swap successfully attached Arc Rifle to Slot 1', mechRig.weapons[1].weaponId === 'arcRifle');

// ── TEST 5: Mech3D Dynamic Weapon Swapping & Abilities ──
console.log('\n5. Mech3D In-Battle Integration & Unique Abilities:');
const battleMech = new IT.Mech3D({
  mechId: 'vortex',
  team: 'blue',
  isPlayer: true,
  primaryWeapon: 'plasmaLauncher',
  secondaryWeapon: 'scatterBlaster'
});

assert('Battle Mech loaded Vortex-9 role Scout', battleMech.role === 'Scout');
assert('Battle Mech initial primary weapon is Plasma Launcher', battleMech.primaryWeaponId === 'plasmaLauncher');

battleMech.equipWeapon(0, 'railSpear');
assert('equipWeapon(0, railSpear) swapped weapon model to Rail Spear', battleMech.primaryWeaponId === 'railSpear' && battleMech.rig.weapons[0].weaponId === 'railSpear');

// Ability test (Phase Dash for Vortex-9)
const abilityUsed = battleMech.useAbility();
assert('Phase Dash activated successfully and granted phased invulnerability', abilityUsed && battleMech.isInvulnerable);

// ── TEST 6: Combat3D Multi-Weapon Behaviors & AOE Detonation ──
console.log('\n6. Combat3D Weapon Behaviors & Plasma Launcher AOE:');
const fakeScene = new THREE.Group();
const combat = new IT.Combat3D(fakeScene, { position: new THREE.Vector3() });

// Create enemy group for AOE test
const enemyA = new IT.Mech3D({ mechId: 'ironclad', team: 'red' });
const enemyB = new IT.Mech3D({ mechId: 'striker', team: 'red' });
enemyA.position.set(0, 0, 10);
enemyB.position.set(4, 0, 10); // Within 8.5m AOE explosion radius!

const enemyAStartShield = enemyA.shield;
const enemyBStartShield = enemyB.shield;

// Fire Plasma Launcher orb at (0, 0, 10)
const plasmaOrb = new IT.Projectile3D(fakeScene, new THREE.Vector3(0, 2.5, 0), new THREE.Vector3(0, 2.5, 10), {
  sourceMech: battleMech,
  team: 'blue',
  type: 'PLASMA_ORB',
  damage: 110,
  speed: 80,
  explosionRadius: 8.5
});

let aoeHits = 0;
plasmaOrb.update(0.15, [], [enemyA, enemyB], (hitPoint, target, source, dmg, isAOE) => {
  if (isAOE) aoeHits++;
});

assert('Plasma Launcher orb detonated with AOE damage', aoeHits >= 2);
assert('Primary enemy took blast damage', enemyA.shield < enemyAStartShield);
assert('Adjacent enemy within 8.5m also took AOE splash damage', enemyB.shield < enemyBStartShield);

console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
process.exit(passed === total ? 0 : 1);
