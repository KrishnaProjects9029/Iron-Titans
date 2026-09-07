/**
 * Iron Titans 3D — GameConfig.js
 * Production Release Configuration & Application Metadata.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const isDevFlag = typeof window !== 'undefined' && Boolean(
    window.IT_DEV ||
    (window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.search.includes('dev=1'))
  );

  IT.CONFIG = {
    APP_NAME: 'IRON TITANS',
    APP_ID: 'com.irontitans.mecharena',
    VERSION: '1.0.0',
    BUILD_DATE: '2026-09-07',
    PRODUCTION_MODE: !isDevFlag,
    OFFLINE_ONLY: false,
    DEFAULT_REGION: 'US-EAST',
    ALLOW_DEBUG_KEYBOARD: true, // Ctrl+Shift+F toggle for QA inspection

    isProduction() {
      return this.PRODUCTION_MODE;
    },

    isDev() {
      return !this.PRODUCTION_MODE;
    },

    getVersionString() {
      return `${this.APP_NAME} v${this.VERSION}`;
    }
  };

  // Lock configuration object against accidental mutation in production
  if (IT.CONFIG.PRODUCTION_MODE && Object.freeze) {
    Object.freeze(IT.CONFIG);
  }
})(window.IT);
