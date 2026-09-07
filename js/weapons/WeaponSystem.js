/**
 * Iron Titans — WeaponSystem.js
 * Complete weapon definitions, firing logic, ammo/reload, and weapon slots.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const WEAPONS = {
    pulsarCannon: {
      id: 'pulsarCannon',
      name: 'Pulsar Cannon',
      type: 'ranged',
      damage: 85,
      cooldown: 0.9,
      range: 480,
      speed: 620,
      projectileRadius: 7,
      projectileCount: 1,
      spread: 0.02,
      color: '#00ffff',
      glowColor: '#0088ff',
      ammo: 10,
      reloadTime: 1.8,
      description: 'High-velocity plasma bolts with pinpoint precision.'
    },
    torrentLauncher: {
      id: 'torrentLauncher',
      name: 'Torrent Launcher',
      type: 'ranged',
      damage: 26,
      cooldown: 0.14,
      range: 420,
      speed: 520,
      projectileRadius: 5,
      projectileCount: 1,
      spread: 0.08,
      color: '#ff8800',
      glowColor: '#ff3300',
      ammo: 24,
      reloadTime: 2.0,
      description: 'Rapid-fire micro-missiles with mild tracking trajectory.'
    },
    arcBlade: {
      id: 'arcBlade',
      name: 'Arc Blade',
      type: 'melee',
      damage: 160,
      cooldown: 0.75,
      range: 100,
      sweepAngle: Math.PI * 0.75,
      color: '#ff22aa',
      glowColor: '#aa00ff',
      ammo: -1,
      description: 'Thermal plasma blade sweep that slices multiple mechs.'
    },
    novaGrenades: {
      id: 'novaGrenades',
      name: 'Nova Grenades',
      type: 'explosive',
      damage: 130,
      cooldown: 0.8,
      range: 380,
      speed: 340,
      projectileRadius: 8,
      aoeRadius: 110,
      color: '#ffdd00',
      glowColor: '#ff6600',
      ammo: 6,
      reloadTime: 2.6,
      description: 'Bouncing ordnance detonating in an intense thermal explosion.'
    },
    cryoBeam: {
      id: 'cryoBeam',
      name: 'Cryo Beam',
      type: 'beam',
      damage: 32,
      cooldown: 0.1,
      range: 350,
      speed: 750,
      projectileRadius: 5,
      slowFactor: 0.5,
      slowDuration: 2.0,
      color: '#aae5ff',
      glowColor: '#3388ff',
      ammo: 45,
      reloadTime: 2.2,
      description: 'Sub-zero cryo stream that freezes and drastically slows targets.'
    },
    scatterFlechettes: {
      id: 'scatterFlechettes',
      name: 'Scatter Flechettes',
      type: 'shotgun',
      damage: 24,
      cooldown: 0.85,
      range: 240,
      speed: 680,
      projectileRadius: 4,
      projectileCount: 8,
      spread: 0.38,
      color: '#ffd043',
      glowColor: '#ff8800',
      ammo: 12,
      reloadTime: 1.9,
      description: 'Heavy 8-pellet kinetic spread devastating at close range.'
    },
    gravityWell: {
      id: 'gravityWell',
      name: 'Gravity Well',
      type: 'aoe',
      damage: 30,
      cooldown: 7.0,
      range: 280,
      aoeRadius: 150,
      duration: 3.2,
      pullForce: 280,
      color: '#cc00ff',
      glowColor: '#7700bb',
      ammo: -1,
      description: 'Singularity projectile creating a vortex that pulls enemies.'
    },
    sentinelTurret: {
      id: 'sentinelTurret',
      name: 'Sentinel Turret',
      type: 'deployable',
      damage: 28,
      cooldown: 14.0,
      range: 260,
      turretHp: 160,
      turretFireRate: 0.5,
      color: '#44ff88',
      glowColor: '#00bb44',
      ammo: 2,
      reloadTime: 5.0,
      description: 'Deploys an autonomous turret that tracks and suppresses foes.'
    }
  };

  class WeaponSlot {
    constructor(weaponDefId) {
      this.def = WEAPONS[weaponDefId] || WEAPONS.pulsarCannon;
      this.cooldownTimer = 0;
      this.currentAmmo = this.def.ammo;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.isCharging = false;
      this.chargeProgress = 0;
    }

    setWeapon(weaponDefId) {
      this.def = WEAPONS[weaponDefId] || WEAPONS.pulsarCannon;
      this.cooldownTimer = 0;
      this.currentAmmo = this.def.ammo;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.isCharging = false;
      this.chargeProgress = 0;
    }

    update(dt) {
      if (this.cooldownTimer > 0) {
        this.cooldownTimer -= dt;
      }
      if (this.isReloading) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) {
          this.isReloading = false;
          this.currentAmmo = this.def.ammo;
        }
      }
    }

    startReload() {
      if (this.def.ammo > 0 && !this.isReloading && this.currentAmmo < this.def.ammo) {
        this.isReloading = true;
        this.reloadTimer = this.def.reloadTime || 2.0;
      }
    }
  }

  class WeaponSystem {
    constructor(owner, initialWeapons = ['pulsarCannon', 'scatterFlechettes']) {
      this.owner = owner;
      this.slots = [
        new WeaponSlot(initialWeapons[0] || 'pulsarCannon'),
        new WeaponSlot(initialWeapons[1] || 'scatterFlechettes')
      ];
    }

    equip(weaponId, slotIdx = 0) {
      if (slotIdx >= 0 && slotIdx < this.slots.length && WEAPONS[weaponId]) {
        this.slots[slotIdx].setWeapon(weaponId);
      }
    }

    update(dt, world) {
      this.slots.forEach(slot => slot.update(dt));
    }

    getWeaponState(slotIdx) {
      const slot = this.slots[slotIdx];
      if (!slot) return null;
      const def = slot.def;
      const cooldownPct = def.cooldown > 0 ? Math.max(0, slot.cooldownTimer / def.cooldown) : 0;
      const reloadPct = slot.isReloading && def.reloadTime > 0
        ? Math.max(0, slot.reloadTimer / def.reloadTime)
        : 0;

      return {
        def,
        cooldownPct,
        ammo: slot.currentAmmo,
        maxAmmo: def.ammo,
        isReloading: slot.isReloading,
        reloadPct,
        isCharging: slot.isCharging
      };
    }

    /**
     * Polymorphic tryFire:
     * tryFire(slot, targetX, targetY, optWorld)
     * tryFire(slot, angle, optWorld)
     */
    tryFire(slotIdx, arg1, arg2, arg3) {
      const slot = this.slots[slotIdx];
      if (!slot || !this.owner || this.owner.isDead) return null;
      if (this.owner.hasStatus && this.owner.hasStatus('stunned')) return null;

      const def = slot.def;

      // Check cooldown and reloading
      if (slot.cooldownTimer > 0) return null;
      if (slot.isReloading) return null;

      // Check ammo
      if (def.ammo > 0 && slot.currentAmmo <= 0) {
        slot.startReload();
        return null;
      }

      let tx, ty, world;
      if (typeof arg2 === 'number') {
        tx = arg1;
        ty = arg2;
        world = arg3;
      } else {
        const angle = typeof arg1 === 'number' ? arg1 : this.owner.angle;
        tx = this.owner.x + Math.cos(angle) * (def.range || 400);
        ty = this.owner.y + Math.sin(angle) * (def.range || 400);
        world = arg2;
      }

      // Decrement ammo and reset cooldown
      if (def.ammo > 0) {
        slot.currentAmmo--;
        if (slot.currentAmmo <= 0) {
          slot.startReload();
        }
      }
      slot.cooldownTimer = def.cooldown;

      const results = [];
      const originX = this.owner.x;
      const originY = this.owner.y;
      const baseAngle = Math.atan2(ty - originY, tx - originX);

      // Weapon multiplier from owner (e.g. passive or crits)
      const dmgMult = (this.owner.getDamageMultiplier ? this.owner.getDamageMultiplier() : 1) || 1;

      // ── Dispatch per weapon type ──
      if (def.type === 'melee') {
        // Melee Arc Sweep
        const sweepAngle = def.sweepAngle || Math.PI * 0.7;
        const halfSweep = sweepAngle / 2;
        const range = def.range || 100;
        const hitTargets = [];

        if (world && world.mechs) {
          world.mechs.forEach(target => {
            if (target === this.owner || target.isDead || target.team === this.owner.team) return;
            const dx = target.x - originX;
            const dy = target.y - originY;
            const dist = Math.hypot(dx, dy);
            if (dist <= range + target.radius) {
              const angToTarget = Math.atan2(dy, dx);
              let diff = angToTarget - baseAngle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              if (Math.abs(diff) <= halfSweep) {
                const isCrit = this.owner.firstStrikeReady || false;
                if (isCrit) this.owner.firstStrikeReady = false;
                const finalDamage = def.damage * dmgMult * (isCrit ? 2.0 : 1.0);
                hitTargets.push({ entity: target, damage: finalDamage, isCrit });
              }
            }
          });
        }

        results.push({
          type: 'meleehit',
          targets: hitTargets
        });

        // Add visual arc sweep effect
        const effectConfig = {
          type: 'arcSweep',
          x: originX,
          y: originY,
          angle: baseAngle,
          sweepAngle,
          range,
          color: def.color,
          life: 0.2,
          maxLife: 0.2
        };
        results.push({ type: 'effect', config: effectConfig });

      } else if (def.type === 'deployable') {
        // Deploy sentinel turret
        const deployDist = 60;
        const depX = originX + Math.cos(baseAngle) * deployDist;
        const depY = originY + Math.sin(baseAngle) * deployDist;

        results.push({
          type: 'turret',
          config: {
            x: depX,
            y: depY,
            team: this.owner.team,
            ownerId: this.owner.id,
            def
          }
        });

      } else if (def.type === 'aoe' && def.id === 'gravityWell') {
        // Singularity vortex effect & projectile
        const spd = 380;
        results.push({
          type: 'projectile',
          config: {
            x: originX,
            y: originY,
            vx: Math.cos(baseAngle) * spd,
            vy: Math.sin(baseAngle) * spd,
            radius: 8,
            damage: def.damage * dmgMult,
            team: this.owner.team,
            ownerId: this.owner.id,
            weaponId: def.id,
            range: def.range,
            aoeRadius: def.aoeRadius,
            duration: def.duration,
            pullForce: def.pullForce,
            isGravityWell: true,
            color: def.color,
            glowColor: def.glowColor
          }
        });

      } else {
        // Projectiles (ranged, shotgun, explosive, beam)
        const count = def.projectileCount || 1;
        const baseSpread = def.spread || 0;
        const speed = def.speed || 500;

        for (let i = 0; i < count; i++) {
          let spreadAngle = 0;
          if (count > 1) {
            spreadAngle = (i / (count - 1) - 0.5) * baseSpread;
          } else if (baseSpread > 0) {
            spreadAngle = (Math.random() - 0.5) * baseSpread;
          }

          const angle = baseAngle + spreadAngle;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;

          const isCrit = this.owner.firstStrikeReady || false;
          if (isCrit && i === 0) this.owner.firstStrikeReady = false;

          const projConfig = {
            x: originX + Math.cos(angle) * (this.owner.radius + 6),
            y: originY + Math.sin(angle) * (this.owner.radius + 6),
            vx,
            vy,
            radius: def.projectileRadius || 5,
            damage: def.damage * dmgMult * (isCrit ? 1.8 : 1.0),
            team: this.owner.team,
            ownerId: this.owner.id,
            weaponId: def.id,
            range: def.range || 400,
            aoeRadius: def.aoeRadius || 0,
            slowFactor: def.slowFactor || 0,
            slowDuration: def.slowDuration || 0,
            color: def.color,
            glowColor: def.glowColor,
            isCrit
          };

          results.push({
            type: 'projectile',
            config: projConfig
          });
        }
      }

      // If world was provided directly (e.g. from BotAI), auto-dispatch to world!
      if (world) {
        results.forEach(r => {
          if (r.type === 'projectile' && world.addProjectile && IT.Projectile) {
            world.addProjectile(new IT.Projectile(r.config));
          } else if (r.type === 'turret' && world.addTurret && IT.Turret) {
            world.addTurret(new IT.Turret(r.config.x, r.config.y, r.config.team, r.config.ownerId, r.config.def));
          } else if (r.type === 'effect' && world.addEffect) {
            world.addEffect(r.config);
          } else if (r.type === 'meleehit' && r.targets) {
            r.targets.forEach(({ entity, damage, isCrit }) => {
              if (!entity.isDead) {
                entity.takeDamage(damage, this.owner, isCrit);
              }
            });
          }
        });
      }

      return results;
    }

    static getDef(id) {
      return WEAPONS[id] || null;
    }

    static getAllDefs() {
      return Object.values(WEAPONS);
    }
  }

  IT.WEAPONS = WEAPONS;
  IT.WeaponSystem = WeaponSystem;
})(window.IT);
