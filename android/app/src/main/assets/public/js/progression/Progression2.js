/**
 * Iron Titans 3D — Progression2.js
 * Player Level System 2.0 (Levels 1 to 50).
 * Defines the XP progression curve, curated milestone unlocks, cosmetic titles,
 * and economy reward distributions for every single pilot level.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class Progression2 {
    constructor() {
      this.MAX_LEVEL = 50;
      this.LEVEL_REWARDS = this._generateCuratedRewards();
    }

    /**
     * Calculate XP required to advance from `level` to `level + 1`.
     * Balanced quadratic-linear curve:
     * L1->L2: 800 XP, L5->L6: 2,400 XP, L10->L11: 4,800 XP, L25->L26: 14,000 XP, L50: Max
     * @param {number} level
     * @returns {number} XP required
     */
    getXPRequiredForLevel(level) {
      if (level >= this.MAX_LEVEL) return Infinity;
      const l = Math.max(1, level);
      return Math.round(800 + (l - 1) * 350 + Math.pow(l - 1, 1.45) * 45);
    }

    /**
     * Curated rewards distribution for levels 1 through 50.
     * Guaranteed rewarding feel at every level.
     */
    _generateCuratedRewards() {
      const rewards = {};

      const TITLES = {
        1: 'CADET PILOT',
        5: 'COMBAT INITIATE',
        10: 'TITAN ROOKIE',
        15: 'ARENA ENFORCER',
        20: 'VETERAN PILOT',
        25: 'WAR MACHINE',
        30: 'APEX PREDATOR',
        35: 'ZONE DOMINATOR',
        40: 'IRON LEGEND',
        45: 'SUPREME TACTICIAN',
        50: 'TITAN OVERLORD'
      };

      for (let lvl = 2; lvl <= this.MAX_LEVEL; lvl++) {
        const baseCredits = Math.round(500 + lvl * 150 + (lvl % 5 === 0 ? 1500 : 0));
        const baseMats = Math.round(15 + lvl * 5 + (lvl % 5 === 0 ? 30 : 0));
        const tokens = (lvl % 5 === 0) ? Math.floor(lvl / 5) * 2 : (lvl % 2 === 0 ? 1 : 0);

        const r = {
          level: lvl,
          credits: baseCredits,
          materials: baseMats,
          tokens: tokens,
          title: TITLES[lvl] || null,
          unlocks: [],
          description: `Promoted to Pilot Level ${lvl}!`
        };

        // Specific milestone unlocks matching mech & weapon registries
        if (lvl === 2) {
          r.unlocks.push({ type: 'WEAPON', id: 'scatterBlaster', name: 'Scatter Blaster' });
        } else if (lvl === 3) {
          r.unlocks.push({ type: 'MECH', id: 'vortex', name: 'Vortex (Recon Skirmisher)' });
        } else if (lvl === 4) {
          r.unlocks.push({ type: 'WEAPON', id: 'plasmaLauncher', name: 'Plasma Launcher' });
        } else if (lvl === 5) {
          r.unlocks.push({ type: 'MECH', id: 'bastion', name: 'Bastion (Shield Juggernaut)' });
        } else if (lvl === 6) {
          r.unlocks.push({ type: 'WEAPON', id: 'arcRifle', name: 'Arc Rifle' });
        } else if (lvl === 7) {
          r.unlocks.push({ type: 'MECH', id: 'striker', name: 'Striker (Assault Brawler)' });
        } else if (lvl === 8) {
          r.unlocks.push({ type: 'WEAPON', id: 'missileRack', name: 'Missile Rack' });
        } else if (lvl === 9) {
          r.unlocks.push({ type: 'WEAPON', id: 'railSpear', name: 'Rail Spear' });
        } else if (lvl === 10) {
          r.unlocks.push({ type: 'MECH', id: 'nova', name: 'Nova (Sniper Artillery)' });
          r.unlocks.push({ type: 'COSMETIC', id: 'skin_cyber_nova', name: 'Cyber Nova Skin' });
        } else if (lvl === 20) {
          r.unlocks.push({ type: 'COSMETIC', id: 'skin_obsidian_titan', name: 'Obsidian Titan Coating' });
        } else if (lvl === 30) {
          r.unlocks.push({ type: 'COSMETIC', id: 'skin_crimson_apex', name: 'Crimson Apex Armor' });
        } else if (lvl === 40) {
          r.unlocks.push({ type: 'COSMETIC', id: 'skin_solar_flare', name: 'Solar Flare Gold Chasis' });
        } else if (lvl === 50) {
          r.unlocks.push({ type: 'COSMETIC', id: 'skin_titan_overlord', name: 'Titan Overlord Platinum Core' });
        }

        rewards[lvl] = r;
      }

      return rewards;
    }

    /**
     * Get reward definition for reaching a specific level.
     * @param {number} level
     * @returns {Object|null}
     */
    getLevelReward(level) {
      return this.LEVEL_REWARDS[level] || null;
    }

    /**
     * Get active pilot title for current level.
     * @param {number} level
     * @returns {string}
     */
    getTitleForLevel(level) {
      const titles = [
        { lvl: 50, title: 'TITAN OVERLORD' },
        { lvl: 45, title: 'SUPREME TACTICIAN' },
        { lvl: 40, title: 'IRON LEGEND' },
        { lvl: 35, title: 'ZONE DOMINATOR' },
        { lvl: 30, title: 'APEX PREDATOR' },
        { lvl: 25, title: 'WAR MACHINE' },
        { lvl: 20, title: 'VETERAN PILOT' },
        { lvl: 15, title: 'ARENA ENFORCER' },
        { lvl: 10, title: 'TITAN ROOKIE' },
        { lvl: 5,  title: 'COMBAT INITIATE' },
        { lvl: 1,  title: 'CADET PILOT' }
      ];

      for (const t of titles) {
        if (level >= t.lvl) return t.title;
      }
      return 'CADET PILOT';
    }
  }

  IT.Progression2 = new Progression2();
})(window.IT);
