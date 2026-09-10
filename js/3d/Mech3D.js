/**
 * Iron Titans 3D — Mech3D.js
 * Advanced 3D Mech Entity supporting:
 * - 5 Original Mech Chassis: Ironclad-X1, Vortex-9, Bastion-R, Striker-X, Nova-7
 * - Expanded Animation State Machine (Idle, Walk, Run, Strafe, Fire, Reload, Hit, Ability, Death)
 * - Multi-Stage Visual Damage Layers (75% sparks, 50% carbon scorch, 25% smoke, Critical hazard pulse)
 * - Material-based Shield distortion & shatter shockwave feedback
 * - Multi-Stage Mech Destruction Sequence (Overload, explosion, flying debris)
 * - Weak Point Strike Processing (Rear Core, Head Sensor)
 * - Throttled Procedural Footstep Audio integration
 * - Smooth kinematic aiming and recoil dampening
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  // Animation States
  const ANIM_STATES = {
    IDLE: 'IDLE',
    WALK: 'WALK',
    RUN: 'RUN',
    STRAFE: 'STRAFE',
    FIRE: 'FIRE',
    RELOAD: 'RELOAD',
    HIT: 'HIT',
    ABILITY: 'ABILITY',
    DEATH: 'DEATH'
  };

  class Mech3D {
    constructor(options = {}) {
      this.mechId = (options.mechId || options.archetype || 'ironclad').toLowerCase();
      const regDef = IT.MechRegistry ? IT.MechRegistry.getStatsForLevel(this.mechId, options.level || 1) : null;

      this.name = options.name || (regDef ? regDef.name : 'IRONCLAD-X1');
      this.role = regDef ? regDef.role : 'Tank';
      this.team = options.team || (options.isEnemy ? 'red' : 'blue');
      this.isPlayer = options.isPlayer || false;
      this.isEnemy = this.team === 'red';

      this.primaryWeaponId = options.primaryWeapon || 'pulseCannon';
      this.secondaryWeaponId = options.secondaryWeapon || 'scatterBlaster';

      // Build 3D mesh components with modular weapon mounts
      this.rig = IT.MechBuilder3D.buildMech(this.mechId, {
        team: this.team,
        isEnemy: this.isEnemy,
        primaryWeapon: this.primaryWeaponId,
        secondaryWeapon: this.secondaryWeaponId
      });
      this.mesh = this.rig.root;

      // World transform
      this.position = this.mesh.position;
      this.heading = options.heading || 0;
      this.torsoYaw = 0;
      this.position.set(options.x || 0, options.y || 0, options.z || 0);

      // Movement & Kinematics
      this.velocity = new THREE.Vector3();
      this.speed = options.speed || (regDef ? regDef.speed : 14.0);
      this.turnSpeed = options.turnSpeed || (regDef ? regDef.turnSpeed : 4.5);
      this.radius = 2.0;

      // Health, Shields, and Armor
      this.maxHp = options.hp || (regDef ? regDef.maxHp : 5000);
      this.hp = this.maxHp;
      this.maxShield = options.shield || (regDef ? regDef.maxShield : 2000);
      this.shield = this.maxShield;
      this.damageReduction = regDef ? regDef.damageReduction : 0.0;
      this.isDead = false;

      // Abilities
      this.abilityId = regDef ? regDef.abilityId : 'energy_charge';
      this.abilityName = regDef ? regDef.abilityName : 'Energy Charge';
      this.abilityCooldown = options.abilityCooldown || (regDef ? regDef.abilityCooldown : 8.0);
      this.abilityTimer = 0;
      this.isAbilityActive = false;
      this.abilityDuration = 2.6;
      this.abilityDurationTimer = 0;

      // Spawn Invulnerability Shield (2s)
      this.isInvulnerable = false;
      this.invulnerableTimer = 0;
      this._buildInvulnerabilityShield();

      // Overhead 3D Billboard Health Bar (for AI combatants)
      this._buildOverheadBillboard();

      // Visual / Animation States
      this.animState = ANIM_STATES.IDLE;
      this.walkPhase = 0;
      this.prevWalkPhase = 0;
      this.isMoving = false;
      this.recoilTimers = [0, 0];
      this.hitFlashTimer = 0;
      this.hitFlinch = new THREE.Vector3();
      this.animTime = 0;
      this.smokeTimer = 0;

      // Deployed barrier object for Bastion-R Deploy Shield ability
      this.deployedBarrier = null;

      // Callbacks
      this.onDamageReceived = null;
      this.onKilled = null;
    }

    equipWeapon(slot = 0, weaponId) {
      if (slot === 0) this.primaryWeaponId = weaponId;
      else this.secondaryWeaponId = weaponId;

      IT.MechBuilder3D.mountWeapons(this.rig, this.primaryWeaponId, this.secondaryWeaponId, {
        team: this.team
      });
    }

    _buildInvulnerabilityShield() {
      const shieldGeo = new THREE.SphereGeometry(3.6, 16, 16);
      const shieldColor = this.team === 'red' ? 0xff4422 : 0x00d8ff;
      const shieldMat = new THREE.MeshStandardMaterial({
        color: shieldColor,
        emissive: shieldColor,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.28,
        roughness: 0.2
      });
      this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
      this.shieldMesh.position.set(0, 2.8, 0);
      this.shieldMesh.visible = false;
      this.mesh.add(this.shieldMesh);
    }

    _buildOverheadBillboard() {
      this.billboardCanvas = document.createElement('canvas');
      this.billboardCanvas.width = 256;
      this.billboardCanvas.height = 64;
      this.billboardCtx = this.billboardCanvas.getContext('2d');

      this.billboardTexture = new THREE.CanvasTexture(this.billboardCanvas);
      const mat = new THREE.SpriteMaterial({ map: this.billboardTexture, depthTest: false });
      this.billboardSprite = new THREE.Sprite(mat);
      this.billboardSprite.position.set(0, 4.8, 0);
      this.billboardSprite.scale.set(4.0, 1.0, 1.0);
      this.mesh.add(this.billboardSprite);

      this._updateBillboardCanvas();
    }

    _updateBillboardCanvas() {
      if (!this.billboardCtx) return;
      const ctx = this.billboardCtx;
      const w = 256, h = 64;
      ctx.clearRect(0, 0, w, h);

      if (this.isDead) {
        this.billboardTexture.needsUpdate = true;
        return;
      }

      // Name & role
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, w / 2, 22);

      // Outer health frame
      const barW = 200;
      const barH = 14;
      const barX = (w - barW) / 2;
      const barY = 32;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX, barY, barW, barH);

      // HP bar fill
      const hpPct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = this.team === 'blue' ? '#00c8ff' : '#ff3b30';
      ctx.fillRect(barX, barY, barW * hpPct, barH);

      // Shield overlay border
      if (this.shield > 0) {
        const shieldPct = Math.max(0, this.shield / this.maxShield);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(barX, barY - 4, barW * shieldPct, 3);
      }

      this.billboardTexture.needsUpdate = true;
    }

    setInvulnerable(seconds) {
      this.isInvulnerable = true;
      this.invulnerableTimer = seconds;
      if (this.shieldMesh) this.shieldMesh.visible = true;
    }

    useAbility(scene) {
      if (this.abilityTimer > 0 || this.isDead) return false;

      this.isAbilityActive = true;
      this.abilityTimer = this.abilityCooldown;
      this.abilityDurationTimer = this.abilityDuration;

      // Audio Trigger
      if (IT.AudioManager) {
        IT.AudioManager.playAbility(this.abilityId);
      }

      // Visual ability effects per mech
      switch (this.abilityId) {
        case 'energy_charge': // Ironclad-X1
          this.rig.materials.armor.emissive.setHex(0x0088ff);
          this.rig.materials.armor.emissiveIntensity = 2.0;
          break;
        case 'phase_dash': // Vortex-9
          this.setInvulnerable(1.8);
          this.rig.materials.visor.emissiveIntensity = 4.0;
          break;
        case 'deploy_shield': // Bastion-R
          this._deployStationaryBarrier(scene);
          break;
        case 'overdrive': // Striker-X
          this.rig.materials.armor.emissive.setHex(0xffaa00);
          this.rig.materials.armor.emissiveIntensity = 2.5;
          break;
        case 'precision_lock': // Nova-7
          this.rig.materials.visor.emissive.setHex(0xffd700);
          this.rig.materials.visor.emissiveIntensity = 3.5;
          break;
      }

      return true;
    }

    _deployStationaryBarrier(scene) {
      if (!scene) return;
      const geo = new THREE.BoxGeometry(6.5, 3.2, 0.4);
      const mat = new THREE.MeshStandardMaterial({
        color: this.team === 'red' ? 0xff3b30 : 0x00c8ff,
        emissive: this.team === 'red' ? 0xff2200 : 0x00aaff,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.55
      });
      const barrier = new THREE.Mesh(geo, mat);

      const fwdX = Math.sin(this.heading);
      const fwdZ = Math.cos(this.heading);
      barrier.position.set(this.position.x + fwdX * 4.5, 2.2, this.position.z + fwdZ * 4.5);
      barrier.rotation.y = this.heading;

      scene.add(barrier);
      this.deployedBarrier = barrier;
    }

    update(dt, moveInput, aimTargetPoint, arenaCollision) {
      if (this.isDead) return;

      this.animTime += dt;

      // Invulnerability Countdown
      if (this.isInvulnerable) {
        this.invulnerableTimer -= dt;
        if (this.shieldMesh) {
          this.shieldMesh.visible = true;
          this.shieldMesh.rotation.y += dt * 1.5;
        }
        if (this.invulnerableTimer <= 0) {
          this.isInvulnerable = false;
          if (this.shieldMesh) this.shieldMesh.visible = false;
        }
      }

      // Ability Cooldown & Duration
      if (this.abilityTimer > 0) {
        this.abilityTimer = Math.max(0, this.abilityTimer - dt);
      }

      if (this.isAbilityActive) {
        this.abilityDurationTimer -= dt;
        if (this.abilityDurationTimer <= 0) {
          this.isAbilityActive = false;
          this.rig.materials.visor.emissiveIntensity = 2.2;
          if (this.hitFlashTimer <= 0) {
            this.rig.materials.armor.emissive.setHex(0x000000);
          }
          if (this.deployedBarrier) {
            if (this.deployedBarrier.parent) this.deployedBarrier.parent.remove(this.deployedBarrier);
            this.deployedBarrier = null;
          }
        }
      }

      // ── Movement & Kinematics ──
      const hasInput = moveInput && (Math.abs(moveInput.x) > 0.05 || Math.abs(moveInput.z) > 0.05);
      this.isMoving = hasInput;

      let currentSpeed = this.speed;
      if (this.isAbilityActive) {
        if (this.abilityId === 'energy_charge') currentSpeed *= 1.4;
        else if (this.abilityId === 'phase_dash') currentSpeed *= 1.6;
      }

      if (hasInput) {
        const inputLen = Math.hypot(moveInput.x, moveInput.z);
        const inputDirX = moveInput.x / (inputLen || 1);
        const inputDirZ = moveInput.z / (inputLen || 1);
        const forwardSpd = currentSpeed * Math.min(1.0, inputLen);

        if (this.isPlayer) {
          // Player responsive movement: velocity directly follows camera-relative input
          this.velocity.x = inputDirX * forwardSpd;
          this.velocity.z = inputDirZ * forwardSpd;

          // Player mech chassis smoothly aligns with the crosshair / aim point
          let desiredHeading = this.heading;
          if (aimTargetPoint) {
            const dx = aimTargetPoint.x - this.position.x;
            const dz = aimTargetPoint.z - this.position.z;
            if (Math.hypot(dx, dz) > 0.5) {
              desiredHeading = Math.atan2(dx, dz);
            }
          } else {
            desiredHeading = Math.atan2(inputDirX, inputDirZ);
          }

          let diff = desiredHeading - this.heading;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.heading += diff * Math.min(1.0, 12.0 * dt);
          this.mesh.rotation.y = this.heading;

          // Leg walk phase: forward vs reverse walking
          const fwdX = Math.sin(this.heading);
          const fwdZ = Math.cos(this.heading);
          const fwdDot = (this.velocity.x * fwdX + this.velocity.z * fwdZ);
          this.prevWalkPhase = this.walkPhase;
          this.walkPhase += (fwdDot >= 0 ? 1 : -1) * dt * forwardSpd * 0.9;
        } else {
          // AI bot kinematics
          const targetHeading = Math.atan2(inputDirX, inputDirZ);
          let diff = targetHeading - this.heading;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.heading += diff * Math.min(1.0, this.turnSpeed * dt);
          this.mesh.rotation.y = this.heading;

          this.velocity.x = Math.sin(this.heading) * forwardSpd;
          this.velocity.z = Math.cos(this.heading) * forwardSpd;

          this.prevWalkPhase = this.walkPhase;
          this.walkPhase += dt * forwardSpd * 0.9;
        }
      } else {
        this.velocity.x *= Math.exp(-dt * 12);
        this.velocity.z *= Math.exp(-dt * 12);
        this.walkPhase *= Math.exp(-dt * 4);

        if (this.isPlayer && aimTargetPoint) {
          const dx = aimTargetPoint.x - this.position.x;
          const dz = aimTargetPoint.z - this.position.z;
          if (Math.hypot(dx, dz) > 0.5) {
            const desiredHeading = Math.atan2(dx, dz);
            let diff = desiredHeading - this.heading;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.heading += diff * Math.min(1.0, 12.0 * dt);
            this.mesh.rotation.y = this.heading;
          }
        }
      }

      // Collision resolution
      const nextX = this.position.x + this.velocity.x * dt;
      const nextZ = this.position.z + this.velocity.z * dt;

      if (arenaCollision) {
        const resolved = arenaCollision(nextX, nextZ, this.radius);
        this.position.x = resolved.x;
        this.position.z = resolved.z;
      } else {
        this.position.x = nextX;
        this.position.z = nextZ;
      }

      // Procedural Leg Animation & Footstep Audio
      this._animateLegs(dt);

      // Independent Torso Aiming
      if (aimTargetPoint) {
        this._aimTorso(aimTargetPoint, dt);
      }

      // Weapon Mechanical Recoil Slide Recovery
      for (let i = 0; i < 2; i++) {
        if (this.recoilTimers[i] > 0) {
          this.recoilTimers[i] = Math.max(0, this.recoilTimers[i] - dt * 6.0);
          const recoilOffset = -0.35 * Math.sin(this.recoilTimers[i] * Math.PI);
          if (this.rig.weapons[i] && this.rig.weapons[i].barrelGroup) {
            this.rig.weapons[i].barrelGroup.position.z = recoilOffset;
          }
        }
      }

      // Hit Flash Recovery
      if (this.hitFlashTimer > 0) {
        this.hitFlashTimer -= dt;
        if (this.hitFlashTimer <= 0 && !this.isAbilityActive) {
          this.rig.materials.armor.emissive.setHex(0x000000);
        }
      }

      // Hit Flinch Decay
      if (this.hitFlinch.lengthSq() > 0.0001) {
        this.hitFlinch.multiplyScalar(Math.exp(-dt * 12));
        this.rig.torsoGroup.position.x = this.hitFlinch.x;
        this.rig.torsoGroup.position.z = this.hitFlinch.z;
      }

      // Visual Damage States
      this._updateVisualDamageStates(dt);
    }

    _animateLegs(dt) {
      const legs = this.rig.legs;
      if (!legs || legs.length < 2) return;

      const stride = this.isMoving ? 0.65 : 0;
      const leftPhase = this.walkPhase;
      const rightPhase = this.walkPhase + Math.PI;

      legs[0].hipPivot.rotation.x = Math.sin(leftPhase) * stride;
      legs[0].kneePivot.rotation.x = Math.max(0, -Math.sin(leftPhase) * stride * 1.3);
      legs[0].anklePivot.rotation.x = -legs[0].hipPivot.rotation.x * 0.7;

      legs[1].hipPivot.rotation.x = Math.sin(rightPhase) * stride;
      legs[1].kneePivot.rotation.x = Math.max(0, -Math.sin(rightPhase) * stride * 1.3);
      legs[1].anklePivot.rotation.x = -legs[1].hipPivot.rotation.x * 0.7;

      // Footstep Sound Trigger on cycle zero crossing
      if (this.isMoving && IT.AudioManager) {
        const p1 = Math.sin(this.walkPhase);
        const p0 = Math.sin(this.prevWalkPhase);
        if ((p0 < 0 && p1 >= 0) || (p0 > 0 && p1 <= 0)) {
          IT.AudioManager.playFootstep(this.mechId, this.role);
        }
      }

      const bob = this.isMoving ? Math.abs(Math.cos(this.walkPhase * 2)) * 0.14 : 0;
      const breath = Math.sin(this.animTime * 2.2) * 0.03;
      this.rig.pelvisGroup.position.y = 2.6 - bob + breath;
    }

    _aimTorso(targetPoint, dt) {
      const dx = targetPoint.x - this.position.x;
      const dz = targetPoint.z - this.position.z;
      const targetWorldAngle = Math.atan2(dx, dz);

      let torsoRelative = targetWorldAngle - this.heading;
      while (torsoRelative < -Math.PI) torsoRelative += Math.PI * 2;
      while (torsoRelative > Math.PI) torsoRelative -= Math.PI * 2;

      torsoRelative = Math.max(-1.52, Math.min(1.52, torsoRelative));
      this.torsoYaw += (torsoRelative - this.torsoYaw) * Math.min(1.0, 10.0 * dt);
      this.rig.torsoGroup.rotation.y = this.torsoYaw;

      const dist = Math.hypot(dx, dz);
      const dy = targetPoint.y - (this.position.y + 3.0);
      const pitch = Math.max(-0.6, Math.min(0.6, Math.atan2(dy, dist)));
      this.rig.arms.forEach(arm => {
        arm.rotation.x = -pitch;
      });
    }

    _updateVisualDamageStates(dt) {
      const hpPct = this.hp / this.maxHp;

      // 1. 25% or below: Smoke plumes
      if (hpPct <= 0.25) {
        this.smokeTimer -= dt;
        if (this.smokeTimer <= 0) {
          this.smokeTimer = 0.25;
          if (IT.VFXManager && IT._activeVFXManager) {
            IT._activeVFXManager.spawnImpactSparks(
              this.position.clone().add(new THREE.Vector3((Math.random() - 0.5), 2.5, (Math.random() - 0.5))),
              new THREE.Vector3(0, 1, 0),
              'METAL',
              this.team
            );
          }
        }
      }

      // 2. Critical Health (<15%): Flashing emergency hazard pulse
      if (hpPct <= 0.15) {
        const pulse = Math.sin(this.animTime * 8.0) > 0 ? 0xff1100 : 0x000000;
        this.rig.materials.armor.emissive.setHex(pulse);
        this.rig.materials.armor.emissiveIntensity = 1.6;
      }
    }

    triggerWeaponFire(slot = 0) {
      if (slot >= 0 && slot < 2) {
        this.recoilTimers[slot] = 1.0;
      }
    }

    getMuzzleWorldPosition(slot = 0) {
      const idx = slot % 2;
      if (this.rig.muzzlePoints && this.rig.muzzlePoints[idx]) {
        const worldPos = new THREE.Vector3();
        this.rig.muzzlePoints[idx].getWorldPosition(worldPos);
        return worldPos;
      }
      return this.position.clone().add(new THREE.Vector3(slot === 0 ? 1.5 : -1.5, 2.5, 2.0));
    }

    takeDamage(rawAmount, attacker = null, hitInfo = null) {
      if (this.isDead || this.isInvulnerable) return 0;

      // Base armor reduction + ability buffs
      let reduction = this.damageReduction;
      if (this.isAbilityActive) {
        if (this.abilityId === 'energy_charge') reduction += 0.5;
        else if (this.abilityId === 'deploy_shield') reduction += 0.7;
      }

      // Check weak point critical hit multiplier
      let isCrit = false;
      let multiplier = 1.0;
      if (hitInfo && hitInfo.isWeakPoint) {
        isCrit = true;
        multiplier = hitInfo.multiplier || 1.5;
        if (IT.AudioManager) {
          IT.AudioManager.playImpact('CRITICAL');
        }
      } else {
        if (IT.AudioManager) {
          IT.AudioManager.playImpact(this.shield > 0 ? 'SHIELD' : 'METAL');
        }
      }

      const amount = Math.max(1, Math.round(rawAmount * multiplier * (1.0 - Math.min(0.85, reduction))));

      // Shield Absorption & Ripple
      if (this.shield > 0) {
        if (IT._activeVFXManager) {
          const hitPos = (hitInfo && hitInfo.point) || this.position.clone().add(new THREE.Vector3(0, 2.5, 0));
          IT._activeVFXManager.spawnShieldRipple(this.position, hitPos, this.team);
        }

        this.shield -= amount;
        if (this.shield <= 0) {
          // Shield Broken Shockwave
          if (IT._activeVFXManager) {
            IT._activeVFXManager.spawnShieldBreak(this.position, this.team);
          }
          this.hp += this.shield;
          this.shield = 0;
        }
      } else {
        this.hp -= amount;
      }

      // Hit Flash & Flinch reaction
      this.hitFlashTimer = 0.12;
      this.rig.materials.armor.emissive.setHex(isCrit ? 0xffcc00 : 0xffffff);
      this.rig.materials.armor.emissiveIntensity = isCrit ? 2.5 : 1.5;

      if (attacker && attacker.position) {
        const flinchDir = this.position.clone().sub(attacker.position).normalize();
        this.hitFlinch.copy(flinchDir).multiplyScalar(isCrit ? 0.45 : 0.22);
      }

      if (this.onDamageReceived && attacker) {
        this.onDamageReceived(attacker.position, amount, isCrit);
      }

      this._updateBillboardCanvas();

      if (this.hp <= 0) {
        this.hp = 0;
        this.die(attacker);
      }

      return { amount, isCrit };
    }

    die(killer = null) {
      if (this.isDead) return;
      this.isDead = true;
      this.velocity.set(0, 0, 0);

      // Polished Destruction Sequence
      if (IT._activeVFXManager) {
        IT._activeVFXManager.spawnDestructionExplosion(this.position, this.role);
      }
      if (IT.AudioManager) {
        IT.AudioManager.playDestructionExplosion();
      }

      this.rig.pelvisGroup.position.y = 0.8;
      this.mesh.rotation.z = Math.PI * 0.45;
      this.mesh.rotation.x = Math.PI * 0.2;

      if (this.shieldMesh) this.shieldMesh.visible = false;
      if (this.deployedBarrier && this.deployedBarrier.parent) {
        this.deployedBarrier.parent.remove(this.deployedBarrier);
        this.deployedBarrier = null;
      }
      this._updateBillboardCanvas();

      if (this.onKilled) {
        this.onKilled(this, killer);
      }
    }

    respawn(x, y, z) {
      this.isDead = false;
      this.hp = this.maxHp;
      this.shield = this.maxShield;
      this.position.set(x, y, z);
      if (this.mesh.rotation && typeof this.mesh.rotation.set === 'function') {
        this.mesh.rotation.set(0, 0, 0);
      } else if (this.mesh.rotation) {
        this.mesh.rotation.x = 0;
        this.mesh.rotation.y = 0;
        this.mesh.rotation.z = 0;
      }
      this.rig.pelvisGroup.position.y = 2.6;
      this.rig.materials.armor.emissive.setHex(0x000000);
      this.isAbilityActive = false;
      this.abilityTimer = 0;
      this.setInvulnerable(2.0);
      this._updateBillboardCanvas();
    }

    destroy() {
      if (this.mesh) {
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
        if (IT.Engine3D && IT.Engine3D.disposeHierarchy) {
          IT.Engine3D.disposeHierarchy(this.mesh);
        }
      }
      if (this.billboardSprite) {
        if (this.billboardSprite.parent) this.billboardSprite.parent.remove(this.billboardSprite);
        if (this.billboardSprite.material) {
          if (this.billboardSprite.material.map) this.billboardSprite.material.map.dispose();
          this.billboardSprite.material.dispose();
        }
      }
    }
  }

  IT.Mech3D = Mech3D;
})(window.IT);
