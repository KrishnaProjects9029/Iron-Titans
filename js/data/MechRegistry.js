/**
 * Iron Titans 3D — MechRegistry.js
 * Central registry for all 5 original playable mechs.
 * Defines stats, level 1-10 upgrade scaling, unlock requirements,
 * visual archetypes, and original abilities.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const MECHS = {
    ironclad: {
      id: 'ironclad',
      name: 'IRONCLAD-X1',
      role: 'Tank',
      description: 'Heavy dreadnought built with thick reactive armor and fortified hydraulic leg stabilizers.',
      unlockLevel: 1,
      baseHp: 5000,
      baseShield: 2000,
      baseSpeed: 14.0,
      turnSpeed: 4.2,
      armorRating: 'High',
      damageReduction: 0.15,
      abilityId: 'energy_charge',
      abilityName: 'Energy Charge',
      abilityDesc: 'Surges forward with high kinetic thrusters and grants +50% armor resistance for 2.6s.',
      abilityCooldown: 8.0,
      // Level 1-10 stat growth per upgrade level
      hpPerLevel: 250,
      shieldPerLevel: 100,
      speedPerLevel: 0.2
    },
    vortex: {
      id: 'vortex',
      name: 'VORTEX-9',
      role: 'Scout',
      description: 'Ultra-lightweight aerodynamic recon mech with reverse-joint limbs engineered for extreme flank mobility.',
      unlockLevel: 5,
      baseHp: 3200,
      baseShield: 1400,
      baseSpeed: 22.5,
      turnSpeed: 5.8,
      armorRating: 'Low',
      damageReduction: 0.0,
      abilityId: 'phase_dash',
      abilityName: 'Phase Dash',
      abilityDesc: 'Performs a hyper-velocity quantum warp forward with 0.6s evasion invulnerability.',
      abilityCooldown: 6.0,
      hpPerLevel: 160,
      shieldPerLevel: 70,
      speedPerLevel: 0.4
    },
    bastion: {
      id: 'bastion',
      name: 'BASTION-R',
      role: 'Defender',
      description: 'Colossal mobile fortress anchored with heavy blast plating and deployable energy barrier generator.',
      unlockLevel: 10,
      baseHp: 6000,
      baseShield: 2500,
      baseSpeed: 11.0,
      turnSpeed: 3.2,
      armorRating: 'Very High',
      damageReduction: 0.25,
      abilityId: 'deploy_shield',
      abilityName: 'Deploy Shield',
      abilityDesc: 'Deploys a broad stationary energy barrier that absorbs enemy projectile fire for 6s.',
      abilityCooldown: 12.0,
      hpPerLevel: 300,
      shieldPerLevel: 150,
      speedPerLevel: 0.15
    },
    striker: {
      id: 'striker',
      name: 'STRIKER-X',
      role: 'Assault',
      description: 'High-impact aggressive combat chassis armed with high-frequency verniers and core overchargers.',
      unlockLevel: 15,
      baseHp: 4200,
      baseShield: 1800,
      baseSpeed: 17.0,
      turnSpeed: 4.8,
      armorRating: 'Medium',
      damageReduction: 0.08,
      abilityId: 'overdrive',
      abilityName: 'Overdrive',
      abilityDesc: 'Overclocks core reactors, boosting weapon fire rate by +60% and damage by +25% for 4s.',
      abilityCooldown: 9.0,
      hpPerLevel: 210,
      shieldPerLevel: 90,
      speedPerLevel: 0.25
    },
    nova: {
      id: 'nova',
      name: 'NOVA-7',
      role: 'Long Range',
      description: 'Advanced marksman platform equipped with dorsal sensor antennae and ground recoil stabilizers.',
      unlockLevel: 20,
      baseHp: 3000,
      baseShield: 1200,
      baseSpeed: 15.0,
      turnSpeed: 4.5,
      armorRating: 'Low',
      damageReduction: 0.0,
      abilityId: 'precision_lock',
      abilityName: 'Precision Lock',
      abilityDesc: 'Locks optical targeting onto enemy critical weakpoints, granting +50% critical damage for 5s.',
      abilityCooldown: 10.0,
      hpPerLevel: 150,
      shieldPerLevel: 60,
      speedPerLevel: 0.2
    }
  };

  class MechRegistry {
    static getAll() {
      return Object.values(MECHS);
    }

    static get(id) {
      if (!id) return MECHS.ironclad;
      return MECHS[id.toLowerCase()] || MECHS.ironclad;
    }

    /**
     * Calculates upgraded stats for a mech at a given level (1 to 10).
     */
    static getStatsForLevel(mechId, level = 1) {
      const def = MechRegistry.get(mechId);
      const lvl = Math.max(1, Math.min(10, Math.floor(level)));
      const bonus = lvl - 1;

      return {
        id: def.id,
        name: def.name,
        role: def.role,
        level: lvl,
        maxHp: def.baseHp + def.hpPerLevel * bonus,
        maxShield: def.baseShield + def.shieldPerLevel * bonus,
        speed: +(def.baseSpeed + def.speedPerLevel * bonus).toFixed(1),
        turnSpeed: def.turnSpeed,
        armorRating: def.armorRating,
        damageReduction: def.damageReduction,
        abilityId: def.abilityId,
        abilityName: def.abilityName,
        abilityDesc: def.abilityDesc,
        abilityCooldown: Math.max(4.0, +(def.abilityCooldown - (bonus * 0.2)).toFixed(1)),
        unlockLevel: def.unlockLevel
      };
    }

    /**
     * Credit cost to upgrade a mech from current level to level + 1.
     */
    static getUpgradeCost(currentLevel) {
      if (currentLevel >= 10) return null; // Max level
      return currentLevel * 250;
    }
  }

  IT.MECHS = MECHS;
  IT.MechRegistry = MechRegistry;
})(window.IT);
