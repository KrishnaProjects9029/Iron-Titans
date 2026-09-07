/**
 * Iron Titans 3D — ArenaRegistry.js
 * Central Registry containing layout, spawn points, objective positions,
 * tactical AI waypoints, and recommended modes for all 3 original arenas:
 * - NEON FORGE (Industrial weapons facility, balanced mid-range)
 * - TITAN DOCKS (Futuristic shipping hub, long/mid-range)
 * - ASHEN REACTOR (Subterranean reactor core, close/mid-range)
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const ARENAS = {
    NEON_FORGE: {
      id: 'NEON_FORGE',
      name: 'NEON FORGE',
      subtitle: 'INDUSTRIAL WEAPONS FACILITY',
      description: 'A fortified weapons plant featuring elevated sky-bridges, hexagonal reactor pillars, and molten lava hazard channels.',
      combatRange: 'MEDIUM RANGE',
      recommendedModes: ['SKIRMISH', 'DOMINATION', 'CONTROL_POINT'],
      bounds: 72,
      themeColor: '#00e1ff',
      builderClass: 'Arena3D',

      blueSpawns: [
        { x: 0, z: -55, heading: 0 },
        { x: -22, z: -50, heading: 0.2 },
        { x: 22, z: -50, heading: -0.2 },
        { x: -35, z: -42, heading: 0.4 },
        { x: 35, z: -42, heading: -0.4 }
      ],
      redSpawns: [
        { x: 0, z: 55, heading: Math.PI },
        { x: -22, z: 50, heading: Math.PI - 0.2 },
        { x: 22, z: 50, heading: Math.PI + 0.2 },
        { x: -35, z: 42, heading: Math.PI - 0.4 },
        { x: 35, z: 42, heading: Math.PI + 0.4 }
      ],

      objectives: {
        domination: [
          { id: 'A', label: 'ZONE A (SOUTH)', position: new THREE.Vector3(-25, 0, -15), radius: 8.5 },
          { id: 'B', label: 'ZONE B (CENTER)', position: new THREE.Vector3(0, 1.2, 0), radius: 9.0 },
          { id: 'C', label: 'ZONE C (NORTH)', position: new THREE.Vector3(25, 0, 15), radius: 8.5 }
        ],
        controlPoint: [
          { name: 'CENTER PLATFORM', position: new THREE.Vector3(0, 1.2, 0) },
          { name: 'NORTH FORGE', position: new THREE.Vector3(0, 0, 32) },
          { name: 'EAST SKYBRIDGE', position: new THREE.Vector3(28, 0, 0) },
          { name: 'WEST CONDUIT', position: new THREE.Vector3(-28, 0, 0) }
        ]
      },

      aiWaypoints: [
        { x: 0, z: 0, name: 'Center Platform' },
        { x: 0, z: -20, name: 'South Ramp' },
        { x: 0, z: 20, name: 'North Ramp' },
        { x: -28, z: 0, name: 'West Corridor' },
        { x: 28, z: 0, name: 'East Skybridge' },
        { x: -24, z: -28, name: 'SW Crate Cluster' },
        { x: 24, z: -28, name: 'SE Crate Cluster' },
        { x: -24, z: 28, name: 'NW Crate Cluster' },
        { x: 24, z: 28, name: 'NE Crate Cluster' },
        { x: 0, z: -48, name: 'South Yard' },
        { x: 0, z: 48, name: 'North Yard' }
      ]
    },

    TITAN_DOCKS: {
      id: 'TITAN_DOCKS',
      name: 'TITAN DOCKS',
      subtitle: 'FUTURISTIC CARGO SHIPPING HUB',
      description: 'A massive container terminal with high gantry cranes, double-decker cargo stacks, wide shipping lanes, and elevated inspection catwalks.',
      combatRange: 'LONG / MEDIUM RANGE',
      recommendedModes: ['SKIRMISH', 'DOMINATION', 'CONTROL_POINT'],
      bounds: 80,
      themeColor: '#ff9900',
      builderClass: 'TitanDocksArena',

      blueSpawns: [
        { x: 0, z: -62, heading: 0 },
        { x: -28, z: -56, heading: 0.2 },
        { x: 28, z: -56, heading: -0.2 },
        { x: -42, z: -48, heading: 0.4 },
        { x: 42, z: -48, heading: -0.4 }
      ],
      redSpawns: [
        { x: 0, z: 62, heading: Math.PI },
        { x: -28, z: 56, heading: Math.PI - 0.2 },
        { x: 28, z: 56, heading: Math.PI + 0.2 },
        { x: -42, z: 48, heading: Math.PI - 0.4 },
        { x: 42, z: 48, heading: Math.PI + 0.4 }
      ],

      objectives: {
        domination: [
          { id: 'A', label: 'ZONE A (WEST BERTH)', position: new THREE.Vector3(-32, 0, 0), radius: 9.0 },
          { id: 'B', label: 'ZONE B (GANTRY CRANE)', position: new THREE.Vector3(0, 0.4, 0), radius: 9.5 },
          { id: 'C', label: 'ZONE C (EAST DRY DOCK)', position: new THREE.Vector3(32, 0, 0), radius: 9.0 }
        ],
        controlPoint: [
          { name: 'CENTRAL GANTRY', position: new THREE.Vector3(0, 0.4, 0) },
          { name: 'NORTH TERMINAL', position: new THREE.Vector3(0, 0, 36) },
          { name: 'EAST WAREHOUSE', position: new THREE.Vector3(32, 0, 0) },
          { name: 'WEST CONTAINER BAY', position: new THREE.Vector3(-32, 0, 0) }
        ]
      },

      aiWaypoints: [
        { x: 0, z: 0, name: 'Gantry Plaza' },
        { x: 0, z: -28, name: 'South Shipping Lane' },
        { x: 0, z: 28, name: 'North Shipping Lane' },
        { x: -32, z: 0, name: 'West Cargo Yard' },
        { x: 32, z: 0, name: 'East Container Stack' },
        { x: -30, z: -32, name: 'SW Crane Base' },
        { x: 30, z: -32, name: 'SE Crane Base' },
        { x: -30, z: 32, name: 'NW Crane Base' },
        { x: 30, z: 32, name: 'NE Crane Base' },
        { x: 0, z: -52, name: 'South Loading Bay' },
        { x: 0, z: 52, name: 'North Loading Bay' }
      ]
    },

    ASHEN_REACTOR: {
      id: 'ASHEN_REACTOR',
      name: 'ASHEN REACTOR',
      subtitle: 'SUBTERRANEAN ENERGY CORE',
      description: 'A subterranean industrial reactor complex surrounded by heavy containment bulkheads, magnetic conduits, glowing plasma valves, and tight tactical choke points.',
      combatRange: 'CLOSE / MEDIUM RANGE',
      recommendedModes: ['SKIRMISH', 'DOMINATION', 'CONTROL_POINT'],
      bounds: 68,
      themeColor: '#ff2255',
      builderClass: 'AshenReactorArena',

      blueSpawns: [
        { x: 0, z: -52, heading: 0 },
        { x: -20, z: -46, heading: 0.2 },
        { x: 20, z: -46, heading: -0.2 },
        { x: -32, z: -38, heading: 0.4 },
        { x: 32, z: -38, heading: -0.4 }
      ],
      redSpawns: [
        { x: 0, z: 52, heading: Math.PI },
        { x: -20, z: 46, heading: Math.PI - 0.2 },
        { x: 20, z: 46, heading: Math.PI + 0.2 },
        { x: -32, z: 38, heading: Math.PI - 0.4 },
        { x: 32, z: 38, heading: Math.PI + 0.4 }
      ],

      objectives: {
        domination: [
          { id: 'A', label: 'ZONE A (COOLING ARRAY)', position: new THREE.Vector3(-22, 0, -12), radius: 8.5 },
          { id: 'B', label: 'ZONE B (REACTOR CORE)', position: new THREE.Vector3(0, 1.2, 0), radius: 9.0 },
          { id: 'C', label: 'ZONE C (TURBINE HALL)', position: new THREE.Vector3(22, 0, 12), radius: 8.5 }
        ],
        controlPoint: [
          { name: 'REACTOR CORE', position: new THREE.Vector3(0, 1.2, 0) },
          { name: 'NORTH TURBINE', position: new THREE.Vector3(0, 0, 26) },
          { name: 'EAST CONDUIT', position: new THREE.Vector3(24, 0, 0) },
          { name: 'WEST COOLING CELL', position: new THREE.Vector3(-24, 0, 0) }
        ]
      },

      aiWaypoints: [
        { x: 0, z: 0, name: 'Core Platform' },
        { x: 0, z: -22, name: 'South Chamber' },
        { x: 0, z: 22, name: 'North Chamber' },
        { x: -24, z: 0, name: 'West Conduit Alley' },
        { x: 24, z: 0, name: 'East Turbine Row' },
        { x: -22, z: -24, name: 'SW Generator Bank' },
        { x: 22, z: -24, name: 'SE Generator Bank' },
        { x: -22, z: 24, name: 'NW Containment Cell' },
        { x: 22, z: 24, name: 'NE Containment Cell' },
        { x: 0, z: -44, name: 'South Blast Doors' },
        { x: 0, z: 44, name: 'North Blast Doors' }
      ]
    }
  };

  class ArenaRegistry {
    static get(arenaId) {
      return ARENAS[arenaId] || ARENAS.NEON_FORGE;
    }

    static getAll() {
      return Object.values(ARENAS);
    }

    static getRandom(modeId) {
      const valid = Object.values(ARENAS).filter(a => {
        return !modeId || a.recommendedModes.includes(modeId);
      });
      const idx = Math.floor(Math.random() * valid.length);
      return valid[idx] || ARENAS.NEON_FORGE;
    }
  }

  IT.ArenaRegistry = ArenaRegistry;
})(window.IT);
