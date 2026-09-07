/**
 * Iron Titans 3D — RewardManager.js
 * Central offline rewards & economy controller.
 * Handles:
 * - Anti-exploit mission reward claim validation
 * - 7-Day login reward calendar with progressive prizes
 * - Daily login activity streak tracking with grace periods
 * - Currency and material grants (Credits, XP, Upgrade Materials, Achievement Tokens, Cosmetics)
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const DAILY_LOGIN_SCHEDULE = [
    {
      day: 1,
      title: 'DAY 1: COMBAT STIPEND',
      credits: 500,
      xp: 150,
      materials: 10,
      tokens: 0,
      cosmetic: null,
      icon: '💎'
    },
    {
      day: 2,
      title: 'DAY 2: TACTICAL RECON',
      credits: 750,
      xp: 300,
      materials: 15,
      tokens: 1,
      cosmetic: null,
      icon: '⚡'
    },
    {
      day: 3,
      title: 'DAY 3: WEAPONS ALLOTMENT',
      credits: 1000,
      xp: 400,
      materials: 25,
      tokens: 2,
      cosmetic: null,
      icon: '🔧'
    },
    {
      day: 4,
      title: 'DAY 4: BATTLE SUPPLY',
      credits: 1250,
      xp: 500,
      materials: 35,
      tokens: 2,
      cosmetic: null,
      icon: '📦'
    },
    {
      day: 5,
      title: 'DAY 5: PILOT ENDORSEMENT',
      credits: 1500,
      xp: 600,
      materials: 45,
      tokens: 3,
      cosmetic: null,
      icon: '🎖️'
    },
    {
      day: 6,
      title: 'DAY 6: HEAVY ARMORY',
      credits: 2000,
      xp: 800,
      materials: 60,
      tokens: 5,
      cosmetic: null,
      icon: '🛡️'
    },
    {
      day: 7,
      title: 'DAY 7: TITAN COMMAND CACHE',
      credits: 3000,
      xp: 1200,
      materials: 100,
      tokens: 10,
      cosmetic: 'skin_neon_vanguard',
      icon: '👑'
    }
  ];

  class RewardManager {
    constructor() {
      this.DAILY_SCHEDULE = DAILY_LOGIN_SCHEDULE;
    }

    /**
     * Grant bundle of rewards securely to player storage.
     * @param {Object} rewards
     * @param {number} [rewards.credits=0]
     * @param {number} [rewards.xp=0]
     * @param {number} [rewards.materials=0]
     * @param {number} [rewards.tokens=0]
     * @param {string|null} [rewards.cosmetic=null]
     * @param {string|null} [rewards.title=null]
     * @returns {Object} Outcome with updated balances and level up details
     */
    grantReward(rewards = {}) {
      if (!IT.SaveManager) {
        console.error('[RewardManager] SaveManager unavailable.');
        return { success: false };
      }

      const sm = IT.SaveManager;
      const results = {
        creditsGranted: rewards.credits || 0,
        xpGranted: rewards.xp || 0,
        materialsGranted: rewards.materials || 0,
        tokensGranted: rewards.tokens || 0,
        cosmeticUnlocked: rewards.cosmetic || null,
        levelUpResult: null
      };

      if (rewards.credits > 0) {
        sm.addCredits(rewards.credits);
      }

      if (rewards.xp > 0) {
        results.levelUpResult = sm.addXP(rewards.xp);
      }

      if (rewards.materials > 0) {
        sm.addMaterials(rewards.materials);
      }

      if (rewards.tokens > 0) {
        sm.addTokens(rewards.tokens);
      }

      if (rewards.cosmetic) {
        sm.unlockCosmetic(rewards.cosmetic);
      }

      sm.save();

      if (IT.EventManager) {
        IT.EventManager.emit(IT.GAME_EVENTS.REWARD_GRANTED, { rewards, results });
      }

      return { success: true, ...results };
    }

    /**
     * Anti-exploit mission reward claim.
     * Validates that mission is completed and not yet claimed.
     * @param {string} missionId
     * @returns {Object} { success, mission, rewardResult, reason }
     */
    claimMission(missionId) {
      if (!IT.MissionManager) {
        return { success: false, reason: 'MissionManager not initialized' };
      }

      const mission = IT.MissionManager.getMissionById(missionId);
      if (!mission) {
        return { success: false, reason: `Mission "${missionId}" not found.` };
      }

      if (!mission.isCompleted) {
        return { success: false, reason: 'Mission objectives are not yet completed.' };
      }

      if (mission.isClaimed) {
        return { success: false, reason: 'Mission reward has already been claimed.' };
      }

      // Mark claimed immediately before dispatching rewards
      mission.isClaimed = true;
      IT.MissionManager.saveMissions();

      // Distribute rewards
      const rewardResult = this.grantReward(mission.rewards);

      // Trigger notification & audio
      if (IT.NotificationManager) {
        IT.NotificationManager.show({
          title: 'REWARD CLAIMED!',
          message: `${mission.title}: Granted +${mission.rewards.credits || 0} Cr, +${mission.rewards.xp || 0} XP`,
          icon: '🎁',
          type: 'mission'
        });
      }

      if (IT.AudioManager && typeof IT.AudioManager.playUI === 'function') {
        IT.AudioManager.playUI('UPGRADE_SUCCESS');
      }

      if (IT.EventManager) {
        IT.EventManager.emit(IT.GAME_EVENTS.MISSION_CLAIMED, { mission, rewardResult });
      }

      return { success: true, mission, rewardResult };
    }

    /**
     * Check daily login status and streak.
     * @returns {Object} { canClaim, currentDay, streak, schedule, claimedToday }
     */
    checkDailyLogin() {
      if (!IT.SaveManager) return null;
      const data = IT.SaveManager.getDailyLoginData();
      const now = Date.now();
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      let canClaim = false;
      let streak = data.streak || 1;
      let currentDay = data.currentDay || 1;

      if (!data.lastLoginTime) {
        // Brand new player, can claim day 1 immediately
        canClaim = true;
        currentDay = 1;
        streak = 1;
      } else {
        const timeDiff = now - data.lastLoginTime;
        const currentCalDay = new Date(now).toDateString();
        const lastCalDay = new Date(data.lastLoginTime).toDateString();

        if (currentCalDay === lastCalDay && data.claimedToday) {
          // Already claimed today
          canClaim = false;
        } else if (timeDiff < 2 * MS_PER_DAY) {
          // Logged in next calendar day within 48-hour grace period: keep streak
          canClaim = true;
          if (currentCalDay !== lastCalDay) {
            data.claimedToday = false;
          }
        } else {
          // Missed more than 48 hours: streak resets to 1, but day resets or loops
          canClaim = true;
          streak = 1;
          data.claimedToday = false;
        }
      }

      return {
        canClaim,
        currentDay,
        streak,
        schedule: this.DAILY_SCHEDULE,
        claimedToday: data.claimedToday
      };
    }

    /**
     * Claim today's daily login reward.
     * @returns {Object} { success, reward, newDay, streak, reason }
     */
    claimDailyReward() {
      const status = this.checkDailyLogin();
      if (!status || !status.canClaim) {
        return { success: false, reason: 'Daily reward already claimed today or not available.' };
      }

      const dayIdx = (status.currentDay - 1) % 7;
      const rewardConfig = this.DAILY_SCHEDULE[dayIdx];

      // Distribute rewards
      const grantResult = this.grantReward(rewardConfig);

      // Update save data
      const nextDay = (status.currentDay % 7) + 1;
      const newStreak = status.streak + 1;
      const highestStreak = Math.max(newStreak, IT.SaveManager.getDailyLoginData().highestStreak || 1);

      IT.SaveManager.updateDailyLoginData({
        currentDay: nextDay,
        streak: newStreak,
        highestStreak: highestStreak,
        lastLoginTime: Date.now(),
        claimedToday: true
      });

      if (IT.NotificationManager) {
        IT.NotificationManager.show({
          title: `DAILY REWARD CLAIMED (DAY ${status.currentDay})`,
          message: `Streak: 🔥 ${newStreak} Days! Rewards delivered to hangar.`,
          icon: '🔥',
          type: 'daily',
          duration: 4500
        });
      }

      if (IT.AudioManager && typeof IT.AudioManager.playUI === 'function') {
        IT.AudioManager.playUI('UPGRADE_SUCCESS');
      }

      if (IT.EventManager) {
        IT.EventManager.emit(IT.GAME_EVENTS.DAILY_LOGIN_CLAIMED, {
          day: status.currentDay,
          streak: newStreak,
          reward: rewardConfig
        });
      }

      return {
        success: true,
        reward: rewardConfig,
        newDay: nextDay,
        streak: newStreak,
        grantResult
      };
    }
  }

  IT.RewardManager = new RewardManager();
})(window.IT);
