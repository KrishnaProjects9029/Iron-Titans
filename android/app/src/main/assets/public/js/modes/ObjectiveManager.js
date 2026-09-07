/**
 * Iron Titans 3D — ObjectiveManager.js
 * Master coordinator for real-time 3D battlefield objectives:
 * - Spawns and manages 3D CaptureZones (Domination: A, B, C)
 * - Spawns and manages rotating 3D ControlPoint
 * - Calculates zone ownership counts for scoring ticks
 * - Exposes active objective states to HUD, Minimap, and Bot AI
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class ObjectiveManager {
    constructor(scene) {
      this.scene = scene;
      this.zones = []; // CaptureZone[] for Domination
      this.controlPoint = null; // ControlPoint for Control Point mode

      // Control point rotation configuration
      this.cpSectors = [];
      this.cpCurrentSectorIndex = 0;
      this.cpTimer = 0;
      this.cpCycleDuration = 60.0; // 60 seconds total per sector
      this.cpWarningDuration = 10.0; // Warning alert 10s before rotation

      this.activeMode = null; // 'DOMINATION', 'CONTROL_POINT'
    }

    initDomination(zoneConfigs) {
      this.destroy();
      this.activeMode = 'DOMINATION';
      this.zones = [];

      zoneConfigs.forEach(cfg => {
        const zone = new IT.CaptureZone(this.scene, cfg);
        this.zones.push(zone);
      });
    }

    initControlPoint(sectorConfigs) {
      this.destroy();
      this.activeMode = 'CONTROL_POINT';
      this.cpSectors = sectorConfigs || [
        { name: 'CENTER', position: new THREE.Vector3(0, 0, 0) }
      ];
      this.cpCurrentSectorIndex = 0;
      this.cpTimer = this.cpCycleDuration;

      const firstSector = this.cpSectors[0];
      this.controlPoint = new IT.ControlPoint(this.scene, {
        sectorName: firstSector.name,
        position: firstSector.position.clone()
      });
    }

    update(dt, allMechs, onEventCallback) {
      if (this.activeMode === 'DOMINATION') {
        for (let i = 0; i < this.zones.length; i++) {
          this.zones[i].update(dt, allMechs, (type, zone, team) => {
            if (onEventCallback) onEventCallback(type, zone, team);
          });
        }
      } else if (this.activeMode === 'CONTROL_POINT' && this.controlPoint) {
        // Update control point timer & rotation
        this.cpTimer -= dt;

        const nextIndex = (this.cpCurrentSectorIndex + 1) % this.cpSectors.length;
        const nextSector = this.cpSectors[nextIndex];

        if (this.cpTimer <= this.cpWarningDuration && !this.controlPoint.isWarning) {
          this.controlPoint.setWarning(true, nextSector.name);
          if (onEventCallback) {
            onEventCallback('warning', this.controlPoint, nextSector.name);
          }
        }

        if (this.cpTimer <= 0) {
          // Relocate to next sector!
          this.cpCurrentSectorIndex = nextIndex;
          this.cpTimer = this.cpCycleDuration;
          const newSector = this.cpSectors[this.cpCurrentSectorIndex];
          this.controlPoint.relocate(newSector.position, newSector.name);

          if (onEventCallback) {
            onEventCallback('relocated', this.controlPoint, newSector.name);
          }
        }

        this.controlPoint.update(dt, allMechs, (type, cp, team) => {
          if (onEventCallback) onEventCallback(type, cp, team);
        });
      }
    }

    /**
     * Counts how many zones each team currently holds (for Domination)
     */
    getControlledZoneCounts() {
      const counts = { blue: 0, red: 0 };
      if (this.activeMode === 'DOMINATION') {
        this.zones.forEach(z => {
          if (z.controllingTeam === 'blue') counts.blue++;
          else if (z.controllingTeam === 'red') counts.red++;
        });
      }
      return counts;
    }

    /**
     * Returns true if active control point is currently held by specified team
     */
    isControlPointHeldBy(team) {
      if (this.activeMode === 'CONTROL_POINT' && this.controlPoint) {
        return this.controlPoint.controllingTeam === team;
      }
      return false;
    }

    /**
     * Returns an array of summary descriptors for minimap and bot AI
     */
    getActiveObjectives() {
      if (this.activeMode === 'DOMINATION') {
        return this.zones.map(z => ({
          id: z.id,
          label: z.label,
          position: z.position,
          radius: z.radius,
          controllingTeam: z.controllingTeam,
          isContested: z.isContested,
          progress: z.captureProgress,
          blueCount: z.blueCount,
          redCount: z.redCount,
          playerInside: z.playerInside
        }));
      } else if (this.activeMode === 'CONTROL_POINT' && this.controlPoint) {
        return [{
          id: 'CP',
          label: this.controlPoint.sectorName,
          position: this.controlPoint.position,
          radius: this.controlPoint.radius,
          controllingTeam: this.controlPoint.controllingTeam,
          isContested: this.controlPoint.isContested,
          progress: this.controlPoint.captureProgress,
          isWarning: this.controlPoint.isWarning,
          nextSectorName: this.controlPoint.nextSectorName,
          blueCount: this.controlPoint.blueCount,
          redCount: this.controlPoint.redCount,
          playerInside: this.controlPoint.playerInside
        }];
      }
      return [];
    }

    destroy() {
      this.zones.forEach(z => z.destroy());
      this.zones = [];
      if (this.controlPoint) {
        this.controlPoint.destroy();
        this.controlPoint = null;
      }
      this.activeMode = null;
    }
  }

  IT.ObjectiveManager = ObjectiveManager;
})(window.IT);
