/**
 * Iron Titans 3D — NetworkProtocol.js
 * Central Network Protocol Specifications, Message Types, and Constants.
 * Standardizes binary-ready JSON packet structures for client-server and peer messaging.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  // ── Network Message Types ──
  const NET_MSG = Object.freeze({
    // Handshake & Telemetry
    HELLO: 'HELLO',
    WELCOME: 'WELCOME',
    PING: 'PING',
    PONG: 'PONG',

    // Matchmaking & Lobby
    MATCHMAKING_QUEUE: 'MATCHMAKING_QUEUE',
    MATCHMAKING_STATUS: 'MATCHMAKING_STATUS',
    MATCHMAKING_FOUND: 'MATCHMAKING_FOUND',
    MATCHMAKING_CANCEL: 'MATCHMAKING_CANCEL',

    // Room Lifecycle
    ROOM_JOIN: 'ROOM_JOIN',
    ROOM_LEAVE: 'ROOM_LEAVE',
    ROOM_STATE: 'ROOM_STATE',
    PLAYER_JOINED: 'PLAYER_JOINED',
    PLAYER_LEFT: 'PLAYER_LEFT',

    // Match State
    MATCH_STARTING: 'MATCH_STARTING',
    MATCH_START: 'MATCH_START',
    MATCH_TICK: 'MATCH_TICK',
    MATCH_END: 'MATCH_END',

    // Player State & Movement
    PLAYER_INPUT: 'PLAYER_INPUT',
    PLAYER_SNAPSHOT: 'PLAYER_SNAPSHOT',
    WORLD_SNAPSHOT: 'WORLD_SNAPSHOT',

    // Combat & Weapons
    WEAPON_FIRE: 'WEAPON_FIRE',
    PROJECTILE_SPAWN: 'PROJECTILE_SPAWN',
    PROJECTILE_HIT: 'PROJECTILE_HIT',
    DAMAGE_APPLIED: 'DAMAGE_APPLIED',
    CRITICAL_HIT: 'CRITICAL_HIT',
    WEAPON_RELOAD: 'WEAPON_RELOAD',

    // Tactical Abilities
    ABILITY_ACTIVATE: 'ABILITY_ACTIVATE',
    ABILITY_EFFECT: 'ABILITY_EFFECT',
    ABILITY_END: 'ABILITY_END',

    // Elimination & Respawn
    PLAYER_KILLED: 'PLAYER_KILLED',
    RESPAWN_COUNTDOWN: 'RESPAWN_COUNTDOWN',
    PLAYER_RESPAWNED: 'PLAYER_RESPAWNED',

    // Objectives & Strategy
    OBJECTIVE_UPDATE: 'OBJECTIVE_UPDATE',
    SCORE_UPDATE: 'SCORE_UPDATE',

    // Error & Diagnostics
    NET_ERROR: 'NET_ERROR'
  });

  // ── Connection States ──
  const CONNECTION_STATES = Object.freeze({
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    RECONNECTING: 'RECONNECTING',
    FAILED: 'FAILED'
  });

  // ── Room States ──
  const ROOM_STATES = Object.freeze({
    WAITING: 'WAITING',
    READY: 'READY',
    STARTING: 'STARTING',
    PLAYING: 'PLAYING',
    FINISHED: 'FINISHED',
    CLOSED: 'CLOSED'
  });

  // ── Teams ──
  const TEAMS = Object.freeze({
    BLUE: 'blue',
    RED: 'red'
  });

  // ── Protocol Constants ──
  const PROTOCOL_CONSTANTS = Object.freeze({
    PROTOCOL_VERSION: 1,
    DEFAULT_PORT: 8090,
    TICK_RATE: 20,              // 20 network ticks per second
    TICK_INTERVAL_MS: 50,       // 50ms per network tick
    INTERPOLATION_DELAY_MS: 100,// 100ms render buffer for jitter smoothing
    HEARTBEAT_INTERVAL_MS: 2000,// 2 seconds ping interval
    HEARTBEAT_TIMEOUT_MS: 6000, // 6 seconds timeout
    MAX_ROOM_PLAYERS: 10,       // 5v5 (5 Blue, 5 Red)
    RESPAWN_DELAY_SEC: 2.0,     // 2-second respawn protection
    MAX_SNAPSHOT_HISTORY: 30    // Stores up to 1.5 seconds of snapshots
  });

  /**
   * Helper to format standardized network packet envelopes.
   */
  class NetworkMessage {
    static create(type, payload = {}, seq = 0) {
      return {
        type,
        seq,
        timestamp: Date.now(),
        payload
      };
    }

    static serialize(msg) {
      return JSON.stringify(msg);
    }

    static deserialize(raw) {
      try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (e) {
        console.warn('[NetworkMessage] Failed to deserialize packet:', e);
        return null;
      }
    }
  }

  IT.NET_MSG = NET_MSG;
  IT.CONNECTION_STATES = CONNECTION_STATES;
  IT.ROOM_STATES = ROOM_STATES;
  IT.NET_TEAMS = TEAMS;
  IT.NET_CONFIG = PROTOCOL_CONSTANTS;
  IT.NetworkMessage = NetworkMessage;
})(window.IT);
