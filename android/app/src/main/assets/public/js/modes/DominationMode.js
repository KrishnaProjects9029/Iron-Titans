/**
 * Iron Titans 3D — DominationMode.js
 * 5v5 Domination Game Mode:
 * - Match Duration: 6:00 minutes
 * - Target Score: 300 points
 * - 3 Strategic Capture Zones: A, B, C
 * - Point Generation per second:
 *   - 1 zone controlled  = +1 pt / sec
 *   - 2 zones controlled = +2 pts / sec
 *   - 3 zones controlled = +3 pts / sec
 * - Capture progress pauses while contested
 * - Objective announcements: "ZONE A CAPTURED", "ZONE B CONTESTED", "ZONE C LOST"
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class DominationMode extends IT.GameModeBase {
    constructor() {
      super({
        modeId: 'DOMINATION',
        name: 'DOMINATION',
        description: 'Capture and hold strategic zones to reach 300 points.',
        playersText: '5v5',
        matchDuration: 360, // 6 minutes
        targetScore: 300
      });

      this.objectiveManager = null;
      this.scoringTimer = 0;
      this.playerObjectiveTime = 0;
      this.playerCaptures = 0;
      this.playerDefenses = 0;
    }

    initialize(context) {
      super.initialize(context);

      this.playerObjectiveTime = 0;
      this.playerCaptures = 0;
      this.playerDefenses = 0;

      // Initialize 3D Objective Manager with arena-specific zones
      if (!this.objectiveManager) {
        this.objectiveManager = new IT.ObjectiveManager(context.scene);
      }

      const arenaConfig = context.arenaConfig || (context.arena && context.arena.getConfig ? context.arena.getConfig() : null);
      const zones = (arenaConfig && arenaConfig.objectives && arenaConfig.objectives.domination) || [
        { id: 'A', label: 'ZONE A', position: new THREE.Vector3(-25, 0, 0), radius: 8.5 },
        { id: 'B', label: 'ZONE B', position: new THREE.Vector3(0, 1.2, 0), radius: 9.0 },
        { id: 'C', label: 'ZONE C', position: new THREE.Vector3(25, 0, 0), radius: 8.5 }
      ];

      this.objectiveManager.initDomination(zones);
    }

    reset() {
      super.reset();
      this.scoringTimer = 0;
      this.playerObjectiveTime = 0;
      this.playerCaptures = 0;
      this.playerDefenses = 0;

      if (this.objectiveManager) {
        this.objectiveManager.zones.forEach(z => {
          z.controllingTeam = null;
          z.captureProgress = 0;
          z.isContested = false;
        });
      }
    }

    update(dt) {
      super.update(dt);
      if (this.state !== IT.MODE_STATES.ACTIVE) return;

      // 1. Update 3D Objectives & Handle Capture Events
      if (this.objectiveManager) {
        this.objectiveManager.update(dt, this.allMechs, (eventType, zone, team) => {
          this._handleZoneEvent(eventType, zone, team);
        });

        // Track player time on active/controlled objective
        const activeObj = this.objectiveManager.getActiveObjectives();
        for (let obj of activeObj) {
          if (obj.playerInside) {
            this.playerObjectiveTime += dt;
            if (this.playerMech) {
              const s = this.getMechStats(this.playerMech);
              s.timeOnPoint = Math.round(this.playerObjectiveTime);
              s.objectiveScore += Math.round(dt * 2);
            }
            break;
          }
        }
      }

      // 2. Point Accumulation Tick (Every 1.0 second)
      this.scoringTimer += dt;
      if (this.scoringTimer >= 1.0) {
        this.scoringTimer -= 1.0;
        this._tickScoring();
      }

      // 3. Update HUD Zone Statuses
      if (this.hud && this.hud.updateDominationZones && this.objectiveManager) {
        this.hud.updateDominationZones(this.objectiveManager.getActiveObjectives());
      }
    }

    _handleZoneEvent(eventType, zone, team) {
      if (eventType === 'captured') {
        const isPlayerTeam = team === 'blue';
        const announcement = isPlayerTeam ? `ZONE ${zone.id} CAPTURED` : `ZONE ${zone.id} LOST`;
        this.broadcastAnnouncement(announcement, isPlayerTeam ? 'accent' : 'warning', 2.5);

        if (zone.playerInside && isPlayerTeam) {
          this.playerCaptures++;
          if (this.playerMech) {
            const s = this.getMechStats(this.playerMech);
            s.captures = this.playerCaptures;
            s.objectiveScore += 50; // Bonus score for capping
          }
        }
      } else if (eventType === 'contested') {
        this.broadcastAnnouncement(`ZONE ${zone.id} CONTESTED`, 'warning', 2.0);

        if (zone.playerInside && zone.controllingTeam === 'blue') {
          this.playerDefenses++;
          if (this.playerMech) {
            const s = this.getMechStats(this.playerMech);
            s.defenses = this.playerDefenses;
            s.objectiveScore += 25; // Bonus score for defending
          }
        }
      }
    }

    _tickScoring() {
      if (!this.objectiveManager) return;
      const counts = this.objectiveManager.getControlledZoneCounts();

      // Points: 1 zone = 1 pt, 2 zones = 2 pts, 3 zones = 3 pts
      if (counts.blue > 0) {
        this.addScore('blue', counts.blue);
      }
      if (counts.red > 0) {
        this.addScore('red', counts.red);
      }
    }

    end(winningTeam) {
      if (this.state === IT.MODE_STATES.MATCH_OVER) return;

      // Pass objective stats to match summary
      super.end(winningTeam);
    }

    getObjectives() {
      return this.objectiveManager ? this.objectiveManager.getActiveObjectives() : [];
    }
  }

  IT.DominationMode = DominationMode;
})(window.IT);
