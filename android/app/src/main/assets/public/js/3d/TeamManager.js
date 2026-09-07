/**
 * Iron Titans 3D — TeamManager.js
 * Manages team rosters (Blue Team vs Red Team), scoring, alive status,
 * and friendly-fire validation queries for 5v5 multi-mech skirmishes.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const TEAMS = {
    BLUE: 'blue',
    RED: 'red'
  };

  const TEAM_COLORS = {
    [TEAMS.BLUE]: {
      name: 'BLUE TEAM',
      hex: 0x00c8ff,
      css: '#00c8ff',
      primary: 0x1e3852,
      secondary: 0x2f557d,
      visor: 0x00d0ff,
      exhaust: 0x0088ff
    },
    [TEAMS.RED]: {
      name: 'RED TEAM',
      hex: 0xff3b30,
      css: '#ff3b30',
      primary: 0x541c1c,
      secondary: 0x7a2828,
      visor: 0xff3030,
      exhaust: 0xff5500
    }
  };

  class TeamManager {
    constructor() {
      this.roster = {
        [TEAMS.BLUE]: [],
        [TEAMS.RED]: []
      };

      this.scores = {
        [TEAMS.BLUE]: 0,
        [TEAMS.RED]: 0
      };
    }

    reset() {
      this.roster[TEAMS.BLUE] = [];
      this.roster[TEAMS.RED] = [];
      this.scores[TEAMS.BLUE] = 0;
      this.scores[TEAMS.RED] = 0;
    }

    addMech(mech, team) {
      if (!team || !this.roster[team]) {
        team = TEAMS.BLUE;
      }
      mech.team = team;
      if (!this.roster[team].includes(mech)) {
        this.roster[team].push(mech);
      }
    }

    getTeamMembers(team) {
      return this.roster[team] || [];
    }

    getEnemiesOf(team) {
      const opposingTeam = team === TEAMS.BLUE ? TEAMS.RED : TEAMS.BLUE;
      return this.roster[opposingTeam] || [];
    }

    getAllMechs() {
      return [...this.roster[TEAMS.BLUE], ...this.roster[TEAMS.RED]];
    }

    isEnemy(sourceMech, targetMech) {
      if (!sourceMech || !targetMech) return false;
      return sourceMech.team !== targetMech.team;
    }

    getScore(team) {
      return this.scores[team] || 0;
    }

    addScore(team, amount = 1) {
      if (this.scores[team] !== undefined) {
        this.scores[team] += amount;
      }
      return this.scores[team];
    }

    getAliveCount(team) {
      const members = this.roster[team] || [];
      return members.filter(m => !m.isDead).length;
    }

    getLeader() {
      if (this.scores[TEAMS.BLUE] > this.scores[TEAMS.RED]) return TEAMS.BLUE;
      if (this.scores[TEAMS.RED] > this.scores[TEAMS.BLUE]) return TEAMS.RED;
      return 'TIE';
    }
  }

  IT.TEAMS = TEAMS;
  IT.TEAM_COLORS = TEAM_COLORS;
  IT.TeamManager = TeamManager;
})(window.IT);
