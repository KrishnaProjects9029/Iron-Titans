/**
 * Iron Titans — Zone.js
 * Domination capture zone entity with team capture progression and visual pulsing.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class Zone {
    constructor(id, x, y, letter = 'A') {
      this.id = id;
      this.x = x;
      this.y = y;
      this.letter = letter;
      this.radius = 85;
      this.controllingTeam = -1; // -1 = neutral, 0 = blue, 1 = red
      this.progress = [0, 0];    // 0..100 per team
      this.isContested = false;
      this.captureSpeed = 24;    // percent per second per mech

      this.pulseTimer = 0;
      this.color = '#888888';
    }

    update(dt, mechs = []) {
      this.pulseTimer += dt * 3;

      let team0Count = 0;
      let team1Count = 0;

      // Count players occupying this zone
      for (let i = 0; i < mechs.length; i++) {
        const m = mechs[i];
        if (m.isDead) continue;
        const dx = m.x - this.x;
        const dy = m.y - this.y;
        if (dx * dx + dy * dy <= this.radius * this.radius) {
          if (m.team === 0) team0Count++;
          else if (m.team === 1) team1Count++;
        }
      }

      this.isContested = team0Count > 0 && team1Count > 0;

      if (!this.isContested) {
        if (team0Count > 0) {
          // Team 0 capturing: reduce team 1 progress first, then increase team 0
          const rate = team0Count * this.captureSpeed * dt;
          if (this.progress[1] > 0) {
            this.progress[1] = Math.max(0, this.progress[1] - rate * 1.5);
            if (this.progress[1] === 0) this.controllingTeam = -1;
          } else {
            this.progress[0] = Math.min(100, this.progress[0] + rate);
            if (this.progress[0] >= 100) {
              this.controllingTeam = 0;
            }
          }
        } else if (team1Count > 0) {
          // Team 1 capturing: reduce team 0 progress first, then increase team 1
          const rate = team1Count * this.captureSpeed * dt;
          if (this.progress[0] > 0) {
            this.progress[0] = Math.max(0, this.progress[0] - rate * 1.5);
            if (this.progress[0] === 0) this.controllingTeam = -1;
          } else {
            this.progress[1] = Math.min(100, this.progress[1] + rate);
            if (this.progress[1] >= 100) {
              this.controllingTeam = 1;
            }
          }
        }
      }

      // Update zone display color
      if (this.controllingTeam === 0) {
        this.color = '#4aaeff';
      } else if (this.controllingTeam === 1) {
        this.color = '#ff4545';
      } else {
        this.color = '#888899';
      }
    }

    isFullyCaptured() {
      return (this.controllingTeam === 0 && this.progress[0] >= 100) ||
             (this.controllingTeam === 1 && this.progress[1] >= 100);
    }

    getPointsPerSecond() {
      if (this.controllingTeam < 0) return 0;
      return this.isContested ? 0.6 : 1.5;
    }
  }

  IT.Zone = Zone;
})(window.IT);
