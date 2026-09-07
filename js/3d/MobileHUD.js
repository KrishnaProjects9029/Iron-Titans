/**
 * Iron Titans 3D — MobileHUD.js
 * Mobile-first Tactical HUD for 5v5 Mech Team Battles:
 * - Top Center: Blue vs Red team scores, 5:00 match timer & 25-kill target
 * - Top Left: 2D Radar Minimap displaying all 10 mechs with Fog-of-War line-of-sight rules
 * - Top Right: Real-time Kill Feed broadcast
 * - Center: Reticle, target lock brackets, and directional damage chevrons
 * - Center Screen: Match countdown banner (3... 2... 1... ENGAGE!)
 * - Bottom Left: Player pilot chassis HP & Shield bars, ammo counter, reload progress
 * - Action Controls: Ability countdown ring, secondary weapon, reload button, target lock
 * - End Game: Victory/Defeat modal with match scoreboard & Play Again action
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class MobileHUD {
    constructor() {
      this.minimapCanvas = document.getElementById('hud-minimap-canvas');
      this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

      // Directional damage indicator state
      this.damageIndicators = []; // [{ angle, life, maxLife }]

      // Match state
      this.activeMode = 'SKIRMISH';
      this.blueScore = 0;
      this.redScore = 0;
      this.targetKills = 25;
      this.targetScore = 25;
      this.matchTime = 300; // 5 minutes
      this.activeObjectives = [];

      // Settings
      this.rotateMinimap = true;
      this.vibrationEnabled = true;

      // DOM Elements
      this.killFeedContainer = document.getElementById('kill-feed-container');
      this.countdownBanner = document.getElementById('match-countdown-banner');
      this.matchOverModal = document.getElementById('match-over-modal');
      this.announcementBanner = document.getElementById('objective-announcement-banner');
      this.deathScreen = document.getElementById('hud-death-screen');
      this.deathKillerName = document.getElementById('death-killer-name');
      this.deathKillerWeapon = document.getElementById('death-killer-weapon');
      this.deathKillerDist = document.getElementById('death-killer-distance');
      this.deathCountdown = document.getElementById('death-countdown-val');
      this.dominationBar = document.getElementById('hud-domination-bar');
      this.controlPointBar = document.getElementById('hud-controlpoint-bar');
      this.announcementTimer = 0;

      // Phase 6 Hit Markers & Vignettes
      this.hitMarker = document.getElementById('hud-hit-marker');
      this.hitMarkerCrit = document.getElementById('hud-hit-marker-crit');
      this.hitMarkerElim = document.getElementById('hud-hit-marker-elim');
      this.damageVignette = document.getElementById('hud-damage-vignette');
      this.lowHpVignette = document.getElementById('hud-low-hp-vignette');
      this.debugPanel = document.getElementById('debug-fps-counter');
      this.dbgFps = document.getElementById('dbg-fps');
      this.dbgFt = document.getElementById('dbg-ft');
      this.dbgDc = document.getElementById('dbg-dc');
      this.dbgTri = document.getElementById('dbg-tri');
      this.dbgProj = document.getElementById('dbg-proj');
      this.dbgVfx = document.getElementById('dbg-vfx');
      this.dbgPing = document.getElementById('dbg-ping');

      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
            e.preventDefault();
            this.toggleDebugOverlay();
          }
        });
      }

      this._setupHapticSupport();
    }

    toggleDebugOverlay() {
      if (!this.debugPanel) return;
      const isVisible = this.debugPanel.style.display !== 'none';
      this.debugPanel.style.display = isVisible ? 'none' : 'block';
      if (IT.SaveManager && IT.SaveManager.saveData && IT.SaveManager.saveData.settings) {
        IT.SaveManager.saveData.settings.showFPS = !isVisible;
        IT.SaveManager.save();
      }
    }

    updateDebugPerformance(fps, frameTime, drawCalls, activeProjectiles, triangles = 0, activeVfx = 0, ping = 0) {
      if (!this.debugPanel || this.debugPanel.style.display === 'none') return;
      if (this.dbgFps) this.dbgFps.textContent = `${fps} FPS`;
      if (this.dbgFt) this.dbgFt.textContent = `${frameTime}ms`;
      if (this.dbgDc) this.dbgDc.textContent = `Calls: ${drawCalls}`;
      if (this.dbgTri) this.dbgTri.textContent = `Tris: ${triangles > 1000 ? (triangles / 1000).toFixed(1) + 'k' : triangles}`;
      if (this.dbgProj) this.dbgProj.textContent = `Proj: ${activeProjectiles}`;
      if (this.dbgVfx) this.dbgVfx.textContent = `VFX: ${activeVfx}`;
      if (this.dbgPing) this.dbgPing.textContent = `Ping: ${ping}ms`;
    }

    _setupHapticSupport() {
      this.hasVibrate = typeof navigator !== 'undefined' && Boolean(navigator.vibrate);
    }

    vibrate(pattern = 15) {
      if (this.vibrationEnabled && this.hasVibrate) {
        try {
          navigator.vibrate(pattern);
        } catch (e) {}
      }
    }

    addDamageIndicator(playerPos, playerHeading, attackerPos) {
      if (!playerPos || !attackerPos) return;

      const dx = attackerPos.x - playerPos.x;
      const dz = attackerPos.z - playerPos.z;
      const worldAngle = Math.atan2(dx, dz);

      let relAngle = worldAngle - playerHeading;
      while (relAngle < -Math.PI) relAngle += Math.PI * 2;
      while (relAngle > Math.PI) relAngle -= Math.PI * 2;

      this.damageIndicators.push({
        angle: relAngle,
        life: 1.2,
        maxLife: 1.2
      });

      this.triggerDamageVignette();
      this.vibrate([25, 40, 25]);
    }

    showHitMarker(type = 'NORMAL') {
      if (type === 'ELIMINATION') {
        if (this.hitMarkerElim) {
          this.hitMarkerElim.style.display = 'block';
          setTimeout(() => { if (this.hitMarkerElim) this.hitMarkerElim.style.display = 'none'; }, 350);
        }
      } else if (type === 'CRITICAL') {
        if (this.hitMarkerCrit) {
          this.hitMarkerCrit.style.display = 'block';
          setTimeout(() => { if (this.hitMarkerCrit) this.hitMarkerCrit.style.display = 'none'; }, 220);
        }
      } else {
        if (this.hitMarker) {
          this.hitMarker.style.display = 'block';
          setTimeout(() => { if (this.hitMarker) this.hitMarker.style.display = 'none'; }, 140);
        }
      }
    }

    triggerDamageVignette() {
      if (!this.damageVignette) return;
      this.damageVignette.style.opacity = '1';
      setTimeout(() => {
        if (this.damageVignette) this.damageVignette.style.opacity = '0';
      }, 120);
    }

    updateDebugPerformance(fps, ft, dc, projCount) {
      if (!this.debugPanel || this.debugPanel.style.display === 'none') return;
      if (this.dbgFps) this.dbgFps.textContent = `${Math.round(fps)} FPS`;
      if (this.dbgFt) this.dbgFt.textContent = `${ft.toFixed(1)}ms`;
      if (this.dbgDc) this.dbgDc.textContent = `Calls: ${dc}`;
      if (this.dbgProj) this.dbgProj.textContent = `Proj: ${projCount}`;
    }

    setUIScale(scale = 'MEDIUM') {
      const scales = { SMALL: '85%', MEDIUM: '100%', LARGE: '115%' };
      const root = document.documentElement;
      if (root) root.style.zoom = scales[scale] || '100%';
    }

    setCrosshairSize(size = 'MEDIUM') {
      const wrap = document.getElementById('hud-crosshair-wrap');
      if (wrap) {
        const transforms = { SMALL: 'translate(-50%, -50%) scale(0.8)', MEDIUM: 'translate(-50%, -50%) scale(1.0)', LARGE: 'translate(-50%, -50%) scale(1.25)' };
        wrap.style.transform = transforms[size] || transforms.MEDIUM;
      }
    }

    updateCountdownBanner(matchState, countdownTimer) {
      if (!this.countdownBanner) return;

      if (matchState === 'COUNTDOWN') {
        this.countdownBanner.style.display = 'flex';
        const num = Math.ceil(countdownTimer);
        if (num > 0) {
          this.countdownBanner.innerHTML = `<span class="countdown-num">${num}</span><span class="countdown-sub">PREPARE FOR BATTLE</span>`;
        } else {
          this.countdownBanner.innerHTML = `<span class="countdown-engage">ENGAGE!</span>`;
        }
      } else {
        if (this.countdownBanner.style.display !== 'none') {
          this.countdownBanner.style.display = 'none';
        }
      }
    }

    renderKillFeed(killFeedItems) {
      if (!this.killFeedContainer || !killFeedItems) return;

      this.killFeedContainer.innerHTML = '';
      killFeedItems.forEach(item => {
        const el = document.createElement('div');
        el.className = `kill-feed-item ${item.isPlayerInvolved ? 'player-involved' : ''}`;

        const killerSpan = `<span class="feed-${item.killerTeam}">${item.killerName}</span>`;
        const victimSpan = `<span class="feed-${item.victimTeam}">${item.victimName}</span>`;

        el.innerHTML = `${killerSpan} <span class="feed-icon">⚡</span> ${victimSpan}`;
        this.killFeedContainer.appendChild(el);
      });
    }

    showMatchOverModal(result, onRestartCallback) {
      if (!this.matchOverModal) return;

      this.matchOverModal.style.display = 'flex';
      const titleEl = document.getElementById('modal-match-title');
      const scoreEl = document.getElementById('modal-match-score');
      const btnRestart = document.getElementById('btn-match-restart');

      if (titleEl) {
        if (result.isDraw) {
          titleEl.textContent = 'STALEMATE';
          titleEl.className = 'modal-title draw';
        } else if (result.playerWon) {
          titleEl.textContent = 'VICTORY';
          titleEl.className = 'modal-title victory';
          this.vibrate([60, 80, 60, 80, 100]);
        } else {
          titleEl.textContent = 'DEFEAT';
          titleEl.className = 'modal-title defeat';
          this.vibrate([150, 80, 150]);
        }
      }

      if (scoreEl) {
        scoreEl.innerHTML = `
          <span class="score-blue">BLUE: ${result.blueScore}</span>
          <span class="score-divider"> — </span>
          <span class="score-red">RED: ${result.redScore}</span>
        `;
      }

      if (btnRestart) {
        btnRestart.onclick = () => {
          this.matchOverModal.style.display = 'none';
          if (onRestartCallback) onRestartCallback();
        };
      }
    }

    setMode(modeId, targetScore = 25) {
      this.activeMode = modeId;
      this.targetScore = targetScore;

      if (this.dominationBar) {
        this.dominationBar.style.display = (modeId === 'DOMINATION') ? 'flex' : 'none';
      }
      if (this.controlPointBar) {
        this.controlPointBar.style.display = (modeId === 'CONTROL_POINT') ? 'flex' : 'none';
      }
    }

    updateDominationZones(objectives) {
      this.activeObjectives = objectives || [];
      if (!this.dominationBar) return;

      this.activeObjectives.forEach(obj => {
        const el = document.getElementById(`zone-badge-${obj.id.toLowerCase()}`);
        if (!el) return;

        el.className = 'zone-badge';
        if (obj.isContested) {
          el.classList.add('status-contested');
        } else if (obj.controllingTeam === 'blue') {
          el.classList.add('status-blue');
        } else if (obj.controllingTeam === 'red') {
          el.classList.add('status-red');
        } else {
          el.classList.add('status-neutral');
        }
      });
    }

    updateControlPointHUD(cpObjective) {
      this.activeObjectives = cpObjective ? [cpObjective] : [];
      if (!this.controlPointBar || !cpObjective) return;

      const sectorEl = document.getElementById('cp-sector-val');
      const statusEl = document.getElementById('cp-status-val');

      if (sectorEl) {
        sectorEl.textContent = cpObjective.isWarning ? `MOVE: ${cpObjective.nextSectorName}` : cpObjective.label;
      }
      if (statusEl) {
        if (cpObjective.isContested) {
          statusEl.textContent = 'CONTESTED';
          statusEl.className = 'status-contested';
        } else if (cpObjective.controllingTeam === 'blue') {
          statusEl.textContent = 'BLUE CONTROL';
          statusEl.className = 'status-blue';
        } else if (cpObjective.controllingTeam === 'red') {
          statusEl.textContent = 'RED CONTROL';
          statusEl.className = 'status-red';
        } else {
          statusEl.textContent = 'NEUTRAL';
          statusEl.className = 'status-neutral';
        }
      }
    }

    showAnnouncement(text, type = 'info', duration = 2.5) {
      if (!this.announcementBanner) return;
      this.announcementBanner.textContent = text;
      this.announcementBanner.className = `announcement-banner announcement-${type}`;
      this.announcementBanner.style.display = 'block';
      this.announcementTimer = duration;
    }

    showDeathScreen(killerName, weaponName, distance, respawnTime) {
      if (!this.deathScreen) return;
      if (this.deathKillerName) this.deathKillerName.textContent = killerName || 'UNKNOWN';
      if (this.deathKillerWeapon) this.deathKillerWeapon.textContent = weaponName || 'KINETIC';
      if (this.deathKillerDist) this.deathKillerDist.textContent = `${Math.round(distance || 0)}m`;
      if (this.deathCountdown) this.deathCountdown.textContent = Math.ceil(respawnTime);
      this.deathScreen.style.display = 'flex';
    }

    updateDeathCountdown(timeRemaining) {
      if (this.deathCountdown) {
        this.deathCountdown.textContent = Math.ceil(timeRemaining);
      }
    }

    hideDeathScreen() {
      if (this.deathScreen) {
        this.deathScreen.style.display = 'none';
      }
    }

    update(dt, playerMech, combat, arenaColliders, allMechs, cameraHeading, activeObjectives = []) {
      if (activeObjectives && activeObjectives.length > 0) {
        this.activeObjectives = activeObjectives;
      }

      // Tick announcement timer
      if (this.announcementTimer > 0) {
        this.announcementTimer -= dt;
        if (this.announcementTimer <= 0 && this.announcementBanner) {
          this.announcementBanner.style.display = 'none';
        }
      }

      // 1. Update Match Timer & Scores Display
      this._updateTopBar();

      // 2. Update Directional Damage Indicators
      for (let i = this.damageIndicators.length - 1; i >= 0; i--) {
        this.damageIndicators[i].life -= dt;
        if (this.damageIndicators[i].life <= 0) {
          this.damageIndicators.splice(i, 1);
        }
      }
      this._renderDamageIndicators();

      // 3. Update Player Status Bars & Ammo
      this._updatePlayerStatus(playerMech, combat);

      // 4. Update Action Buttons
      this._updateActionButtons(playerMech, combat);

      // 5. Render 2D Radar Minimap with 10 mechs, Fog-of-War rules, and active objectives
      this._renderMinimap(playerMech, allMechs, arenaColliders);
    }

    _updateTopBar() {
      const timerEl = document.getElementById('hud-match-timer');
      const scoreBlueEl = document.getElementById('score-blue');
      const scoreRedEl = document.getElementById('score-red');

      if (timerEl) {
        const m = Math.floor(this.matchTime / 60);
        const s = Math.floor(this.matchTime % 60);
        timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      }

      if (scoreBlueEl) {
        scoreBlueEl.textContent = this.blueScore < 10 ? `0${this.blueScore}` : this.blueScore;
      }

      if (scoreRedEl) {
        scoreRedEl.textContent = this.redScore < 10 ? `0${this.redScore}` : this.redScore;
      }
    }

    _updatePlayerStatus(playerMech, combat) {
      if (!playerMech) return;

      const hpBar = document.getElementById('hud-hp-bar');
      const shieldBar = document.getElementById('hud-shield-bar');
      const ammoCount = document.getElementById('hud-ammo-count');
      const reloadBar = document.getElementById('hud-reload-progress');

      if (hpBar) {
        const pct = Math.max(0, (playerMech.hp / playerMech.maxHp) * 100);
        hpBar.style.width = `${pct}%`;
      }

      if (shieldBar) {
        const pct = Math.max(0, (playerMech.shield / playerMech.maxShield) * 100);
        shieldBar.style.width = `${pct}%`;
      }

      if (combat) {
        if (ammoCount) {
          ammoCount.textContent = combat.isReloading ? 'RELOAD' : `${combat.ammo} / ${combat.maxAmmo}`;
          if (combat.isReloading || combat.ammo <= 6) {
            ammoCount.classList.add('ammo-low');
          } else {
            ammoCount.classList.remove('ammo-low');
          }
        }

        if (reloadBar) {
          if (combat.isReloading) {
            reloadBar.parentElement.style.display = 'block';
            const rPct = 100 - (combat.reloadTimer / combat.maxReloadTime) * 100;
            reloadBar.style.width = `${rPct}%`;
          } else {
            reloadBar.parentElement.style.display = 'none';
          }
        }
      }
    }

    _updateActionButtons(playerMech, combat) {
      const btnAbility = document.getElementById('btn-ability-touch');
      const abilityCdText = document.getElementById('ability-cd-text');

      if (playerMech && btnAbility && abilityCdText) {
        if (playerMech.abilityTimer > 0) {
          btnAbility.classList.add('cooling');
          abilityCdText.textContent = Math.ceil(playerMech.abilityTimer);
        } else {
          btnAbility.classList.remove('cooling');
          abilityCdText.textContent = '⚡';
        }

        if (playerMech.isAbilityActive) {
          btnAbility.classList.add('active-boost');
        } else {
          btnAbility.classList.remove('active-boost');
        }
      }

      const btnLock = document.getElementById('btn-lock-touch');
      if (btnLock && combat) {
        if (combat.isTargetLocked) {
          btnLock.classList.add('locked');
        } else {
          btnLock.classList.remove('locked');
        }
      }

      const btnReload = document.getElementById('btn-reload-touch');
      if (btnReload && combat) {
        if (combat.ammo <= 6 || combat.isReloading) {
          btnReload.classList.add('urgent');
        } else {
          btnReload.classList.remove('urgent');
        }
      }

      // Low HP Pulsing Warning Vignette
      if (this.lowHpVignette && playerMech) {
        const hpPct = playerMech.hp / playerMech.maxHp;
        this.lowHpVignette.style.display = (!playerMech.isDead && hpPct <= 0.25) ? 'block' : 'none';
      }
    }

    _renderDamageIndicators() {
      let container = document.getElementById('hud-damage-indicators');
      if (!container) return;

      container.innerHTML = '';
      this.damageIndicators.forEach(ind => {
        const chevron = document.createElement('div');
        chevron.className = 'damage-chevron';
        const alpha = Math.max(0, ind.life / ind.maxLife);
        chevron.style.opacity = alpha;
        chevron.style.transform = `rotate(${ind.angle}rad)`;
        container.appendChild(chevron);
      });
    }

    _renderMinimap(playerMech, allMechs, arenaColliders) {
      if (!this.minimapCtx || !playerMech) return;

      const ctx = this.minimapCtx;
      const size = 110;
      const scale = size / 160.0;
      const halfSize = size / 2;

      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.translate(halfSize, halfSize);

      if (this.rotateMinimap) {
        ctx.rotate(-playerMech.heading);
      }

      const px = -playerMech.position.x * scale;
      const pz = -playerMech.position.z * scale;
      ctx.translate(px, pz);

      // 1. Arena Perimeter
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-75 * scale, -75 * scale, 150 * scale, 150 * scale);

      // 2. Arena Structures
      if (arenaColliders) {
        ctx.fillStyle = 'rgba(60, 75, 110, 0.75)';
        arenaColliders.forEach(c => {
          const w = (c.maxX - c.minX) * scale;
          const d = (c.maxZ - c.minZ) * scale;
          const x = c.minX * scale;
          const z = c.minZ * scale;
          ctx.fillRect(x, z, w, d);
        });
      }

      // 2.5 Render Active Objectives (A, B, C or Control Point) Always Visible
      if (this.activeObjectives && this.activeObjectives.length > 0) {
        this.activeObjectives.forEach(obj => {
          const ox = obj.position.x * scale;
          const oz = obj.position.z * scale;
          const or = (obj.radius || 8.5) * scale;

          ctx.beginPath();
          ctx.arc(ox, oz, or, 0, Math.PI * 2);

          let strokeColor = '#778899';
          let fillColor = 'rgba(119, 136, 153, 0.2)';
          if (obj.isContested) {
            strokeColor = '#ffaa00';
            fillColor = 'rgba(255, 170, 0, 0.35)';
          } else if (obj.controllingTeam === 'blue') {
            strokeColor = '#00c8ff';
            fillColor = 'rgba(0, 200, 255, 0.3)';
          } else if (obj.controllingTeam === 'red') {
            strokeColor = '#ff3344';
            fillColor = 'rgba(255, 51, 68, 0.3)';
          }

          ctx.fillStyle = fillColor;
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = strokeColor;
          ctx.stroke();

          // Center Label
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(obj.id || 'CP', ox, oz);
        });
      }

      // 3. Mechs Render (10 Mechs)
      if (allMechs && allMechs.length > 0) {
        allMechs.forEach(m => {
          if (m.isDead || m === playerMech) return;

          const mx = m.position.x * scale;
          const mz = m.position.z * scale;

          if (m.team === 'blue') {
            // Blue Ally: Always visible to teammates
            ctx.fillStyle = '#00c8ff';
            ctx.beginPath();
            ctx.arc(mx, mz, 3.2, 0, Math.PI * 2);
            ctx.fill();

            // Heading tick
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(mx, mz);
            ctx.lineTo(mx + Math.sin(m.heading) * 6, mz + Math.cos(m.heading) * 6);
            ctx.stroke();
          } else {
            // Red Enemy: Fog of War check
            // Visible if: within 22m (proximity radar) OR currently firing/invulnerable OR near allies
            const distToPlayer = playerMech.position.distanceTo(m.position);
            const isDetected = distToPlayer < 24 || m.weaponCooldown > 0 || m.isInvulnerable;

            if (isDetected) {
              ctx.fillStyle = '#ff3344';
              ctx.beginPath();
              ctx.arc(mx, mz, 3.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }

      // 4. Player Chevron Marker (Blue/Cyan)
      ctx.restore();
      ctx.save();
      ctx.translate(halfSize, halfSize);
      if (!this.rotateMinimap) {
        ctx.rotate(playerMech.heading);
      }

      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  IT.MobileHUD = MobileHUD;
})(window.IT);
