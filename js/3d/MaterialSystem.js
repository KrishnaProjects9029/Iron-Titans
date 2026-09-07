/**
 * Iron Titans 3D — MaterialSystem.js
 * Centralized PBR Material Factory providing physically-inspired materials:
 * - ARMOR: Matte carbon/gunmetal composite with subtle metallic response
 * - DARK_METAL: Heavy structural frame, articulated joints, limb pivots
 * - LIGHT_METAL / CHROME: Machined hydraulic cylinders, actuators, pistons
 * - ENERGY: Dynamic emissive materials with team trim (Cyan/Blue vs Crimson/Red)
 * - GLASS: High-specular canopy, sensor optics, HUD glass
 * - RUBBER: Conduit lines, flexible cable bundles, hydraulic hose jackets
 * - HYDRAULIC: Mirror chrome piston shafts
 * - WEAPON_METAL: Heat-treated blued gunmetal alloy
 *
 * Fully supports Team Color Identification and Colorblind Accessibility.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const COLORBLIND_PALETTES = {
    DEFAULT: {
      blue: 0x00d8ff,      // Cyan
      red: 0xff3b30,       // Crimson
      blueAccent: 0x0088ff,
      redAccent: 0xff5500,
      objectiveNeutral: 0x8899aa
    },
    PROTANOPIA: {
      blue: 0x00a8ff,      // Deep Blue
      red: 0xffd600,       // Bright Yellow
      blueAccent: 0x0066cc,
      redAccent: 0xffaa00,
      objectiveNeutral: 0x8899aa
    },
    DEUTERANOPIA: {
      blue: 0x2288ff,      // Electric Blue
      red: 0xffb300,       // Golden Amber
      blueAccent: 0x0055dd,
      redAccent: 0xdd8800,
      objectiveNeutral: 0x8899aa
    },
    TRITANOPIA: {
      blue: 0x00e5ff,      // Cyan-Aqua
      red: 0xff2d55,       // Hot Magenta
      blueAccent: 0x00a0b0,
      redAccent: 0xcc1144,
      objectiveNeutral: 0x8899aa
    }
  };

  class MaterialSystem {
    constructor() {
      this.colorblindMode = 'DEFAULT';
      this.cache = new Map();
    }

    setColorblindMode(mode) {
      if (COLORBLIND_PALETTES[mode]) {
        this.colorblindMode = mode;
        this.cache.clear();
      }
    }

    getTeamColors(team = 'blue') {
      const pal = COLORBLIND_PALETTES[this.colorblindMode] || COLORBLIND_PALETTES.DEFAULT;
      const isRed = team === 'red';
      return {
        primary: isRed ? pal.red : pal.blue,
        accent: isRed ? pal.redAccent : pal.blueAccent,
        neutral: pal.objectiveNeutral
      };
    }

    /**
     * Creates or retrieves a standard material set for a mech chassis.
     * Keeps team identity subtle (energy strips, reactor glow, visor optics)
     * while giving the chassis authentic military engineering finishes.
     */
    createMechMaterialSet(team = 'blue', options = {}) {
      const colors = this.getTeamColors(team);
      const isRed = team === 'red';

      // Authentic base chassis paints:
      // Blue team: Titanium-slate gunmetal with cold dark undertones
      // Red team: Obsidian-charcoal carbon composite with warm deep undertones
      const armorColor = isRed ? 0x222024 : 0x1f232b;
      const plateColor = isRed ? 0x2c2930 : 0x28303d;
      const darkMetalColor = 0x14161a;
      const lightMetalColor = 0x8892a0;

      // 1. ARMOR (Composite Hull Plates)
      const armor = new THREE.MeshStandardMaterial({
        color: armorColor,
        roughness: 0.38,
        metalness: 0.72,
        name: `mat_armor_${team}`
      });

      // 2. ARMOR ACCENT (Upper Pauldrons & Mantlet Plates)
      const armorAccent = new THREE.MeshStandardMaterial({
        color: plateColor,
        roughness: 0.32,
        metalness: 0.78,
        name: `mat_armor_accent_${team}`
      });

      // 3. DARK METAL (Structural Endoskeleton, Joints, Spine)
      const darkMetal = new THREE.MeshStandardMaterial({
        color: darkMetalColor,
        roughness: 0.65,
        metalness: 0.88,
        name: 'mat_dark_metal'
      });

      // 4. LIGHT METAL / CHROME (Pistons, Shock Absorbers, Actuator Rods)
      const lightMetal = new THREE.MeshStandardMaterial({
        color: lightMetalColor,
        roughness: 0.18,
        metalness: 0.95,
        name: 'mat_light_metal'
      });

      // 5. HYDRAULIC CHROME (Mirror piston shafts)
      const hydraulic = new THREE.MeshStandardMaterial({
        color: 0xdde4ec,
        roughness: 0.12,
        metalness: 0.98,
        name: 'mat_hydraulic'
      });

      // 6. RUBBER (Hydraulic conduits, flexible cable bundles)
      const rubber = new THREE.MeshStandardMaterial({
        color: 0x111214,
        roughness: 0.85,
        metalness: 0.10,
        name: 'mat_rubber'
      });

      // 7. GLASS / SENSOR VISOR (Reflective optical sensor array)
      const visor = new THREE.MeshStandardMaterial({
        color: 0x05080c,
        emissive: colors.primary,
        emissiveIntensity: 2.2,
        roughness: 0.08,
        metalness: 0.92,
        transparent: true,
        opacity: 0.92,
        name: `mat_visor_${team}`
      });

      // 8. ENERGY / REACTOR (Pulsating engine core & conduit glow)
      const energy = new THREE.MeshStandardMaterial({
        color: 0x081018,
        emissive: colors.primary,
        emissiveIntensity: 2.0,
        roughness: 0.25,
        metalness: 0.5,
        name: `mat_energy_${team}`
      });

      // 9. EXHAUST / HEAT SINKS (Thruster bells and venting grills)
      const exhaust = new THREE.MeshStandardMaterial({
        color: 0x161616,
        emissive: colors.accent,
        emissiveIntensity: 1.4,
        roughness: 0.45,
        metalness: 0.7,
        name: `mat_exhaust_${team}`
      });

      // 10. WEAPON METAL (Hardpoint mounting fixtures)
      const weaponMetal = new THREE.MeshStandardMaterial({
        color: 0x1a1d24,
        roughness: 0.40,
        metalness: 0.85,
        name: 'mat_weapon_metal'
      });

      // 11. WEAK POINT (Rear reactor / Sensor Mast glow - subtle amber indicator)
      const weakPointCore = new THREE.MeshStandardMaterial({
        color: 0x1a1005,
        emissive: 0xff9900,
        emissiveIntensity: 2.5,
        roughness: 0.2,
        metalness: 0.7,
        name: 'mat_weakpoint_core'
      });

      return {
        armor,
        armorAccent,
        darkMetal,
        lightMetal,
        hydraulic,
        rubber,
        visor,
        energy,
        exhaust,
        weaponMetal,
        weakPointCore,
        teamColors: colors
      };
    }

    /**
     * Creates weapon materials with authentic blued finish, heat sinks, and energy conduits.
     */
    createWeaponMaterialSet(team = 'blue') {
      const colors = this.getTeamColors(team);

      const barrel = new THREE.MeshStandardMaterial({
        color: 0x181c22,
        roughness: 0.35,
        metalness: 0.85,
        name: 'mat_wep_barrel'
      });

      const receiver = new THREE.MeshStandardMaterial({
        color: 0x22262e,
        roughness: 0.45,
        metalness: 0.75,
        name: 'mat_wep_receiver'
      });

      const heatCoil = new THREE.MeshStandardMaterial({
        color: 0x20150a,
        emissive: 0xff6600,
        emissiveIntensity: 0.4, // Increases dynamically when firing
        roughness: 0.3,
        metalness: 0.9,
        name: 'mat_wep_heatcoil'
      });

      const energyConduit = new THREE.MeshStandardMaterial({
        color: 0x050d14,
        emissive: colors.primary,
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0.6,
        name: 'mat_wep_conduit'
      });

      const chrome = new THREE.MeshStandardMaterial({
        color: 0xc8d2de,
        roughness: 0.15,
        metalness: 0.95,
        name: 'mat_wep_chrome'
      });

      return { barrel, receiver, heatCoil, energyConduit, chrome, teamColors: colors };
    }
  }

  IT.MaterialSystem = new MaterialSystem();
})(window.IT);
