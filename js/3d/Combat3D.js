/**
 * Iron Titans 3D — Combat3D.js
 * Advanced 3D Combat Engine implementing 6 distinct weapon behaviors:
 * 1. PULSE CANNON: Fast coherent plasma bolts with cyan streaks
 * 2. SCATTER BLASTER: 7-pellet spread kinetic burst with dynamic flash
 * 3. PLASMA LAUNCHER: Heavy slow plasma orb with 8.5m AOE area detonation
 * 4. ARC RIFLE: Continuous high-voltage electric beam with instant tick damage
 * 5. MISSILE RACK: Salvo of 4 micro-missiles with steering / homing mechanics
 * 6. RAIL SPEAR: Hyper-velocity depleted uranium sabot with armor piercing
 *
 * Full Phase 6 Integration:
 * - Weapon Muzzle Flashes & Dynamic Point Lighting
 * - Procedural Audio Dispatch for all weapons, hits, and abilities
 * - Weak Point Strike Detection (Rear Core 1.75x, Head Sensor 1.5x)
 * - Projectile Velocity Ribbon Trails
 * - Central Hit Marker feedback (Normal, Crit, Elimination)
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  // ── Reusable Scratch Vectors & Raycaster for Zero-Allocation Physics ──
  const _scratchStep = new THREE.Vector3();
  const _scratchPrevPos = new THREE.Vector3();
  const _scratchDir = new THREE.Vector3();
  const _scratchToTarget = new THREE.Vector3();
  const _scratchImpact = new THREE.Vector3();
  const _sharedRaycaster = new THREE.Raycaster();

  // ── Shared Projectile Geometries & Materials ──
  let _sharedGeos = null;
  let _sharedMats = null;

  function getSharedGeos() {
    if (!_sharedGeos) {
      _sharedGeos = {
        pulse: new THREE.CylinderGeometry(0.11, 0.11, 1.8, 6),
        scatter: new THREE.SphereGeometry(0.12, 5, 5),
        plasmaOrb: new THREE.SphereGeometry(0.42, 8, 8),
        plasmaCore: new THREE.SphereGeometry(0.22, 6, 6),
        missileBody: new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6),
        missileNose: new THREE.ConeGeometry(0.1, 0.25, 6),
        railSpear: new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6)
      };
    }
    return _sharedGeos;
  }

  function getSharedMats() {
    if (!_sharedMats) {
      _sharedMats = {
        pulseBlue: new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
        pulseRed: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
        scatterBlue: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
        scatterRed: new THREE.MeshBasicMaterial({ color: 0xff4400 }),
        plasmaGreen: new THREE.MeshBasicMaterial({ color: 0x38ef7d }),
        plasmaCore: new THREE.MeshBasicMaterial({ color: 0xffffff }),
        missileBody: new THREE.MeshStandardMaterial({ color: 0x222a36, metalness: 0.8 }),
        missileNoseBlue: new THREE.MeshBasicMaterial({ color: 0xff4422 }),
        missileNoseRed: new THREE.MeshBasicMaterial({ color: 0xff2200 }),
        railBlue: new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
        railRed: new THREE.MeshBasicMaterial({ color: 0xff2222 }),
        trailPulse: new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 }),
        trailPulseRed: new THREE.LineBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.75 }),
        trailScatter: new THREE.LineBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.75 }),
        trailPlasma: new THREE.LineBasicMaterial({ color: 0x38ef7d, transparent: true, opacity: 0.75 }),
        trailRail: new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 })
      };
    }
    return _sharedMats;
  }

  // ── Unified Projectile Entity with Sleek Velocity Ribbon Trails ──
  class Projectile3D {
    constructor(scene, type = 'PULSE') {
      this.scene = scene;
      this.type = type;
      this.sourceMech = null;
      this.team = 'blue';
      this.damage = 45;
      this.speed = 135.0;
      this.range = 160.0;
      this.explosionRadius = 0;
      this.targetMech = null;
      this.distTraveled = 0;
      this.isAlive = false;
      this.lifeTime = 0;
      this.velocity = new THREE.Vector3();

      const geos = getSharedGeos();
      const mats = getSharedMats();

      // ── Build 3D Mesh per Weapon Type ──
      this.mesh = new THREE.Group();
      this.mesh.visible = false;

      switch (this.type) {
        case 'SCATTER': {
          this.bodyMesh = new THREE.Mesh(geos.scatter, mats.scatterBlue);
          this.mesh.add(this.bodyMesh);
          break;
        }

        case 'PLASMA_ORB': {
          this.bodyMesh = new THREE.Mesh(geos.plasmaOrb, mats.plasmaGreen);
          this.coreMesh = new THREE.Mesh(geos.plasmaCore, mats.plasmaCore);
          this.mesh.add(this.bodyMesh);
          this.mesh.add(this.coreMesh);
          break;
        }

        case 'MISSILE': {
          this.bodyMesh = new THREE.Mesh(geos.missileBody, mats.missileBody);
          this.bodyMesh.rotation.x = Math.PI / 2;
          this.mesh.add(this.bodyMesh);

          this.noseMesh = new THREE.Mesh(geos.missileNose, mats.missileNoseBlue);
          this.noseMesh.rotation.x = Math.PI / 2;
          this.noseMesh.position.set(0, 0, 0.5);
          this.mesh.add(this.noseMesh);
          break;
        }

        case 'RAIL_SPEAR': {
          this.bodyMesh = new THREE.Mesh(geos.railSpear, mats.railBlue);
          this.mesh.add(this.bodyMesh);
          break;
        }

        case 'PULSE':
        default: {
          this.bodyMesh = new THREE.Mesh(geos.pulse, mats.pulseBlue);
          this.mesh.add(this.bodyMesh);
          break;
        }
      }

      // ── Velocity Ribbon Trail ──
      const trailPositions = new Float32Array(6);
      this.trailGeo = new THREE.BufferGeometry();
      this.trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      this.trailMat = mats.trailPulse;
      this.trailLine = new THREE.Line(this.trailGeo, this.trailMat);
      this.trailLine.visible = false;

      if (this.scene) {
        this.scene.add(this.mesh);
        this.scene.add(this.trailLine);
      }
    }

    init(startPos, targetPos, options = {}) {
      this.sourceMech = options.sourceMech || null;
      this.team = options.team || (options.sourceMech ? options.sourceMech.team : 'blue');
      this.damage = options.damage || 45;
      this.speed = options.speed || 135.0;
      this.range = options.range || 160.0;
      this.explosionRadius = options.explosionRadius || 0;
      this.targetMech = options.targetMech || null;
      this.distTraveled = 0;
      this.isAlive = true;
      this.lifeTime = 0;

      const isRed = this.team === 'red';
      const mats = getSharedMats();

      // Update team-specific materials
      if (this.type === 'SCATTER' && this.bodyMesh) {
        this.bodyMesh.material = isRed ? mats.scatterRed : mats.scatterBlue;
      } else if (this.type === 'MISSILE' && this.noseMesh) {
        this.noseMesh.material = isRed ? mats.missileNoseRed : mats.missileNoseBlue;
      } else if (this.type === 'RAIL_SPEAR' && this.bodyMesh) {
        this.bodyMesh.material = isRed ? mats.railRed : mats.railBlue;
      } else if (this.type === 'PULSE' && this.bodyMesh) {
        this.bodyMesh.material = isRed ? mats.pulseRed : mats.pulseBlue;
      }

      // Update trail material
      if (this.type === 'PLASMA_ORB') this.trailLine.material = mats.trailPlasma;
      else if (this.type === 'SCATTER') this.trailLine.material = mats.trailScatter;
      else if (this.type === 'RAIL_SPEAR') this.trailLine.material = mats.trailRail;
      else this.trailLine.material = isRed ? mats.trailPulseRed : mats.trailPulse;

      // Trajectory direction
      _scratchDir.subVectors(targetPos, startPos).normalize();
      this.velocity.copy(_scratchDir).multiplyScalar(this.speed);

      this.mesh.position.copy(startPos);
      if (this.type === 'RAIL_SPEAR' || this.type === 'PULSE') {
        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _scratchDir);
      } else if (this.type === 'MISSILE') {
        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _scratchDir);
      }

      // Reset trail points
      const attr = this.trailGeo.getAttribute('position');
      attr.setXYZ(0, startPos.x, startPos.y, startPos.z);
      attr.setXYZ(1, startPos.x, startPos.y, startPos.z);
      attr.needsUpdate = true;

      this.mesh.visible = true;
      this.trailLine.visible = true;
      return this;
    }

    update(dt, arenaObstacles, allMechs, onHitCallback) {
      if (!this.isAlive) return;
      this.lifeTime += dt;

      // ── Guided Missile Homing Physics ──
      if (this.type === 'MISSILE' && this.targetMech && !this.targetMech.isDead) {
        _scratchToTarget.copy(this.targetMech.position).add({ x: 0, y: 2.5, z: 0 }).sub(this.mesh.position).normalize();
        _scratchCurDir.copy(this.velocity).normalize();
        _scratchCurDir.lerp(_scratchToTarget, Math.min(1.0, 5.0 * dt)).normalize();
        this.velocity.copy(_scratchCurDir).multiplyScalar(this.speed);
        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _scratchCurDir);
      }

      _scratchStep.copy(this.velocity).multiplyScalar(dt);
      const moveDist = _scratchStep.length();
      _scratchPrevPos.copy(this.mesh.position);
      this.mesh.position.add(_scratchStep);
      this.distTraveled += moveDist;

      // Update Ribbon Trail tail
      if (this.trailGeo) {
        const attr = this.trailGeo.getAttribute('position');
        attr.setXYZ(0, _scratchPrevPos.x, _scratchPrevPos.y, _scratchPrevPos.z);
        attr.setXYZ(1, this.mesh.position.x, this.mesh.position.y, this.mesh.position.z);
        attr.needsUpdate = true;
      }

      if (this.distTraveled >= this.range) {
        this.destroy();
        return;
      }

      // 1. Static Arena Obstacle Collision
      if (arenaObstacles && arenaObstacles.length > 0) {
        _scratchDir.copy(this.velocity).normalize();
        _sharedRaycaster.set(_scratchPrevPos, _scratchDir);
        _sharedRaycaster.far = moveDist;
        const hits = _sharedRaycaster.intersectObjects(arenaObstacles, false);
        if (hits.length > 0) {
          this._handleImpact(hits[0].point, null, allMechs, onHitCallback);
          this.destroy();
          return;
        }
      }

      // 2. Mech Collision with Continuous Collision Detection (CCD)
      if (allMechs && allMechs.length > 0) {
        for (let i = 0; i < allMechs.length; i++) {
          const target = allMechs[i];
          if (target === this.sourceMech) continue;
          if (target.isDead) continue;
          if (target.team === this.team) continue; // Friendly-fire immunity

          const segX = this.mesh.position.x - _scratchPrevPos.x;
          const segY = this.mesh.position.y - _scratchPrevPos.y;
          const segZ = this.mesh.position.z - _scratchPrevPos.z;
          const segLenSqH = segX * segX + segZ * segZ;

          let t = 0;
          if (segLenSqH > 0.0001) {
            const toTargetX = target.position.x - _scratchPrevPos.x;
            const toTargetZ = target.position.z - _scratchPrevPos.z;
            t = Math.max(0, Math.min(1, (toTargetX * segX + toTargetZ * segZ) / segLenSqH));
          }

          const closestX = _scratchPrevPos.x + segX * t;
          const closestY = _scratchPrevPos.y + segY * t;
          const closestZ = _scratchPrevPos.z + segZ * t;

          const targetH = 5.0;
          const dy = closestY - target.position.y;
          const isWithinHeight = dy >= -0.5 && dy <= targetH + 0.5;

          const hDist = Math.hypot(closestX - target.position.x, closestZ - target.position.z);
          const hitRadius = (target.radius || 2.0) + (this.type === 'PLASMA_ORB' ? 0.8 : 0.4);

          if (isWithinHeight && hDist <= hitRadius) {
            _scratchImpact.set(closestX, closestY, closestZ);
            this._handleImpact(_scratchImpact, target, allMechs, onHitCallback, _scratchPrevPos);
            this.destroy();
            return;
          }
        }
      }
    }

    _handleImpact(hitPoint, directTarget, allMechs, onHitCallback, prevPos = null) {
      // Area-Of-Effect (AOE) explosion for Plasma Launcher
      if (this.explosionRadius > 0 && allMechs) {
        allMechs.forEach(m => {
          if (m.isDead || m.team === this.team) return;
          const d = m.position.distanceTo(hitPoint);
          if (d <= this.explosionRadius) {
            const falloff = Math.max(0.3, 1.0 - (d / this.explosionRadius));
            const aoeDamage = Math.round(this.damage * falloff);
            const res = m.takeDamage(aoeDamage, this.sourceMech, { point: hitPoint });
            const dmgDone = typeof res === 'object' ? res.amount : res;
            if (onHitCallback) onHitCallback(hitPoint, m, this.sourceMech, dmgDone, true, false);
          }
        });
        return;
      }

      // Direct single target impact with Weak Point Detection
      if (directTarget) {
        if (directTarget.isInvulnerable) {
          if (onHitCallback) onHitCallback(hitPoint, directTarget, this.sourceMech, 0, false, false);
          return;
        }

        let dmg = this.damage;
        if (this.type === 'RAIL_SPEAR') dmg = Math.round(dmg * 1.2); // Armor piercing

        // Test for Weak Point Collisions (Rear Core / Head Sensor)
        let isCrit = false;
        let weakPointInfo = { point: hitPoint, isWeakPoint: false, multiplier: 1.0 };

        if (directTarget.mesh && prevPos) {
          _scratchDir.copy(this.velocity).normalize();
          _sharedRaycaster.set(prevPos, _scratchDir);
          _sharedRaycaster.far = 8.0;
          const subHits = _sharedRaycaster.intersectObjects(directTarget.mesh.children, true);

          if (subHits.length > 0) {
            for (let sh of subHits) {
              let cur = sh.object;
              while (cur && cur !== directTarget.mesh) {
                if (cur.userData && cur.userData.isWeakPoint) {
                  isCrit = true;
                  weakPointInfo.isWeakPoint = true;
                  weakPointInfo.weakPointType = cur.userData.type;
                  weakPointInfo.multiplier = cur.userData.multiplier || 1.5;
                  break;
                }
                cur = cur.parent;
              }
              if (isCrit) break;
            }
          }
        }

        const res = directTarget.takeDamage(dmg, this.sourceMech, weakPointInfo);
        const dmgDone = typeof res === 'object' ? res.amount : res;
        const actualCrit = typeof res === 'object' ? res.isCrit : isCrit;

        if (onHitCallback) {
          onHitCallback(hitPoint, directTarget, this.sourceMech, dmgDone, false, actualCrit);
        }
      } else {
        if (onHitCallback) onHitCallback(hitPoint, null, this.sourceMech, 0, false, false);
      }
    }

    destroy() {
      if (!this.isAlive) return;
      this.isAlive = false;
      if (this.mesh) this.mesh.visible = false;
      if (this.trailLine) this.trailLine.visible = false;

      if (IT.PoolManager) {
        IT.PoolManager.release('projectile_' + this.type, this);
      } else {
        if (this.mesh && this.mesh.parent) this.scene.remove(this.mesh);
        if (this.trailLine && this.trailLine.parent) this.scene.remove(this.trailLine);
      }
    }

    dispose() {
      if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
      if (this.trailLine && this.trailLine.parent) this.trailLine.parent.remove(this.trailLine);
      if (this.trailGeo) this.trailGeo.dispose();
    }
  }

  // ── Combat Manager ──
  class Combat3D {
    constructor(scene, camera) {
      this.scene = scene;
      this.camera = camera;
      this.projectiles = [];
      this.raycaster = new THREE.Raycaster();

      // Primary Weapon
      this.primarySlot = 0;
      this.primaryCooldown = 0;
      this.primaryAmmo = 28;
      this.primaryMaxAmmo = 28;
      this.isPrimaryReloading = false;
      this.primaryReloadTimer = 0;
      this.primaryMaxReloadTime = 1.8;

      // Secondary Weapon
      this.secondarySlot = 1;
      this.secondaryCooldown = 0;
      this.secondaryAmmo = 12;
      this.secondaryMaxAmmo = 12;
      this.isSecondaryReloading = false;
      this.secondaryReloadTimer = 0;
      this.secondaryMaxReloadTime = 2.2;

      // Target lock & aim assist
      this.crosshairAimPoint = new THREE.Vector3();
      this.aimTargetEntity = null;
      this.aimAssistLevel = 'MEDIUM';
      this.isTargetLocked = false;
      this.lockedTarget = null;

      this._initProjectilePools();
    }

    _initProjectilePools() {
      if (!IT.PoolManager) return;
      const types = ['PULSE', 'SCATTER', 'PLASMA_ORB', 'MISSILE', 'RAIL_SPEAR', 'ARC_BEAM'];
      types.forEach(type => {
        const key = 'projectile_' + type;
        if (!IT.PoolManager.getPool(key)) {
          IT.PoolManager.registerPool(
            key,
            () => new Projectile3D(this.scene, type),
            (item, sp, tp, opt) => item.init(sp, tp, opt),
            (item) => item.dispose(),
            10,
            120
          );
        }
      });
    }

    spawnProjectile(startPos, targetPos, options = {}) {
      const type = options.type || 'PULSE';
      const poolKey = 'projectile_' + type;
      let p = null;
      if (IT.PoolManager && IT.PoolManager.getPool(poolKey)) {
        p = IT.PoolManager.acquire(poolKey, startPos, targetPos, options);
      } else {
        p = new Projectile3D(this.scene, type);
        p.init(startPos, targetPos, options);
      }
      if (p) this.projectiles.push(p);
      return p;
    }

    configurePlayerWeapons(primaryDef, secondaryDef) {
      if (primaryDef) {
        this.primaryMaxAmmo = primaryDef.magazine;
        this.primaryAmmo = primaryDef.magazine;
        this.primaryMaxReloadTime = primaryDef.reloadTime;
        this.primaryDef = primaryDef;
      }
      if (secondaryDef) {
        this.secondaryMaxAmmo = secondaryDef.magazine;
        this.secondaryAmmo = secondaryDef.magazine;
        this.secondaryMaxReloadTime = secondaryDef.reloadTime;
        this.secondaryDef = secondaryDef;
      }
    }

    startReload() {
      if (!this.isPrimaryReloading && this.primaryAmmo < this.primaryMaxAmmo) {
        this.isPrimaryReloading = true;
        this.primaryReloadTimer = this.primaryMaxReloadTime;
        if (IT.AudioManager) {
          IT.AudioManager.playUI('click');
        }
      }
    }

    toggleTargetLock(enemyMechs) {
      if (this.isTargetLocked) {
        this.isTargetLocked = false;
        this.lockedTarget = null;
        return false;
      }

      let bestTarget = null;
      let minDistance = 150;

      if (enemyMechs) {
        for (let m of enemyMechs) {
          if (m.isDead) continue;
          const d = this.camera.position.distanceTo(m.position);
          if (d < minDistance) {
            minDistance = d;
            bestTarget = m;
          }
        }
      }

      if (bestTarget) {
        this.isTargetLocked = true;
        this.lockedTarget = bestTarget;
        return true;
      }
      return false;
    }

    updateAimTarget(arenaObstacles, enemyMechs) {
      if (this.isTargetLocked && this.lockedTarget && !this.lockedTarget.isDead) {
        this.aimTargetEntity = this.lockedTarget;
        this.crosshairAimPoint.copy(this.lockedTarget.position).add(new THREE.Vector3(0, 2.8, 0));
        return this.crosshairAimPoint;
      } else if (this.isTargetLocked && this.lockedTarget && this.lockedTarget.isDead) {
        this.isTargetLocked = false;
        this.lockedTarget = null;
      }

      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      const targets = [...(arenaObstacles || [])];
      if (enemyMechs) {
        enemyMechs.forEach(m => {
          if (!m.isDead && m.mesh) targets.push(m.mesh);
        });
      }

      const hits = this.raycaster.intersectObjects(targets, true);
      this.aimTargetEntity = null;

      if (hits.length > 0) {
        this.crosshairAimPoint.copy(hits[0].point);
        if (enemyMechs) {
          for (let m of enemyMechs) {
            if (!m.isDead && m.mesh) {
              let cur = hits[0].object;
              while (cur) {
                if (cur === m.mesh) {
                  this.aimTargetEntity = m;
                  break;
                }
                cur = cur.parent;
              }
            }
          }
        }
      } else {
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        this.crosshairAimPoint.copy(this.camera.position).addScaledVector(forward, 150);
      }

      // Auto Aim Assist
      if (!this.aimTargetEntity && this.aimAssistLevel !== 'OFF' && enemyMechs) {
        const assistStrengths = { LOW: 0.1, MEDIUM: 0.22, HIGH: 0.4 };
        const factor = assistStrengths[this.aimAssistLevel] || 0.2;

        for (let m of enemyMechs) {
          if (m.isDead) continue;
          const targetChest = m.position.clone().add(new THREE.Vector3(0, 2.8, 0));
          const projected = targetChest.clone().project(this.camera);
          const screenDist = Math.hypot(projected.x, projected.y);

          if (projected.z > 0 && screenDist < 0.25) {
            this.crosshairAimPoint.lerp(targetChest, factor);
            this.aimTargetEntity = m;
            break;
          }
        }
      }

      return this.crosshairAimPoint;
    }

    tryFire(playerMech, isFirePressed) {
      if (this.isPrimaryReloading) return false;
      if (this.primaryAmmo <= 0) {
        this.startReload();
        return false;
      }

      if (!isFirePressed || this.primaryCooldown > 0 || !playerMech || playerMech.isDead) {
        return false;
      }

      const wep = this.primaryDef || IT.WeaponRegistry.getStatsForLevel('pulseCannon', 1);
      this.primaryCooldown = wep.fireRate;
      this.primaryAmmo--;

      playerMech.triggerWeaponFire(0);
      const muzzlePos = playerMech.getMuzzleWorldPosition(0);

      this._spawnWeaponProjectiles(playerMech, wep, muzzlePos, this.crosshairAimPoint, this.lockedTarget);

      if (this.primaryAmmo <= 0) {
        this.startReload();
      }

      return true;
    }

    tryFireSecondary(playerMech, isSecondaryPressed) {
      if (this.isSecondaryReloading) return false;
      if (this.secondaryAmmo <= 0) {
        this.isSecondaryReloading = true;
        this.secondaryReloadTimer = this.secondaryMaxReloadTime;
        return false;
      }

      if (!isSecondaryPressed || this.secondaryCooldown > 0 || !playerMech || playerMech.isDead) {
        return false;
      }

      const wep = this.secondaryDef || IT.WeaponRegistry.getStatsForLevel('scatterBlaster', 1);
      this.secondaryCooldown = wep.fireRate;
      this.secondaryAmmo--;

      playerMech.triggerWeaponFire(1);
      const muzzlePos = playerMech.getMuzzleWorldPosition(1);

      this._spawnWeaponProjectiles(playerMech, wep, muzzlePos, this.crosshairAimPoint, this.lockedTarget);

      if (this.secondaryAmmo <= 0) {
        this.isSecondaryReloading = true;
        this.secondaryReloadTimer = this.secondaryMaxReloadTime;
      }

      return true;
    }

    _spawnWeaponProjectiles(mech, wep, muzzlePos, targetPoint, lockedTarget = null) {
      const aimDir = targetPoint.clone().sub(muzzlePos).normalize();

      // Muzzle Flash VFX
      if (IT._activeVFXManager) {
        IT._activeVFXManager.spawnMuzzleFlash(muzzlePos, aimDir, wep.projectileType, mech.team);
      }

      // Audio Trigger
      if (IT.AudioManager) {
        IT.AudioManager.playWeaponFire(wep.id, mech.isPlayer);
      }

      switch (wep.projectileType) {
        case 'SCATTER': {
          const count = wep.pelletCount || 7;
          for (let i = 0; i < count; i++) {
            const spread = new THREE.Vector3(
              (Math.random() - 0.5) * 4.5,
              (Math.random() - 0.5) * 4.5,
              (Math.random() - 0.5) * 4.5
            );
            const spreadTarget = targetPoint.clone().add(spread);
            this.spawnProjectile(muzzlePos, spreadTarget, {
              sourceMech: mech,
              team: mech.team,
              type: 'SCATTER',
              damage: wep.damage,
              speed: wep.projectileSpeed * (0.9 + Math.random() * 0.2),
              range: wep.rangeUnits
            });
          }
          break;
        }

        case 'PLASMA_ORB': {
          this.spawnProjectile(muzzlePos, targetPoint, {
            sourceMech: mech,
            team: mech.team,
            type: 'PLASMA_ORB',
            damage: wep.damage,
            speed: wep.projectileSpeed,
            range: wep.rangeUnits,
            explosionRadius: wep.explosionRadius || 8.5
          });
          break;
        }

        case 'MISSILE': {
          const count = wep.salvoCount || 4;
          for (let i = 0; i < count; i++) {
            setTimeout(() => {
              if (mech && !mech.isDead) {
                const sMuzzle = mech.getMuzzleWorldPosition(1);
                const spreadOffset = new THREE.Vector3(
                  (Math.random() - 0.5) * 3.0,
                  (Math.random() - 0.5) * 3.0,
                  (Math.random() - 0.5) * 3.0
                );
                this.spawnProjectile(sMuzzle, targetPoint.clone().add(spreadOffset), {
                  sourceMech: mech,
                  team: mech.team,
                  type: 'MISSILE',
                  damage: wep.damage,
                  speed: wep.projectileSpeed,
                  range: wep.rangeUnits,
                  targetMech: lockedTarget
                });
              }
            }, i * 110);
          }
          break;
        }

        case 'RAIL_SPEAR': {
          this.spawnProjectile(muzzlePos, targetPoint, {
            sourceMech: mech,
            team: mech.team,
            type: 'RAIL_SPEAR',
            damage: wep.damage,
            speed: wep.projectileSpeed,
            range: wep.rangeUnits
          });
          break;
        }

        case 'ARC_BEAM': {
          this.spawnProjectile(muzzlePos, targetPoint, {
            sourceMech: mech,
            team: mech.team,
            type: 'ARC_BEAM',
            damage: wep.damage,
            speed: 240,
            range: wep.rangeUnits,
            colorHex: 0x9d4edd
          });
          break;
        }

        case 'PULSE':
        default: {
          this.spawnProjectile(muzzlePos, targetPoint, {
            sourceMech: mech,
            team: mech.team,
            type: 'PULSE',
            damage: wep.damage,
            speed: wep.projectileSpeed,
            range: wep.rangeUnits
          });
          break;
        }
      }
    }

    fireBotWeapon(botMech, targetPoint) {
      if (!botMech || botMech.isDead) return;

      const wep = IT.WeaponRegistry.getStatsForLevel(botMech.primaryWeaponId || 'pulseCannon', 1);
      const slot = botMech.activeSlot || 0;
      const muzzlePos = botMech.getMuzzleWorldPosition(slot);

      this._spawnWeaponProjectiles(botMech, wep, muzzlePos, targetPoint);
    }

    update(dt, arenaObstacles, allMechs, onHitCallback) {
      if (this.primaryCooldown > 0) this.primaryCooldown -= dt;
      if (this.secondaryCooldown > 0) this.secondaryCooldown -= dt;

      if (this.isPrimaryReloading) {
        this.primaryReloadTimer -= dt;
        if (this.primaryReloadTimer <= 0) {
          this.isPrimaryReloading = false;
          this.primaryAmmo = this.primaryMaxAmmo;
        }
      }

      if (this.isSecondaryReloading) {
        this.secondaryReloadTimer -= dt;
        if (this.secondaryReloadTimer <= 0) {
          this.isSecondaryReloading = false;
          this.secondaryAmmo = this.secondaryMaxAmmo;
        }
      }

      // Update active projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.update(dt, arenaObstacles, allMechs, (hitPoint, target, sourceMech, dmg, isAOE, isCrit) => {
          // Trigger Impact VFX
          if (IT._activeVFXManager) {
            const hitType = isCrit ? 'CRITICAL' : ((target && target.shield > 0) ? 'SHIELD' : 'METAL');
            IT._activeVFXManager.spawnImpactSparks(hitPoint, null, hitType, target ? target.team : 'blue');
          }

          if (onHitCallback) {
            onHitCallback(hitPoint, target, sourceMech, dmg, isCrit);
          }
        });

        if (!p.isAlive) {
          this.projectiles.splice(i, 1);
        }
      }

      // Update VFXManager if attached
      if (IT._activeVFXManager) {
        IT._activeVFXManager.update(dt);
      }
    }

    destroy() {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        this.projectiles[i].destroy();
      }
      this.projectiles.length = 0;
    }

    // Convenience getters for HUD
    get ammo() { return this.primaryAmmo; }
    get maxAmmo() { return this.primaryMaxAmmo; }
    get isReloading() { return this.isPrimaryReloading; }
    get reloadTimer() { return this.primaryReloadTimer; }
    get maxReloadTime() { return this.primaryMaxReloadTime; }
  }

  IT.Combat3D = Combat3D;
  IT.Projectile3D = Projectile3D;
})(window.IT);
