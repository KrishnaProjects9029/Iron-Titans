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

    // ── 1. IRONCLAD-X1 (Authentic AAA Mech Arena Combat Walker) ──
    static _buildIroncladChassis(m, isRed) {
      const root = new THREE.Group();
      const whiteMat = m.whiteComposite || m.lightMetal;
      const blueArmMat = m.electricBlueArmor || m.armorAccent;
      const redGlow = m.crimsonGlow || m.energy;

      // ── Pelvis & Turntable Waist ──
      const pelvisGroup = new THREE.Group();
      pelvisGroup.position.set(0, 2.68, 0);
      root.add(pelvisGroup);

      // Heavy faceted pelvis frame
      const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.72, 1.25), m.darkMetal);
      pelvisMesh.castShadow = true;
      pelvisGroup.add(pelvisMesh);

      // Angled Groin Armor Shield
      const groinShield = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.68, 0.48), m.armor);
      groinShield.position.set(0, -0.12, 0.62);
      groinShield.rotation.x = -Math.PI * 0.12;
      groinShield.castShadow = true;
      pelvisGroup.add(groinShield);

      // Alpine White Groin Strike Chevron
      const groinChevron = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.12), whiteMat);
      groinChevron.position.set(0, -0.16, 0.88);
      groinChevron.rotation.x = -Math.PI * 0.12;
      pelvisGroup.add(groinChevron);

      // Rotary mechanical waist ring (two-tier turret hub)
      const waistUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.95, 0.28, 20), m.darkMetal);
      waistUpper.position.set(0, 0.45, 0);
      pelvisGroup.add(waistUpper);

      const waistLower = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.05, 0.18, 20), m.darkMetal);
      waistLower.position.set(0, 0.24, 0);
      pelvisGroup.add(waistLower);

      // Chrome waist hydraulic stabilizers
      [-0.68, 0.68].forEach(wx => {
        const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8), m.hydraulic);
        piston.position.set(wx, 0.32, 0.35);
        pelvisGroup.add(piston);
      });

      // Symmetrical Rotary Hip Hubs with Glowing Red Ring
      [-0.96, 0.96].forEach(hx => {
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.32, 16), m.darkMetal);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(hx, -0.1, 0.04);
        pelvisGroup.add(hub);

        const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 16), redGlow);
        hubRing.rotation.y = Math.PI / 2;
        hubRing.position.set(hx > 0 ? hx + 0.17 : hx - 0.17, -0.1, 0.04);
        pelvisGroup.add(hubRing);
      });

      // ── Torso Assembly (Hunched athletic stance) ──
      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, 0.55, 0);
      torsoGroup.rotation.x = 0.08; // Hunched aggressive forward lean
      pelvisGroup.add(torsoGroup);

      // Muscular forward-canted chest core
      const chestCore = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.65, 2.05), m.armor);
      chestCore.position.set(0, 0.95, 0);
      chestCore.castShadow = true;
      torsoGroup.add(chestCore);

      // High Armored Neck Collar / Cowl protecting head on flanks
      [-1.05, 1.05].forEach(cx => {
        const collarShield = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.85, 1.35), m.armor);
        collarShield.position.set(cx, 1.55, 0.25);
        collarShield.rotation.z = (cx > 0 ? 1 : -1) * -0.14;
        collarShield.rotation.y = (cx > 0 ? 1 : -1) * 0.10;
        collarShield.castShadow = true;
        torsoGroup.add(collarShield);

        // Alpine White Chamfered Collar Top Trim Plate
        const collarTrim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 1.15), whiteMat);
        collarTrim.position.set(cx > 0 ? cx + 0.14 : cx - 0.14, 1.75, 0.25);
        collarTrim.rotation.z = (cx > 0 ? 1 : -1) * -0.14;
        torsoGroup.add(collarTrim);
      });

      // Dual Symmetrical Angled Breastplates (Dark Gunmetal Hull Plates)
      [-0.66, 0.66].forEach(bx => {
        const bp = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.12, 0.48), m.armorAccent);
        bp.position.set(bx, 0.85, 0.88);
        bp.rotation.x = -0.24;
        bp.rotation.y = (bx > 0 ? 1 : -1) * -0.14;
        bp.castShadow = true;
        torsoGroup.add(bp);

        // Crisp White Composite Armor Trim on chest upper corners (accent line)
        const bpWhite = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.10), whiteMat);
        bpWhite.position.set(bx, 1.25, 1.02);
        bpWhite.rotation.x = -0.24;
        bpWhite.rotation.y = (bx > 0 ? 1 : -1) * -0.14;
        torsoGroup.add(bpWhite);
      });

      // Center Sternum Intake Grille with Glowing Crimson Slats
      const intakeFrame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.65, 0.18), m.darkMetal);
      intakeFrame.position.set(0, 0.68, 1.04);
      torsoGroup.add(intakeFrame);

      [-0.10, 0.10].forEach(sy => {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.08), redGlow);
        slat.position.set(0, 0.68 + sy, 1.14);
        torsoGroup.add(slat);
      });

      // ── Head & Signature Crimson Angular Visor Pod (Front Center Focus) ──
      const headPod = new THREE.Group();
      headPod.position.set(0, 1.20, 0.72);
      torsoGroup.add(headPod);

      // Angular Helmet Cowl
      const headBase = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.52, 0.95), m.armor);
      headPod.add(headBase);

      // Angled Forehead Brow Wedge
      const browWedge = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.30, 0.52), m.armorAccent);
      browWedge.position.set(0, 0.22, 0.26);
      browWedge.rotation.x = 0.25;
      headPod.add(browWedge);

      // Forehead Crest Plate in Alpine White Composite
      const browCrest = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.15, 0.44), whiteMat);
      browCrest.position.set(0, 0.32, 0.25);
      browCrest.rotation.x = 0.25;
      headPod.add(browCrest);

      // Bold Menacing Glowing Crimson Angular Visor (Center Slit + Winged Edges)
      const visorCenter = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.24), m.visor);
      visorCenter.position.set(0, 0.02, 0.52);
      visorCenter.userData = { isWeakPoint: true, type: 'HEAD_SENSOR', multiplier: 1.5 };
      headPod.add(visorCenter);

      [-0.50, 0.50].forEach(vx => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.15, 0.20), m.visor);
        wing.position.set(vx, 0.08, 0.46);
        wing.rotation.z = (vx > 0 ? -1 : 1) * 0.32;
        wing.userData = { isWeakPoint: true, type: 'HEAD_SENSOR', multiplier: 1.5 };
        headPod.add(wing);
      });

      // Dark Angular Chin / Jaw Plate
      const chin = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.50), m.darkMetal);
      chin.position.set(0, -0.22, 0.36);
      chin.rotation.x = -0.28;
      headPod.add(chin);

      // Symmetrical Cheek Armor Strike Plates
      [-0.66, 0.66].forEach(cx => {
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.44), whiteMat);
        cheek.position.set(cx, -0.04, 0.34);
        cheek.rotation.y = (cx > 0 ? 1 : -1) * 0.28;
        headPod.add(cheek);
      });

      // ── Rear Reactor Core Housing & Vernier Thrusters ──
      const pack = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.35, 0.88), m.darkMetal);
      pack.position.set(0, 1.1, -1.25);
      pack.castShadow = true;
      torsoGroup.add(pack);

      // Rear Reactor Core (Weak Point: REAR_CORE)
      const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.75, 16), m.weakPointCore);
      coreMesh.rotation.x = Math.PI / 2;
      coreMesh.position.set(0, 1.05, -1.72);
      coreMesh.userData = { isWeakPoint: true, type: 'REAR_CORE', multiplier: 1.75 };
      torsoGroup.add(coreMesh);

      // Twin Vernier Thrusters with glowing exhaust interior
      [-0.65, 0.65].forEach(tx => {
        const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.1, 12), m.darkMetal);
        thruster.position.set(tx, 1.38, -1.62);
        thruster.rotation.x = -0.22;
        thruster.castShadow = true;
        torsoGroup.add(thruster);

        const flameNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.16, 12), m.exhaust);
        flameNozzle.position.set(0, 0.52, 0);
        thruster.add(flameNozzle);
      });

      // Rubber Conduit Line linking reactor to torso spine
      const cable = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 16, Math.PI * 0.9), m.rubber);
      cable.rotation.y = Math.PI / 2;
      cable.position.set(0, 0.72, -1.02);
      torsoGroup.add(cable);

      // ── Arms & Massive Combat Gauntlet Weapon Pods (Raised Strike Stance) ──
      const arms = [];
      const weaponMounts = [];

      [-1, 1].forEach(side => {
        const armPivot = new THREE.Group();
        armPivot.position.set(side * 1.55, 1.25, 0.05);
        armPivot.rotation.z = side * -0.22; // Flared up and out
        armPivot.rotation.x = -0.26;       // Shoulders pulled back/up
        torsoGroup.add(armPivot);

        // Shoulder joint rotary ball
        const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), m.darkMetal);
        armPivot.add(shoulderJoint);

        // Shoulder to Torso Hydraulic Piston
        const shoulderPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), m.hydraulic);
        shoulderPiston.position.set(side * -0.22, 0.08, 0.08);
        armPivot.add(shoulderPiston);

        // Heavy Shoulder Pauldron
        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.12, 1.62), m.armor);
        pauldron.position.set(side * 0.22, 0.26, 0);
        pauldron.rotation.z = side * -Math.PI * 0.09;
        pauldron.castShadow = true;
        armPivot.add(pauldron);

        // Alpine White Chamfered Top Armor Plate on Pauldron
        const pauldronWhite = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 1.42), whiteMat);
        pauldronWhite.position.set(side * 0.26, 0.86, 0);
        pauldronWhite.rotation.z = side * -Math.PI * 0.09;
        armPivot.add(pauldronWhite);

        // Glowing Crimson Heat Vent Strip on Pauldron Outer Face
        const pauldronGlow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 1.08), redGlow);
        pauldronGlow.position.set(side * 0.84, 0.32, 0);
        armPivot.add(pauldronGlow);

        // Bicep Mechanical Framework & Chrome Pistons
        const bicep = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.52), m.darkMetal);
        bicep.position.set(0, -0.42, 0.06);
        armPivot.add(bicep);

        [-0.14, 0.14].forEach(px => {
          const bpPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 8), m.hydraulic);
          bpPiston.position.set(px, -0.42, -0.15);
          armPivot.add(bpPiston);
        });

        // Elbow Joint Hinge with Glowing Red Core Hub
        const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.58, 12), m.darkMetal);
        elbow.rotation.z = Math.PI / 2;
        elbow.position.set(0, -0.80, 0.12);
        armPivot.add(elbow);

        const elbowRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 14), redGlow);
        elbowRing.rotation.y = Math.PI / 2;
        elbowRing.position.set(side * 0.31, -0.80, 0.12);
        armPivot.add(elbowRing);

        // Forearm Group: Raised forward at 85° in ready-to-strike posture
        const forearmGroup = new THREE.Group();
        forearmGroup.position.set(0, -0.80, 0.16);
        forearmGroup.rotation.x = 1.48; // Bent forward 85°
        forearmGroup.rotation.y = side * -0.20; // Angled slightly inward toward center
        armPivot.add(forearmGroup);

        // Massive Heavy Combat Gauntlet Chassis
        const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.80, 1.55), m.armor);
        gauntlet.position.set(0, 0, 0.65);
        gauntlet.castShadow = true;
        forearmGroup.add(gauntlet);

        // Alpine White Composite Strike Shield on Top Forearm
        const gauntletWhite = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 1.30), whiteMat);
        gauntletWhite.position.set(0, 0.45, 0.65);
        forearmGroup.add(gauntletWhite);

        // Glowing Crimson Heat Channel along outer gauntlet flank
        const gauntletGlow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 1.15), redGlow);
        gauntletGlow.position.set(side * 0.45, 0.08, 0.68);
        forearmGroup.add(gauntletGlow);

        // Front Face Combat Fist & Dual Muzzle Bores
        const fistCap = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.76, 0.24), m.darkMetal);
        fistCap.position.set(0, 0, 1.46);
        forearmGroup.add(fistCap);

        // Dual Muzzle Ports
        [-0.18, 0.18].forEach(my => {
          const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 12), m.weaponMetal);
          bore.rotation.x = Math.PI / 2;
          bore.position.set(0, my, 1.56);
          forearmGroup.add(bore);

          const muzzleCore = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), m.darkMetal);
          muzzleCore.rotation.x = Math.PI / 2;
          muzzleCore.position.set(0, my, 1.57);
          forearmGroup.add(muzzleCore);
        });

        // Weapon Hardpoint Socket (mount sits flush atop the gauntlet)
        const mount = new THREE.Group();
        mount.position.set(0, 0.54, 0.70);
        forearmGroup.add(mount);

        arms.push(armPivot);
        weaponMounts.push(mount);
      });

      // ── Articulated Athletic Digitigrade Legs (Raptor Combat Stance) ──
      const legs = MechBuilder3D._buildDigitigradeLegs(pelvisGroup, m, {
        hipWidth: 1.05,
        thighW: 0.72,
        footW: 0.95
      });

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

    // ── Helper: Authentic AAA Digitigrade (Reverse-Joint) Raptor Legs ──
    static _buildDigitigradeLegs(pelvisGroup, m, opts = {}) {
      const legs = [];
      const hipWidth = opts.hipWidth || 0.95;
      const thighW = opts.thighW || 0.70;
      const footW = opts.footW || 0.92;
      const whiteMat = m.whiteComposite || m.lightMetal;
      const blueArmMat = m.electricBlueArmor || m.armorAccent;
      const redGlow = m.crimsonGlow || m.energy;

      [-1, 1].forEach(side => {
        const hipPivot = new THREE.Group();
        hipPivot.position.set(side * hipWidth, -0.12, 0.04);
        hipPivot.rotation.z = side * 0.14; // Spread wide in combat A-stance
        hipPivot.rotation.y = side * -0.06;
        pelvisGroup.add(hipPivot);

        // Spherical hip rotary ball joint
        const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), m.darkMetal);
        hipPivot.add(hipBall);

        const thighGroup = new THREE.Group();
        hipPivot.add(thighGroup);

        // Forward-canted Upper Thigh (angled forward ~24°)
        const thighAngle = Math.PI * 0.14;
        thighGroup.rotation.x = thighAngle;

        // Main Thigh Armor Housing
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(thighW, 1.32, 0.82), m.armor);
        thigh.position.set(0, -0.62, 0.05);
        thigh.castShadow = true;
        thighGroup.add(thigh);

        // Signature Glowing Crimson Curved Front Channel (from reference image)
        const thighGlow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.96, 0.12), redGlow);
        thighGlow.position.set(0, -0.60, 0.47);
        thighGroup.add(thighGlow);

        // Alpine White Composite Outer Flank Armor Chevron
        const thighWhite = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.68, 0.65), whiteMat);
        thighWhite.position.set(side * (thighW * 0.5 + 0.05), -0.52, 0.08);
        thighGroup.add(thighWhite);

        // Rear Chrome Hydraulic Shock Cylinder
        const thighPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.05, 8), m.hydraulic);
        thighPiston.position.set(0, -0.62, -0.42);
        thighGroup.add(thighPiston);

        // ── Reverse Knee Assembly ──
        const kneePivot = new THREE.Group();
        kneePivot.position.set(0, -1.28, 0.08);
        thighGroup.add(kneePivot);

        // Transverse Knee Pivot Cylinder Hub
        const kneeHub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, thighW + 0.08, 16), m.darkMetal);
        kneeHub.rotation.z = Math.PI / 2;
        kneeHub.castShadow = true;
        kneePivot.add(kneeHub);

        // Glowing Crimson Knee Hub Ring on outer face
        const kneeRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 18), redGlow);
        kneeRing.rotation.y = Math.PI / 2;
        kneeRing.position.set(side * (thighW * 0.5 + 0.07), 0, 0);
        kneePivot.add(kneeRing);

        // Forward-Jutting Angular Knee Armor Guard
        const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(thighW * 0.92, 0.62, 0.58), m.armor);
        kneeGuard.position.set(0, 0.12, 0.36);
        kneeGuard.rotation.x = -Math.PI * 0.14;
        kneeGuard.castShadow = true;
        kneePivot.add(kneeGuard);

        // Crisp Alpine White Knee Strike Cap
        const kneeWhite = new THREE.Mesh(new THREE.BoxGeometry(thighW * 0.72, 0.28, 0.18), whiteMat);
        kneeWhite.position.set(0, 0.18, 0.64);
        kneeWhite.rotation.x = -Math.PI * 0.14;
        kneePivot.add(kneeWhite);

        // ── Backward-Slanted Reverse Shin / Upper Calf ──
        const shinGroup = new THREE.Group();
        kneePivot.add(shinGroup);

        // Reverse angle: slanted backward ~48°
        const shinAngle = -Math.PI * 0.27;
        shinGroup.rotation.x = shinAngle;

        // Upper Calf Structural Pylon
        const shin = new THREE.Mesh(new THREE.BoxGeometry(thighW * 0.88, 1.40, 0.72), m.armorAccent);
        shin.position.set(0, -0.68, -0.06);
        shin.castShadow = true;
        shinGroup.add(shin);

        // Front Chrome Hydraulic Assist Piston Strut
        const shinPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.08, 8), m.hydraulic);
        shinPiston.position.set(0, -0.64, 0.36);
        shinGroup.add(shinPiston);

        // ── Lower Leg / Ankle Sleeve (Metallic Cobalt Blue) ──
        const anklePivot = new THREE.Group();
        anklePivot.position.set(0, -1.36, -0.08);
        shinGroup.add(anklePivot);

        // Counter-angle to restore foot horizontal orientation
        const ankleCounterAngle = -(thighAngle + shinAngle);
        anklePivot.rotation.x = ankleCounterAngle;
        anklePivot.rotation.z = side * -0.14; // Counter-roll to keep sole flat on platform

        // High-Specular Metallic Cobalt Blue Lower Shin Plating (from reference image)
        const blueSleeve = new THREE.Mesh(new THREE.BoxGeometry(thighW * 0.95, 0.88, 0.78), blueArmMat);
        blueSleeve.position.set(0, -0.38, 0.06);
        blueSleeve.castShadow = true;
        anklePivot.add(blueSleeve);

        // Alpine White Lower Shin Front Strike Chevron
        const blueWhite = new THREE.Mesh(new THREE.BoxGeometry(thighW * 0.65, 0.42, 0.14), whiteMat);
        blueWhite.position.set(0, -0.32, 0.46);
        anklePivot.add(blueWhite);

        // Lateral Ankle Hydraulic Actuators
        [-0.34, 0.34].forEach(ax => {
          const anklePiston = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), m.lightMetal);
          anklePiston.position.set(ax, -0.36, 0.04);
          anklePivot.add(anklePiston);
        });

        // ── Articulated Cybernetic Split-Claw Foot ──
        const footGroup = new THREE.Group();
        footGroup.position.set(0, -0.76, 0.08);
        anklePivot.add(footGroup);

        // Main Foot Chassis
        const footBase = new THREE.Mesh(new THREE.BoxGeometry(footW * 0.9, 0.30, 1.05), m.darkMetal);
        footBase.position.set(0, -0.15, 0.08);
        footBase.castShadow = true;
        footGroup.add(footBase);

        // Dual Split Front Claws / Mechanical Talons
        [-0.26, 0.26].forEach(tx => {
          const toe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.76), m.armor);
          toe.position.set(tx, -0.16, 0.74);
          toe.rotation.y = (tx > 0 ? 1 : -1) * 0.12;
          toe.castShadow = true;
          footGroup.add(toe);

          // Alpine White Toe Tip Cap
          const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.22), whiteMat);
          toeCap.position.set(tx > 0 ? tx + 0.04 : tx - 0.04, -0.14, 1.12);
          toeCap.rotation.y = (tx > 0 ? 1 : -1) * 0.12;
          footGroup.add(toeCap);
        });

        // Rear Heel Recoil Anchor Spur
        const heelSpur = new THREE.Mesh(new THREE.BoxGeometry(footW * 0.65, 0.26, 0.58), m.darkMetal);
        heelSpur.position.set(0, -0.15, -0.52);
        heelSpur.rotation.x = -Math.PI * 0.12;
        footGroup.add(heelSpur);

        // Rubber Traction Sole Pads
        const sole = new THREE.Mesh(new THREE.BoxGeometry(footW * 0.88, 0.08, 1.55), m.rubber);
        sole.position.set(0, -0.28, 0.22);
        footGroup.add(sole);

        legs.push({ hipPivot, thighGroup, kneePivot, shinGroup, anklePivot });
      });

      return legs;
    }

    static getArchetypeConfig(archetypeKey) {
      const key = (archetypeKey || '').toUpperCase();
      const configs = {
        ASSAULT: { role: 'Assault', hp: 500, speed: 16.0, damage: 45, scale: 1.0 },
        TANK: { role: 'Tank', hp: 850, speed: 11.5, damage: 40, scale: 1.25 },
        SCOUT: { role: 'Scout', hp: 350, speed: 22.5, damage: 32, scale: 0.85 },
        STRIKER: { role: 'Striker / Assassin', hp: 420, speed: 18.0, damage: 58, scale: 0.95 }
      };
      return configs[key] || configs.ASSAULT;
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
