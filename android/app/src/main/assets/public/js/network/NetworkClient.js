/**
 * Iron Titans 3D — NetworkClient.js
 * Client Connection Manager, Auto-Reconnect & RTT Latency Telemetry.
 * Manages heartbeat ping-pong intervals, calculates smooth ping (ms),
 * and handles resilient reconnection backoff without disrupting gameplay.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class NetworkClient {
    constructor() {
      this.adapter = null;
      this.state = IT.CONNECTION_STATES.DISCONNECTED;
      this.ping = 0;
      this.lastHeartbeatTime = 0;
      this.heartbeatTimer = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 3;
      this.reconnectTimer = null;

      // Event Callbacks
      this.onStateChange = null;
      this.onPingUpdate = null;
      this.onMessage = null;
    }

    /**
     * Connect using a specified adapter.
     */
    connect(adapter, url) {
      if (this.adapter) {
        this.disconnect();
      }

      this.adapter = adapter;
      this._setState(IT.CONNECTION_STATES.CONNECTING);

      this.adapter.onOpen = () => {
        this._setState(IT.CONNECTION_STATES.CONNECTED);
        this.reconnectAttempts = 0;
        this._startHeartbeat();

        // Send HELLO
        this.send(IT.NET_MSG.HELLO, {
          clientVersion: IT.NET_CONFIG.PROTOCOL_VERSION,
          timestamp: Date.now()
        });
      };

      this.adapter.onClose = () => {
        this._stopHeartbeat();
        if (this.state === IT.CONNECTION_STATES.CONNECTED) {
          this._attemptReconnect(url);
        } else {
          this._setState(IT.CONNECTION_STATES.DISCONNECTED);
        }
      };

      this.adapter.onError = (err) => {
        console.warn('[NetworkClient] Connection error:', err);
        this._stopHeartbeat();
        if (this.state === IT.CONNECTION_STATES.CONNECTING) {
          this._setState(IT.CONNECTION_STATES.FAILED);
        }
      };

      this.adapter.onMessage = (msg) => {
        this._handleMessage(msg);
      };

      this.adapter.connect(url);
    }

    disconnect() {
      this._stopHeartbeat();
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      if (this.adapter) {
        this.adapter.disconnect();
        this.adapter = null;
      }
      this._setState(IT.CONNECTION_STATES.DISCONNECTED);
    }

    send(type, payload = {}) {
      if (!this.adapter || this.state !== IT.CONNECTION_STATES.CONNECTED) return false;
      return this.adapter.send(type, payload);
    }

    _setState(newState) {
      if (this.state === newState) return;
      this.state = newState;
      if (this.onStateChange) {
        this.onStateChange(this.state);
      }
    }

    _startHeartbeat() {
      this._stopHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (this.state === IT.CONNECTION_STATES.CONNECTED) {
          this.lastHeartbeatTime = Date.now();
          this.send(IT.NET_MSG.PING, { timestamp: this.lastHeartbeatTime });
        }
      }, IT.NET_CONFIG.HEARTBEAT_INTERVAL_MS);
    }

    _stopHeartbeat() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    }

    _attemptReconnect(url) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this._setState(IT.CONNECTION_STATES.FAILED);
        return;
      }

      this.reconnectAttempts++;
      this._setState(IT.CONNECTION_STATES.RECONNECTING);
      const delay = Math.min(4000, 1000 * Math.pow(2, this.reconnectAttempts - 1));

      this.reconnectTimer = setTimeout(() => {
        if (this.adapter) {
          this.adapter.connect(url);
        }
      }, delay);
    }

    _handleMessage(msg) {
      if (!msg || !msg.type) return;

      // Intercept PONG for RTT calculation
      if (msg.type === IT.NET_MSG.PONG) {
        const clientTimestamp = (msg.payload && msg.payload.clientTime) || this.lastHeartbeatTime;
        if (clientTimestamp > 0) {
          const rtt = Math.max(1, Date.now() - clientTimestamp);
          // Exponential moving average filter
          this.ping = this.ping === 0 ? rtt : Math.round(0.7 * this.ping + 0.3 * rtt);
          if (this.onPingUpdate) {
            this.onPingUpdate(this.ping);
          }
        }
        return;
      }

      if (this.onMessage) {
        this.onMessage(msg);
      }
    }
  }

  IT.NetworkClient = NetworkClient;
})(window.IT);
