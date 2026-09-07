/**
 * Iron Titans 3D — NetworkRoom.js
 * 5v5 Room State & Match Synchronization.
 * Tracks connected players, teams (Blue/Red), score counters, match timer,
 * objectives (Zones A, B, C / Rotating CP), and end-of-match settlement.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class NetworkRoom {
    constructor(data = {}) {
      this.roomId = data.roomId || 'room_' + Math.random().toString(36).substr(2, 6);
      this.gameMode = data.mode || 'SKIRMISH';
      this.arenaId = data.arena || 'NEON_FORGE';
      this.state = IT.ROOM_STATES.WAITING;

      // Players: Map of id -> NetworkPlayer
      this.players = new Map();
      this.teams = {
        blue: [],
        red: []
      };

      // Match variables
      this.matchDuration = data.matchDuration || 300;
      this.timer = this.matchDuration;
      this.targetScore = data.targetScore || (this.gameMode === 'DOMINATION' ? 300 : 25);
      this.scores = { blue: 0, red: 0 };

      // Synchronized Objectives for Domination & Control Point
      this.objectives = {
        zones: {
          A: { id: 'A', owner: 'neutral', progress: 0, contested: false },
          B: { id: 'B', owner: 'neutral', progress: 0, contested: false },
          C: { id: 'C', owner: 'neutral', progress: 0, contested: false }
        },
        activePoint: 'A'
      };

      this.isRewardSettled = false;
    }

    /**
     * Populate roster from MATCH_START packet.
     */
    initializeRoster(playerDefs, localPlayerId) {
      this.players.clear();
      this.teams.blue = [];
      this.teams.red = [];
      this.isRewardSettled = false;

      playerDefs.forEach(p => {
        const isLocal = p.id === localPlayerId;
        const netPlayer = new IT.NetworkPlayer({
          ...p,
          isLocal
        });

        this.players.set(p.id, netPlayer);
        if (p.team === 'red') {
          this.teams.red.push(netPlayer);
        } else {
          this.teams.blue.push(netPlayer);
        }
      });

      this.state = IT.ROOM_STATES.PLAYING;
    }

    getPlayer(id) {
      return this.players.get(id) || null;
    }

    getAllPlayers() {
      return Array.from(this.players.values());
    }

    /**
     * Apply authoritative tick snapshot from server.
     */
    applyServerTick(tickData) {
      if (!tickData) return;

      if (tickData.timer !== undefined) this.timer = tickData.timer;
      if (tickData.scores) {
        this.scores.blue = tickData.scores.blue || this.scores.blue;
        this.scores.red = tickData.scores.red || this.scores.red;
      }

      if (tickData.objectives) {
        Object.assign(this.objectives, tickData.objectives);
      }

      // Synchronize player transforms
      if (tickData.players && Array.isArray(tickData.players)) {
        tickData.players.forEach(pData => {
          const p = this.players.get(pData.id);
          if (p && !p.isLocal) {
            const transform = IT.NetworkTransform.unpack(pData.t);
            p.receiveSnapshot(transform);
          }
        });
      }
    }

    /**
     * Settle match rewards securely once, preventing double claims.
     */
    settleMatchOutcome(result, localPlayerId) {
      if (this.isRewardSettled) return null;
      this.isRewardSettled = true;
      this.state = IT.ROOM_STATES.FINISHED;

      const localPlayer = this.getPlayer(localPlayerId);
      const isWinner = result.winningTeam === (localPlayer ? localPlayer.team : 'blue');

      const outcome = {
        won: isWinner,
        winningTeam: result.winningTeam,
        scores: this.scores,
        kills: localPlayer ? localPlayer.kills : 0,
        deaths: localPlayer ? localPlayer.deaths : 0,
        assists: localPlayer ? localPlayer.assists : 0,
        damageDealt: localPlayer ? localPlayer.damageDealt : 0,
        modeId: this.gameMode,
        arenaId: this.arenaId,
        creditsEarned: isWinner ? 1200 : 600,
        xpEarned: isWinner ? 800 : 400
      };

      // Save to Career and Economy
      if (IT.SaveManager) {
        IT.SaveManager.recordMatchOutcome(outcome);
      }

      // Dispatch Phase 7 Progression Events
      if (IT.EventManager) {
        IT.EventManager.emit(IT.GAME_EVENTS.MATCH_COMPLETED, outcome);
        if (isWinner) {
          IT.EventManager.emit(IT.GAME_EVENTS.MATCH_WON, outcome);
        } else {
          IT.EventManager.emit(IT.GAME_EVENTS.MATCH_LOST, outcome);
        }
      }

      return outcome;
    }

    /**
     * Replaces disconnected human player with an AI bot so match finishes cleanly.
     */
    handlePlayerDisconnect(playerId) {
      const p = this.players.get(playerId);
      if (!p) return;
      p.isBot = true;
      p.displayName = `[BOT] ${p.displayName}`;
      if (IT.EventManager) {
        IT.EventManager.emit('PLAYER_DISCONNECTED_REPLACED', { playerId, team: p.team });
      }
    }

    destroy() {
      this.players.forEach(p => p.destroy());
      this.players.clear();
      this.teams.blue = [];
      this.teams.red = [];
      this.state = IT.ROOM_STATES.CLOSED;
    }
  }

  IT.NetworkRoom = NetworkRoom;
})(window.IT);
