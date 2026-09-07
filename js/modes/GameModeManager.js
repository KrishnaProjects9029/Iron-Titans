/**
 * Iron Titans 3D — GameModeManager.js
 * Central Registry and Router for all Game Modes:
 * - Registers: TEAM SKIRMISH, DOMINATION, CONTROL POINT
 * - Coordinates mode switching, initialization, HUD updates, and match flow
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class GameModeManager {
    constructor() {
      this.modes = new Map();
      this.activeMode = null;

      // Register default modes
      this.register(new IT.TeamSkirmishMode());
      this.register(new IT.DominationMode());
      this.register(new IT.ControlPointMode());

      this.activeMode = this.modes.get('SKIRMISH');
    }

    register(modeInstance) {
      if (!modeInstance || !modeInstance.modeId) return;
      this.modes.set(modeInstance.modeId, modeInstance);
    }

    get(modeId) {
      return this.modes.get(modeId) || this.modes.get('SKIRMISH');
    }

    getAll() {
      return Array.from(this.modes.values()).map(m => ({
        id: m.modeId,
        name: m.name,
        description: m.description,
        players: m.playersText,
        matchDuration: m.matchDuration,
        targetScore: m.targetScore
      }));
    }

    selectMode(modeId) {
      const mode = this.get(modeId);
      if (mode) {
        this.activeMode = mode;
      }
      return this.activeMode;
    }

    setMode(modeId) {
      return this.selectMode(modeId);
    }

    getActiveMode() {
      return this.activeMode;
    }
  }

  IT.GameModeManager = GameModeManager;
})(window.IT);
