/**
 * Iron Titans 3D — AuthManager.js
 * Authentication & Player Identity Architecture.
 * Supports Guest Player onboarding, persistent pilot callsigns,
 * session token management, and future OAuth/backend credentials integration.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class PlayerIdentity {
    constructor(data = {}) {
      this.id = data.id || 'usr_' + Math.random().toString(36).substr(2, 9);
      this.callsign = data.callsign || 'TitanPilot';
      this.isGuest = data.isGuest !== undefined ? Boolean(data.isGuest) : true;
      this.token = data.token || 'sess_' + Math.random().toString(36).substr(2, 12);
      this.createdAt = data.createdAt || Date.now();
    }

    toJSON() {
      return {
        id: this.id,
        callsign: this.callsign,
        isGuest: this.isGuest,
        token: this.token,
        createdAt: this.createdAt
      };
    }
  }

  class SessionManager {
    constructor() {
      this.STORAGE_KEY = 'iron_titans_auth_session';
      this.currentIdentity = null;
    }

    load() {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.currentIdentity = new PlayerIdentity(parsed);
          return this.currentIdentity;
        }
      } catch (e) {
        console.warn('[SessionManager] Failed to load auth session:', e);
      }
      return null;
    }

    save(identity) {
      this.currentIdentity = identity;
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(identity.toJSON()));
      } catch (e) {
        console.warn('[SessionManager] Failed to persist session:', e);
      }
    }

    clear() {
      this.currentIdentity = null;
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch (e) {}
    }
  }

  class AuthManager {
    constructor() {
      this.session = new SessionManager();
      this.identity = null;
      this.init();
    }

    init() {
      let saved = this.session.load();
      if (!saved) {
        // Generate initial guest identity matching SaveManager pilot name
        const callsign = (IT.SaveManager && IT.SaveManager.pilotName) || ('TitanPilot_' + Math.floor(100 + Math.random() * 900));
        saved = new PlayerIdentity({ callsign, isGuest: true });
        this.session.save(saved);
      }
      this.identity = saved;
    }

    /**
     * Log in as Guest.
     * @param {string} [customCallsign]
     * @returns {PlayerIdentity}
     */
    loginAsGuest(customCallsign) {
      const callsign = customCallsign || (this.identity ? this.identity.callsign : 'TitanPilot');
      this.identity = new PlayerIdentity({
        id: this.identity ? this.identity.id : undefined,
        callsign,
        isGuest: true
      });
      this.session.save(this.identity);

      if (IT.SaveManager) {
        IT.SaveManager.pilotName = callsign;
      }
      return this.identity;
    }

    /**
     * Future credentials authentication hook.
     */
    async loginWithToken(token) {
      // Future backend authentication hook
      return this.identity;
    }

    setCallsign(newCallsign) {
      if (!newCallsign || typeof newCallsign !== 'string') return;
      this.identity.callsign = newCallsign.trim().substring(0, 16);
      this.session.save(this.identity);
      if (IT.SaveManager) {
        IT.SaveManager.pilotName = this.identity.callsign;
      }
    }

    getIdentity() {
      return this.identity;
    }

    isAuthenticated() {
      return Boolean(this.identity && this.identity.token);
    }
  }

  IT.PlayerIdentity = PlayerIdentity;
  IT.SessionManager = SessionManager;
  IT.AuthManager = new AuthManager();
})(window.IT);
