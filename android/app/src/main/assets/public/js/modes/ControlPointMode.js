/**
 * Iron Titans 3D — ControlPointMode.js
 * 5v5 Rotating Control Point Game Mode:
 * - Match Duration: 7:00 minutes
 * - Target Score: 300 points
 * - Single active control point in the arena
 * - Point Generation:
 *   - Controlled objective = +2 pts / sec
 * - Objective rotates sequentially (e.g. Center -> North -> East -> West -> Center)
 * - Warning announcement 10 seconds before rotation: "NEXT OBJECTIVE: NORTH SECTOR"
 * - Capture progress pauses while contested
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class ControlPointMode extends IT.GameModeBase {
    constructor() {
      super({
        modeId: 'CONTROL_POINT',
        name: 'CONTROL POINT',
        description: 'Control the active objective to earn points.',
        playersText: '5v5',
        matchDuration: 420, // 7 minutes
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

      if (!this.objectiveManager) {
        this.objectiveManager = new IT.ObjectiveManager(context.scene);
      }

      const arenaConfig = context.arenaConfig || (context.arena && context.arena.getConfig ? context.arena.getConfig() : null);
      const sectors = (arenaConfig && arenaConfig.objectives && arenaConfig.objectives.controlPoint) || [
        { name: 'CENTER', position: new THREE.Vector3(0, 1.2, 0) },
        { name: 'NORTH SECTOR', position: new THREE.Vector3(0, 0, 28) },
        { name: 'EAST SECTOR', position: new THREE.Vector3(26, 0, 0) },
        { name: 'WEST SECTOR', position: new THREE.Vector3(-26, 0, 0) }
      ];

      this.objectiveManager.initControlPoint(sectors);
      this.broadcastAnnouncement('OBJECTIVE ACTIVE: CENTER', 'info', 3.0);
    }

    reset() {
      super.reset();
      this.scoringTimer = 0;
      this.playerObjectiveTime = 0;
      this.playerCaptures = 0;
      this.playerDefenses = 0;

      if (this.objectiveManager && this.objectiveManager.controlPoint) {
        this.objectiveManager.controlPoint.controllingTeam = null;
        this.objectiveManager.controlPoint.captureProgress = 0;
        this.objectiveManager.controlPoint.isContested = false;
      }
    }

    update(dt) {
      super.update(dt);
      if (this.state !== IT.MODE_STATES.ACTIVE) return;

      // 1. Update 3D Control Point & Sector Rotation
      if (this.objectiveManager) {
        this.objectiveManager.update(dt, this.allMechs, (eventType, cp, payload) => {
          this._handleControlPointEvent(eventType, cp, payload);
        });

        const activeObj = this.objectiveManager.getActiveObjectives();
        if (activeObj.length > 0 && activeObj[0].playerInside) {
          this.playerObjectiveTime += dt;
          if (this.playerMech) {
            const s = this.getMechStats(this.playerMech);
            s.timeOnPoint = Math.round(this.playerObjectiveTime);
            s.objectiveScore += Math.round(dt * 3);
          }
        }
      }

      // 2. Point Accumulation Tick (+2 pts/sec for controlling team)
      this.scoringTimer += dt;
      if (this.scoringTimer >= 1.0) {
        this.scoringTimer -= 1.0;
        this._tickScoring();
      }

      // 3. Update HUD
      if (this.hud && this.hud.updateControlPointHUD && this.objectiveManager) {
        const activeObj = this.objectiveManager.getActiveObjectives();
        if (activeObj.length > 0) {
          this.hud.updateControlPointHUD(activeObj[0]);
        }
      }
    }

    _handleControlPointEvent(eventType, cp, payload) {
      if (eventType === 'captured') {
        const isPlayerTeam = payload === 'blue';
        const msg = isPlayerTeam ? 'OBJECTIVE CAPTURED' : 'OBJECTIVE LOST';
        this.broadcastAnnouncement(msg, isPlayerTeam ? 'accent' : 'warning', 2.5);

        if (cp.playerInside && isPlayerTeam) {
          this.playerCaptures++;
          if (this.playerMech) {
            const s = this.getMechStats(this.playerMech);
            s.captures = this.playerCaptures;
            s.objectiveScore += 60;
          }
        }
      } else if (eventType === 'contested') {
        this.broadcastAnnouncement('OBJECTIVE CONTESTED', 'warning', 2.0);

        if (cp.playerInside && cp.controllingTeam === 'blue') {
          this.playerDefenses++;
          if (this.playerMech) {
            const s = this.getMechStats(this.playerMech);
            s.defenses = this.playerDefenses;
            s.objectiveScore += 30;
          }
        }
      } else if (eventType === 'warning') {
        this.broadcastAnnouncement(`NEXT OBJECTIVE: ${payload}`, 'warning', 3.0);
      } else if (eventType === 'relocated') {
        this.broadcastAnnouncement(`NEW OBJECTIVE ACTIVE: ${payload}`, 'accent', 3.0);
      }
    }

    _tickScoring() {
      if (!this.objectiveManager) return;
      if (this.objectiveManager.isControlPointHeldBy('blue')) {
        this.addScore('blue', 2);
      } else if (this.objectiveManager.isControlPointHeldBy('red')) {
        this.addScore('red', 2);
      }
    }

    getObjectives() {
      return this.objectiveManager ? this.objectiveManager.getActiveObjectives() : [];
    }

    getControlPoint() {
      if (this.objectiveManager) {
        const list = this.objectiveManager.getActiveObjectives();
        return list.length > 0 ? list[0] : null;
      }
      return null;
    }
  }

  IT.ControlPointMode = ControlPointMode;
})(window.IT);
