/**
 * Iron Titans 3D — WeaponRegistry.js
 * Central registry for all 6 original weapons.
 * Defines stats, level 1-10 upgrade curves, unlock levels, and combat behavior types:
 * - PULSE CANNON: Fast projectile, medium damage
 * - SCATTER BLASTER: Multi-pellet shotgun burst, high close-range damage
 * - PLASMA LAUNCHER: Slow orb with area explosion (AOE)
 * - ARC RIFLE: Continuous electric lightning beam
 * - MISSILE RACK: Quad micro-missiles with homing steering
 * - RAIL SPEAR: Hyper-velocity piercing precision kinetic spear
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const WEAPONS = {
    pulseCannon: {
      id: 'pulseCannon',
      name: 'PULSE CANNON',
      slotType: 'PRIMARY', // Primary weapon
      description: 'Rapid twin plasma accelerator discharging high-velocity coherent energy bolts.',
      unlockLevel: 1,
      baseDamage: 45,
      fireRate: 0.18, // Seconds per shot
      range: 'Medium',
      rangeUnits: 140,
      magazine: 28,
      reloadTime: 1.8,
      accuracy: 'High',
      projectileType: 'PULSE',
      projectileSpeed: 140,
      colorHex: 0x00f0ff,
      // Stat growth per level
      damagePerLevel: 3,
      magazinePerLevel: 2,
      reloadReductionPerLevel: 0.05
    },
    scatterBlaster: {
      id: 'scatterBlaster',
      name: 'SCATTER BLASTER',
      slotType: 'SECONDARY',
      description: 'Heavy wide-bore flak cannon unleashing devastating multi-pellet shrapnel cones.',
      unlockLevel: 1,
      baseDamage: 14, // Per pellet (7 pellets = 98 max point-blank damage)
      pelletCount: 7,
      spreadAngle: 0.14,
      fireRate: 0.75,
      range: 'Short',
      rangeUnits: 65,
      magazine: 12,
      reloadTime: 2.2,
      accuracy: 'Spread',
      projectileType: 'SCATTER',
      projectileSpeed: 120,
      colorHex: 0xffaa00,
      damagePerLevel: 1.5,
      magazinePerLevel: 1,
      reloadReductionPerLevel: 0.06
    },
    plasmaLauncher: {
      id: 'plasmaLauncher',
      name: 'PLASMA LAUNCHER',
      slotType: 'PRIMARY',
      description: 'Superheated plasma mortar discharging dense orbs that detonate in devastating area-of-effect blasts.',
      unlockLevel: 4,
      baseDamage: 110,
      explosionRadius: 8.5,
      fireRate: 1.25,
      range: 'Medium',
      rangeUnits: 110,
      magazine: 8,
      reloadTime: 2.4,
      accuracy: 'Medium',
      projectileType: 'PLASMA_ORB',
      projectileSpeed: 80,
      colorHex: 0x38ef7d,
      damagePerLevel: 8,
      magazinePerLevel: 1,
      reloadReductionPerLevel: 0.06
    },
    arcRifle: {
      id: 'arcRifle',
      name: 'ARC RIFLE',
      slotType: 'PRIMARY',
      description: 'High-frequency tesla projector emitting sustained dielectric lightning arcs that chain electrical damage.',
      unlockLevel: 8,
      baseDamage: 26, // Continuous tick damage (every 0.1s)
      fireRate: 0.10,
      range: 'Medium',
      rangeUnits: 85,
      magazine: 45,
      reloadTime: 2.0,
      accuracy: 'Continuous',
      projectileType: 'ARC_BEAM',
      projectileSpeed: 220,
      colorHex: 0x9d4edd,
      damagePerLevel: 2,
      magazinePerLevel: 4,
      reloadReductionPerLevel: 0.05
    },
    missileRack: {
      id: 'missileRack',
      name: 'MISSILE RACK',
      slotType: 'SECONDARY',
      description: 'Pod of smart guided micro-missiles that lock on and track enemy signatures with fiery impact.',
      unlockLevel: 12,
      baseDamage: 38, // Per missile (salvo of 4 = 152 damage)
      missilesPerBurst: 4,
      fireRate: 1.8,
      range: 'Long',
      rangeUnits: 160,
      magazine: 16,
      reloadTime: 2.6,
      accuracy: 'Homing',
      projectileType: 'MISSILE',
      projectileSpeed: 95,
      colorHex: 0xff3b30,
      damagePerLevel: 3,
      magazinePerLevel: 2,
      reloadReductionPerLevel: 0.08
    },
    railSpear: {
      id: 'railSpear',
      name: 'RAIL SPEAR',
      slotType: 'PRIMARY',
      description: 'Linear magnetic accelerator launching hyper-velocity depleted uranium sabots with extreme kinetic penetration.',
      unlockLevel: 16,
      baseDamage: 185,
      fireRate: 2.4,
      range: 'Extreme',
      rangeUnits: 200,
      magazine: 5,
      reloadTime: 2.8,
      accuracy: 'Precision Pinpoint',
      projectileType: 'RAIL_SPEAR',
      projectileSpeed: 260,
      colorHex: 0x00c8ff,
      damagePerLevel: 15,
      magazinePerLevel: 1,
      reloadReductionPerLevel: 0.08
    }
  };

  class WeaponRegistry {
    static getAll() {
      return Object.values(WEAPONS);
    }

    static get(id) {
      if (!id) return WEAPONS.pulseCannon;
      return WEAPONS[id] || WEAPONS.pulseCannon;
    }

    /**
     * Calculates upgraded stats for a weapon at a given level (1 to 10).
     */
    static getStatsForLevel(weaponId, level = 1) {
      const def = WeaponRegistry.get(weaponId);
      const lvl = Math.max(1, Math.min(10, Math.floor(level)));
      const bonus = lvl - 1;

      return {
        id: def.id,
        name: def.name,
        slotType: def.slotType,
        level: lvl,
        damage: Math.round(def.baseDamage + def.damagePerLevel * bonus),
        fireRate: Math.max(0.08, +(def.fireRate * Math.pow(0.97, bonus)).toFixed(2)),
        range: def.range,
        rangeUnits: def.rangeUnits + bonus * 3,
        magazine: def.magazine + def.magazinePerLevel * bonus,
        reloadTime: Math.max(1.0, +(def.reloadTime - def.reloadReductionPerLevel * bonus).toFixed(2)),
        accuracy: def.accuracy,
        projectileType: def.projectileType,
        projectileSpeed: def.projectileSpeed,
        colorHex: def.colorHex,
        unlockLevel: def.unlockLevel,
        pelletCount: def.pelletCount,
        explosionRadius: def.explosionRadius,
        missilesPerBurst: def.missilesPerBurst
      };
    }

    /**
     * Credit cost to upgrade a weapon from current level to level + 1.
     */
    static getUpgradeCost(currentLevel) {
      if (currentLevel >= 10) return null;
      return currentLevel * 200;
    }
  }

  IT.WEAPONS = WEAPONS;
  IT.WeaponRegistry = WeaponRegistry;
})(window.IT);
