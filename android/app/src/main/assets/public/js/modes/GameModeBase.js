/**
 * Iron Titans 3D — GameModeBase.js
 * Standard interface and lifecycle for all Iron Titans 3D battle modes:
 * - initialize()
 * - start()
 * - update(dt)
 * - handleKill(victim, killer)
 * - handleDeath(victim)
 * - handleObjective(event)
 * - end(winningTeam)
 * - reset()
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const MODE_STATES = {
    COUNTDOWN: 'COUNTDOWN',
    ACTIVE: 'ACTIVE',
    MATCH_OVER: 'MATCH_OVER'
  };

  // Original brief streak announcements
  const STREAK_MILESTONES = {
    2: { name: 'DOUBLE STRIKE', sound: 'double_strike' },
    3: { name: 'TRIPLE STRIKE', sound: 'triple_strike' },
    5: { name: 'RAMPAGE', sound: 'rampage' },
    7: { name: 'DOMINATING', sound: 'dominating' }
  };

  class GameModeBase {
    constructor(config = {}) {
      this.modeId = config.modeId || 'BASE';
      this.name = config.name || 'Battle Mode';
      this.description = config.description || '';
      this.playersText = config.playersText || '5v5';
      this.matchDuration = config.matchDuration || 300;
      this.targetScore = config.targetScore || 25;

      this.timer = this.matchDuration;
      this.state = MODE_STATES.COUNTDOWN;
      this.countdownTimer = 3.0;

      this.teamScores = { blue: 0, red: 0 };

      // Match statistics per mech: mech -> { kills, deaths, assists, damageDealt, objectiveScore, captures, defenses, timeOnPoint }
      this.stats = new Map();
      this.killFeed = [];
      this.maxKillFeed = 5;

      // Kill streak tracking per mech
      this.streaks = new Map();

      // System references attached on initialize
      this.teamManager = null;
      this.spawnManager = null;
      this.hud = null;
      this.arena = null;
      this.allMechs = [];
      this.playerMech = null;

      // Event hooks
      this.onMatchOver = null;
      this.onKillFeedEvent = null;
      this.onAnnouncement = null;
      this.onScoreChanged = null;
    }

    initialize(context) {
      this.teamManager = context.teamManager;
      this.spawnManager = context.spawnManager;
      this.hud = context.hud;
      this.arena = context.arena;
      this.allMechs = context.allMechs || [];
      this.playerMech = context.playerMech || null;

      this.reset();
    }

    start() {
      this.state = MODE_STATES.ACTIVE;
      this.broadcastAnnouncement('ENGAGE!', 'accent', 1.8);
    }

    reset() {
      this.state = MODE_STATES.COUNTDOWN;
      this.countdownTimer = 3.0;
      this.timer = this.matchDuration;
      this.teamScores = { blue: 0, red: 0 };
      this.killFeed = [];
      this.stats.clear();
      this.streaks.clear();

      if (this.teamManager && typeof this.teamManager.resetScores === 'function') {
        this.teamManager.resetScores();
      }

      if (this.allMechs) {
        this.allMechs.forEach(m => this.initMechStats(m));
      }

      if (this.hud) {
        this.hud.blueScore = 0;
        this.hud.redScore = 0;
        this.hud.matchTime = this.matchDuration;
      }
    }

    initMechStats(mech) {
      this.stats.set(mech, {
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        objectiveScore: 0,
        captures: 0,
        defenses: 0,
        timeOnPoint: 0
      });
      this.streaks.set(mech, 0);
    }

    getMechStats(mech) {
      return this.stats.get(mech) || {
        kills: 0,
        deaths: 0,
        assists: 0,
        damageDealt: 0,
        objectiveScore: 0,
        captures: 0,
        defenses: 0,
        timeOnPoint: 0
      };
    }

    recordDamage(attacker, victim, amount) {
      if (!attacker) return;
      const s = this.getMechStats(attacker);
      s.damageDealt += Math.round(amount);
    }

    handleKill(victim, killer) {
      if (this.state !== MODE_STATES.ACTIVE) return;

      const victimStats = this.getMechStats(victim);
      victimStats.deaths++;
      this.streaks.set(victim, 0); // End streak on death

      let killerName = 'HAZARD';
      let killerTeam = victim.team === 'blue' ? 'red' : 'blue';

      if (killer) {
        const killerStats = this.getMechStats(killer);
        killerStats.kills++;
        killerName = killer.name;
        killerTeam = killer.team;

        // Advance kill streak
        const currentStreak = (this.streaks.get(killer) || 0) + 1;
        this.streaks.set(killer, currentStreak);

        // Check for kill streak announcement if killer is player
        if (killer.isPlayer && STREAK_MILESTONES[currentStreak]) {
          const streakData = STREAK_MILESTONES[currentStreak];
          this.broadcastAnnouncement(streakData.name, 'streak', 2.2);
        }
      }

      // Add to kill feed
      const isPlayerInvolved = (killer && killer.isPlayer) || victim.isPlayer;
      const feedItem = {
        id: Date.now() + Math.random(),
        killerName,
        killerTeam,
        victimName: victim.name,
        victimTeam: victim.team,
        isPlayerInvolved,
        text: `[${killerTeam.toUpperCase()}] ${killerName} ⚔️ [${victim.team.toUpperCase()}] ${victim.name}`,
        life: 4.5
      };

      this.killFeed.unshift(feedItem);
      if (this.killFeed.length > this.maxKillFeed) {
        this.killFeed.pop();
      }

      if (this.onKillFeedEvent) {
        this.onKillFeedEvent(feedItem);
      }
    }

    handleDeath(victim) {
      // Hook for mode-specific handling of death / respawn timing
    }

    handleObjective(event) {
      // Virtual hook overridden by objective modes
    }

    addScore(team, amount = 1) {
      if (this.state !== MODE_STATES.ACTIVE) return;
      if (team !== 'blue' && team !== 'red') return;

      this.teamScores[team] += amount;
      if (this.teamManager) {
        this.teamManager.scores[team] = this.teamScores[team];
      }

      if (this.hud) {
        this.hud.blueScore = this.teamScores.blue;
        this.hud.redScore = this.teamScores.red;
      }

      if (this.onScoreChanged) {
        this.onScoreChanged(team, this.teamScores[team]);
      }

      if (this.teamScores[team] >= this.targetScore) {
        this.end(team);
      }
    }

    update(dt) {
      // 1. Countdown Phase
      if (this.state === MODE_STATES.COUNTDOWN) {
        this.countdownTimer -= dt;
        if (this.countdownTimer <= 0) {
          this.start();
        }
        return;
      }

      // 2. Active Match Phase
      if (this.state === MODE_STATES.ACTIVE) {
        this.timer = Math.max(0, this.timer - dt);
        if (this.hud) {
          this.hud.matchTime = this.timer;
        }

        if (this.timer <= 0) {
          if (this.teamScores.blue > this.teamScores.red) {
            this.end('blue');
          } else if (this.teamScores.red > this.teamScores.blue) {
            this.end('red');
          } else {
            this.end('draw');
          }
        }
      }

      // 3. Age kill feed
      for (let i = this.killFeed.length - 1; i >= 0; i--) {
        this.killFeed[i].life -= dt;
        if (this.killFeed[i].life <= 0) {
          this.killFeed.splice(i, 1);
        }
      }
    }

    end(winningTeam) {
      if (this.state === MODE_STATES.MATCH_OVER) return;
      this.state = MODE_STATES.MATCH_OVER;

      const playerWon = winningTeam === 'blue';
      const isDraw = winningTeam === 'draw';

      if (this.onMatchOver) {
        this.onMatchOver({
          modeId: this.modeId,
          modeName: this.name,
          winningTeam,
          playerWon,
          isDraw,
          blueScore: this.teamScores.blue,
          redScore: this.teamScores.red,
          targetScore: this.targetScore,
          matchDuration: this.matchDuration - this.timer
        });
      }
    }

    broadcastAnnouncement(text, type = 'info', duration = 2.5) {
      if (this.onAnnouncement) {
        this.onAnnouncement({ text, type, duration });
      }
    }

    getObjectives() {
      return [];
    }

    getRemainingTime() {
      return this.timer;
    }

    get blueScore() {
      return this.teamScores.blue;
    }

    get redScore() {
      return this.teamScores.red;
    }

    getPlayerPerformance(playerMech) {
      const s = this.getMechStats(playerMech);
      return {
        captures: s.captures || 0,
        defenses: s.defenses || 0,
        timeOnPoint: s.timeOnPoint || 0,
        objectiveScore: s.objectiveScore || 0
      };
    }

    getPlayerStreak(playerMech) {
      return this.streaks.get(playerMech) || 0;
    }
  }

  IT.MODE_STATES = MODE_STATES;
  IT.STREAK_MILESTONES = STREAK_MILESTONES;
  IT.GameModeBase = GameModeBase;
})(window.IT);
