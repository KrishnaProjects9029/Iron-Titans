/**
 * Iron Titans 3D — NetworkManager.js
 * Master Multiplayer Coordinator Singleton.
 * Bridges network adapters, client connection, 5v5 room synchronization,
 * matchmaking, authoritative combat replication, and HUD telemetry.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class NetworkManager {
    constructor() {
      this.client = new IT.NetworkClient();
      this.combat = new IT.NetworkCombat(this);
      this.matchmaking = new IT.MatchmakingManager(this);
      this.room = null;

      // Mode flag
      this.isOnline = false;
      this.localPlayerId = null;

      // Active 3D engine hooks
      this.activeScene = null;
      this.activeCamera = null;
      this.activeCombat3D = null;
      this.activeHud = null;
      this.localMech = null;

      // Tick rate timer for outgoing transform packets (20 Hz / 50ms)
      this.lastTickTime = 0;
      this.tickInterval = IT.NET_CONFIG.TICK_INTERVAL_MS;

      this._wireClientEvents();
    }

    _wireClientEvents() {
      this.client.onStateChange = (state) => {
        this._updateNetworkIndicator(state, this.client.ping);
      };

      this.client.onPingUpdate = (pingMs) => {
        this._updateNetworkIndicator(this.client.state, pingMs);
      };

      this.client.onMessage = (msg) => {
        this._dispatchIncomingMessage(msg);
      };
    }

    /**
     * Connect to multiplayer server.
     * Automatically attempts WebSocket, with graceful Loopback fallback.
     */
    connect(onConnected) {
      if (this.client.state === IT.CONNECTION_STATES.CONNECTED) {
        if (onConnected) onConnected();
        return;
      }

      const settings = (IT.SaveManager && IT.SaveManager.networkSettings) || {};
      const mode = settings.adapterMode || 'AUTO';

      if (mode === 'LOOPBACK') {
        const adapter = new IT.LoopbackServerAdapter();
        this.client.connect(adapter);
        if (onConnected) setTimeout(onConnected, 60);
        return;
      }

      // Default: try WebSocket server on localhost:8090
      const host = (window.location && window.location.hostname) || 'localhost';
      const wsUrl = `ws://${host}:${IT.NET_CONFIG.DEFAULT_PORT || 8090}`;
      const wsAdapter = new IT.WebSocketServerAdapter();

      let timeoutFired = false;
      const fallbackTimeout = setTimeout(() => {
        if (this.client.state !== IT.CONNECTION_STATES.CONNECTED) {
          timeoutFired = true;
          console.info('[NetworkManager] Local WebSocket server not detected. Falling back to LoopbackServerAdapter.');
          const loopbackAdapter = new IT.LoopbackServerAdapter();
          this.client.connect(loopbackAdapter);
          if (onConnected) onConnected();
        }
      }, 1200);

      this.client.onStateChange = (state) => {
        this._updateNetworkIndicator(state, this.client.ping);
        if (state === IT.CONNECTION_STATES.CONNECTED && !timeoutFired) {
          clearTimeout(fallbackTimeout);
          if (onConnected) onConnected();
        }
      };

      this.client.connect(wsAdapter, wsUrl);
    }

    disconnect() {
      this.isOnline = false;
      if (this.room) {
        this.room.destroy();
        this.room = null;
      }
      this.client.disconnect();
      this._updateNetworkIndicator(IT.CONNECTION_STATES.DISCONNECTED, 0);
    }

    send(type, payload = {}) {
      return this.client.send(type, payload);
    }

    getPlayer(id) {
      return this.room ? this.room.getPlayer(id) : null;
    }

    _dispatchIncomingMessage(msg) {
      const { type, payload } = msg;
      const NM = IT.NET_MSG;

      switch (type) {
        case NM.MATCHMAKING_STATUS:
          this.matchmaking.handleStatusUpdate(payload);
          break;

        case NM.MATCHMAKING_FOUND:
          this.matchmaking.handleMatchFound(payload);
          break;

        case NM.MATCH_START:
          this._handleMatchStart(payload);
          break;

        case NM.MATCH_TICK:
          if (this.room) {
            this.room.applyServerTick(payload);
          }
          break;

        case NM.WEAPON_FIRE:
          this.combat.handleRemoteWeaponFire(payload);
          break;

        case NM.ABILITY_EFFECT:
          this.combat.handleRemoteAbility(payload);
          break;

        case NM.DAMAGE_APPLIED:
          this.combat.handleDamageApplied(payload);
          break;

        case NM.PLAYER_KILLED:
          this.combat.handlePlayerKilled(payload);
          break;

        case NM.MATCH_END:
          this._handleMatchEnd(payload);
          break;
      }
    }

    _handleMatchStart(data) {
      this.isOnline = true;
      const identity = IT.AuthManager ? IT.AuthManager.getIdentity() : null;
      this.localPlayerId = (identity && identity.id) || 'player_local';

      this.room = new IT.NetworkRoom({
        roomId: data.roomId,
        mode: data.mode,
        arena: data.arena,
        matchDuration: data.matchDuration,
        targetScore: data.targetScore
      });

      this.room.initializeRoster(data.players, this.localPlayerId);

      // Trigger transition in UIManager / Main3D
      if (IT._main3D && typeof IT._main3D.startOnlineBattle === 'function') {
        IT._main3D.startOnlineBattle(this.room);
      }
    }

    _handleMatchEnd(data) {
      if (!this.room) return;
      const outcome = this.room.settleMatchOutcome(data, this.localPlayerId);

      // Display post-battle match reward modal
      if (IT._main3D && typeof IT._main3D.handleOnlineMatchOver === 'function') {
        IT._main3D.handleOnlineMatchOver(outcome);
      }
    }

    /**
     * Master render loop update hook called from Main3D.js
     */
    update(dt) {
      if (!this.isOnline || !this.room) return;

      const now = Date.now();

      // 1. Send local player transform snapshot at 20 Hz
      if (this.localMech && (now - this.lastTickTime >= this.tickInterval)) {
        this.lastTickTime = now;
        const snapshot = IT.NetworkTransform.fromMech(this.localMech);
        this.send(IT.NET_MSG.PLAYER_SNAPSHOT, {
          id: this.localPlayerId,
          t: snapshot.pack()
        });
      }

      // 2. Interpolate all remote players smoothly
      this.room.players.forEach(p => {
        if (!p.isLocal) {
          p.update(dt, this.activeCamera);
        }
      });
    }

    _updateNetworkIndicator(state, pingMs) {
      const el = document.getElementById('net-status-pill');
      if (!el) return;

      if (state === IT.CONNECTION_STATES.CONNECTED) {
        el.className = 'net-status-pill net-online';
        el.innerHTML = `<span class="net-dot"></span> ONLINE <span class="net-ping">${pingMs || 35}ms</span>`;
      } else if (state === IT.CONNECTION_STATES.CONNECTING || state === IT.CONNECTION_STATES.RECONNECTING) {
        el.className = 'net-status-pill net-connecting';
        el.innerHTML = `<span class="net-dot"></span> CONNECTING...`;
      } else {
        el.className = 'net-status-pill net-offline';
        el.innerHTML = `<span class="net-dot"></span> OFFLINE`;
      }
    }
  }

  IT.NetworkManager = new NetworkManager();
})(window.IT);
