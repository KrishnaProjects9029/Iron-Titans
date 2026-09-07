/**
 * Iron Titans — Renderer.js
 * High-performance Canvas 2D rendering pipeline with camera tracking, screen shake,
 * procedural mech geometry, particle effects, projectile trails, and tactical minimap.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.camera = { x: 0, y: 0 };
      this.particles = [];
      this.trauma = 0;
      this.shake = { x: 0, y: 0 };
      this.animTime = 0;
      this.TILE_SIZE = 40;
    }

    update(dt) {
      this.animTime += dt;

      // Screen shake trauma decay
      if (this.trauma > 0) {
        this.trauma = Math.max(0, this.trauma - dt * 1.5);
        const shakeIntensity = this.trauma * this.trauma;
        const maxOffset = 18 * shakeIntensity;
        this.shake.x = (Math.random() * 2 - 1) * maxOffset;
        this.shake.y = (Math.random() * 2 - 1) * maxOffset;
      } else {
        this.shake.x = 0;
        this.shake.y = 0;
      }

      // Update particle physics
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.gravity) p.vy += p.gravity * dt;
        p.vx *= Math.pow(0.85, dt);
        p.vy *= Math.pow(0.85, dt);
      }
    }

    addTrauma(amount) {
      this.trauma = Math.min(1.0, this.trauma + amount);
    }

    updateCamera(playerMech, worldW, worldH) {
      if (!playerMech) return;
      const targetX = playerMech.x - this.canvas.width / 2;
      const targetY = playerMech.y - this.canvas.height / 2;

      // Smooth camera lerp
      this.camera.x += (targetX - this.camera.x) * 0.12;
      this.camera.y += (targetY - this.camera.y) * 0.12;

      // Clamp camera to world boundary
      this.camera.x = Math.max(0, Math.min(worldW - this.canvas.width, this.camera.x));
      this.camera.y = Math.max(0, Math.min(worldH - this.canvas.height, this.camera.y));
    }

    spawnParticles(x, y, config = {}) {
      const count = config.count || 8;
      const speed = config.speed || 150;
      const color = config.color || '#ff8800';
      const spread = config.spread || Math.PI * 2;
      const baseAngle = config.angle || 0;
      const life = config.life || 0.6;
      const size = config.size || 4;
      const gravity = config.gravity || 0;
      const glow = config.glow || false;

      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * spread;
        const spd = speed * (0.4 + Math.random() * 0.8);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color,
          size: size * (0.6 + Math.random() * 0.8),
          life,
          maxLife: life,
          gravity,
          glow
        });
      }
    }

    draw(world) {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      // Clear background
      ctx.fillStyle = world && world.map && world.map.bgColor ? world.map.bgColor : '#0d0f17';
      ctx.fillRect(0, 0, w, h);

      if (!world) return;

      ctx.save();
      // Apply camera view + screen shake
      ctx.translate(-Math.floor(this.camera.x + this.shake.x), -Math.floor(this.camera.y + this.shake.y));

      // 1. Draw Map & Obstacles
      this._drawMap(world.map, world.obstacles);

      // 2. Draw Hazards
      if (world.map && world.map.hazards) {
        this._drawHazards(world.map.hazards);
      }

      // 3. Draw Domination Capture Zones
      if (world.zones) {
        world.zones.forEach(zone => this._drawZone(zone));
      }

      // 4. Draw Turrets
      if (world.turrets) {
        world.turrets.forEach(turret => this._drawTurret(turret));
      }

      // 5. Draw Mechs
      if (world.mechs) {
        // Sort mechs so front mechs render over rear mechs
        const sortedMechs = [...world.mechs].sort((a, b) => a.y - b.y);
        sortedMechs.forEach(m => this._drawMech(m, m === world.playerMech));
      }

      // 6. Draw Projectiles
      if (world.projectiles) {
        world.projectiles.forEach(proj => this._drawProjectile(proj));
      }

      // 7. Draw Visual Effects (Explosions, Sweeps, Pulses)
      if (world.effects) {
        world.effects.forEach(eff => this._drawEffect(eff));
      }

      // 8. Draw Particles
      this._drawParticles();

      ctx.restore();

      // 9. Draw Minimap Overlay (Screen Space)
      this._drawMinimap(world);
    }

    _drawMap(mapDef, obstacles) {
      const ctx = this.ctx;
      if (!mapDef) return;

      const floorCol = mapDef.floorColor || '#1b1e2c';
      const wallCol = mapDef.wallColor || '#36405e';
      const accentCol = mapDef.accentColor || '#4aaeff';

      // Floor backdrop
      ctx.fillStyle = floorCol;
      ctx.fillRect(0, 0, 1600, 1200);

      // Subtle tech floor grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const step = 80;
      for (let x = 0; x <= 1600; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1200);
        ctx.stroke();
      }
      for (let y = 0; y <= 1200; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1600, y);
        ctx.stroke();
      }

      // Draw obstacles / walls
      if (obstacles) {
        for (let i = 0; i < obstacles.length; i++) {
          const obs = obstacles[i];
          // Wall shadow
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(obs.x + 4, obs.y + 6, obs.w, obs.h);

          // Wall surface
          ctx.fillStyle = obs.color || wallCol;
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

          // Wall bevel / outline
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

          // Accent neon trim
          ctx.fillStyle = accentCol;
          ctx.fillRect(obs.x + 2, obs.y + 2, Math.min(8, obs.w - 4), Math.min(8, obs.h - 4));
        }
      }
    }

    _drawHazards(hazards) {
      const ctx = this.ctx;
      const pulse = Math.sin(this.animTime * 4) * 0.15 + 0.85;

      hazards.forEach(h => {
        if (h.type === 'lava') {
          const grad = ctx.createLinearGradient(h.x, h.y, h.x + h.w, h.y + h.h);
          grad.addColorStop(0, `rgba(255, 68, 0, ${0.45 * pulse})`);
          grad.addColorStop(1, `rgba(255, 150, 0, ${0.35 * pulse})`);
          ctx.fillStyle = grad;
          ctx.fillRect(h.x, h.y, h.w, h.h);

          ctx.strokeStyle = `rgba(255, 100, 0, ${0.8 * pulse})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(h.x, h.y, h.w, h.h);
        } else if (h.type === 'water') {
          ctx.fillStyle = `rgba(0, 160, 255, ${0.28 * pulse})`;
          ctx.fillRect(h.x, h.y, h.w, h.h);
          ctx.strokeStyle = 'rgba(100, 220, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(h.x, h.y, h.w, h.h);
        }
      });
    }

    _drawZone(zone) {
      const ctx = this.ctx;
      const pulse = Math.sin(this.animTime * 3) * 0.1 + 0.9;
      const r = zone.radius * pulse;

      // Outer dashed ring
      ctx.save();
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Semi-transparent inner capture fill
      const dominantTeam = zone.controllingTeam;
      if (dominantTeam >= 0) {
        ctx.fillStyle = dominantTeam === 0 ? 'rgba(74, 174, 255, 0.18)' : 'rgba(255, 69, 69, 0.18)';
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Zone letter icon
      ctx.font = 'bold 26px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone.letter, zone.x, zone.y);

      // Capture progress bar ring
      const prog = zone.progress[0] > 0 ? zone.progress[0] : zone.progress[1];
      if (prog > 0) {
        const teamColor = zone.progress[0] > 0 ? '#4aaeff' : '#ff4545';
        ctx.strokeStyle = teamColor;
        ctx.lineWidth = 5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, r + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (prog / 100)));
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawTurret(turret) {
      if (turret.isDead) return;
      const ctx = this.ctx;
      const teamCol = turret.team === 0 ? '#4aaeff' : '#ff4545';

      ctx.save();
      ctx.translate(turret.x, turret.y);

      // Base footprint
      ctx.fillStyle = '#222638';
      ctx.strokeStyle = teamCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-turret.radius, -turret.radius, turret.radius * 2, turret.radius * 2, 4);
      ctx.fill();
      ctx.stroke();

      // Rotating gun mount
      ctx.rotate(turret.angle);
      ctx.fillStyle = '#556080';
      ctx.fillRect(0, -3, turret.radius + 6, 6); // Twin barrel
      ctx.fillStyle = turret.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Health bar above turret
      this._drawEntityBar(turret.x, turret.y - turret.radius - 10, turret.hp, turret.maxHp, '#44ff88', 30);
    }

    _drawMech(mech, isPlayer) {
      const ctx = this.ctx;
      if (mech.isDead) {
        // Draw scorched wreck crater
        ctx.save();
        ctx.fillStyle = 'rgba(20, 20, 20, 0.6)';
        ctx.beginPath();
        ctx.arc(mech.x, mech.y, mech.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      const teamColor = mech.team === 0 ? '#4aaeff' : '#ff4545';
      const def = mech.def || { color: '#8899aa', accentColor: '#aabbcc', shape: 'hexagon' };

      ctx.save();
      ctx.translate(mech.x, mech.y);

      // 1. Soft ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 6, mech.radius * 1.1, mech.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Shield aura bubble
      if (mech.shield > 0) {
        const shieldRatio = mech.shield / mech.maxShield;
        ctx.strokeStyle = `rgba(0, 220, 255, ${0.3 + shieldRatio * 0.5})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, mech.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotate mech to facing direction
      ctx.rotate(mech.angle);

      // 3. Weapon barrels
      ctx.fillStyle = '#222838';
      ctx.fillRect(mech.radius * 0.3, -mech.radius * 0.5, mech.radius * 0.9, 4);
      ctx.fillRect(mech.radius * 0.3, mech.radius * 0.5 - 4, mech.radius * 0.9, 4);

      // 4. Procedural Chassis Geometry based on Archetype Shape
      ctx.fillStyle = def.color;
      ctx.strokeStyle = isPlayer ? '#ffffff' : teamColor;
      ctx.lineWidth = isPlayer ? 3 : 2;

      const r = mech.radius;
      ctx.beginPath();

      if (def.shape === 'hexagon') {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else if (def.shape === 'diamond') {
        ctx.moveTo(r * 1.3, 0);
        ctx.lineTo(0, -r * 0.85);
        ctx.lineTo(-r * 0.9, 0);
        ctx.lineTo(0, r * 0.85);
        ctx.closePath();
      } else if (def.shape === 'triangle') {
        ctx.moveTo(r * 1.3, 0);
        ctx.lineTo(-r * 0.9, -r);
        ctx.lineTo(-r * 0.5, 0);
        ctx.lineTo(-r * 0.9, r);
        ctx.closePath();
      } else if (def.shape === 'square') {
        ctx.roundRect(-r, -r, r * 2, r * 2, 4);
      } else if (def.shape === 'star') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rad = i % 2 === 0 ? r * 1.2 : r * 0.7;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else {
        // Circle default
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      }

      ctx.fill();
      ctx.stroke();

      // 5. Cockpit Canopy Eye
      ctx.fillStyle = def.accentColor || '#ffffff';
      ctx.beginPath();
      ctx.arc(r * 0.35, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Ability flash overlay
      if (mech.abilityActive || mech.isFortifying) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fill();
      }

      ctx.restore();

      // 6. Overhead Overhead Health & Shield Status Bars
      const barY = mech.y - mech.radius - 18;
      const barW = 44;

      // Shield bar (cyan)
      if (mech.maxShield > 0) {
        this._drawEntityBar(mech.x, barY, Math.max(0, mech.shield), mech.maxShield, '#00e1ff', barW, 4);
      }
      // Health bar (team colored or player green)
      const hpColor = isPlayer ? '#00ff88' : teamColor;
      this._drawEntityBar(mech.x, barY + 5, Math.max(0, mech.hp), mech.maxHp, hpColor, barW, 5);

      // Name & role label
      ctx.font = 'bold 11px system-ui';
      ctx.fillStyle = isPlayer ? '#ffff00' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(isPlayer ? `YOU (${def.name})` : def.name, mech.x, barY - 4);
    }

    _drawEntityBar(cx, y, cur, max, color, width = 40, height = 5) {
      const ctx = this.ctx;
      const x = cx - width / 2;
      const pct = Math.max(0, Math.min(1, cur / (max || 1)));

      // Dark background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x, y, width, height);

      // Filled amount
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width * pct, height);

      // Thin border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
    }

    _drawProjectile(proj) {
      if (!proj.isAlive) return;
      const ctx = this.ctx;

      // 1. Trail
      if (proj.trail && proj.trail.length > 1) {
        ctx.save();
        for (let i = 0; i < proj.trail.length - 1; i++) {
          const t1 = proj.trail[i];
          const t2 = proj.trail[i + 1];
          const alpha = (i / proj.trail.length) * 0.4;
          ctx.strokeStyle = proj.color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = proj.radius * 0.8;
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y);
          ctx.lineTo(t2.x, t2.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Singularity vortex gravity well
      if (proj.isGravityWell) {
        ctx.save();
        const pulse = Math.sin(this.animTime * 8) * 0.15 + 0.85;
        const radius = proj.isStationary ? proj.aoeRadius * pulse : proj.radius * 2;

        ctx.strokeStyle = proj.glowColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(120, 0, 220, 0.25)';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // 3. Regular ballistic projectile
      ctx.save();
      ctx.fillStyle = proj.color;
      ctx.shadowColor = proj.glowColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _drawEffect(eff) {
      const ctx = this.ctx;
      const progress = 1 - (eff.life / eff.maxLife);

      if (eff.type === 'explosion') {
        const r = eff.r * (0.3 + progress * 0.7);
        ctx.save();
        ctx.strokeStyle = eff.color || '#ff8800';
        ctx.lineWidth = Math.max(1, 6 * (1 - progress));
        ctx.globalAlpha = 1 - progress;
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (eff.type === 'arcSweep') {
        ctx.save();
        ctx.strokeStyle = eff.color || '#ff00aa';
        ctx.lineWidth = 8 * (1 - progress);
        ctx.globalAlpha = 1 - progress;
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, eff.range, eff.angle - eff.sweepAngle / 2, eff.angle + eff.sweepAngle / 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    _drawParticles() {
      const ctx = this.ctx;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.glow) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
        }
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    _drawMinimap(world) {
      const ctx = this.ctx;
      const mw = 160;
      const mh = 120;
      const mx = 16;
      const my = 16;
      const scaleX = mw / 1600;
      const scaleY = mh / 1200;

      ctx.save();
      // Minimap background panel
      ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = 'rgba(74, 174, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mx, my, mw, mh);

      // Obstacles
      if (world.obstacles) {
        ctx.fillStyle = '#3a4460';
        world.obstacles.forEach(obs => {
          ctx.fillRect(mx + obs.x * scaleX, my + obs.y * scaleY, obs.w * scaleX, obs.h * scaleY);
        });
      }

      // Capture Zones
      if (world.zones) {
        world.zones.forEach(z => {
          ctx.fillStyle = z.controllingTeam === 0 ? '#4aaeff' : z.controllingTeam === 1 ? '#ff4545' : '#aaaaaa';
          ctx.beginPath();
          ctx.arc(mx + z.x * scaleX, my + z.y * scaleY, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Mechs on radar
      if (world.mechs) {
        world.mechs.forEach(m => {
          if (m.isDead) return;
          const px = mx + m.x * scaleX;
          const py = my + m.y * scaleY;
          if (m === world.playerMech) {
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = m.team === 0 ? '#4aaeff' : '#ff4545';
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Viewport rectangle indicator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        mx + this.camera.x * scaleX,
        my + this.camera.y * scaleY,
        this.canvas.width * scaleX,
        this.canvas.height * scaleY
      );

      ctx.restore();
    }
  }

  IT.Renderer = Renderer;
})(window.IT);
