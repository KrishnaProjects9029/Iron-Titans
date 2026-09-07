/**
 * Iron Titans — HUD.js
 * In-game tactical heads-up display drawn directly on Canvas overlay:
 * team scores, match timer, pilot HP/shield bars, weapon slots, ability recharge ring,
 * animated kill feed, and floating combat text.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class HUD {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.killFeed = [];
      this.damageNumbers = [];
    }

    addKillFeedEntry(killerName, killerTeam, victimName, victimTeam) {
      this.killFeed.unshift({
        killerName,
        killerTeam,
        victimName,
        victimTeam,
        timer: 4.0
      });
      if (this.killFeed.length > 5) this.killFeed.pop();
    }

    addDamageNumber(x, y, amount, isCrit = false, isHeal = false) {
      this.damageNumbers.push({
        worldX: x + (Math.random() * 20 - 10),
        worldY: y,
        amount: Math.round(amount),
        isCrit,
        isHeal,
        life: 0.85,
        maxLife: 0.85
      });
    }

    update(dt) {
      // Tick kill feed timers
      for (let i = this.killFeed.length - 1; i >= 0; i--) {
        this.killFeed[i].timer -= dt;
        if (this.killFeed[i].timer <= 0) {
          this.killFeed.splice(i, 1);
        }
      }

      // Tick floating damage numbers
      for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
        const dn = this.damageNumbers[i];
        dn.life -= dt;
        dn.worldY -= 45 * dt;
        if (dn.life <= 0) {
          this.damageNumbers.splice(i, 1);
        }
      }
    }

    draw(world, playerMech) {
      if (!world) return;
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const camera = (window._ironTitans && window._ironTitans.renderer)
        ? window._ironTitans.renderer.camera
        : { x: 0, y: 0 };

      ctx.save();

      // 1. Top Center Score & Timer Panel
      this._drawScorePanel(world, w, h);

      // 2. Pilot Health & Shield (Bottom Left)
      if (playerMech) {
        this._drawPlayerStatus(playerMech, w, h);
        this._drawWeaponHUD(playerMech, w, h);
        this._drawAbilityHUD(playerMech, w, h);
      }

      // 3. Floating Damage Numbers (Screen Space converted from World)
      this._drawDamageNumbers(camera);

      // 4. Kill Feed (Top Right)
      this._drawKillFeed(w, h);

      // 5. Death / Respawn Screen
      if (playerMech && playerMech.isDead) {
        this._drawDeathScreen(world, w, h);
      }

      ctx.restore();
    }

    _drawScorePanel(world, w, h) {
      const ctx = this.ctx;
      const panelW = 280;
      const panelH = 54;
      const px = (w - panelW) / 2;
      const py = 12;

      // Dark sci-fi header backdrop
      ctx.fillStyle = 'rgba(10, 14, 22, 0.88)';
      ctx.beginPath();
      ctx.roundRect(px, py, panelW, panelH, [0, 0, 10, 10]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Blue Team Score
      ctx.fillStyle = '#4aaeff';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(world.scores[0], px + 80, py + 34);

      // Match Countdown Timer
      const mins = Math.floor(world.matchTimer / 60);
      const secs = Math.floor(world.matchTimer % 60);
      const timerStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      ctx.fillStyle = world.matchTimer < 30 ? '#ff3333' : '#ffffff';
      ctx.font = 'bold 20px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(timerStr, px + panelW / 2, py + 32);

      // Mode indicator
      ctx.font = '9px system-ui';
      ctx.fillStyle = '#8899aa';
      ctx.fillText(world.modeDef ? world.modeDef.name.toUpperCase() : 'SKIRMISH', px + panelW / 2, py + 46);

      // Red Team Score
      ctx.fillStyle = '#ff4545';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(world.scores[1], px + panelW - 80, py + 34);
    }

    _drawPlayerStatus(playerMech, w, h) {
      const ctx = this.ctx;
      const bx = 20;
      const by = h - 90;
      const bw = 220;

      ctx.fillStyle = 'rgba(12, 16, 26, 0.85)';
      ctx.beginPath();
      ctx.roundRect(bx - 6, by - 26, bw + 12, 106, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(74, 174, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mech Name & Role
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`${playerMech.def.name.toUpperCase()} [${playerMech.def.role}]`, bx, by - 8);

      // Shield Bar (Cyan)
      const maxS = playerMech.maxShield || 1;
      const sPct = Math.max(0, Math.min(1, playerMech.shield / maxS));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(bx, by, bw, 10);
      ctx.fillStyle = '#00e1ff';
      ctx.fillRect(bx, by, bw * sPct, 10);
      ctx.font = '9px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`SHIELD: ${Math.round(playerMech.shield)}`, bx + 4, by + 8);

      // Health Bar (Green/Yellow/Red)
      const maxH = playerMech.maxHp || 1;
      const hPct = Math.max(0, Math.min(1, playerMech.hp / maxH));
      const hpColor = hPct > 0.5 ? '#00ff88' : (hPct > 0.25 ? '#ffbb00' : '#ff3333');

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(bx, by + 16, bw, 16);
      ctx.fillStyle = hpColor;
      ctx.fillRect(bx, by + 16, bw * hPct, 16);
      ctx.font = 'bold 11px system-ui';
      ctx.fillStyle = '#000000';
      ctx.fillText(`HP ${Math.round(playerMech.hp)} / ${playerMech.maxHp}`, bx + 6, by + 28);
    }

    _drawWeaponHUD(playerMech, w, h) {
      if (!playerMech.weaponSystem) return;
      const ctx = this.ctx;
      const ws = playerMech.weaponSystem;
      const startX = w - 190;
      const startY = h - 90;

      for (let i = 0; i < 2; i++) {
        const state = ws.getWeaponState(i);
        if (!state) continue;
        const x = startX + i * 85;
        const y = startY;

        ctx.fillStyle = 'rgba(12, 16, 26, 0.85)';
        ctx.beginPath();
        ctx.roundRect(x, y, 78, 70, 6);
        ctx.fill();
        ctx.strokeStyle = state.cooldownPct > 0 ? 'rgba(255, 255, 255, 0.15)' : state.def.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Weapon name
        ctx.font = 'bold 9px system-ui';
        ctx.fillStyle = state.def.color;
        ctx.textAlign = 'center';
        ctx.fillText(state.def.name.slice(0, 10), x + 39, y + 14);

        // Ammo count or infinite
        ctx.font = 'bold 16px system-ui';
        ctx.fillStyle = '#ffffff';
        if (state.isReloading) {
          ctx.fillStyle = '#ffaa00';
          ctx.fillText('RELOAD', x + 39, y + 36);
        } else if (state.maxAmmo > 0) {
          ctx.fillText(`${state.ammo}`, x + 39, y + 36);
        } else {
          ctx.fillText('∞', x + 39, y + 36);
        }

        // Slot tag [LMB] / [RMB]
        ctx.font = '8px system-ui';
        ctx.fillStyle = '#7f8ba6';
        ctx.fillText(i === 0 ? '[LMB / Fire]' : '[RMB / Alt]', x + 39, y + 58);

        // Cooldown dark shade overlay
        if (state.cooldownPct > 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fillRect(x, y, 78, 70 * state.cooldownPct);
        }
      }
    }

    _drawAbilityHUD(playerMech, w, h) {
      const ctx = this.ctx;
      const cx = w / 2;
      const cy = h - 45;
      const r = 24;

      // Outer circle
      ctx.fillStyle = 'rgba(14, 18, 30, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190, 85, 236, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const cd = playerMech.abilityTimer || 0;
      if (cd > 0) {
        // Cooldown arc
        const maxCd = playerMech.abilityCooldown || 10;
        const pct = cd / maxCd;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(cd)}s`, cx, cy);
      } else {
        ctx.fillStyle = '#ffd043';
        ctx.font = '16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', cx, cy - 2);
      }

      ctx.font = '8px system-ui';
      ctx.fillStyle = '#bf55ec';
      ctx.fillText('[SPACE]', cx, cy + r + 12);
    }

    _drawDamageNumbers(camera) {
      const ctx = this.ctx;
      this.damageNumbers.forEach(dn => {
        const sx = dn.worldX - camera.x;
        const sy = dn.worldY - camera.y;
        const alpha = Math.max(0, dn.life / dn.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = dn.isCrit ? 'bold 22px system-ui' : 'bold 15px system-ui';
        ctx.fillStyle = dn.isHeal ? '#00ff88' : (dn.isCrit ? '#ffd700' : '#ff4444');
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(dn.amount, sx, sy);
        ctx.restore();
      });
    }

    _drawKillFeed(w, h) {
      const ctx = this.ctx;
      const startX = w - 20;
      let startY = 24;

      this.killFeed.forEach(entry => {
        const alpha = Math.min(1.0, entry.timer);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'right';

        const text = `${entry.killerName} ⚔ ${entry.victimName}`;
        const metrics = ctx.measureText(text);

        ctx.fillStyle = 'rgba(10, 14, 22, 0.75)';
        ctx.fillRect(startX - metrics.width - 16, startY - 14, metrics.width + 16, 20);

        ctx.fillStyle = entry.killerTeam === 0 ? '#4aaeff' : (entry.killerTeam === 1 ? '#ff4545' : '#aaaaaa');
        ctx.fillText(text, startX - 8, startY);

        ctx.restore();
        startY += 24;
      });
    }

    _drawDeathScreen(world, w, h) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(40, 0, 0, 0.55)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 36px system-ui';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 20;
      ctx.fillText('MECH DESTROYED', w / 2, h / 2 - 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = '16px system-ui';
      ctx.shadowBlur = 0;
      ctx.fillText('Reconstructing combat frame...', w / 2, h / 2 + 20);
      ctx.restore();
    }
  }

  IT.HUD = HUD;
})(window.IT);
