/**
 * Iron Titans 3D — TeamSkirmishMode.js
 * 5v5 Team Skirmish mode:
 * - Match Duration: 5:00 minutes
 * - Target Score: 25 eliminations
 * - +1 team point per kill
 * - First to 25 wins, or highest score when timer expires
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class TeamSkirmishMode extends IT.GameModeBase {
    constructor() {
      super({
        modeId: 'SKIRMISH',
        name: 'TEAM SKIRMISH',
        description: 'First team to 25 eliminations.',
        playersText: '5v5',
        matchDuration: 300, // 5 minutes
        targetScore: 25
      });
    }

    handleKill(victim, killer) {
      if (this.state !== IT.MODE_STATES.ACTIVE) return;
      super.handleKill(victim, killer);

      // In Skirmish, every kill scores +1 for the killer's team
      const killerTeam = killer ? killer.team : (victim.team === 'blue' ? 'red' : 'blue');
      this.addScore(killerTeam, 1);
    }
  }

  IT.TeamSkirmishMode = TeamSkirmishMode;
})(window.IT);
