/**
 * Iron Titans — Turret.js
 * Deployable sentinel automated defense turret.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  let _turretId = 1;

  class Turret {
    constructor(x, y, team, ownerId, def = {}) {
      this.id = _turretId++;
      this.x = x;
      this.y = y;
      this.team = team !== undefined ? team : 0;
      this.ownerId = ownerId || 0;
      this.def = def;

      this.maxHp = def.turretHp || 160;
      this.hp = this.maxHp;
      this.radius = 18;
      this.angle = 0;

      this.range = def.range || 260;
      this.damage = def.damage || 28;
      this.fireRate = def.turretFireRate || 0.5;
      this.fireTimer = 0;
      this.scanTimer = 0;
      this.target = null;
      this.isDead = false;

      this.color = def.color || '#44ff88';
      this.glowColor = def.glowColor || '#00bb44';
    }

    update(dt, world) {
      if (this.isDead) return;

      if (this.fireTimer > 0) this.fireTimer -= dt;
      this.scanTimer -= dt;

      // Scan for targets periodically
      if (this.scanTimer <= 0) {
        this.scanTimer = 0.25;
        this._findTarget(world);
      }

      // Verify current target
      if (this.target) {
        if (this.target.isDead || Math.hypot(this.target.x - this.x, this.target.y - this.y) > this.range + 40) {
          this.target = null;
        }
      }

      // Track target and fire
      if (this.target) {
        const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        // Smooth rotation
        let diff = targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.angle += diff * Math.min(1, 10 * dt);

        // Fire when aligned and off cooldown
        if (Math.abs(diff) < 0.35 && this.fireTimer <= 0) {
          this.fire(world);
          this.fireTimer = this.fireRate;
        }
      }
    }

    _findTarget(world) {
      if (!world || !world.mechs) return;
      let closest = null;
      let minDst = this.range;

      for (let i = 0; i < world.mechs.length; i++) {
        const m = world.mechs[i];
        if (m.isDead || m.team === this.team) continue;

        const dist = Math.hypot(m.x - this.x, m.y - this.y);
        if (dist < minDst) {
          // Check line of sight
          if (IT.Physics && IT.Physics.lineOfSight && world.obstacles) {
            if (!IT.Physics.lineOfSight(this.x, this.y, m.x, m.y, world.obstacles)) {
              continue;
            }
          }
          minDst = dist;
          closest = m;
        }
      }

      this.target = closest;
    }

    fire(world) {
      if (!world) return;
      const spd = 550;
      const projConfig = {
        x: this.x + Math.cos(this.angle) * (this.radius + 4),
        y: this.y + Math.sin(this.angle) * (this.radius + 4),
        vx: Math.cos(this.angle) * spd,
        vy: Math.sin(this.angle) * spd,
        radius: 4,
        damage: this.damage,
        team: this.team,
        ownerId: this.ownerId,
        weaponId: 'sentinelTurret',
        range: this.range,
        color: this.color,
        glowColor: this.glowColor
      };

      if (IT.Projectile && world.addProjectile) {
        world.addProjectile(new IT.Projectile(projConfig));
      }
    }

    takeDamage(amount) {
      if (this.isDead) return;
      this.hp -= amount;
      if (this.hp <= 0) {
        this.hp = 0;
        this.die();
      }
    }

    die() {
      this.isDead = true;
      if (window._ironTitans && window._ironTitans.renderer) {
        window._ironTitans.renderer.spawnParticles(this.x, this.y, {
          count: 14,
          color: this.color,
          spread: Math.PI * 2,
          speed: 180,
          size: 4,
          life: 0.5,
          gravity: 80,
          glow: true
        });
      }
    }
  }

  IT.Turret = Turret;
})(window.IT);
