/**
 * Iron Titans 3D — SaveManager.js
 * Persistent localStorage-backed progression, economy, and loadout architecture.
 * Manages:
 * - Player Level (1-50) & XP progression with unlock thresholds
 * - Credits economy (earned in combat, spent on upgrades)
 * - Equipped loadout (Selected Mech, Primary Weapon, Secondary Weapon)
 * - Mech & Weapon upgrade levels (Level 1-10)
 * - Career combat statistics (matches, wins, losses, kills, deaths, assists, damage)
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const SAVE_KEY = 'iron_titans_phase10_save';
  const BACKUP_KEY = 'iron_titans_backup_save';
  const LEGACY_KEYS = ['iron_titans_phase9_save', 'iron_titans_phase4_save', 'iron_titans_phase3_save', 'iron_titans_save'];

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeDefaults(dst, src) {
    for (const key of Object.keys(src)) {
      if (!(key in dst)) {
        dst[key] = deepClone(src[key]);
      } else if (
        typeof src[key] === 'object' &&
        src[key] !== null &&
        !Array.isArray(src[key]) &&
        typeof dst[key] === 'object' &&
        dst[key] !== null &&
        !Array.isArray(dst[key])
      ) {
        mergeDefaults(dst[key], src[key]);
      }
    }
  }

  const DEFAULT_SAVE = {
    // Release & First-Launch Tracking (Phase 10)
    isFirstLaunch: true,
    saveVersion: 10,
    // Economy & Player Progression
    credits: 1000,
    playerLevel: 1,
    playerXP: 0,

    // Active Loadout
    loadout: {
      mechId: 'ironclad',
      primaryId: 'pulseCannon',
      secondaryId: 'scatterBlaster'
    },

    // Unlocked Roster
    unlockedMechs: ['ironclad'],
    unlockedWeapons: ['pulseCannon', 'scatterBlaster'],

    // Upgrades (Level 1 to 10)
    mechLevels: {
      ironclad: 1,
      vortex: 1,
      bastion: 1,
      striker: 1,
      nova: 1
    },
    weaponLevels: {
      pulseCannon: 1,
      scatterBlaster: 1,
      plasmaLauncher: 1,
      arcRifle: 1,
      missileRack: 1,
      railSpear: 1
    },
    abilityLevels: {
      energy_charge: 1,
      phase_dash: 1,
      deploy_shield: 1,
      overdrive: 1,
      precision_lock: 1
    },

    // Preferences (Phase 5)
    preferredMode: 'SKIRMISH',
    preferredArena: 'NEON_FORGE',

    // Mode-specific statistics (Phase 5)
    modeStats: {
      SKIRMISH: { matches: 0, wins: 0, score: 0 },
      DOMINATION: { matches: 0, wins: 0, score: 0 },
      CONTROL_POINT: { matches: 0, wins: 0, score: 0 }
    },

    // Career Combat Stats (Expanded for Phase 5)
    career: {
      matchesPlayed: 0,
      victories: 0,
      defeats: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      damageTaken: 0,
      objectiveCaptures: 0,
      objectiveDefenses: 0,
      objectiveTime: 0,
      bestScore: 0,
      bestStreak: 0
    },

    // Phase 7, 8 & 9 Identity, Economy & Unlocks
    saveVersion: 9,
    pilotName: 'TitanPilot_' + Math.floor(100 + Math.random() * 900),
    upgradeMaterials: 50,
    achievementTokens: 5,
    unlockedCosmetics: ['chassis_default'],

    // Missions & Login (Phase 7)
    missions: {
      daily: [],
      weekly: [],
      career: [],
      achievements: [],
      lastDailyReset: 0,
      lastWeeklyReset: 0
    },
    dailyLogin: {
      currentDay: 1,
      streak: 1,
      highestStreak: 1,
      lastLoginTime: 0,
      claimedToday: false
    },

    // Network & Multiplayer Settings (Phase 8)
    networkSettings: {
      region: 'US-EAST',
      autoRegion: true,
      showPing: true,
      adapterMode: 'AUTO' // 'AUTO' | 'WS' | 'LOOPBACK'
    },

    // Settings (Phase 6 & 9 Audio, Graphics, Accessibility)
    settings: {
      masterVolume: 80,
      musicVolume: 60,
      sfxVolume: 85,
      uiVolume: 75,
      isMuted: false,
      graphicsPreset: 'HIGH', // 'LOW', 'MEDIUM', 'HIGH', 'AUTO'
      showFPS: false,
      screenShake: 'MEDIUM', // 'OFF', 'LOW', 'MEDIUM', 'HIGH'
      uiScale: 'MEDIUM',
      crosshairSize: 'MEDIUM',
      colorblind: 'DEFAULT', // 'DEFAULT', 'PROTANOPIA', 'DEUTERANOPIA', 'TRITANOPIA'
      vibration: true,
      showDamageNumbers: true,
      aimAssist: 'MEDIUM',
      controlsOverlay: 'AUTO'
    }
  };

  class SaveManager {
    constructor() {
      this._data = null;
      this.load();
    }

    load() {
      try {
        let raw = localStorage.getItem(SAVE_KEY);
        let isNewPlayer = false;

        // Migrate from legacy save versions if Phase 10 save does not exist yet
        if (!raw) {
          for (const legKey of LEGACY_KEYS) {
            const legData = localStorage.getItem(legKey);
            if (legData) {
              console.log(`[SaveManager] Migrating legacy save from key: ${legKey}`);
              raw = legData;
              break;
            }
          }
        }

        if (!raw) {
          isNewPlayer = true;
        }

        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            mergeDefaults(parsed, DEFAULT_SAVE);
            parsed.saveVersion = 10;
            // Existing players migrating from older versions bypass first launch onboarding
            if (!isNewPlayer && parsed.career && parsed.career.matchesPlayed > 0) {
              parsed.isFirstLaunch = false;
            }
            this._data = parsed;
            // Write migrated data forward
            this.save();
          } catch (parseErr) {
            console.error('[SaveManager] Corrupted primary save detected. Checking redundant backup...', parseErr);
            let recovered = false;
            try {
              const backupRaw = localStorage.getItem(BACKUP_KEY);
              if (backupRaw) {
                const backupParsed = JSON.parse(backupRaw);
                mergeDefaults(backupParsed, DEFAULT_SAVE);
                backupParsed.saveVersion = 10;
                this._data = backupParsed;
                this.save();
                recovered = true;
                console.log('[SaveManager] Successfully recovered pilot progression from dual-save backup!');
              }
            } catch (backupErr) {
              console.warn('[SaveManager] Backup save was also unrecoverable.', backupErr);
            }

            if (!recovered) {
              localStorage.setItem('iron_titans_corrupted_backup', raw);
              this._data = deepClone(DEFAULT_SAVE);
              this.save();
            }
          }
        } else {
          this._data = deepClone(DEFAULT_SAVE);
          this.save();
        }
      } catch (e) {
        console.warn('[SaveManager] localStorage unavailable or blocked. Using in-memory default state.', e);
        this._data = deepClone(DEFAULT_SAVE);
      }
      this._checkUnlocksForCurrentLevel();
      return this._data;
    }

    save() {
      try {
        const serialized = JSON.stringify(this._data);
        localStorage.setItem(SAVE_KEY, serialized);
        try {
          localStorage.setItem(BACKUP_KEY, serialized);
        } catch (backupErr) {
          // Backup write failure (e.g. quota limits)
        }
      } catch (e) {
        console.error('[SaveManager] Failed to persist save data.', e);
      }
    }

    get isFirstLaunch() { return (this._data && Boolean(this._data.isFirstLaunch)) || false; }
    setFirstLaunchComplete() {
      if (this._data) {
        this._data.isFirstLaunch = false;
        this.save();
      }
    }

    get credits() { return (this._data && this._data.credits) || 0; }
    get playerLevel() { return (this._data && this._data.playerLevel) || 1; }
    get playerXP() { return (this._data && this._data.playerXP) || 0; }
    get pilotName() { return (this._data && this._data.pilotName) || 'TITAN-PILOT'; }
    get saveData() { return this._data; }

    // ── XP & Player Level ──
    getXPRequiredForLevel(level) {
      // Linear-quadratic scale: Level 1 -> 800, Level 2 -> 1100, Level 3 -> 1400, etc.
      return Math.round(800 + (level - 1) * 300);
    }

    addXP(amount) {
      if (amount <= 0) return { leveledUp: false, oldLevel: this._data.playerLevel, newLevel: this._data.playerLevel, newUnlocks: [] };

      const oldLevel = this._data.playerLevel;
      this._data.playerXP += amount;

      const newUnlocks = [];
      let leveledUp = false;

      while (this._data.playerLevel < 50) {
        const needed = this.getXPRequiredForLevel(this._data.playerLevel);
        if (this._data.playerXP >= needed) {
          this._data.playerXP -= needed;
          this._data.playerLevel++;
          leveledUp = true;

          // Check new unlocks at this new level
          const unlocks = this._checkUnlocksForCurrentLevel();
          newUnlocks.push(...unlocks);
        } else {
          break;
        }
      }

      this.save();
      return {
        leveledUp,
        oldLevel,
        newLevel: this._data.playerLevel,
        currentXP: this._data.playerXP,
        neededXP: this.getXPRequiredForLevel(this._data.playerLevel),
        newUnlocks
      };
    }

    _checkUnlocksForCurrentLevel() {
      const unlocks = [];
      const lvl = this._data.playerLevel;

      // Check mechs
      if (IT.MechRegistry) {
        IT.MechRegistry.getAll().forEach(m => {
          if (lvl >= m.unlockLevel && !this._data.unlockedMechs.includes(m.id)) {
            this._data.unlockedMechs.push(m.id);
            unlocks.push({ type: 'MECH', item: m });
          }
        });
      }

      // Check weapons
      if (IT.WeaponRegistry) {
        IT.WeaponRegistry.getAll().forEach(w => {
          if (lvl >= w.unlockLevel && !this._data.unlockedWeapons.includes(w.id)) {
            this._data.unlockedWeapons.push(w.id);
            unlocks.push({ type: 'WEAPON', item: w });
          }
        });
      }

      return unlocks;
    }

    isMechUnlocked(mechId) {
      return this._data.unlockedMechs.includes(mechId);
    }

    isWeaponUnlocked(weaponId) {
      return this._data.unlockedWeapons.includes(weaponId);
    }

    // ── Credits Economy ──
    addCredits(amount) {
      if (amount <= 0) return this._data.credits;
      this._data.credits += Math.round(amount);
      this.save();
      return this._data.credits;
    }

    spendCredits(amount) {
      if (amount <= 0) return true;
      if (this._data.credits < amount) return false;
      this._data.credits -= amount;
      this.save();
      return true;
    }

    // ── Upgrades ──
    getMechLevel(mechId) {
      return (this._data.mechLevels && this._data.mechLevels[mechId]) || 1;
    }

    upgradeMech(mechId) {
      const curLevel = this.getMechLevel(mechId);
      if (curLevel >= 10) return { success: false, reason: 'Max level reached (Level 10)' };

      const cost = IT.MechRegistry ? IT.MechRegistry.getUpgradeCost(curLevel) : curLevel * 250;
      if (!this.spendCredits(cost)) {
        return { success: false, reason: `Not enough credits (Need ${cost}, have ${this._data.credits})` };
      }

      this._data.mechLevels[mechId] = curLevel + 1;
      this.save();
      return { success: true, newLevel: curLevel + 1 };
    }

    getWeaponLevel(weaponId) {
      return (this._data.weaponLevels && this._data.weaponLevels[weaponId]) || 1;
    }

    upgradeWeapon(weaponId) {
      const curLevel = this.getWeaponLevel(weaponId);
      if (curLevel >= 10) return { success: false, reason: 'Max level reached (Level 10)' };

      const cost = IT.WeaponRegistry ? IT.WeaponRegistry.getUpgradeCost(curLevel) : curLevel * 200;
      if (!this.spendCredits(cost)) {
        return { success: false, reason: `Not enough credits (Need ${cost}, have ${this._data.credits})` };
      }

      this._data.weaponLevels[weaponId] = curLevel + 1;
      this.save();
      return { success: true, newLevel: curLevel + 1 };
    }

    // ── Loadout ──
    getLoadout() {
      return { ...this._data.loadout };
    }

    setLoadout(loadout) {
      if (loadout.mechId) this._data.loadout.mechId = loadout.mechId;
      if (loadout.primaryId) this._data.loadout.primaryId = loadout.primaryId;
      if (loadout.secondaryId) this._data.loadout.secondaryId = loadout.secondaryId;
      this.save();
    }

    // ── Match Completion & Career Stats ──
    recordMatchOutcome(stats) {
      // stats = { won, kills, deaths, assists, damageDealt, damageTaken, xpEarned, creditsEarned, modeId, arenaId, captures, defenses, timeOnPoint, score, bestStreak }
      const c = this._data.career;
      c.matchesPlayed++;
      if (stats.won) c.victories++;
      else c.defeats++;

      c.kills += stats.kills || 0;
      c.deaths += stats.deaths || 0;
      c.assists += stats.assists || 0;
      c.damageDealt += Math.round(stats.damageDealt || 0);
      c.damageTaken += Math.round(stats.damageTaken || 0);

      // Objective stats
      c.objectiveCaptures += stats.captures || 0;
      c.objectiveDefenses += stats.defenses || 0;
      c.objectiveTime += stats.timeOnPoint || 0;

      if (stats.score && stats.score > c.bestScore) c.bestScore = stats.score;
      if (stats.bestStreak && stats.bestStreak > c.bestStreak) c.bestStreak = stats.bestStreak;

      // Mode-specific stats
      if (stats.modeId && this._data.modeStats && this._data.modeStats[stats.modeId]) {
        const ms = this._data.modeStats[stats.modeId];
        ms.matches++;
        if (stats.won) ms.wins++;
        ms.score += stats.score || 0;
      }

      if (stats.modeId) this._data.preferredMode = stats.modeId;
      if (stats.arenaId) this._data.preferredArena = stats.arenaId;

      if (stats.creditsEarned > 0) {
        this.addCredits(stats.creditsEarned);
      }

      let xpResult = null;
      if (stats.xpEarned > 0) {
        xpResult = this.addXP(stats.xpEarned);
      }

      this.save();
      return {
        career: { ...c },
        credits: this._data.credits,
        xpResult
      };
    }

    reset() {
      this._data = deepClone(DEFAULT_SAVE);
      this.save();
    }

    // ── Phase 7 & 8 Economy, Missions & Identity ──
    addMaterials(amount) {
      if (amount <= 0) return this._data.upgradeMaterials;
      this._data.upgradeMaterials = (this._data.upgradeMaterials || 0) + Math.round(amount);
      this.save();
      return this._data.upgradeMaterials;
    }

    spendMaterials(amount) {
      if (amount <= 0) return true;
      if ((this._data.upgradeMaterials || 0) < amount) return false;
      this._data.upgradeMaterials -= amount;
      this.save();
      return true;
    }

    get materials() { return this._data.upgradeMaterials || 0; }

    addTokens(amount) {
      if (amount <= 0) return this._data.achievementTokens;
      this._data.achievementTokens = (this._data.achievementTokens || 0) + Math.round(amount);
      this.save();
      return this._data.achievementTokens;
    }

    spendTokens(amount) {
      if (amount <= 0) return true;
      if ((this._data.achievementTokens || 0) < amount) return false;
      this._data.achievementTokens -= amount;
      this.save();
      return true;
    }

    get tokens() { return this._data.achievementTokens || 0; }

    unlockCosmetic(id) {
      if (!this._data.unlockedCosmetics) this._data.unlockedCosmetics = ['chassis_default'];
      if (!this._data.unlockedCosmetics.includes(id)) {
        this._data.unlockedCosmetics.push(id);
        this.save();
      }
    }

    isCosmeticUnlocked(id) {
      return (this._data.unlockedCosmetics || []).includes(id);
    }

    getMissionsData() {
      return this._data.missions || DEFAULT_SAVE.missions;
    }

    updateMissionsData(data) {
      if (data && typeof data === 'object') {
        this._data.missions = Object.assign(this._data.missions || {}, data);
        this.save();
      }
    }

    getDailyLoginData() {
      return this._data.dailyLogin || DEFAULT_SAVE.dailyLogin;
    }

    updateDailyLoginData(data) {
      if (data && typeof data === 'object') {
        this._data.dailyLogin = Object.assign(this._data.dailyLogin || {}, data);
        this.save();
      }
    }

    get pilotName() { return this._data.pilotName || 'TitanPilot'; }
    set pilotName(val) {
      if (val && typeof val === 'string') {
        this._data.pilotName = val.trim().substring(0, 16);
        this.save();
      }
    }

    get networkSettings() { return this._data.networkSettings || DEFAULT_SAVE.networkSettings; }
    updateNetworkSettings(newNet) {
      if (newNet && typeof newNet === 'object') {
        this._data.networkSettings = Object.assign(this._data.networkSettings || {}, newNet);
        this.save();
      }
    }

    get settings() { return this._data.settings || DEFAULT_SAVE.settings; }
    updateSettings(newSettings) {
      if (newSettings && typeof newSettings === 'object') {
        this._data.settings = Object.assign(this._data.settings || {}, newSettings);
        this.save();
      }
    }

    exportSave() {
      return JSON.stringify(this._data, null, 2);
    }

    importSave(jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        mergeDefaults(parsed, DEFAULT_SAVE);
        parsed.saveVersion = 9;
        this._data = parsed;
        this.save();
        this._checkUnlocksForCurrentLevel();
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }

  IT.SaveManager = new SaveManager();
})(window.IT);
