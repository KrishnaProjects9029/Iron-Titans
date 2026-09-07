/**
 * Iron Titans 3D — NetworkTransform.js
 * High-efficiency 3D Transform Representation & Serialization.
 * Encapsulates position, velocity, orientation, and combat vital flags for network sync.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class NetworkTransform {
    constructor(data = {}) {
      // Position
      this.x = data.x || 0;
      this.y = data.y || 0;
      this.z = data.z || 0;

      // Linear Velocity (for dead reckoning prediction)
      this.vx = data.vx || 0;
      this.vy = data.vy || 0;
      this.vz = data.vz || 0;

      // Rotation (radians)
      this.yaw = data.yaw || 0;
      this.pitch = data.pitch || 0;

      // Vital Status
      this.hp = data.hp !== undefined ? data.hp : 1000;
      this.maxHp = data.maxHp !== undefined ? data.maxHp : 1000;
      this.shield = data.shield !== undefined ? data.shield : 500;
      this.maxShield = data.maxShield !== undefined ? data.maxShield : 500;

      // States
      this.animState = data.animState || 'IDLE'; // 'IDLE', 'WALK', 'RUN', 'STRAFE', 'FIRE', 'DEATH'
      this.isDead = Boolean(data.isDead);
      this.isRespawning = Boolean(data.isRespawning);
      this.timestamp = data.timestamp || Date.now();
    }

    /**
     * Pack transform into compact array or JSON-friendly object.
     * Rounding float values to 2 decimals saves ~40% bandwidth over standard floats.
     */
    pack() {
      return {
        p: [Math.round(this.x * 100) / 100, Math.round(this.y * 100) / 100, Math.round(this.z * 100) / 100],
        v: [Math.round(this.vx * 10) / 10, Math.round(this.vy * 10) / 10, Math.round(this.vz * 10) / 10],
        r: [Math.round(this.yaw * 1000) / 1000, Math.round(this.pitch * 1000) / 1000],
        h: [Math.round(this.hp), Math.round(this.shield)],
        a: this.animState,
        d: this.isDead ? 1 : 0,
        t: this.timestamp
      };
    }

    /**
     * Unpack compact payload into NetworkTransform instance.
     */
    static unpack(packed) {
      if (!packed) return new NetworkTransform();
      const p = packed.p || [0, 0, 0];
      const v = packed.v || [0, 0, 0];
      const r = packed.r || [0, 0];
      const h = packed.h || [1000, 500];

      return new NetworkTransform({
        x: p[0], y: p[1], z: p[2],
        vx: v[0], vy: v[1], vz: v[2],
        yaw: r[0], pitch: r[1],
        hp: h[0], shield: h[1],
        animState: packed.a || 'IDLE',
        isDead: Boolean(packed.d),
        timestamp: packed.t || Date.now()
      });
    }

    /**
     * Extract transform directly from a 3D Mech entity.
     */
    static fromMech(mech) {
      if (!mech || !mech.position) return new NetworkTransform();
      const pos = mech.position;
      const vel = mech.velocity || { x: 0, y: 0, z: 0 };
      const rot = mech.rotation ? (mech.rotation.y || 0) : 0;

      return new NetworkTransform({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        vx: vel.x,
        vy: vel.y,
        vz: vel.z,
        yaw: rot,
        pitch: mech.aimPitch || 0,
        hp: mech.hp || 0,
        maxHp: mech.maxHp || 1000,
        shield: mech.shield || 0,
        maxShield: mech.maxShield || 500,
        animState: mech.currentAnimation || 'IDLE',
        isDead: Boolean(mech.isDestroyed || mech.hp <= 0),
        isRespawning: Boolean(mech.isRespawning),
        timestamp: Date.now()
      });
    }

    /**
     * Delta compression check: returns false if change is below threshold, saving bandwidth.
     */
    shouldSendDelta(prev) {
      if (!prev) return true;
      if (this.isDead !== prev.isDead || this.isRespawning !== prev.isRespawning) return true;
      if (this.animState !== prev.animState) return true;
      if (Math.abs(this.hp - prev.hp) > 5 || Math.abs(this.shield - prev.shield) > 5) return true;
      const dPosSq = (this.x - prev.x) ** 2 + (this.y - prev.y) ** 2 + (this.z - prev.z) ** 2;
      if (dPosSq > 0.0025) return true; // > 0.05m movement
      if (Math.abs(this.yaw - prev.yaw) > 0.02 || Math.abs(this.pitch - prev.pitch) > 0.02) return true;
      return false;
    }
  }

  IT.NetworkTransform = NetworkTransform;
})(window.IT);
