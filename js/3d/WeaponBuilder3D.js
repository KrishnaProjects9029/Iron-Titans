/**
 * Iron Titans 3D — WeaponBuilder3D.js
 * Generates original, engineered 3D models for all 6 weapons with moving mechanical components:
 * 1. PULSE CANNON: Dual vented barrels with cyan heat-sink fins, rotary drum, sliding recoil sleeve.
 * 2. SCATTER BLASTER: Heavy flared blunderbuss muzzle with orange cooling vents and breech ejection port.
 * 3. PLASMA LAUNCHER: Bulbous electromagnetic coil drum with glowing plasma chamber and containment rings.
 * 4. ARC RIFLE: Twin dielectric conductive prongs with high-voltage capacitor tube and focusing tips.
 * 5. MISSILE RACK: 4-pod honeycomb launcher with armed warheads and rear exhaust blast ports.
 * 6. RAIL SPEAR: Hyper-velocity linear magnetic rails with 4 staged flux acceleration rings.
 *
 * Fully integrated with MaterialSystem for PBR metals, chrome pistons, and energy conduits.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class WeaponBuilder3D {
    static buildWeapon(weaponId, options = {}) {
      const id = (weaponId || 'pulseCannon').toLowerCase();
      const team = options.team || 'blue';
      const isRed = team === 'red';

      // Obtain physically-inspired materials from MaterialSystem
      const mats = IT.MaterialSystem.createWeaponMaterialSet(team);

      switch (id) {
        case 'scatterblaster':
        case 'scatter_blaster':
          return WeaponBuilder3D._buildScatterBlaster(mats, isRed);

        case 'plasmalauncher':
        case 'plasma_launcher':
          return WeaponBuilder3D._buildPlasmaLauncher(mats, isRed);

        case 'arcrifle':
        case 'arc_rifle':
          return WeaponBuilder3D._buildArcRifle(mats, isRed);

        case 'missilerack':
        case 'missile_rack':
          return WeaponBuilder3D._buildMissileRack(mats, isRed);

        case 'railspear':
        case 'rail_spear':
          return WeaponBuilder3D._buildRailSpear(mats, isRed);

        case 'pulsecannon':
        case 'pulse_cannon':
        default:
          return WeaponBuilder3D._buildPulseCannon(mats, isRed);
      }
    }

    // ── 1. PULSE CANNON ──
    static _buildPulseCannon(m, isRed) {
      const root = new THREE.Group();
      root.name = 'Weapon_PulseCannon';

      // Receiver body
      const recGeo = new THREE.BoxGeometry(0.5, 0.6, 1.4);
      const receiver = new THREE.Mesh(recGeo, m.receiver);
      receiver.castShadow = true;
      root.add(receiver);

      // Rotary magazine drum with chrome locking rim
      const drumGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.35, 12);
      const drum = new THREE.Mesh(drumGeo, m.barrel);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(0.3, 0.1, -0.15);
      root.add(drum);

      const drumRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 12), m.chrome);
      drumRing.position.set(0.3, 0.1, -0.15);
      drumRing.rotation.y = Math.PI / 2;
      root.add(drumRing);

      // Energy conduit line on weapon spine
      const spineConduit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), m.energyConduit);
      spineConduit.position.set(0, 0.34, 0);
      root.add(spineConduit);

      // Sliding recoil barrel assembly
      const barrelGroup = new THREE.Group();
      root.add(barrelGroup);

      [-0.13, 0.13].forEach(bx => {
        const barrelGeo = new THREE.CylinderGeometry(0.08, 0.085, 1.6, 8);
        const barrel = new THREE.Mesh(barrelGeo, m.barrel);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(bx, 0, 0.9);
        barrel.castShadow = true;
        barrelGroup.add(barrel);

        // Chrome recoil guide collar
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.25, 8), m.chrome);
        collar.rotation.x = Math.PI / 2;
        collar.position.set(bx, 0, 0.25);
        barrelGroup.add(collar);

        // Muzzle glow aperture
        const muzzleGlowGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.05, 8);
        const muzzleGlow = new THREE.Mesh(muzzleGlowGeo, m.energyConduit);
        muzzleGlow.rotation.x = Math.PI / 2;
        muzzleGlow.position.set(bx, 0, 1.72);
        barrelGroup.add(muzzleGlow);
      });

      const muzzlePoint = new THREE.Object3D();
      muzzlePoint.position.set(0, 0, 1.85);
      root.add(muzzlePoint);

      return { root, barrelGroup, muzzlePoint, weaponId: 'pulseCannon', materials: m };
    }

    // ── 2. SCATTER BLASTER ──
    static _buildScatterBlaster(m, isRed) {
      const root = new THREE.Group();
      root.name = 'Weapon_ScatterBlaster';

      // Heavy wide receiver
      const recGeo = new THREE.BoxGeometry(0.65, 0.75, 1.2);
      const receiver = new THREE.Mesh(recGeo, m.receiver);
      receiver.castShadow = true;
      root.add(receiver);

      // Top-mounted shell ejection shroud
      const shroudGeo = new THREE.BoxGeometry(0.45, 0.3, 0.7);
      const shroud = new THREE.Mesh(shroudGeo, m.chrome);
      shroud.position.set(0, 0.4, -0.1);
      root.add(shroud);

      // Flared heavy blunderbuss barrel
      const barrelGroup = new THREE.Group();
      root.add(barrelGroup);

      const flareGeo = new THREE.CylinderGeometry(0.24, 0.13, 1.2, 8);
      const flare = new THREE.Mesh(flareGeo, m.barrel);
      flare.rotation.x = Math.PI / 2;
      flare.position.set(0, 0, 0.75);
      flare.castShadow = true;
      barrelGroup.add(flare);

      // Lateral heat-sink vents that glow orange under heat
      [-0.18, 0.18].forEach(vx => {
        const ventGeo = new THREE.BoxGeometry(0.08, 0.25, 0.8);
        const vent = new THREE.Mesh(ventGeo, m.heatCoil);
        vent.position.set(vx, 0.05, 0.7);
        barrelGroup.add(vent);
      });

      const muzzlePoint = new THREE.Object3D();
      muzzlePoint.position.set(0, 0, 1.55);
      root.add(muzzlePoint);

      return { root, barrelGroup, muzzlePoint, weaponId: 'scatterBlaster', materials: m };
    }

    // ── 3. PLASMA LAUNCHER ──
    static _buildPlasmaLauncher(m, isRed) {
      const root = new THREE.Group();
      root.name = 'Weapon_PlasmaLauncher';

      const matPlasma = new THREE.MeshStandardMaterial({
        color: 0x082012,
        emissive: 0x38ef7d,
        emissiveIntensity: 2.6,
        roughness: 0.1,
        metalness: 0.5
      });

      // Massive cylindrical magnetic coil receiver
      const drumGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.1, 16);
      const drum = new THREE.Mesh(drumGeo, m.receiver);
      drum.rotation.x = Math.PI / 2;
      drum.castShadow = true;
      root.add(drum);

      // Glowing plasma core window
      const coreGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.35, 16);
      const core = new THREE.Mesh(coreGeo, matPlasma);
      core.rotation.x = Math.PI / 2;
      core.position.set(0, 0, -0.1);
      root.add(core);

      // Electromagnetic muzzle barrel
      const barrelGroup = new THREE.Group();
      root.add(barrelGroup);

      const barrelGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.0, 12);
      const barrel = new THREE.Mesh(barrelGeo, m.barrel);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0, 0.85);
      barrel.castShadow = true;
      barrelGroup.add(barrel);

      // Front electromagnetic emitter ring
      const ringGeo = new THREE.TorusGeometry(0.26, 0.05, 8, 16);
      const ring = new THREE.Mesh(ringGeo, matPlasma);
      ring.position.set(0, 0, 1.35);
      barrelGroup.add(ring);

      const muzzlePoint = new THREE.Object3D();
      muzzlePoint.position.set(0, 0, 1.65);
      root.add(muzzlePoint);

      return { root, barrelGroup, muzzlePoint, weaponId: 'plasmaLauncher', materials: m };
    }

    // ── 4. ARC RIFLE ──
    static _buildArcRifle(m, isRed) {
      const root = new THREE.Group();
      root.name = 'Weapon_ArcRifle';

      const matArc = new THREE.MeshStandardMaterial({
        color: 0x140520,
        emissive: 0x9d4edd,
        emissiveIntensity: 2.8,
        roughness: 0.1,
        metalness: 0.8
      });

      // Long slender receiver
      const recGeo = new THREE.BoxGeometry(0.4, 0.55, 1.6);
      const receiver = new THREE.Mesh(recGeo, m.receiver);
      receiver.castShadow = true;
      root.add(receiver);

      // Vacuum arc capacitor tube
      const tubeGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12);
      const tube = new THREE.Mesh(tubeGeo, matArc);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 0.2, 0.2);
      root.add(tube);

      // Twin dielectric prongs
      const barrelGroup = new THREE.Group();
      root.add(barrelGroup);

      [-0.14, 0.14].forEach(px => {
        const prongGeo = new THREE.BoxGeometry(0.06, 0.18, 1.4);
        const prong = new THREE.Mesh(prongGeo, m.barrel);
        prong.position.set(px, 0, 1.25);
        prong.castShadow = true;
        barrelGroup.add(prong);

        const tipGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8);
        const tip = new THREE.Mesh(tipGeo, matArc);
        tip.position.set(px, 0, 1.95);
        tip.rotation.x = Math.PI / 2;
        barrelGroup.add(tip);
      });

      const muzzlePoint = new THREE.Object3D();
      muzzlePoint.position.set(0, 0, 2.05);
      root.add(muzzlePoint);

      return { root, barrelGroup, muzzlePoint, weaponId: 'arcRifle', materials: m };
    }

    // ── 5. MISSILE RACK ──
    static _buildMissileRack(m, isRed) {
      const root = new THREE.Group();
      root.name = 'Weapon_MissileRack';

      const matWarhead = new THREE.MeshStandardMaterial({
        color: 0xff3b30,
        emissive: 0xaa1111,
        emissiveIntensity: 0.8,
        roughness: 0.3
      });

      // Honeycomb 4-missile launcher box
      const boxGeo = new THREE.BoxGeometry(0.85, 0.75, 1.3);
      const box = new THREE.Mesh(boxGeo, m.receiver);
      box.castShadow = true;
      root.add(box);

      const barrelGroup = new THREE.Group();
      root.add(barrelGroup);

      // 4 missile launch tubes (2x2 grid)
      const offsets = [
        { x: -0.22, y: 0.18 },
        { x: 0.22, y: 0.18 },
        { x: -0.22, y: -0.18 },
        { x: 0.22, y: -0.18 }
      ];

      offsets.forEach(pos => {
        // Hollow tube rim
        const rimGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
        const rim = new THREE.Mesh(rimGeo, m.barrel);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(pos.x, pos.y, 0.68);
        barrelGroup.add(rim);

        // Rocket nosecone visible inside tube
        const noseGeo = new THREE.ConeGeometry(0.09, 0.22, 8);
        const nose = new THREE.Mesh(noseGeo, matWarhead);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(pos.x, pos.y, 0.62);
        barrelGroup.add(nose);
      });

      const muzzlePoint = new THREE.Object3D();
      muzzlePoint.position.set(0, 0, 1.4);
      root.add(muzzlePoint);

      return { root, barrelGroup, muzzlePoint, weaponId: 'missileRack', materials: m };
    }

    // ── 6. RAIL SPEAR ──
    static _buildRailSpear(m, isRed) {
      const root = new THREE.Group();
      root.name = 'Weapon_RailSpear';

      // Heavy rear housing
      const housingGeo = new THREE.BoxGeometry(0.5, 0.65, 1.5);
      const housing = new THREE.Mesh(housingGeo, m.receiver);
      housing.castShadow = true;
      root.add(housing);

      // Extra-long linear magnetic accelerator rails
      const barrelGroup = new THREE.Group();
      root.add(barrelGroup);

      [-0.11, 0.11].forEach(rx => {
        const railGeo = new THREE.BoxGeometry(0.08, 0.16, 2.4);
        const rail = new THREE.Mesh(railGeo, m.barrel);
        rail.position.set(rx, 0, 1.4);
        rail.castShadow = true;
        barrelGroup.add(rail);
      });

      // 4 electromagnetic coil accelerator bands along the rails
      [0.6, 1.1, 1.6, 2.1].forEach(bz => {
        const bandGeo = new THREE.BoxGeometry(0.36, 0.26, 0.14);
        const band = new THREE.Mesh(bandGeo, m.energyConduit);
        band.position.set(0, 0, bz);
        barrelGroup.add(band);
      });

      const muzzlePoint = new THREE.Object3D();
      muzzlePoint.position.set(0, 0, 2.75);
      root.add(muzzlePoint);

      return { root, barrelGroup, muzzlePoint, weaponId: 'railSpear', materials: m };
    }
  }

  IT.WeaponBuilder3D = WeaponBuilder3D;
})(window.IT);
