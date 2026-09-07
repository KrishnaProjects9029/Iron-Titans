/**
 * Iron Titans 3D — MatchmakingManager.js
 * 5v5 Matchmaking Queue & Roster Assembly Coordinator.
 * Handles queue entry, player aggregation, AI slot-filling (hybrid human+bot),
 * team assignment (Blue vs Red), and countdown dispatch.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const MATCHMAKING_STATES = Object.freeze({
    IDLE: 'IDLE',
    QUEUED: 'QUEUED',
    SEARCHING: 'SEARCHING',
    FOUND: 'FOUND',
    ASSIGNING: 'ASSIGNING',
    STARTING: 'STARTING',
    CANCELLED: 'CANCELLED'
  });

  class MatchmakingManager {
    constructor(networkManager) {
      this.nm = networkManager;
      this.state = MATCHMAKING_STATES.IDLE;
      this.playersFound = 0;
      this.targetPlayers = 10; // 5v5
      this.currentMode = 'SKIRMISH';
      this.currentArena = 'NEON_FORGE';
      this.statusText = 'Searching for players...';
      this.countdown = 3;

      // Event Callbacks
      this.onStatusChange = null;
      this.onMatchFound = null;
    }

    /**
     * Start queuing for an online 5v5 match.
     */
    startQueue(options = {}) {
      this.currentMode = options.mode || (IT.SaveManager && IT.SaveManager.preferredMode) || 'SKIRMISH';
      this.currentArena = options.arena || (IT.SaveManager && IT.SaveManager.preferredArena) || 'NEON_FORGE';
      this.state = MATCHMAKING_STATES.QUEUED;
      this.playersFound = 1;
      this.statusText = 'Searching for players...';
      this._notifyStatus();

      // Ensure network client is connected
      this.nm.connect(() => {
        this.state = MATCHMAKING_STATES.SEARCHING;
        const identity = IT.AuthManager ? IT.AuthManager.getIdentity() : null;
        const loadout = IT.SaveManager ? IT.SaveManager.getLoadout() : null;

        this.nm.send(IT.NET_MSG.MATCHMAKING_QUEUE, {
          mode: this.currentMode,
          arena: this.currentArena,
          player: {
            id: identity ? identity.id : 'player_local',
            name: identity ? identity.callsign : 'Commander',
            loadout
          }
        });
      });
    }

    /**
     * Cancel ongoing matchmaking queue.
     */
    cancelQueue() {
      if (this.state === MATCHMAKING_STATES.IDLE) return;
      this.state = MATCHMAKING_STATES.CANCELLED;
      this.statusText = 'Matchmaking cancelled.';
      this._notifyStatus();

      this.nm.send(IT.NET_MSG.MATCHMAKING_CANCEL, {});
      this.state = MATCHMAKING_STATES.IDLE;
    }

    /**
     * Handle incoming status updates from server or loopback adapter.
     */
    handleStatusUpdate(data) {
      if (data.status === 'SEARCHING') {
        this.state = MATCHMAKING_STATES.SEARCHING;
        this.playersFound = data.playersFound || this.playersFound;
        this.statusText = `Searching for players... (${this.playersFound}/${this.targetPlayers})`;
      } else if (data.status === 'CANCELLED') {
        this.state = MATCHMAKING_STATES.IDLE;
        this.statusText = 'Matchmaking cancelled.';
      }
      this._notifyStatus();
    }

    /**
     * Handle match found notification.
     */
    handleMatchFound(data) {
      this.state = MATCHMAKING_STATES.FOUND;
      this.playersFound = 10;
      this.countdown = data.countdown || 3;
      this.statusText = 'Match found! Assigning teams...';
      this._notifyStatus();

      let remaining = this.countdown;
      const countTimer = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          this.statusText = `Match starting in ${remaining}...`;
          this._notifyStatus();
        } else {
          clearInterval(countTimer);
          this.state = MATCHMAKING_STATES.STARTING;
          this.statusText = 'Connecting to arena...';
          this._notifyStatus();
        }
      }, 1000);
    }

    _notifyStatus() {
      if (this.onStatusChange) {
        this.onStatusChange({
          state: this.state,
          playersFound: this.playersFound,
          targetPlayers: this.targetPlayers,
          statusText: this.statusText,
          countdown: this.countdown
        });
      }
    }
  }

  IT.MATCHMAKING_STATES = MATCHMAKING_STATES;
  IT.MatchmakingManager = MatchmakingManager;
})(window.IT);
