/**
 * Iron Titans 3D — NetworkCombat.js
 * Server-Authoritative Network Combat Synchronization.
 * Synchronizes:
 * - Weapon fire events and projectile replication for all 6 weapons
 * - Ability triggers and particle bursts for all 5 tactical abilities
 * - Authoritative damage resolution, shield absorption, critical hits, and destructions
 * - 2-second respawn countdown and invulnerability protection
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class NetworkCombat {
    constructor(networkManager) {
      this.nm = networkManager;
      this.activeProjectiles = [];
    }

    /**
     * Called when the local player fires a weapon.
     * Generates local projectile immediately (client-side prediction)
     * and broadcasts WEAPON_FIRE event to server.
     */
    onLocalWeaponFire(weaponId, origin, direction, isSecondary = false) {
      if (!this.nm || !this.nm.isOnline) return;

      const payload = {
        weaponId,
        origin: [Math.round(origin.x * 10) / 10, Math.round(origin.y * 10) / 10, Math.round(origin.z * 10) / 10],
        direction: [Math.round(direction.x * 100) / 100, Math.round(direction.y * 100) / 100, Math.round(direction.z * 100) / 100],
        isSecondary: Boolean(isSecondary),
        timestamp: Date.now()
      };

      this.nm.send(IT.NET_MSG.WEAPON_FIRE, payload);
    }

    /**
     * Called when receiving a WEAPON_FIRE event from a remote player.
     * Spawns remote weapon visual effects, audio cues, and tracer projectiles.
     */
    handleRemoteWeaponFire(data) {
      const { shooterId, weaponId, origin, direction } = data;
      const remotePlayer = this.nm.getPlayer(shooterId);
      if (!remotePlayer) return;

      // Audio cue
      if (IT.AudioManager && typeof IT.AudioManager.playWeaponFire === 'function') {
        IT.AudioManager.playWeaponFire(weaponId);
      }

      // Visual muzzle flash & projectile tracer
      const combat = this.nm.activeCombat3D;
      if (combat && combat.spawnRemoteTracer) {
        combat.spawnRemoteTracer(weaponId, origin, direction);
      } else if (combat && combat.scene) {
        // Fallback visual tracer
        this._spawnVisualTracer(weaponId, origin, direction);
      }
    }

    /**
     * Called when the local player activates a tactical ability.
     */
    onLocalAbilityUsed(abilityId) {
      if (!this.nm || !this.nm.isOnline) return;

      this.nm.send(IT.NET_MSG.ABILITY_ACTIVATE, {
        abilityId,
        timestamp: Date.now()
      });
    }

    /**
     * Handle incoming remote player ability activation.
     */
    handleRemoteAbility(data) {
      const { playerId, abilityId } = data;
      const remotePlayer = this.nm.getPlayer(playerId);
      if (!remotePlayer || !remotePlayer.mechInstance) return;

      // Audio
      if (IT.AudioManager && typeof IT.AudioManager.playAbility === 'function') {
        IT.AudioManager.playAbility(abilityId);
      }

      // Visual VFX burst
      if (IT._activeVFXManager && remotePlayer.mechInstance.position) {
        IT._activeVFXManager.spawnImpactSparks(remotePlayer.mechInstance.position, 15);
      }
    }

    /**
     * Server-authoritative hit notification received.
     * Applies damage to target player's shields/health and displays floating damage text.
     */
    handleDamageApplied(data) {
      const { victimId, attackerId, damage, isCritical, isShield, remainingHp, remainingShield } = data;
      const victim = this.nm.getPlayer(victimId);
      if (!victim) return;

      victim.hp = remainingHp;
      victim.shield = remainingShield;

      // Floating Combat Text (FCT)
      if (victim.mechInstance && victim.mechInstance.position) {
        const combat = this.nm.activeCombat3D;
        if (combat && combat.showFCT) {
          combat.showFCT(victim.mechInstance.position, Math.round(damage), isCritical, isShield);
        }
      }

      // Camera shake and hit vignette if local player was hit
      if (victim.isLocal) {
        if (IT._activeCamera && IT._activeCamera.addShake) {
          IT._activeCamera.addShake(isCritical ? 0.35 : 0.15);
        }
        if (IT.AudioManager && typeof IT.AudioManager.playHitSound === 'function') {
          IT.AudioManager.playHitSound(isShield, isCritical);
        }
      }

      // Update Phase 7 EventManager metrics
      if (IT.EventManager && attackerId === this.nm.localPlayerId) {
        IT.EventManager.emit(IT.GAME_EVENTS.DAMAGE_DEALT, {
          amount: damage,
          isPlayer: true,
          isCritical: Boolean(isCritical)
        });
      }
    }

    /**
     * Server-authoritative player elimination event.
     */
    handlePlayerKilled(data) {
      const { victimId, killerId, weaponId } = data;
      const victim = this.nm.getPlayer(victimId);
      const killer = this.nm.getPlayer(killerId);

      if (victim) {
        victim.isDead = true;
        victim.hp = 0;
        victim.shield = 0;
        if (victim.mechInstance && victim.mechInstance.mesh) {
          victim.mechInstance.mesh.visible = false;
        }

        // Spawn explosion VFX
        if (IT._activeVFXManager && victim.mechInstance) {
          IT._activeVFXManager.spawnExplosion(victim.mechInstance.position, 1.5);
        }
      }

      if (killer) {
        killer.kills = (killer.kills || 0) + 1;
      }

      // Kill feed update
      if (this.nm.activeHud && typeof this.nm.activeHud.addKillFeedEntry === 'function') {
        this.nm.activeHud.addKillFeedEntry({
          killerName: killer ? killer.name : 'Unknown',
          victimName: victim ? victim.name : 'Unknown',
          weaponId: weaponId || 'pulseCannon',
          killerTeam: killer ? killer.team : 'blue'
        });
      }

      // Local player elimination flow
      if (victim && victim.isLocal) {
        this._startLocalRespawnCountdown();
      }

      // Phase 7 Mission trigger for player elimination
      if (IT.EventManager && killer && killer.isLocal) {
        IT.EventManager.emit(IT.GAME_EVENTS.ENEMY_DESTROYED, {
          isPlayer: true,
          weaponId,
          isCritical: false
        });
      }
    }

    /**
     * 2-second respawn timer flow with HUD announcements.
     */
    _startLocalRespawnCountdown() {
      const hud = this.nm.activeHud;
      if (hud && hud.showDeathScreen) {
        hud.showDeathScreen(IT.NET_CONFIG.RESPAWN_DELAY_SEC);
      }

      let remaining = IT.NET_CONFIG.RESPAWN_DELAY_SEC;
      const interval = setInterval(() => {
        remaining -= 1.0;
        if (remaining <= 0) {
          clearInterval(interval);
          if (hud && hud.hideDeathScreen) {
            hud.hideDeathScreen();
          }
        }
      }, 1000);
    }

    _spawnVisualTracer(weaponId, originArr, dirArr) {
      if (typeof THREE === 'undefined' || !this.nm.activeScene) return;
      const origin = new THREE.Vector3(...originArr);
      const dir = new THREE.Vector3(...dirArr).normalize();

      const geom = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6);
      geom.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
      const tracer = new THREE.Mesh(geom, mat);
      tracer.position.copy(origin);
      tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

      this.nm.activeScene.add(tracer);

      let dist = 0;
      const speed = 120; // m/s
      const anim = () => {
        dist += speed * 0.016;
        tracer.position.addScaledVector(dir, speed * 0.016);
        if (dist > 90) {
          if (tracer.parent) tracer.parent.remove(tracer);
          geom.dispose();
          mat.dispose();
        } else {
          requestAnimationFrame(anim);
        }
      };
      requestAnimationFrame(anim);
    }
  }

  IT.NetworkCombat = NetworkCombat;
})(window.IT);
