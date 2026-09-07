/**
 * Iron Titans 3D — ServerAdapter.js
 * Pluggable Server Communication Abstraction Layer.
 * Provides:
 * - ServerAdapter (Base Interface)
 * - WebSocketServerAdapter (Native RFC 6455 WebSockets for local/remote servers)
 * - LoopbackServerAdapter (In-memory simulated multiplayer server for offline/testing)
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  /**
   * Base ServerAdapter Interface.
   */
  class ServerAdapter {
    constructor() {
      this.onOpen = null;
      this.onClose = null;
      this.onError = null;
      this.onMessage = null;
      this.isConnected = false;
    }

    connect(url) {
      throw new Error('connect() must be implemented by subclass');
    }

    disconnect() {
      throw new Error('disconnect() must be implemented by subclass');
    }

    send(type, payload = {}) {
      throw new Error('send() must be implemented by subclass');
    }
  }

  /**
   * WebSocketServerAdapter
   * Connects to a standard WebSocket server over ws:// or wss://.
   */
  class WebSocketServerAdapter extends ServerAdapter {
    constructor() {
      super();
      this.ws = null;
      this.url = null;
    }

    connect(url = `ws://${window.location ? window.location.hostname : 'localhost'}:8090`) {
      this.url = url;
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.isConnected = true;
          if (this.onOpen) this.onOpen();
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          if (this.onClose) this.onClose(event);
        };

        this.ws.onerror = (err) => {
          if (this.onError) this.onError(err);
        };

        this.ws.onmessage = (event) => {
          const msg = IT.NetworkMessage.deserialize(event.data);
          if (msg && this.onMessage) {
            this.onMessage(msg);
          }
        };
      } catch (e) {
        if (this.onError) this.onError(e);
      }
    }

    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.isConnected = false;
    }

    send(type, payload = {}) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
      const msg = IT.NetworkMessage.create(type, payload);
      this.ws.send(IT.NetworkMessage.serialize(msg));
      return true;
    }
  }

  /**
   * LoopbackServerAdapter
   * In-memory simulated server. Allows full online multiplayer flow testing,
   * simulated matchmaking, and 5v5 AI filling even if no node server is running!
   */
  class LoopbackServerAdapter extends ServerAdapter {
    constructor() {
      super();
      this.simulatedLatencyMs = 35; // Simulates ~35ms realistic network latency
      this.currentRoom = null;
      this.matchmakingTimer = null;
      this._intervalId = null;
    }

    connect() {
      setTimeout(() => {
        this.isConnected = true;
        if (this.onOpen) this.onOpen();
      }, this.simulatedLatencyMs);
    }

    disconnect() {
      this.isConnected = false;
      if (this.matchmakingTimer) clearTimeout(this.matchmakingTimer);
      if (this._intervalId) clearInterval(this._intervalId);
      if (this.onClose) this.onClose({ code: 1000, reason: 'Client disconnected' });
    }

    send(type, payload = {}) {
      if (!this.isConnected) return false;

      setTimeout(() => {
        this._handleClientMessage(type, payload);
      }, this.simulatedLatencyMs);

      return true;
    }

    _handleClientMessage(type, payload) {
      const NM = IT.NET_MSG;

      switch (type) {
        case NM.HELLO:
          this._reply(NM.WELCOME, {
            serverTime: Date.now(),
            version: IT.NET_CONFIG.PROTOCOL_VERSION,
            adapter: 'LOOPBACK_SIMULATOR'
          });
          break;

        case NM.PING:
          this._reply(NM.PONG, { clientTime: payload.timestamp, serverTime: Date.now() });
          break;

        case NM.MATCHMAKING_QUEUE:
          this._simulateMatchmaking(payload);
          break;

        case NM.MATCHMAKING_CANCEL:
          if (this.matchmakingTimer) clearTimeout(this.matchmakingTimer);
          this._reply(NM.MATCHMAKING_STATUS, { status: 'CANCELLED' });
          break;

        case NM.PLAYER_SNAPSHOT:
          // Echo transform in loopback tick
          break;

        case NM.WEAPON_FIRE:
          this._reply(NM.WEAPON_FIRE, {
            shooterId: payload.shooterId || 'local_player',
            ...payload
          });
          break;

        case NM.ABILITY_ACTIVATE:
          this._reply(NM.ABILITY_EFFECT, payload);
          break;
      }
    }

    _simulateMatchmaking(payload) {
      const { mode = 'SKIRMISH', arena = 'NEON_FORGE', player } = payload;
      let count = 1;

      const step = () => {
        count += Math.floor(1 + Math.random() * 3);
        if (count < 10) {
          this._reply(IT.NET_MSG.MATCHMAKING_STATUS, {
            status: 'SEARCHING',
            playersFound: count,
            maxPlayers: 10
          });
          this.matchmakingTimer = setTimeout(step, 800);
        } else {
          count = 10;
          this._reply(IT.NET_MSG.MATCHMAKING_FOUND, {
            roomId: 'room_' + Math.random().toString(36).substr(2, 6),
            mode,
            arena,
            playersFound: 10,
            countdown: 3
          });
          this.matchmakingTimer = setTimeout(() => this._startSimulatedMatch(payload), 1500);
        }
      };

      this.matchmakingTimer = setTimeout(step, 400);
    }

    _startSimulatedMatch(payload) {
      const roomId = 'room_' + Math.random().toString(36).substr(2, 6);
      const players = [
        {
          id: payload.player ? payload.player.id : 'player_local',
          name: payload.player ? payload.player.name : 'Commander',
          team: 'blue',
          isLocal: true,
          isAI: false,
          mechId: (payload.player && payload.player.loadout && payload.player.loadout.mechId) || 'ironclad',
          primaryWeapon: (payload.player && payload.player.loadout && payload.player.loadout.primaryId) || 'pulseCannon',
          secondaryWeapon: (payload.player && payload.player.loadout && payload.player.loadout.secondaryId) || 'scatterBlaster'
        }
      ];

      // Generate 9 AI players (4 Blue allies, 5 Red enemies)
      const MECHS = ['ironclad', 'vortex', 'bastion', 'striker', 'nova'];
      const WEAPONS = ['pulseCannon', 'scatterBlaster', 'plasmaLauncher', 'arcRifle', 'missileRack', 'railSpear'];
      const AI_NAMES = ['Valkyrie', 'Goliath', 'Specter', 'Aegis', 'Nemesis', 'Onslaught', 'Tempest', 'Havoc', 'Reaper'];

      for (let i = 1; i < 10; i++) {
        players.push({
          id: `bot_${i}`,
          name: AI_NAMES[i - 1],
          team: i < 5 ? 'blue' : 'red',
          isLocal: false,
          isAI: true,
          mechId: MECHS[i % MECHS.length],
          primaryWeapon: WEAPONS[i % WEAPONS.length],
          secondaryWeapon: WEAPONS[(i + 1) % WEAPONS.length]
        });
      }

      this._reply(IT.NET_MSG.MATCH_START, {
        roomId,
        mode: payload.mode || 'SKIRMISH',
        arena: payload.arena || 'NEON_FORGE',
        players,
        matchDuration: 300,
        targetScore: payload.mode === 'DOMINATION' ? 300 : 25
      });
    }

    _reply(type, payload = {}) {
      setTimeout(() => {
        if (!this.isConnected || !this.onMessage) return;
        const msg = IT.NetworkMessage.create(type, payload);
        this.onMessage(msg);
      }, this.simulatedLatencyMs);
    }
  }

  IT.ServerAdapter = ServerAdapter;
  IT.WebSocketServerAdapter = WebSocketServerAdapter;
  IT.LoopbackServerAdapter = LoopbackServerAdapter;
})(window.IT);
