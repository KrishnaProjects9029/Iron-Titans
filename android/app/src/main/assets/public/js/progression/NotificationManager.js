/**
 * Iron Titans 3D — NotificationManager.js
 * In-game & Menu Toast Notification System.
 * Displays high-impact, non-blocking visual banner alerts for mission completions,
 * player level ups, achievement unlocks, and daily login rewards.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class NotificationManager {
    constructor() {
      this.containerId = 'notification-toast-container';
      this._container = null;
      this._queue = [];
      this._activeToasts = 0;
      this.MAX_CONCURRENT = 3;
    }

    _getContainer() {
      if (typeof document === 'undefined') return null;
      if (!this._container) {
        this._container = document.getElementById(this.containerId);
        if (!this._container && document.body) {
          this._container = document.createElement('div');
          this._container.id = this.containerId;
          this._container.className = 'notification-toast-container';
          document.body.appendChild(this._container);
        }
      }
      return this._container;
    }

    /**
     * Show a generic notification toast.
     * @param {Object} options
     * @param {string} options.title - Header text
     * @param {string} options.message - Body text / rewards summary
     * @param {string} [options.icon='⭐'] - Display icon/emoji
     * @param {string} [options.type='info'] - 'mission', 'level', 'achievement', 'daily', 'info'
     * @param {number} [options.duration=3500] - Display duration in ms
     */
    show({ title, message, icon = '⭐', type = 'info', duration = 3500 }) {
      this._queue.push({ title, message, icon, type, duration });
      this._processQueue();
    }

    /**
     * Specialized helper for mission completed toast.
     */
    showMissionComplete(mission) {
      if (!mission) return;
      const rewardsText = [];
      if (mission.rewards.credits) rewardsText.push(`+${mission.rewards.credits} 💎`);
      if (mission.rewards.xp) rewardsText.push(`+${mission.rewards.xp} XP`);
      if (mission.rewards.materials) rewardsText.push(`+${mission.rewards.materials} 🔧`);

      this.show({
        title: 'MISSION COMPLETE!',
        message: `${mission.title} — ${rewardsText.join(' ')}`,
        icon: '🎯',
        type: 'mission',
        duration: 4000
      });

      if (IT.AudioManager && typeof IT.AudioManager.playUI === 'function') {
        IT.AudioManager.playUI('UPGRADE_SUCCESS');
      }
    }

    /**
     * Specialized helper for player level up toast.
     */
    showLevelUp(newLevel, title, rewardSummary = '') {
      this.show({
        title: `PILOT PROMOTED! LEVEL ${newLevel}`,
        message: `${title ? `"${title}" · ` : ''}${rewardSummary || 'Rewards added to hangar'}`,
        icon: '🎖️',
        type: 'level',
        duration: 5000
      });

      if (IT.AudioManager && typeof IT.AudioManager.playUI === 'function') {
        IT.AudioManager.playUI('VICTORY');
      }
    }

    /**
     * Specialized helper for achievement unlocked toast.
     */
    showAchievementUnlocked(achievement) {
      if (!achievement) return;
      this.show({
        title: 'ACHIEVEMENT UNLOCKED!',
        message: `${achievement.title} (+${achievement.tokens || 1} 🪙 Tokens)`,
        icon: '🏆',
        type: 'achievement',
        duration: 4500
      });

      if (IT.AudioManager && typeof IT.AudioManager.playUI === 'function') {
        IT.AudioManager.playUI('UPGRADE_SUCCESS');
      }
    }

    /**
     * Specialized helper for daily login reward available.
     */
    showDailyRewardReady(day, streak) {
      this.show({
        title: `DAILY REWARD READY (DAY ${day})`,
        message: `Current Login Streak: 🔥 ${streak} ${streak === 1 ? 'Day' : 'Days'}!`,
        icon: '🎁',
        type: 'daily',
        duration: 4500
      });
    }

    _processQueue() {
      if (this._activeToasts >= this.MAX_CONCURRENT || this._queue.length === 0) return;

      const container = this._getContainer();
      if (!container) return;

      const item = this._queue.shift();
      this._activeToasts++;

      const toast = document.createElement('div');
      toast.className = `notification-toast toast-${item.type}`;
      toast.innerHTML = `
        <div class="toast-icon-wrap">${item.icon}</div>
        <div class="toast-content">
          <div class="toast-title">${item.title}</div>
          <div class="toast-message">${item.message}</div>
        </div>
      `;

      container.appendChild(toast);

      // Trigger enter animation
      const raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
      raf(() => {
        if (toast.classList) toast.classList.add('toast-visible');
      });

      // Dismissal timer
      setTimeout(() => {
        if (toast.classList) {
          toast.classList.remove('toast-visible');
          toast.classList.add('toast-hiding');
        }
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
          this._activeToasts--;
          this._processQueue();
        }, 300);
      }, item.duration);
    }
  }

  IT.NotificationManager = new NotificationManager();
})(window.IT);
