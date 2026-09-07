/**
 * Iron Titans 3D — NetworkInterpolation.js
 * Snapshot Buffering, Dead Reckoning & Hermite/Linear Interpolation Engine.
 * Ensures jitter-free, smooth remote mech movement without teleportation artifacts.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpAngle(a, b, t) {
    let diff = (b - a) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
  }

  class NetworkInterpolation {
    constructor(options = {}) {
      this.bufferSize = options.bufferSize || IT.NET_CONFIG.MAX_SNAPSHOT_HISTORY || 30;
      this.interpolationDelayMs = options.interpolationDelayMs || IT.NET_CONFIG.INTERPOLATION_DELAY_MS || 100;
      this.maxExtrapolationMs = options.maxExtrapolationMs || 250;
      this.snapshots = []; // Ordered array of NetworkTransform
    }

    /**
     * Push a new incoming network snapshot into the circular buffer.
     * Keeps snapshots sorted by timestamp.
     * @param {IT.NetworkTransform} snapshot
     */
    addSnapshot(snapshot) {
      if (!snapshot || !snapshot.timestamp) return;

      // Discard duplicate or backwards packets
      if (this.snapshots.length > 0 && snapshot.timestamp <= this.snapshots[0].timestamp) {
        return;
      }

      this.snapshots.unshift(snapshot); // Latest at index 0

      // Trim buffer to max size
      if (this.snapshots.length > this.bufferSize) {
        this.snapshots.length = this.bufferSize;
      }
    }

    /**
     * Reset buffer (e.g. on respawn or teleport).
     */
    clear() {
      this.snapshots = [];
    }

    /**
     * Calculate smooth interpolated transform for the current render frame.
     * @param {number} [currentTime=Date.now()]
     * @returns {Object|null} Interpolated { x, y, z, yaw, pitch, hp, shield, animState, isDead }
     */
    getInterpolatedState(currentTime = Date.now()) {
      if (this.snapshots.length === 0) return null;

      // Single snapshot case: return exact position
      if (this.snapshots.length === 1) {
        const s = this.snapshots[0];
        return {
          x: s.x, y: s.y, z: s.z,
          yaw: s.yaw, pitch: s.pitch,
          hp: s.hp, shield: s.shield,
          animState: s.animState,
          isDead: s.isDead,
          isExtrapolating: false
        };
      }

      const renderTimestamp = currentTime - this.interpolationDelayMs;

      // Case 1: Render timestamp is newer than latest snapshot -> EXTRAPOLATE (Dead Reckoning)
      const latest = this.snapshots[0];
      if (renderTimestamp > latest.timestamp) {
        const deltaSec = Math.min(this.maxExtrapolationMs, renderTimestamp - latest.timestamp) / 1000;
        return {
          x: latest.x + latest.vx * deltaSec,
          y: latest.y + latest.vy * deltaSec,
          z: latest.z + latest.vz * deltaSec,
          yaw: latest.yaw,
          pitch: latest.pitch,
          hp: latest.hp,
          shield: latest.shield,
          animState: latest.animState,
          isDead: latest.isDead,
          isExtrapolating: true
        };
      }

      // Case 2: Render timestamp is older than oldest recorded snapshot -> clamp to oldest
      const oldest = this.snapshots[this.snapshots.length - 1];
      if (renderTimestamp <= oldest.timestamp) {
        return {
          x: oldest.x, y: oldest.y, z: oldest.z,
          yaw: oldest.yaw, pitch: oldest.pitch,
          hp: oldest.hp, shield: oldest.shield,
          animState: oldest.animState,
          isDead: oldest.isDead,
          isExtrapolating: false
        };
      }

      // Case 3: Standard Interpolation between two bounding snapshots (s0 and s1)
      let s0 = null; // Older snapshot (before renderTimestamp)
      let s1 = null; // Newer snapshot (after renderTimestamp)

      for (let i = 0; i < this.snapshots.length - 1; i++) {
        if (this.snapshots[i].timestamp >= renderTimestamp && this.snapshots[i + 1].timestamp <= renderTimestamp) {
          s1 = this.snapshots[i];
          s0 = this.snapshots[i + 1];
          break;
        }
      }

      if (!s0 || !s1 || s1.timestamp === s0.timestamp) {
        return {
          x: latest.x, y: latest.y, z: latest.z,
          yaw: latest.yaw, pitch: latest.pitch,
          hp: latest.hp, shield: latest.shield,
          animState: latest.animState,
          isDead: latest.isDead,
          isExtrapolating: false
        };
      }

      const alpha = (renderTimestamp - s0.timestamp) / (s1.timestamp - s0.timestamp);
      const clampedAlpha = Math.max(0, Math.min(1, alpha));

      return {
        x: lerp(s0.x, s1.x, clampedAlpha),
        y: lerp(s0.y, s1.y, clampedAlpha),
        z: lerp(s0.z, s1.z, clampedAlpha),
        yaw: lerpAngle(s0.yaw, s1.yaw, clampedAlpha),
        pitch: lerp(s0.pitch, s1.pitch, clampedAlpha),
        hp: Math.round(lerp(s0.hp, s1.hp, clampedAlpha)),
        shield: Math.round(lerp(s0.shield, s1.shield, clampedAlpha)),
        animState: s1.animState,
        isDead: s1.isDead,
        isExtrapolating: false
      };
    }
  }

  IT.NetworkInterpolation = NetworkInterpolation;
})(window.IT);
