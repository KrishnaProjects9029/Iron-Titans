/**
 * Iron Titans 3D — EventManager.js
 * Decoupled Pub/Sub Event Dispatcher Singleton.
 * Connects 3D combat, game modes, AI eliminations, and objective milestones
 * to the Mission Tracker, Reward System, and In-Game Notifications without
 * incurring per-frame polling overhead in the render loop.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const GAME_EVENTS = Object.freeze({
    // Match lifecycle
    MATCH_STARTED: 'MATCH_STARTED',
    MATCH_COMPLETED: 'MATCH_COMPLETED',
    MATCH_WON: 'MATCH_WON',
    MATCH_LOST: 'MATCH_LOST',

    // Combat & Eliminations
    ENEMY_DESTROYED: 'ENEMY_DESTROYED',
    DAMAGE_DEALT: 'DAMAGE_DEALT',
    DAMAGE_TAKEN: 'DAMAGE_TAKEN',
    CRITICAL_HIT: 'CRITICAL_HIT',
    ASSIST_RECEIVED: 'ASSIST_RECEIVED',
    WEAPON_FIRED: 'WEAPON_FIRED',
    ABILITY_USED: 'ABILITY_USED',

    // Objectives & Strategy
    OBJECTIVE_CAPTURED: 'OBJECTIVE_CAPTURED',
    OBJECTIVE_DEFENDED: 'OBJECTIVE_DEFENDED',
    CONTROL_POINT_TICKS: 'CONTROL_POINT_TICKS',

    // Progression & Unlocks
    PLAYER_LEVEL_UP: 'PLAYER_LEVEL_UP',
    MISSION_COMPLETED: 'MISSION_COMPLETED',
    MISSION_CLAIMED: 'MISSION_CLAIMED',
    ACHIEVEMENT_UNLOCKED: 'ACHIEVEMENT_UNLOCKED',
    DAILY_LOGIN_CLAIMED: 'DAILY_LOGIN_CLAIMED',
    REWARD_GRANTED: 'REWARD_GRANTED'
  });

  class EventManager {
    constructor() {
      this._listeners = new Map();
      this.GAME_EVENTS = GAME_EVENTS;
    }

    /**
     * Subscribe to a game event.
     * @param {string} eventName
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback) {
      if (typeof callback !== 'function') {
        console.warn(`[EventManager] Invalid listener registered for event "${eventName}".`);
        return () => {};
      }
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Set());
      }
      this._listeners.get(eventName).add(callback);

      return () => this.off(eventName, callback);
    }

    /**
     * Unsubscribe a listener from an event.
     * @param {string} eventName
     * @param {Function} callback
     */
    off(eventName, callback) {
      if (!this._listeners.has(eventName)) return;
      const set = this._listeners.get(eventName);
      set.delete(callback);
      if (set.size === 0) {
        this._listeners.delete(eventName);
      }
    }

    /**
     * Emit an event to all subscribed listeners.
     * @param {string} eventName
     * @param {Object} [data={}]
     */
    emit(eventName, data = {}) {
      if (!this._listeners.has(eventName)) return;
      const set = this._listeners.get(eventName);
      for (const cb of set) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[EventManager] Error in listener for "${eventName}":`, err);
        }
      }
    }

    /**
     * Clear all registered listeners.
     */
    clear() {
      this._listeners.clear();
    }
  }

  IT.GAME_EVENTS = GAME_EVENTS;
  IT.EventManager = new EventManager();
})(window.IT);
