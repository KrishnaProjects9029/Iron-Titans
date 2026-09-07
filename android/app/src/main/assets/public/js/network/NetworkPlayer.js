/**
 * Iron Titans 3D — NetworkPlayer.js
 * Remote & Local Player Entity Controller.
 * Bridges networked transform streams to 3D Mech models, animations,
 * health/shield indicators, and floating 3D screen-space nameplates.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class NetworkPlayer {
    constructor(data = {}) {
      this.id = data.id || 'player_' + Math.random().toString(36).substr(2, 6);
      this.name = data.name || 'Pilot';
      this.team = data.team || 'blue';
      this.isLocal = Boolean(data.isLocal);
      this.isAI = Boolean(data.isAI);
      this.mechId = data.mechId || 'ironclad';
      this.primaryWeapon = data.primaryWeapon || 'pulseCannon';
      this.secondaryWeapon = data.secondaryWeapon || 'scatterBlaster';
      this.ping = data.ping || 0;

      // Stats
      this.kills = data.kills || 0;
      this.deaths = data.deaths || 0;
      this.assists = data.assists || 0;
      this.damageDealt = data.damageDealt || 0;

      // Combat state
      this.hp = data.hp || 1000;
      this.maxHp = data.maxHp || 1000;
      this.shield = data.shield || 500;
      this.maxShield = data.maxShield || 500;
      this.isDead = Boolean(data.isDead);
      this.respawnTimer = 0;

      // 3D references
      this.mechInstance = null;
      this.interpolation = new IT.NetworkInterpolation();

      // Nameplate element
      this.nameplateEl = null;
      if (!this.isLocal && typeof document !== 'undefined') {
        this._createNameplate();
      }
    }

    /**
     * Create floating HTML nameplate overlay.
     */
    _createNameplate() {
      const container = document.getElementById('nameplates-container');
      if (!container) return;

      const el = document.createElement('div');
      el.className = `net-nameplate nameplate-${this.team}`;
      el.innerHTML = `
        <div class="nameplate-header">
          <span class="nameplate-ai-tag">${this.isAI ? '[AI]' : ''}</span>
          <span class="nameplate-name">${this.name}</span>
        </div>
        <div class="nameplate-bars">
          <div class="nameplate-bar-shield"><div class="bar-fill" style="width: 100%;"></div></div>
          <div class="nameplate-bar-hp"><div class="bar-fill" style="width: 100%;"></div></div>
        </div>
      `;
      container.appendChild(el);
      this.nameplateEl = el;
    }

    /**
     * Set the 3D Mech model instance.
     */
    attachMech(mech) {
      this.mechInstance = mech;
      if (mech) {
        mech.networkPlayerId = this.id;
        mech.isRemote = !this.isLocal;
        mech.team = this.team;
      }
    }

    /**
     * Receive and record a new transform snapshot.
     */
    receiveSnapshot(snapshot) {
      this.interpolation.addSnapshot(snapshot);
    }

    /**
     * Per-frame update for remote player models.
     */
    update(dt, camera) {
      if (this.isLocal || !this.mechInstance) return;

      const state = this.interpolation.getInterpolatedState();
      if (state) {
        // Position & orientation
        this.mechInstance.position.set(state.x, state.y, state.z);
        if (this.mechInstance.rotation) {
          this.mechInstance.rotation.y = state.yaw;
        }

        // Vital stats
        this.hp = state.hp;
        this.shield = state.shield;
        this.isDead = state.isDead;

        // Animations
        if (this.mechInstance.setAnimationState && state.animState) {
          this.mechInstance.setAnimationState(state.animState);
        }

        // Death / active visibility
        if (this.mechInstance.mesh) {
          this.mechInstance.mesh.visible = !this.isDead;
        }
      }

      // Update floating nameplate projection
      this.updateNameplate(camera);
    }

    /**
     * Project 3D mech position into 2D screen coordinates for floating nameplate.
     */
    updateNameplate(camera) {
      if (!this.nameplateEl || !this.mechInstance || !camera) return;

      if (this.isDead || (this.mechInstance.mesh && !this.mechInstance.mesh.visible)) {
        this.nameplateEl.style.display = 'none';
        return;
      }

      const mechPos = this.mechInstance.position;
      const camPos = camera.position;
      const distSq = (mechPos.x - camPos.x) ** 2 + (mechPos.y - camPos.y) ** 2 + (mechPos.z - camPos.z) ** 2;

      // Distance culling: hide nameplate if beyond 70 meters
      if (distSq > 70 * 70) {
        this.nameplateEl.style.display = 'none';
        return;
      }

      if (typeof THREE === 'undefined') return;

      // Project head position (mechPos + 3.2m elevation)
      const headPos = new THREE.Vector3(mechPos.x, mechPos.y + 3.2, mechPos.z);
      headPos.project(camera);

      // Behind camera check
      if (headPos.z > 1) {
        this.nameplateEl.style.display = 'none';
        return;
      }

      const x = (headPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(headPos.y * 0.5) + 0.5) * window.innerHeight;

      this.nameplateEl.style.display = 'block';
      this.nameplateEl.style.transform = `translate(-50%, -100%) translate(${Math.round(x)}px, ${Math.round(y)}px)`;

      // Update HP / Shield bar widths
      const hpFill = this.nameplateEl.querySelector('.nameplate-bar-hp .bar-fill');
      const shieldFill = this.nameplateEl.querySelector('.nameplate-bar-shield .bar-fill');
      if (hpFill) {
        hpFill.style.width = `${Math.max(0, Math.min(100, Math.round((this.hp / this.maxHp) * 100)))}%`;
      }
      if (shieldFill) {
        shieldFill.style.width = `${Math.max(0, Math.min(100, Math.round((this.shield / this.maxShield) * 100)))}%`;
      }
    }

    destroy() {
      if (this.nameplateEl && this.nameplateEl.parentNode) {
        this.nameplateEl.parentNode.removeChild(this.nameplateEl);
        this.nameplateEl = null;
      }
      this.interpolation.clear();
      this.mechInstance = null;
    }
  }

  IT.NetworkPlayer = NetworkPlayer;
})(window.IT);
