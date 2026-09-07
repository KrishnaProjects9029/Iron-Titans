/**
 * Iron Titans — Projectile.js
 * Bullet, rocket, flechette, grenade, and vortex singularity projectile entities.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  let _projId = 1;

  class Projectile {
    constructor(config) {
      this.id = _projId++;
      this.x = config.x || 0;
      this.y = config.y || 0;
      this.vx = config.vx || 0;
      this.vy = config.vy || 0;
      this.radius = config.radius || 5;
      this.damage = config.damage || 20;
      this.team = config.team !== undefined ? config.team : -1;
      this.ownerId = config.ownerId || 0;
      this.weaponId = config.weaponId || 'pulsarCannon';
      this.range = config.range || 500;
      this.distTraveled = 0;
      this.isAlive = true;

      this.aoeRadius = config.aoeRadius || 0;
      this.slowFactor = config.slowFactor || 0;
      this.slowDuration = config.slowDuration || 0;
      this.isCrit = config.isCrit || false;

      // Special Gravity Well
      this.isGravityWell = config.isGravityWell || false;
      this.duration = config.duration || 3.0;
      this.pullForce = config.pullForce || 280;
      this.wellTimer = 0;
      this.isStationary = false;

      this.color = config.color || '#00ffff';
      this.glowColor = config.glowColor || '#0088ff';

      // Visual trail
      this.trail = [];
      this.maxTrail = 6;
    }

    update(dt, world) {
      if (!this.isAlive) return;

      // Update trail
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) {
        this.trail.shift();
      }

      // ── Gravity Well vortex behavior ──
      if (this.isGravityWell && this.isStationary) {
        this.wellTimer += dt;
        if (this.wellTimer >= this.duration) {
          this.isAlive = false;
          return;
        }

        // Pull enemy mechs and inflict ticking damage
        if (world && world.mechs) {
          world.mechs.forEach(m => {
            if (m.isDead || m.team === this.team) return;
            const dx = this.x - m.x;
            const dy = this.y - m.y;
            const dist = Math.hypot(dx, dy);
            if (dist < this.aoeRadius && dist > 2) {
              const force = (1 - dist / this.aoeRadius) * this.pullForce;
              m.vx += (dx / dist) * force * dt;
              m.vy += (dy / dist) * force * dt;
              m.takeDamage(this.damage * dt, null, false);
            }
          });
        }
        return;
      }

      // Regular ballistic flight
      const moveDist = Math.hypot(this.vx, this.vy) * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.distTraveled += moveDist;

      // Check max range
      if (this.distTraveled >= this.range) {
        if (this.isGravityWell) {
          this.isStationary = true;
          this.vx = 0;
          this.vy = 0;
          return;
        }
        if (this.aoeRadius > 0) {
          this.explode(world);
        }
        this.isAlive = false;
        return;
      }

      // Check collision with obstacles
      if (world && world.obstacles) {
        for (let i = 0; i < world.obstacles.length; i++) {
          const obs = world.obstacles[i];
          if (IT.Physics && IT.Physics.circleRect) {
            if (IT.Physics.circleRect(this.x, this.y, this.radius, obs.x, obs.y, obs.w, obs.h)) {
              if (obs.hp !== undefined) {
                obs.hp -= this.damage;
                if (obs.hp <= 0) {
                  world.obstacles.splice(i, 1);
                }
              }
              if (this.aoeRadius > 0) {
                this.explode(world);
              }
              this.isAlive = false;
              return;
            }
          }
        }
      }

      // Check collision with mechs
      if (world && world.mechs) {
        for (let i = 0; i < world.mechs.length; i++) {
          const target = world.mechs[i];
          if (target.isDead || target.team === this.team) continue;

          const dx = this.x - target.x;
          const dy = this.y - target.y;
          const distSq = dx * dx + dy * dy;
          const hitDist = this.radius + target.radius;

          if (distSq <= hitDist * hitDist) {
            this.hit(target, world);
            return;
          }
        }
      }

      // Check collision with enemy turrets
      if (world && world.turrets) {
        for (let i = 0; i < world.turrets.length; i++) {
          const turret = world.turrets[i];
          if (turret.isDead || turret.team === this.team) continue;

          const dx = this.x - turret.x;
          const dy = this.y - turret.y;
          const distSq = dx * dx + dy * dy;
          const hitDist = this.radius + (turret.radius || 20);

          if (distSq <= hitDist * hitDist) {
            turret.takeDamage(this.damage);
            if (this.aoeRadius > 0) {
              this.explode(world);
            }
            this.isAlive = false;
            return;
          }
        }
      }
    }

    hit(target, world) {
      const ownerMech = world && world.mechs ? world.mechs.find(m => m.id === this.ownerId) : null;
      const actualDmg = target.takeDamage(this.damage, ownerMech, this.isCrit);

      // Apply status effects (e.g. freeze slow)
      if (this.slowFactor > 0 && target.addStatusEffect) {
        target.addStatusEffect('slowed', this.slowDuration, this.slowFactor);
      }

      // Trigger floating combat text & screen shake
      if (window._ironTitans) {
        if (window._ironTitans.hud) {
          window._ironTitans.hud.addDamageNumber(target.x, target.y - target.radius, actualDmg, this.isCrit, false);
        }
        if (window._ironTitans.renderer && (target.isPlayer || (ownerMech && ownerMech.isPlayer))) {
          window._ironTitans.renderer.addTrauma(this.isCrit ? 0.25 : 0.1);
        }
      }

      if (this.aoeRadius > 0) {
        this.explode(world);
      } else if (this.isGravityWell) {
        this.isStationary = true;
        this.vx = 0;
        this.vy = 0;
        return;
      }

      this.isAlive = false;
    }

    explode(world) {
      if (!world || !world.mechs) return;
      const ownerMech = world.mechs.find(m => m.id === this.ownerId);

      world.mechs.forEach(m => {
        if (m.isDead || m.team === this.team) return;
        const dx = this.x - m.x;
        const dy = this.y - m.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= this.aoeRadius) {
          const falloff = 1 - (dist / this.aoeRadius) * 0.5;
          const finalDmg = this.damage * falloff;
          const actual = m.takeDamage(finalDmg, ownerMech, false);

          if (window._ironTitans && window._ironTitans.hud) {
            window._ironTitans.hud.addDamageNumber(m.x, m.y - m.radius, actual, false, false);
          }

          // Knockback
          if (dist > 1 && (!m.def || m.def.passive !== 'immovable')) {
            const push = ((this.aoeRadius - dist) / this.aoeRadius) * 350;
            m.vx -= (dx / dist) * push;
            m.vy -= (dy / dist) * push;
          }
        }
      });

      // Add visual explosion effect to world
      if (world.addEffect) {
        world.addEffect({
          type: 'explosion',
          x: this.x,
          y: this.y,
          r: this.aoeRadius,
          color: this.glowColor,
          life: 0.4,
          maxLife: 0.4
        });
      }
    }
  }

  IT.Projectile = Projectile;
})(window.IT);
