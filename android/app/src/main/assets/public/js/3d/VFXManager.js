/**
 * Iron Titans 3D — VFXManager.js
 * Centralized Visual Effects and Particle Pooling System.
 *
 * Features:
 * - Object pooling for zero-allocation garbage collection during combat
 * - Muzzle Flashes tailored for all 6 weapons (geometry + bounded dynamic lights)
 * - Projectile Trails (sleek velocity ribbons and streak particles)
 * - Material-dependent Impact Effects (Armor sparks, Metal debris, Shield ripples)
 * - Shield Visuals (Hexagonal / spherical ripple, shield shatter shockwave)
 * - Multi-Stage Mech Destruction (sparks -> smoke -> reactor overload -> explosion -> debris)
 * - Dynamic Light Budgeting (strict concurrency caps for mobile performance)
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  // Reusable vector scratchpads
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();

  class VFXManager {
    constructor(scene) {
      this.scene = scene;

      // Active effects collections
      this.muzzleFlashes = [];
      this.sparks = [];
      this.smokePlumes = [];
      this.shieldRipples = [];
      this.explosions = [];
      this.debrisPieces = [];

      // Concurrency Limits for Mobile 60 FPS
      this.maxDynamicLights = 4;
      this.activeDynamicLights = [];

      // Graphics preset ('LOW', 'MEDIUM', 'HIGH', 'AUTO')
      this.graphicsPreset = 'HIGH';
      this.autoScaleFactor = 1.0;
      this.perfSampleTime = 0;
      this.perfFrameCount = 0;

      // Shared Geometries & Materials
      this._initSharedResources();

      // Initialize scene lights pool via PoolManager
      if (IT.PoolManager) {
        this.lightPool = IT.PoolManager.initSceneLights(this.scene, 4);
      }
    }

    setGraphicsPreset(preset) {
      this.graphicsPreset = preset || 'HIGH';
      if (preset === 'LOW') {
        this.maxDynamicLights = 0;
      } else if (preset === 'MEDIUM') {
        this.maxDynamicLights = 2;
      } else {
        this.maxDynamicLights = 4;
      }
    }

    _initSharedResources() {
      this.sparkGeo = new THREE.BufferGeometry();
      const sparkPositions = new Float32Array([0, 0, 0, 0, 0, 0.45]);
      this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));

      // Shared materials to prevent GPU shader thrashing
      this.sharedSparkMats = {
        blue: new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 1.0 }),
        red: new THREE.LineBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 1.0 }),
        crit: new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 1.0 }),
        metal: new THREE.LineBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 1.0 })
      };

      this.smokeGeo = new THREE.SphereGeometry(0.35, 6, 6);
      this.smokeMat = new THREE.MeshBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.55
      });

      this.debrisGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      this.debrisMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, metalness: 0.8, roughness: 0.5 });

      // Pre-allocated pools for high-frequency sparks and smoke
      this.sparkPool = [];
      for (let i = 0; i < 60; i++) {
        const line = new THREE.Line(this.sparkGeo, this.sharedSparkMats.metal);
        line.visible = false;
        this.scene.add(line);
        this.sparkPool.push(line);
      }

      this.smokePool = [];
      for (let i = 0; i < 30; i++) {
        const sm = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
        sm.visible = false;
        this.scene.add(sm);
        this.smokePool.push(sm);
      }
    }

    // ── DYNAMIC LIGHT BUDGETING (ZERO RUNTIME ALLOCATION) ──
    _requestDynamicLight(color, intensity, distance, duration) {
      if (this.maxDynamicLights <= 0) return null;
      if (this.lightPool) {
        return this.lightPool.acquire(color, intensity, distance, duration);
      }
      return null;
    }

    // ── 1. MUZZLE FLASHES ──
    spawnMuzzleFlash(position, direction, weaponType = 'PULSE', team = 'blue') {
      const isRed = team === 'red';
      const color = isRed ? 0xff4422 : 0x00f0ff;

      const flashGroup = new THREE.Group();
      flashGroup.position.copy(position);

      switch (weaponType) {
        case 'SCATTER': {
          // Cone of fiery blast rays
          for (let i = 0; i < 5; i++) {
            const rayGeo = new THREE.ConeGeometry(0.12, 0.7, 4);
            const rayMat = new THREE.MeshBasicMaterial({ color: isRed ? 0xff5500 : 0xffaa00 });
            const ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.set(
              (Math.random() - 0.5) * 0.2,
              (Math.random() - 0.5) * 0.2,
              0.3
            );
            ray.rotation.x = Math.PI / 2;
            flashGroup.add(ray);
          }
          this._requestDynamicLight(isRed ? 0xff4400 : 0xffaa00, 2.5, 9, 0.07);
          break;
        }

        case 'PLASMA_ORB': {
          // Large energetic plasma discharge sphere
          const orbGeo = new THREE.SphereGeometry(0.48, 8, 8);
          const orbMat = new THREE.MeshBasicMaterial({ color: 0x38ef7d });
          const orb = new THREE.Mesh(orbGeo, orbMat);
          flashGroup.add(orb);
          this._requestDynamicLight(0x38ef7d, 3.5, 14, 0.12);
          break;
        }

        case 'ARC_BEAM': {
          // Electric dielectric crackle spark
          const arcGeo = new THREE.RingGeometry(0.1, 0.35, 6);
          const arcMat = new THREE.MeshBasicMaterial({ color: 0xbb55ff, side: THREE.DoubleSide });
          const arc = new THREE.Mesh(arcGeo, arcMat);
          arc.rotation.y = Math.random() * Math.PI;
          flashGroup.add(arc);
          this._requestDynamicLight(0xaa44ff, 2.0, 8, 0.06);
          break;
        }

        case 'MISSILE': {
          // Smoke puff + backblast flame
          const flameGeo = new THREE.ConeGeometry(0.2, 0.9, 6);
          const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
          const flame = new THREE.Mesh(flameGeo, flameMat);
          flame.rotation.x = -Math.PI / 2;
          flame.position.z = -0.4;
          flashGroup.add(flame);
          this._requestDynamicLight(0xff5500, 2.2, 10, 0.08);
          break;
        }

        case 'RAIL_SPEAR': {
          // Focused high-energy ionization ring + linear spike
          const ringGeo = new THREE.TorusGeometry(0.35, 0.05, 6, 12);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          flashGroup.add(ring);
          this._requestDynamicLight(0x00f0ff, 4.0, 16, 0.09);
          break;
        }

        case 'PULSE':
        default: {
          // Coherent diamond flash
          const diaGeo = new THREE.OctahedronGeometry(0.32, 0);
          const diaMat = new THREE.MeshBasicMaterial({ color });
          const dia = new THREE.Mesh(diaGeo, diaMat);
          flashGroup.add(dia);
          this._requestDynamicLight(color, 2.0, 8, 0.06);
          break;
        }
      }

      this.scene.add(flashGroup);
      this.muzzleFlashes.push({ group: flashGroup, timer: 0.07, maxTime: 0.07 });
    }

    // ── 2. IMPACT EFFECTS (SPARKS & DEBRIS) ──
    spawnImpactSparks(position, normal, type = 'METAL', team = 'blue') {
      const isRed = team === 'red';
      const sparkMat = type === 'CRITICAL'
        ? this.sharedSparkMats.crit
        : (type === 'SHIELD' ? (isRed ? this.sharedSparkMats.red : this.sharedSparkMats.blue) : this.sharedSparkMats.metal);
      const sparkColor = type === 'CRITICAL'
        ? 0xffcc00
        : (type === 'SHIELD' ? (isRed ? 0xff4422 : 0x00f0ff) : 0xffaa33);

      let count = this.graphicsPreset === 'LOW' ? 3 : (type === 'CRITICAL' ? 12 : 7);
      if (this.graphicsPreset === 'AUTO') {
        count = Math.max(2, Math.round(count * this.autoScaleFactor));
      }

      for (let i = 0; i < count; i++) {
        let line = this.sparkPool.pop();
        if (!line) {
          line = new THREE.Line(this.sparkGeo, sparkMat);
          this.scene.add(line);
        } else {
          line.material = sparkMat;
        }
        line.visible = true;
        line.position.copy(position);

        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 8.0 + (normal ? normal.x * 4 : 0),
          Math.random() * 6.0 + 1.0 + (normal ? normal.y * 3 : 0),
          (Math.random() - 0.5) * 8.0 + (normal ? normal.z * 4 : 0)
        );

        this.sparks.push({ mesh: line, vel, timer: 0.28 + Math.random() * 0.15, maxTime: 0.4, isPooled: true });
      }

      if (this.maxDynamicLights > 0) {
        this._requestDynamicLight(sparkColor, 1.8, 6, 0.06);
      }
    }

    // ── 3. SHIELD RIPPLE EFFECT ──
    spawnShieldRipple(centerPos, impactPos, team = 'blue') {
      const isRed = team === 'red';
      const color = isRed ? 0xff3b30 : 0x00d8ff;

      const rippleGeo = new THREE.RingGeometry(0.3, 1.6, 12);
      const rippleMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      const ripple = new THREE.Mesh(rippleGeo, rippleMat);
      ripple.position.copy(impactPos);

      // Face towards impact direction from center
      _v1.subVectors(impactPos, centerPos).normalize();
      ripple.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _v1);

      this.scene.add(ripple);
      this.shieldRipples.push({ mesh: ripple, timer: 0.25, maxTime: 0.25, initialScale: 0.5 });
    }

    // ── 4. SHIELD BREAK SHOCKWAVE ──
    spawnShieldBreak(position, team = 'blue') {
      const isRed = team === 'red';
      const color = isRed ? 0xff2200 : 0x00f0ff;

      const sphereGeo = new THREE.SphereGeometry(2.8, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        wireframe: true
      });
      const shockwave = new THREE.Mesh(sphereGeo, sphereMat);
      shockwave.position.copy(position).add(new THREE.Vector3(0, 2.5, 0));

      this.scene.add(shockwave);
      this.shieldRipples.push({ mesh: shockwave, timer: 0.35, maxTime: 0.35, isBreak: true });
      this._requestDynamicLight(color, 4.0, 14, 0.18);
    }

    spawnShieldShatter(position, radius = 2.5, team = 'blue') {
      return this.spawnShieldBreak(position, team);
    }

    // ── 5. MECH DESTRUCTION EXPLOSION ──
    spawnDestructionExplosion(position, role = 'Tank') {
      const basePos = position.clone().add(new THREE.Vector3(0, 2.5, 0));

      // 1. Central blinding explosion core
      const coreGeo = new THREE.SphereGeometry(1.8, 12, 12);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.copy(basePos);
      this.scene.add(core);
      this.explosions.push({ mesh: core, timer: 0.3, maxTime: 0.3, maxScale: 3.5 });

      // 2. Dynamic light
      this._requestDynamicLight(0xff6600, 5.0, 24, 0.25);

      // 3. Smoke puffs using pool
      let smokeCount = this.graphicsPreset === 'LOW' ? 3 : 8;
      if (this.graphicsPreset === 'AUTO') {
        smokeCount = Math.max(2, Math.round(smokeCount * this.autoScaleFactor));
      }

      for (let i = 0; i < smokeCount; i++) {
        let m = this.smokePool.pop();
        if (!m) {
          m = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
          this.scene.add(m);
        }
        m.visible = true;
        m.position.copy(basePos).add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.0,
          (Math.random() - 0.5) * 1.5
        ));
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 4.0,
          Math.random() * 5.0 + 2.0,
          (Math.random() - 0.5) * 4.0
        );
        this.smokePlumes.push({ mesh: m, vel, timer: 0.9 + Math.random() * 0.4, maxTime: 1.3, isPooled: true });
      }

      // 4. Flying chassis debris pieces
      let debrisCount = this.graphicsPreset === 'LOW' ? 2 : 6;
      if (this.graphicsPreset === 'AUTO') {
        debrisCount = Math.max(1, Math.round(debrisCount * this.autoScaleFactor));
      }

      for (let i = 0; i < debrisCount; i++) {
        const deb = new THREE.Mesh(this.debrisGeo, this.debrisMat);
        deb.position.copy(basePos);
        const dVel = new THREE.Vector3(
          (Math.random() - 0.5) * 12.0,
          Math.random() * 10.0 + 4.0,
          (Math.random() - 0.5) * 12.0
        );
        const rotVel = new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
        this.scene.add(deb);
        this.debrisPieces.push({ mesh: deb, vel: dVel, rotVel, timer: 1.2, maxTime: 1.2 });
      }
    }

    spawnExplosion(position, scale = 1.0, role = 'Tank') {
      return this.spawnDestructionExplosion(position, role);
    }

    // ── MASTER UPDATE LOOP ──
    update(dt) {
      // Dynamic framerate sampling for AUTO preset
      if (this.graphicsPreset === 'AUTO') {
        this.perfSampleTime += dt;
        this.perfFrameCount++;
        if (this.perfSampleTime >= 1.0) {
          const fps = this.perfFrameCount / this.perfSampleTime;
          if (fps < 45) {
            this.autoScaleFactor = Math.max(0.4, this.autoScaleFactor - 0.15);
          } else if (fps > 55) {
            this.autoScaleFactor = Math.min(1.0, this.autoScaleFactor + 0.1);
          }
          this.perfSampleTime = 0;
          this.perfFrameCount = 0;
        }
      }

      // 1. Muzzle Flashes
      for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
        const f = this.muzzleFlashes[i];
        f.timer -= dt;
        const progress = 1.0 - (f.timer / f.maxTime);
        f.group.scale.setScalar(1.0 + progress * 0.4);
        if (f.timer <= 0) {
          this.scene.remove(f.group);
          this.muzzleFlashes.splice(i, 1);
        }
      }

      // 2. Sparks
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.timer -= dt;
        s.vel.y -= 18.0 * dt; // Gravity
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.material.opacity = Math.max(0, s.timer / s.maxTime);
        if (s.timer <= 0 || s.mesh.position.y < 0) {
          s.mesh.visible = false;
          if (s.isPooled) {
            this.sparkPool.push(s.mesh);
          } else {
            this.scene.remove(s.mesh);
            s.mesh.material.dispose();
          }
          this.sparks.splice(i, 1);
        }
      }

      // 3. Shield Ripples
      for (let i = this.shieldRipples.length - 1; i >= 0; i--) {
        const r = this.shieldRipples[i];
        r.timer -= dt;
        const p = 1.0 - (r.timer / r.maxTime);
        const s = r.isBreak ? 1.0 + p * 1.8 : 0.5 + p * 1.5;
        r.mesh.scale.setScalar(s);
        r.mesh.material.opacity = Math.max(0, (r.timer / r.maxTime) * 0.85);
        if (r.timer <= 0) {
          this.scene.remove(r.mesh);
          r.mesh.material.dispose();
          this.shieldRipples.splice(i, 1);
        }
      }

      // 4. Explosions
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const e = this.explosions[i];
        e.timer -= dt;
        const p = 1.0 - (e.timer / e.maxTime);
        e.mesh.scale.setScalar(1.0 + p * e.maxScale);
        if (e.timer <= 0) {
          this.scene.remove(e.mesh);
          this.explosions.splice(i, 1);
        }
      }

      // 5. Smoke Plumes
      for (let i = this.smokePlumes.length - 1; i >= 0; i--) {
        const sm = this.smokePlumes[i];
        sm.timer -= dt;
        sm.vel.multiplyScalar(0.96);
        sm.mesh.position.addScaledVector(sm.vel, dt);
        const p = 1.0 - (sm.timer / sm.maxTime);
        sm.mesh.scale.setScalar(1.0 + p * 2.2);
        sm.mesh.material.opacity = Math.max(0, (sm.timer / sm.maxTime) * 0.55);
        if (sm.timer <= 0) {
          sm.mesh.visible = false;
          if (sm.isPooled) {
            this.smokePool.push(sm.mesh);
          } else {
            this.scene.remove(sm.mesh);
            sm.mesh.material.dispose();
          }
          this.smokePlumes.splice(i, 1);
        }
      }

      // 6. Debris Pieces
      for (let i = this.debrisPieces.length - 1; i >= 0; i--) {
        const d = this.debrisPieces[i];
        d.timer -= dt;
        d.vel.y -= 22.0 * dt; // Gravity
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.rotation.x += d.rotVel.x * dt;
        d.mesh.rotation.y += d.rotVel.y * dt;

        // Floor bounce
        if (d.mesh.position.y < 0.1) {
          d.mesh.position.y = 0.1;
          d.vel.y = -d.vel.y * 0.4;
          d.vel.x *= 0.7;
          d.vel.z *= 0.7;
        }

        if (d.timer <= 0) {
          this.scene.remove(d.mesh);
          this.debrisPieces.splice(i, 1);
        }
      }

      // 7. Dynamic Lights via Scene Light Pool
      if (this.lightPool) {
        this.lightPool.update(dt);
      }
    }

    destroy() {
      for (const f of this.muzzleFlashes) {
        if (f.group && f.group.parent) f.group.parent.remove(f.group);
      }
      this.muzzleFlashes.length = 0;

      for (const s of this.sparks) {
        if (s.mesh && s.mesh.parent) s.mesh.parent.remove(s.mesh);
      }
      this.sparks.length = 0;

      for (const p of this.sparkPool) {
        if (p && p.parent) p.parent.remove(p);
      }
      this.sparkPool.length = 0;

      for (const sm of this.smokePlumes) {
        if (sm.mesh && sm.mesh.parent) sm.mesh.parent.remove(sm.mesh);
      }
      this.smokePlumes.length = 0;

      for (const sm of this.smokePool) {
        if (sm && sm.parent) sm.parent.remove(sm);
      }
      this.smokePool.length = 0;

      for (const r of this.shieldRipples) {
        if (r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh);
      }
      this.shieldRipples.length = 0;

      for (const e of this.explosions) {
        if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
      }
      this.explosions.length = 0;

      for (const d of this.debrisPieces) {
        if (d.mesh && d.mesh.parent) d.mesh.parent.remove(d.mesh);
      }
      this.debrisPieces.length = 0;

      if (this.lightPool) {
        this.lightPool.clear();
        this.lightPool = null;
      }
    }
  }

  IT.VFXManager = VFXManager;
})(window.IT);
