/**
 * Iron Titans 3D — MatchManager.js
 * Orchestrates 5v5 Team Skirmish match flow:
 * - Match countdown (3... 2... 1... ENGAGE!)
 * - 5:00 match timer & 25-kill win condition
 * - Real-time Kill Feed broadcast and combat stats tracking
 * - Victory / Defeat screen handling and clean match restart
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const MATCH_STATES = {
    COUNTDOWN: 'COUNTDOWN',
    ACTIVE: 'ACTIVE',
    MATCH_OVER: 'MATCH_OVER'
  };

  class MatchManager {
    constructor(teamManager, spawnManager, hud) {
      this.teamManager = teamManager;
      this.spawnManager = spawnManager;
      this.hud = hud;

      this.targetKills = 25;
      this.matchDuration = 300; // 5 minutes
      this.timer = this.matchDuration;

      this.state = MATCH_STATES.COUNTDOWN;
      this.countdownTimer = 3.0; // 3 seconds intro

      // Player and bot match stats
      this.stats = new Map(); // mech -> { kills, deaths, damageDealt }

      // Kill feed queue
      this.killFeed = []; // [{ id, text, team, isPlayerInvolved, timestamp }]
      this.maxKillFeedEntries = 5;

      // Callbacks
      this.onMatchOver = null;
      this.onKillFeedEvent = null;
    }

    initMechStats(mech) {
      this.stats.set(mech, {
        kills: 0,
        deaths: 0,
        damageDealt: 0
      });
    }

    getMechStats(mech) {
      return this.stats.get(mech) || { kills: 0, deaths: 0, damageDealt: 0 };
    }

    recordDamage(attacker, victim, amount) {
      if (!attacker) return;
      const s = this.getMechStats(attacker);
      s.damageDealt += amount;
    }

    recordKill(victim, killer) {
      if (this.state !== MATCH_STATES.ACTIVE) return;

      const victimStats = this.getMechStats(victim);
      victimStats.deaths++;

      let killerName = 'HAZARD';
      let killerTeam = victim.team === 'blue' ? 'red' : 'blue';

      if (killer) {
        const killerStats = this.getMechStats(killer);
        killerStats.kills++;
        killerName = killer.name;
        killerTeam = killer.team;
      }

      // Increment team score
      const newScore = this.teamManager.addScore(killerTeam, 1);
      if (this.hud) {
        this.hud.blueScore = this.teamManager.getScore('blue');
        this.hud.redScore = this.teamManager.getScore('red');
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
      if (this.killFeed.length > this.maxKillFeedEntries) {
        this.killFeed.pop();
      }

      if (this.onKillFeedEvent) {
        this.onKillFeedEvent(feedItem);
      }

      // Check for win condition
      if (newScore >= this.targetKills) {
        this._endMatch(killerTeam);
      }
    }

    update(dt) {
      if (this.state === MATCH_STATES.COUNTDOWN) {
        this.countdownTimer -= dt;
        if (this.countdownTimer <= 0) {
          this.state = MATCH_STATES.ACTIVE;
        }
        return;
      }

      if (this.state === MATCH_STATES.ACTIVE) {
        this.timer = Math.max(0, this.timer - dt);
        if (this.hud) {
          this.hud.matchTime = this.timer;
        }

        // Time expired check
        if (this.timer <= 0) {
          const blueScore = this.teamManager.getScore('blue');
          const redScore = this.teamManager.getScore('red');
          if (blueScore > redScore) {
            this._endMatch('blue');
          } else if (redScore > blueScore) {
            this._endMatch('red');
          } else {
            this._endMatch('draw');
          }
        }
      }

      // Age kill feed items
      for (let i = this.killFeed.length - 1; i >= 0; i--) {
        this.killFeed[i].life -= dt;
        if (this.killFeed[i].life <= 0) {
          this.killFeed.splice(i, 1);
        }
      }
    }

    _endMatch(winningTeam) {
      this.state = MATCH_STATES.MATCH_OVER;

      const playerWon = winningTeam === 'blue';
      const blueScore = this.teamManager.getScore('blue');
      const redScore = this.teamManager.getScore('red');

      if (this.onMatchOver) {
        this.onMatchOver({
          winningTeam,
          playerWon,
          blueScore,
          redScore,
          isDraw: winningTeam === 'draw'
        });
      }
    }

    resetMatch(allMechs) {
      this.state = MATCH_STATES.COUNTDOWN;
      this.countdownTimer = 3.0;
      this.timer = this.matchDuration;
      this.killFeed = [];

      if (this.teamManager && typeof this.teamManager.resetScores === 'function') {
        this.teamManager.resetScores();
      }
      if (this.hud) {
        this.hud.blueScore = 0;
        this.hud.redScore = 0;
        this.hud.matchTime = this.matchDuration;
      }

      // Reset mechs to team base positions
      if (allMechs) {
        allMechs.forEach(m => {
          this.initMechStats(m);
          const spawns = this.spawnManager.getSpawnPoints(m.team);
          const idx = Math.floor(Math.random() * spawns.length);
          const s = spawns[idx];
          m.respawn(s.x, 0, s.z);
          m.heading = s.heading || 0;
        });
      }

      this.spawnManager.reset();
    }
  }

  IT.MATCH_STATES = MATCH_STATES;
  IT.MatchManager = MatchManager;
})(window.IT);
