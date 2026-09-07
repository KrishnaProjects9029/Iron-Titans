/**
 * Iron Titans 3D — MechBuilder3D.js
 * Generates 5 high-fidelity, original procedural 3D mechs with authentic military engineering details:
 * - Armor plates with beveled composite cowls
 * - Articulated mechanical joints and limb pivots
 * - Chrome hydraulic pistons and shock absorbers
 * - Rubber conduit cable harnesses and hydraulic hoses
 * - Heat dissipation gills and reactor exhaust vents
 * - Reflective optical sensor cockpits and visors
 * - Glowing team energy indicator strips (Cyan for Blue, Crimson for Red)
 * - Defined Weak Points (Rear Core 1.75x crit, Head Sensor 1.5x crit)
 *
 * Provides physical weapon hardpoints (leftMount, rightMount) for dynamic weapon attachment.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class MechBuilder3D {
    static buildMech(mechId, options = {}) {
      const id = (mechId || 'ironclad').toLowerCase();
      const team = options.team || (options.isEnemy ? 'red' : 'blue');
      const isRed = team === 'red';

      // Obtain physically-inspired PBR materials from MaterialSystem
      const materials = IT.MaterialSystem.createMechMaterialSet(team, options);

      // Maintain legacy property aliases for backward compatibility
      materials.matPrimary = materials.armor;
      materials.matSecondary = materials.armorAccent;
      materials.matFrame = materials.darkMetal;
      materials.matVisor = materials.visor;
      materials.matExhaust = materials.exhaust;

      let rig;
      switch (id) {
        case 'vortex':
          rig = MechBuilder3D._buildVortexChassis(materials, isRed);
          break;
        case 'bastion':
          rig = MechBuilder3D._buildBastionChassis(materials, isRed);
          break;
        case 'striker':
          rig = MechBuilder3D._buildStrikerChassis(materials, isRed);
          break;
        case 'nova':
          rig = MechBuilder3D._buildNovaChassis(materials, isRed);
          break;
        case 'ironclad':
        default:
          rig = MechBuilder3D._buildIroncladChassis(materials, isRed);
          break;
      }

      rig.materials = materials;
      rig.mechId = id;
      rig.team = team;

      // Mount initial weapons onto hardpoints
      const primaryWeapon = options.primaryWeapon || 'pulseCannon';
      const secondaryWeapon = options.secondaryWeapon || 'scatterBlaster';
      MechBuilder3D.mountWeapons(rig, primaryWeapon, secondaryWeapon, { team });

      return rig;
    }

    /**
     * Physically attaches weapons onto the mech's left and right hardpoints.
     */
    static mountWeapons(rig, primaryWeaponId, secondaryWeaponId, options = {}) {
      if (!rig || !rig.weaponMounts || rig.weaponMounts.length < 2) return;

      const team = options.team || rig.team || 'blue';

      // Detach any existing weapons
      rig.weaponMounts.forEach(mount => {
        while (mount.children.length > 0) {
          mount.remove(mount.children[0]);
        }
      });

      rig.weapons = [];
      rig.muzzlePoints = [];

      // Slot 0: Right mount (Primary Weapon)
      const primaryWep = IT.WeaponBuilder3D.buildWeapon(primaryWeaponId, { team });
      rig.weaponMounts[0].add(primaryWep.root);
      rig.weapons.push(primaryWep);
      rig.muzzlePoints.push(primaryWep.muzzlePoint);

      // Slot 1: Left mount (Secondary Weapon)
      const secondaryWep = IT.WeaponBuilder3D.buildWeapon(secondaryWeaponId, { team });
      rig.weaponMounts[1].add(secondaryWep.root);
      rig.weapons.push(secondaryWep);
      rig.muzzlePoints.push(secondaryWep.muzzlePoint);
    }

    // ── 1. IRONCLAD-X1 (Tank) ──
    static _buildIroncladChassis(m, isRed) {
      const root = new THREE.Group();
      const pelvisGroup = new THREE.Group();
      pelvisGroup.position.set(0, 2.6, 0);
      root.add(pelvisGroup);

      // Heavy reinforced pelvis
      const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.4), m.darkMetal);
      pelvisMesh.castShadow = true;
      pelvisGroup.add(pelvisMesh);

      // Rotary mechanical waist ring
      const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.35, 16), m.darkMetal);
      waist.position.set(0, 0.5, 0);
      pelvisGroup.add(waist);

      // Hydraulic waist stabilizer pistons
      [-0.6, 0.6].forEach(wx => {
        const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), m.hydraulic);
        piston.position.set(wx, 0.3, 0.4);
        pelvisGroup.add(piston);
      });

      // Torso Assembly
      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 0.6, 0);
      pelvisGroup.add(torsoGroup);

      // Armored composite chest core
      const chest = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 2.0), m.armor);
      chest.position.set(0, 0.95, 0);
      chest.castShadow = true;
      torsoGroup.add(chest);

      // Sloped front reactive armor breastplate
      const breastplate = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.2, 0.7), m.armorAccent);
      breastplate.position.set(0, 1.05, 1.0);
      breastplate.rotation.x = -Math.PI * 0.08;
      breastplate.castShadow = true;
      torsoGroup.add(breastplate);

      // Team Energy Trim Strips on Torso Flanks
      [-1.32, 1.32].forEach(tx => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.8), m.energy);
        strip.position.set(tx, 1.0, 0.1);
        torsoGroup.add(strip);
      });

      // Head / Cockpit Sensor Pod with Weak Point detection
      const headPod = new THREE.Group();
      headPod.position.set(0, 1.8, 0.3);
      torsoGroup.add(headPod);

      const headArmor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.8), m.armor);
      headPod.add(headArmor);

      // Sensor Visor (Weak Point: HEAD_SENSOR)
      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 0.3), m.visor);
      visor.position.set(0, 0.05, 0.4);
      visor.userData = { isWeakPoint: true, type: 'HEAD_SENSOR', multiplier: 1.5 };
      headPod.add(visor);

      // Rear Reactor Core Housing & Cooling Radiator
      const pack = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 0.85), m.darkMetal);
      pack.position.set(0, 1.1, -1.25);
      pack.castShadow = true;
      torsoGroup.add(pack);

      // Rear Reactor Core (Weak Point: REAR_CORE)
      const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), m.weakPointCore);
      coreMesh.rotation.x = Math.PI / 2;
      coreMesh.position.set(0, 1.1, -1.7);
      coreMesh.userData = { isWeakPoint: true, type: 'REAR_CORE', multiplier: 1.75 };
      torsoGroup.add(coreMesh);

      // Heat Dissipation Vent Gills
      [-0.6, 0.6].forEach(gx => {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.2), m.exhaust);
        vent.position.set(gx, 1.25, -1.7);
        torsoGroup.add(vent);
      });

      // Rubber Conduit Line linking reactor to torso
      const cable = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 6, 12, Math.PI), m.rubber);
      cable.rotation.y = Math.PI / 2;
      cable.position.set(0, 0.8, -1.0);
      torsoGroup.add(cable);

      // Arms & Weapon Hardpoints
      const arms = [];
      const weaponMounts = [];

      [-1, 1].forEach(side => {
        const armPivot = new THREE.Group();
        armPivot.position.set(side * 1.65, 1.3, 0);
        torsoGroup.add(armPivot);

        // Shoulder joint rotary assembly
        const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), m.darkMetal);
        armPivot.add(shoulderJoint);

        // Heavy shoulder pauldron with armor bevel and team light
        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.5), m.armor);
        pauldron.position.set(side * 0.18, 0.25, 0);
        pauldron.rotation.z = side * -Math.PI * 0.08;
        pauldron.castShadow = true;
        armPivot.add(pauldron);

        // Shoulder team energy beacon
        const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.9), m.energy);
        beacon.position.set(side * 0.7, 0.5, 0);
        armPivot.add(beacon);

        // Lower arm hydraulic strut
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.85, 8), m.hydraulic);
        strut.position.set(0, -0.5, 0);
        armPivot.add(strut);

        // Armored forearm cowl
        const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.8), m.armorAccent);
        forearm.position.set(0, -0.65, 0.2);
        armPivot.add(forearm);

        // Weapon hardpoint socket
        const mount = new THREE.Group();
        mount.position.set(0, -1.0, 0.4);
        armPivot.add(mount);

        arms.push(armPivot);
        weaponMounts.push(mount);
      });

      // Articulated Hydraulic Legs
      const legs = MechBuilder3D._buildStandardLegs(pelvisGroup, m, { hipWidth: 1.0, thighW: 0.75, footW: 0.95 });

      return { root, pelvisGroup, torsoGroup, arms, weaponMounts, legs };
    }

    // ── 2. VORTEX-9 (Scout) ──
    static _buildVortexChassis(m, isRed) {
      const root = new THREE.Group();
      const sc = 0.88;
      const pelvisGroup = new THREE.Group();
      pelvisGroup.position.set(0, 2.4 * sc, 0);
      pelvisGroup.scale.set(sc, sc, sc);
      root.add(pelvisGroup);

      // Lightweight carbon pelvis
      const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 1.1), m.darkMetal);
      pelvis.castShadow = true;
      pelvisGroup.add(pelvis);

      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 0.5, 0);
      pelvisGroup.add(torsoGroup);

      // Aerodynamic swept wedge chest
      const chestGeo = new THREE.ConeGeometry(1.2, 1.8, 4);
      const chest = new THREE.Mesh(chestGeo, m.armor);
      chest.rotation.y = Math.PI / 4;
      chest.position.set(0, 1.0, 0);
      chest.castShadow = true;
      torsoGroup.add(chest);

      // Raked stealth breastplate
      const bp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.5), m.armorAccent);
      bp.position.set(0, 1.1, 0.75);
      bp.rotation.x = -Math.PI * 0.15;
      torsoGroup.add(bp);

      // Aerodynamic Mono-Eye Sensor Visor (Weak Point: HEAD_SENSOR)
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.35), m.visor);
      visor.position.set(0, 1.45, 0.9);
      visor.userData = { isWeakPoint: true, type: 'HEAD_SENSOR', multiplier: 1.5 };
      torsoGroup.add(visor);

      // Twin swept dorsal winglet fins with team energy leading edges
      [-0.6, 0.6].forEach(fx => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.9), m.armorAccent);
        fin.position.set(fx, 1.6, -0.7);
        fin.rotation.x = -Math.PI * 0.2;
        fin.rotation.z = (fx > 0 ? 1 : -1) * -Math.PI * 0.12;
        fin.castShadow = true;
        torsoGroup.add(fin);

        const finStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.08), m.energy);
        finStrip.position.set(fx > 0 ? 0.07 : -0.07, 0, 0.4);
        fin.add(finStrip);
      });

      // High-thrust propulsion manifold (Weak Point: REAR_CORE)
      const thrusterCore = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.6, 10), m.weakPointCore);
      thrusterCore.rotation.x = Math.PI / 2;
      thrusterCore.position.set(0, 1.0, -0.85);
      thrusterCore.userData = { isWeakPoint: true, type: 'REAR_CORE', multiplier: 1.75 };
      torsoGroup.add(thrusterCore);

      // Lean Arms & Hardpoints
      const arms = [];
      const weaponMounts = [];

      [-1, 1].forEach(side => {
        const armPivot = new THREE.Group();
        armPivot.position.set(side * 1.35, 1.25, 0);
        torsoGroup.add(armPivot);

        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 1.1), m.armor);
        pauldron.position.set(side * 0.1, 0.15, 0);
        pauldron.castShadow = true;
        armPivot.add(pauldron);

        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.75, 8), m.lightMetal);
        strut.position.set(0, -0.45, 0);
        armPivot.add(strut);

        const mount = new THREE.Group();
        mount.position.set(0, -0.9, 0.4);
        armPivot.add(mount);

        arms.push(armPivot);
        weaponMounts.push(mount);
      });

      // Digitigrade Reverse-Joint Legs
      const legs = MechBuilder3D._buildDigitigradeLegs(pelvisGroup, m);

      return { root, pelvisGroup, torsoGroup, arms, weaponMounts, legs };
    }

    // ── 3. BASTION-R (Defender) ──
    static _buildBastionChassis(m, isRed) {
      const root = new THREE.Group();
      const sc = 1.22;
      const pelvisGroup = new THREE.Group();
      pelvisGroup.position.set(0, 2.7 * sc, 0);
      pelvisGroup.scale.set(sc, sc, sc);
      root.add(pelvisGroup);

      // Heavy octagonal fortress chassis base
      const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.9, 8), m.darkMetal);
      pelvis.castShadow = true;
      pelvisGroup.add(pelvis);

      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 0.65, 0);
      pelvisGroup.add(torsoGroup);

      // Colossal bunker torso
      const chest = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.9, 2.4), m.armor);
      chest.position.set(0, 1.0, 0);
      chest.castShadow = true;
      torsoGroup.add(chest);

      // Front reinforced mantlet shield collar
      const mantlet = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 0.8), m.armorAccent);
      mantlet.position.set(0, 1.1, 1.2);
      mantlet.rotation.x = -Math.PI * 0.05;
      mantlet.castShadow = true;
      torsoGroup.add(mantlet);

      // Reinforced slit visor (Weak Point: HEAD_SENSOR)
      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 0.5), m.visor);
      visor.position.set(0, 1.5, 1.35);
      visor.userData = { isWeakPoint: true, type: 'HEAD_SENSOR', multiplier: 1.5 };
      torsoGroup.add(visor);

      // Dorsal energy shield generator crown with glowing energy field
      const shieldPack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.6, 12), m.darkMetal);
      shieldPack.position.set(0, 2.2, -0.6);
      shieldPack.castShadow = true;
      torsoGroup.add(shieldPack);

      const generatorRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 20), m.energy);
      generatorRing.rotation.x = Math.PI / 2;
      generatorRing.position.set(0, 2.5, -0.6);
      torsoGroup.add(generatorRing);

      // Massive Rear Power Generator (Weak Point: REAR_CORE)
      const rearCore = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.6), m.weakPointCore);
      rearCore.position.set(0, 1.0, -1.45);
      rearCore.userData = { isWeakPoint: true, type: 'REAR_CORE', multiplier: 1.75 };
      torsoGroup.add(rearCore);

      // Heavy Arms & Hardpoints
      const arms = [];
      const weaponMounts = [];

      [-1, 1].forEach(side => {
        const armPivot = new THREE.Group();
        armPivot.position.set(side * 1.9, 1.3, 0);
        torsoGroup.add(armPivot);

        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 1.8), m.armor);
        pauldron.position.set(side * 0.2, 0.3, 0);
        pauldron.castShadow = true;
        armPivot.add(pauldron);

        // Hydraulic twin arm pistons
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), m.hydraulic);
        p1.position.set(-0.15, -0.5, 0);
        armPivot.add(p1);
        const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), m.hydraulic);
        p2.position.set(0.15, -0.5, 0);
        armPivot.add(p2);

        const mount = new THREE.Group();
        mount.position.set(0, -1.1, 0.5);
        armPivot.add(mount);

        arms.push(armPivot);
        weaponMounts.push(mount);
      });

      const legs = MechBuilder3D._buildStandardLegs(pelvisGroup, m, { hipWidth: 1.2, thighW: 0.95, footW: 1.2, hasOutriggers: true });

      return { root, pelvisGroup, torsoGroup, arms, weaponMounts, legs };
    }

    // ── 4. STRIKER-X (Assault) ──
    static _buildStrikerChassis(m, isRed) {
      const root = new THREE.Group();
      const sc = 1.05;
      const pelvisGroup = new THREE.Group();
      pelvisGroup.position.set(0, 2.6 * sc, 0);
      pelvisGroup.scale.set(sc, sc, sc);
      root.add(pelvisGroup);

      const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.2), m.darkMetal);
      pelvis.castShadow = true;
      pelvisGroup.add(pelvis);

      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 0.55, 0);
      pelvisGroup.add(torsoGroup);

      // Forward-leaning aggressive chevron chest
      const chest = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.6, 1.8), m.armor);
      chest.position.set(0, 0.95, 0);
      chest.castShadow = true;
      torsoGroup.add(chest);

      const breastplate = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 0.6), m.armorAccent);
      breastplate.position.set(0, 1.05, 0.95);
      breastplate.rotation.x = -Math.PI * 0.12;
      breastplate.castShadow = true;
      torsoGroup.add(breastplate);

      // Dual horizontal chevron visor (Weak Point: HEAD_SENSOR)
      const visor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.4), m.visor);
      visor.position.set(0, 1.42, 1.05);
      visor.userData = { isWeakPoint: true, type: 'HEAD_SENSOR', multiplier: 1.5 };
      torsoGroup.add(visor);

      // Twin vernier thrusters on backpack with afterburner flame glow
      [-0.6, 0.6].forEach(tx => {
        const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 1.4, 8), m.darkMetal);
        thruster.position.set(tx, 1.5, -1.1);
        thruster.rotation.x = -Math.PI * 0.15;
        torsoGroup.add(thruster);

        const flameCone = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.15, 8), m.exhaust);
        flameCone.position.set(tx, 2.1, -1.2);
        torsoGroup.add(flameCone);
      });

      // Spine Power Conduit Core (Weak Point: REAR_CORE)
      const spineCore = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.35), m.weakPointCore);
      spineCore.position.set(0, 0.95, -1.05);
      spineCore.userData = { isWeakPoint: true, type: 'REAR_CORE', multiplier: 1.75 };
      torsoGroup.add(spineCore);

      // Arms with angular pauldron cowls
      const arms = [];
      const weaponMounts = [];

      [-1, 1].forEach(side => {
        const armPivot = new THREE.Group();
        armPivot.position.set(side * 1.6, 1.3, 0);
        torsoGroup.add(armPivot);

        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.4), m.armor);
        pauldron.position.set(side * 0.15, 0.2, 0);
        pauldron.rotation.z = side * -Math.PI * 0.1;
        armPivot.add(pauldron);

        const mount = new THREE.Group();
        mount.position.set(0, -1.0, 0.5);
        armPivot.add(mount);

        arms.push(armPivot);
        weaponMounts.push(mount);
      });

      const legs = MechBuilder3D._buildStandardLegs(pelvisGroup, m, { hipWidth: 0.95, thighW: 0.72, footW: 0.9 });

      return { root, pelvisGroup, torsoGroup, arms, weaponMounts, legs };
    }

    // ── 5. NOVA-7 (Long Range) ──
    static _buildNovaChassis(m, isRed) {
      const root = new THREE.Group();
      const sc = 1.0;
      const pelvisGroup = new THREE.Group();
      pelvisGroup.position.set(0, 2.65 * sc, 0);
      root.add(pelvisGroup);

      const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.2), m.darkMetal);
      pelvis.castShadow = true;
      pelvisGroup.add(pelvis);

      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 0.55, 0);
      pelvisGroup.add(torsoGroup);

      // Slender sniper frame
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 1.6), m.armor);
      chest.position.set(0, 0.95, 0);
      chest.castShadow = true;
      torsoGroup.add(chest);

      // High dorsal targeting radar array fin
      const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.9), m.armorAccent);
      antenna.position.set(0, 2.2, 0.1);
      antenna.castShadow = true;
      torsoGroup.add(antenna);

      // Precision optical lens oculars (Weak Point: HEAD_SENSOR)
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8), m.visor);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 1.4, 0.95);
      lens.userData = { isWeakPoint: true, type: 'HEAD_SENSOR', multiplier: 1.5 };
      torsoGroup.add(lens);

      // Rear Coolant Housing (Weak Point: REAR_CORE)
      const coolantCore = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.4), m.weakPointCore);
      coolantCore.position.set(0, 1.0, -0.95);
      coolantCore.userData = { isWeakPoint: true, type: 'REAR_CORE', multiplier: 1.75 };
      torsoGroup.add(coolantCore);

      // Arms & Long-range Hardpoints
      const arms = [];
      const weaponMounts = [];

      [-1, 1].forEach(side => {
        const armPivot = new THREE.Group();
        armPivot.position.set(side * 1.45, 1.3, 0);
        torsoGroup.add(armPivot);

        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 1.3), m.armor);
        pauldron.position.set(side * 0.1, 0.2, 0);
        armPivot.add(pauldron);

        const mount = new THREE.Group();
        mount.position.set(0, -1.0, 0.45);
        armPivot.add(mount);

        arms.push(armPivot);
        weaponMounts.push(mount);
      });

      const legs = MechBuilder3D._buildStandardLegs(pelvisGroup, m, { hipWidth: 0.9, thighW: 0.65, footW: 0.85, hasSpades: true });

      return { root, pelvisGroup, torsoGroup, arms, weaponMounts, legs };
    }

    // ── Helper: Standard Bipedal Articulated Legs with Chrome Hydraulic Pistons ──
    static _buildStandardLegs(pelvisGroup, m, opts = {}) {
      const legs = [];
      const hipWidth = opts.hipWidth || 0.95;
      const thighW = opts.thighW || 0.7;
      const footW = opts.footW || 0.9;

      [-1, 1].forEach(side => {
        const hipPivot = new THREE.Group();
        hipPivot.position.set(side * hipWidth, -0.15, 0);
        pelvisGroup.add(hipPivot);

        // Spherical hip rotary joint
        const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), m.darkMetal);
        hipPivot.add(hipBall);

        const thighGroup = new THREE.Group();
        hipPivot.add(thighGroup);

        const thigh = new THREE.Mesh(new THREE.BoxGeometry(thighW, 1.3, 0.85), m.armor);
        thigh.position.set(0, -0.6, 0);
        thigh.castShadow = true;
        thighGroup.add(thigh);

        // Thigh hydraulic shock cylinder
        const thighPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 8), m.hydraulic);
        thighPiston.position.set(side * 0.1, -0.6, -0.45);
        thighGroup.add(thighPiston);

        const kneePivot = new THREE.Group();
        kneePivot.position.set(0, -1.25, 0.1);
        thighGroup.add(kneePivot);

        const kneeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, thighW, 8), m.darkMetal);
        kneeCap.rotation.z = Math.PI / 2;
        kneeCap.castShadow = true;
        kneePivot.add(kneeCap);

        const shinGroup = new THREE.Group();
        kneePivot.add(shinGroup);

        const shin = new THREE.Mesh(new THREE.BoxGeometry(thighW, 1.4, 0.9), m.armorAccent);
        shin.position.set(0, -0.7, -0.05);
        shin.castShadow = true;
        shinGroup.add(shin);

        // Shin armor plate and hydraulic assist
        const shinPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), m.lightMetal);
        shinPiston.position.set(0, -0.7, 0.45);
        shinGroup.add(shinPiston);

        const anklePivot = new THREE.Group();
        anklePivot.position.set(0, -1.35, 0);
        shinGroup.add(anklePivot);

        const foot = new THREE.Mesh(new THREE.BoxGeometry(footW, 0.35, 1.6), m.armor);
        foot.position.set(0, -0.18, 0.25);
        foot.castShadow = true;
        anklePivot.add(foot);

        // Optional Bastion stabilizing outriggers or Nova recoil anchor spades
        if (opts.hasOutriggers) {
          const outrigger = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), m.darkMetal);
          outrigger.position.set(side * 0.45, -0.2, -0.5);
          anklePivot.add(outrigger);
        } else if (opts.hasSpades) {
          const spade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.5), m.darkMetal);
          spade.position.set(0, -0.1, -0.8);
          anklePivot.add(spade);
        }

        legs.push({ hipPivot, thighGroup, kneePivot, shinGroup, anklePivot });
      });

      return legs;
    }

    // ── Helper: Digitigrade (Reverse-Joint) Raptor Legs for Vortex-9 ──
    static _buildDigitigradeLegs(pelvisGroup, m) {
      const legs = [];
      [-1, 1].forEach(side => {
        const hipPivot = new THREE.Group();
        hipPivot.position.set(side * 0.75, -0.1, 0);
        pelvisGroup.add(hipPivot);

        const thighGroup = new THREE.Group();
        hipPivot.add(thighGroup);

        // Forward angled thigh
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.2, 0.7), m.armor);
        thigh.position.set(0, -0.5, 0.2);
        thigh.rotation.x = Math.PI * 0.12;
        thighGroup.add(thigh);

        // Tension tendon cable
        const tendon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), m.rubber);
        tendon.position.set(0, -0.5, -0.25);
        thighGroup.add(tendon);

        const kneePivot = new THREE.Group();
        kneePivot.position.set(0, -1.1, 0.4);
        thighGroup.add(kneePivot);

        // Backward angled reverse shin
        const shinGroup = new THREE.Group();
        kneePivot.add(shinGroup);

        const shin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.65), m.armorAccent);
        shin.position.set(0, -0.6, -0.25);
        shin.rotation.x = -Math.PI * 0.2;
        shinGroup.add(shin);

        // Hydraulic strut bridging knee and ankle
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), m.hydraulic);
        strut.position.set(0, -0.6, 0.1);
        shinGroup.add(strut);

        const anklePivot = new THREE.Group();
        anklePivot.position.set(0, -1.2, -0.5);
        shinGroup.add(anklePivot);

        // Raptor claw foot
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 1.4), m.armor);
        foot.position.set(0, -0.14, 0.35);
        anklePivot.add(foot);

        legs.push({ hipPivot, thighGroup, kneePivot, shinGroup, anklePivot });
      });

      return legs;
    }

    // Backward compatibility helper
    static buildArchetype(archetypeKey, options = {}) {
      const mapping = {
        ASSAULT: 'ironclad',
        TANK: 'bastion',
        SCOUT: 'vortex',
        STRIKER: 'striker'
      };
      const mechId = mapping[(archetypeKey || '').toUpperCase()] || 'ironclad';
      return MechBuilder3D.buildMech(mechId, options);
    }
  }

  IT.MechBuilder3D = MechBuilder3D;
})(window.IT);
