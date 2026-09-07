/**
 * MapLoader.js — Iron Titans
 * Defines all arena maps with tile grids, obstacles, spawn points,
 * capture zones, and hazard regions. Exposes window.IT.MapLoader.
 *
 * Tile legend:
 *   0 = floor
 *   1 = wall (solid, impassable)
 *   2 = hazard tile (lava / electrified)
 *   3 = slow tile  (water / mud)
 *   4 = destructible cover
 */

(function (IT) {
  'use strict';

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  /** Map compact chars to tile values */
  function expandRow(str) {
    const map = { '.': 0, '#': 1, 'H': 2, 'S': 3, 'D': 4 };
    return str.split('').map(c => (map[c] !== undefined ? map[c] : 0));
  }

  /**
   * Build a flat 1200-element tile array from 30 row-strings (each exactly 40 chars).
   * Any row shorter than 40 is right-padded with floor ('.'); longer rows are truncated.
   */
  function buildGrid(rows) {
    const tiles = [];
    for (let r = 0; r < 30; r++) {
      let rowStr = (rows[r] || '').slice(0, 40).padEnd(40, '.');
      const row = expandRow(rowStr);
      for (let c = 0; c < 40; c++) tiles.push(row[c]);
    }
    return tiles;
  }

  const TILE = 40; // pixels per tile

  // ──────────────────────────────────────────────────────────────────────────
  // MAP 1 — Forge Nexus  (industrial, lava channels)
  // ──────────────────────────────────────────────────────────────────────────
  // 40 cols × 30 rows. '#'=wall, '.'=floor, 'H'=lava-hazard, 'D'=destructible
  const FORGE_ROWS = [
    '########################################', // 0
    '#......................................#', // 1
    '#.####.##########.########.####.####..#', // 2
    '#.#....#........#.#......#.#....#...#.#', // 3
    '#.#.##.#.######.#.#.####.#.#.##.###.#.#', // 4
    '#.#.#..#.#....#.#.#.#....#.#.#..#...#.#', // 5
    '#...#..#.#.HH.#...#.HH.#..#.#.......#.#', // 6
    '#.###..###.HH.###.#.HH.###.###.###.##.#', // 7
    '#.#..........###.....###...........#...#', // 8
    '#.#.D..D.....###.....###.....D..D..#...#', // 9
    '#.#..........####...####...........#...#', // 10
    '#.####.###.##....#####....##.###.####..#', // 11
    '#............HHHHHHHHHHHHHH............#', // 12 lava channel top
    '##...####.##.HHHHHHHHHHHHHH.##.####....#', // 13 lava channel top
    '#....#....##....######....##.#.........#', // 14
    '#....#....##....######....##.#.........#', // 15
    '##...####.##.HHHHHHHHHHHHHH.##.####....#', // 16 lava channel bot
    '#............HHHHHHHHHHHHHH............#', // 17 lava channel bot
    '#.####.###.##....#####....##.###.####..#', // 18
    '#.#..........####...####...........#...#', // 19
    '#.#.D..D.....###.....###.....D..D..#...#', // 20
    '#.#..........###.....###...........#...#', // 21
    '#.###..###.HH.###.#.HH.###.###.###.##.#', // 22
    '#...#..#.#.HH.#...#.HH.#..#.#.......#.#', // 23
    '#.#.#..#.#....#.#.#.#....#.#.#..#...#.#', // 24
    '#.#.##.#.######.#.#.####.#.#.##.###.#.#', // 25
    '#.#....#........#.#......#.#....#...#.#', // 26
    '#.####.##########.########.####.####..#', // 27
    '#......................................#', // 28
    '########################################', // 29
  ];

  const MAP_FORGE_NEXUS = {
    id: 'forgeNexus',
    name: 'Forge Nexus',
    theme: 'industrial',
    bgColor: '#1a0f08',
    floorColor: '#2a1a10',
    wallColor: '#5a3a20',
    accentColor: '#ff6600',
    tiles: buildGrid(FORGE_ROWS),
    obstacles: [],
    spawnPoints: [
      { x: 3  * TILE + 20, y: 14 * TILE + 20, team: 0 },
      { x: 3  * TILE + 20, y: 15 * TILE + 20, team: 0 },
      { x: 36 * TILE + 20, y: 14 * TILE + 20, team: 1 },
      { x: 36 * TILE + 20, y: 15 * TILE + 20, team: 1 },
    ],
    zones: [
      { id: 'A', x: 10 * TILE, y: 14 * TILE + 20, r: 80 },
      { id: 'B', x: 20 * TILE, y:  8 * TILE,       r: 80 },
      { id: 'C', x: 30 * TILE, y: 14 * TILE + 20,  r: 80 },
    ],
    hazards: [
      {
        id: 'lava_top',
        x: 13 * TILE, y: 12 * TILE,
        w: 14 * TILE, h:  2 * TILE,
        type: 'lava', damage: 20, interval: 0.5, slowFactor: 0,
      },
      {
        id: 'lava_bot',
        x: 13 * TILE, y: 16 * TILE,
        w: 14 * TILE, h:  2 * TILE,
        type: 'lava', damage: 20, interval: 0.5, slowFactor: 0,
      },
    ],
    description: 'A roaring industrial factory bisected by rivers of molten metal. ' +
                 'Control the central catwalks — but mind the lava channels.',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // MAP 2 — Crystal Spire  (alien planet, destructible crystal pillars)
  // ──────────────────────────────────────────────────────────────────────────
  const CRYSTAL_ROWS = [
    '########################################', //  0
    '#......................................#', //  1
    '#..##..................................#', //  2
    '#..##..DD......................DD..##..#', //  3 blue spawn area top-left
    '#......DD......................DD......#', //  4
    '#......................................#', //  5
    '#....DD......####....####......DD.....#', //  6
    '#....DD......#..#....#..#......DD.....#', //  7
    '#............#..#....#..#.............#', //  8
    '#............####....####.............#', //  9
    '#......................................#', // 10
    '#...####.......DD........DD.......####.#', // 11
    '#...#..#.......DD........DD.......#..#.#', // 12
    '#...#..#...............................#', // 13  -- intentionally open centre
    '#...####...............................#', // 14
    '#......................................#', // 15
    '#...####...............................#', // 16
    '#...#..#.......DD........DD.......#..#.#', // 17
    '#...#..#.......DD........DD.......#..#.#', // 18
    '#...####.......DD........DD.......####.#', // 19
    '#......................................#', // 20
    '#............####....####.............#', // 21
    '#............#..#....#..#.............#', // 22
    '#....DD......#..#....#..#......DD.....#', // 23
    '#....DD......####....####......DD.....#', // 24
    '#......................................#', // 25
    '#......DD......................DD......#', // 26
    '#..##..DD......................DD..##..#', // 27  red spawn area bottom-right
    '#......................................#', // 28
    '########################################', // 29
  ];

  const MAP_CRYSTAL_SPIRE = {
    id: 'crystalSpire',
    name: 'Crystal Spire',
    theme: 'alien',
    bgColor: '#080818',
    floorColor: '#0d0d2a',
    wallColor: '#3030aa',
    accentColor: '#cc44ff',
    tiles: buildGrid(CRYSTAL_ROWS),
    obstacles: [],
    spawnPoints: [
      { x: 4  * TILE, y:  3 * TILE + 20, team: 0 },
      { x: 6  * TILE, y:  3 * TILE + 20, team: 0 },
      { x: 34 * TILE, y: 26 * TILE + 20, team: 1 },
      { x: 36 * TILE, y: 26 * TILE + 20, team: 1 },
    ],
    zones: [
      { id: 'A', x: 20 * TILE, y:  5 * TILE, r: 90 },
      { id: 'B', x:  8 * TILE, y: 22 * TILE, r: 90 },
      { id: 'C', x: 32 * TILE, y: 22 * TILE, r: 90 },
    ],
    hazards: [],
    description: 'An alien crystalline plateau dotted with prismatic pillars. ' +
                 'Shatter enemy cover and hold three scattered control spires.',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // MAP 3 — Sunken Citadel  (flooded ruins, water slows movement)
  // ──────────────────────────────────────────────────────────────────────────
  const CITADEL_ROWS = [
    '########################################', //  0
    '#......................................#', //  1
    '#.##...................................#', //  2
    '#.##...####........................##..#', //  3 blue top-left spawn
    '#......#..#........................##..#', //  4
    '#......#..#....SSSSSSSSSSSSS..........#', //  5
    '#......####....SSSSSSSSSSSSS..........#', //  6
    '#..............SSSSSSSSSSSSS..........#', //  7
    '#.....##.......SSSSSSSSSSSSS......##..#', //  8
    '#.....##.......SSSSSSSSSSSSS......##..#', //  9
    '#..##..........SSSSSSSSSSSSS...........#', // 10
    '#..##..SSSSSSSSSSSSSSSSSSSSSSSSSSSS....#', // 11 water moat
    '#......SSSSSSSSSSSSSSSSSSSSSSSSSSSS....#', // 12 water moat
    '#......SSSSSSSSSSSSSSSSSSSSSSSSSSSS....#', // 13 water moat
    '#......SSSSSSSSSSSSSSSSSSSSSSSSSSSS....#', // 14 water moat
    '#......SSSSSSSSSSSSSSSSSSSSSSSSSSSS....#', // 15 water moat
    '#......SSSSSSSSSSSSSSSSSSSSSSSSSSSS....#', // 16 water moat
    '#......SSSSSSSSSSSSSSSSSSSSSSSSSSSS....#', // 17 water moat
    '#..##..SSSSSSSSSSSSSSSSSSSSSSSSSSSS....#', // 18 water moat
    '#..##..........SSSSSSSSSSSSS...........#', // 19
    '#.....##.......SSSSSSSSSSSSS......##..#', // 20
    '#.....##.......SSSSSSSSSSSSS......##..#', // 21
    '#..............SSSSSSSSSSSSS..........#', // 22
    '#......####....SSSSSSSSSSSSS..........#', // 23
    '#......#..#....SSSSSSSSSSSSS..........#', // 24
    '#......#..#........................##..#', // 25
    '#......####........................##..#', // 26  red bottom-right spawn
    '#......................................#', // 27
    '#......................................#', // 28
    '########################################', // 29
  ];

  const MAP_SUNKEN_CITADEL = {
    id: 'sunkenCitadel',
    name: 'Sunken Citadel',
    theme: 'ruins',
    bgColor: '#060d10',
    floorColor: '#0a1a20',
    wallColor: '#1a3040',
    accentColor: '#00ccff',
    tiles: buildGrid(CITADEL_ROWS),
    obstacles: [],
    spawnPoints: [
      { x:  3 * TILE + 20, y:  3 * TILE + 20, team: 0 },
      { x:  3 * TILE + 20, y:  4 * TILE + 20, team: 0 },
      { x: 36 * TILE + 20, y: 25 * TILE + 20, team: 1 },
      { x: 36 * TILE + 20, y: 26 * TILE + 20, team: 1 },
    ],
    zones: [
      { id: 'A', x: 20 * TILE, y:  4 * TILE, r: 80 },
      { id: 'B', x: 20 * TILE, y: 15 * TILE, r: 80 },
      { id: 'C', x: 20 * TILE, y: 25 * TILE, r: 80 },
    ],
    hazards: [
      {
        id: 'water_moat',
        x:  6 * TILE, y: 11 * TILE,
        w: 28 * TILE, h:  8 * TILE,
        type: 'water', damage: 0, interval: 0, slowFactor: 0.5,
      },
      {
        id: 'water_col_top',
        x: 14 * TILE, y:  5 * TILE,
        w: 13 * TILE, h:  6 * TILE,
        type: 'water', damage: 0, interval: 0, slowFactor: 0.5,
      },
      {
        id: 'water_col_bot',
        x: 14 * TILE, y: 19 * TILE,
        w: 13 * TILE, h:  6 * TILE,
        type: 'water', damage: 0, interval: 0, slowFactor: 0.5,
      },
    ],
    description: 'Ancient ruins half-submerged in dark water. ' +
                 'The flooded moat slows all units — cross at your own risk.',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // All maps registry
  // ──────────────────────────────────────────────────────────────────────────

  const ALL_MAPS = [MAP_FORGE_NEXUS, MAP_CRYSTAL_SPIRE, MAP_SUNKEN_CITADEL];

  // ──────────────────────────────────────────────────────────────────────────
  // MapLoader class
  // ──────────────────────────────────────────────────────────────────────────

  class MapLoader {

    /**
     * Returns the map definition for a given id, or null.
     * @param {string} id
     * @returns {Object|null}
     */
    static getMap(id) {
      return ALL_MAPS.find(m => m.id === id) || null;
    }

    /**
     * Returns an array of all map definition objects (shallow copy).
     * @returns {Object[]}
     */
    static getAllMaps() {
      return ALL_MAPS.slice();
    }

    /**
     * Converts the tile grid of mapDef into an array of AABB obstacle objects.
     * Consecutive wall tiles in the same row are merged into horizontal spans.
     * Destructible tiles produce separate obstacle entries with independent hp.
     *
     * @param {Object} mapDef
     * @returns {Array<{x,y,w,h,type,hp,maxHp}>}
     */
    static buildObstacles(mapDef) {
      const { tiles } = mapDef;
      const COLS = 40;
      const ROWS = 30;
      const obstacles = [];
      const merged = new Uint8Array(COLS * ROWS);

      for (let row = 0; row < ROWS; row++) {
        let col = 0;
        while (col < COLS) {
          const idx  = row * COLS + col;
          const tile = tiles[idx];

          // ── Solid walls: horizontal-span merge ──
          if (tile === 1 && !merged[idx]) {
            const spanStart = col;
            while (col < COLS && tiles[row * COLS + col] === 1 && !merged[row * COLS + col]) {
              merged[row * COLS + col] = 1;
              col++;
            }
            obstacles.push({
              x: spanStart * TILE,
              y: row * TILE,
              w: (col - spanStart) * TILE,
              h: TILE,
              type: 'wall',
              hp: -1,     // indestructible
              maxHp: -1,
            });

          // ── Destructible cover — kept individual for independent HP ──
          } else if (tile === 4 && !merged[idx]) {
            merged[idx] = 1;
            obstacles.push({
              x: col * TILE,
              y: row * TILE,
              w: TILE,
              h: TILE,
              type: 'destructible',
              hp: 150,
              maxHp: 150,
            });
            col++;

          } else {
            col++;
          }
        }
      }

      return obstacles;
    }

    /**
     * Returns the world-space spawn position for a given team and player index.
     * index is 0 or 1 (up to 2 spawns per team).
     *
     * @param {Object} mapDef
     * @param {number} team   0=Blue, 1=Red
     * @param {number} index  0 or 1
     * @returns {{x:number, y:number}}
     */
    static getSpawnPoint(mapDef, team, index) {
      const teamSpawns = mapDef.spawnPoints.filter(sp => sp.team === team);
      if (teamSpawns.length === 0) {
        const fx = team === 0 ? 3 * TILE + 20 : 36 * TILE + 20;
        return { x: fx, y: (14 + index) * TILE + 20 };
      }
      const sp = teamSpawns[index % teamSpawns.length];
      return { x: sp.x, y: sp.y };
    }

    /**
     * Returns the tile type (0-4) at a given world position.
     * Returns 1 (wall) for out-of-bounds coordinates.
     *
     * @param {Object} mapDef
     * @param {number} wx  world X
     * @param {number} wy  world Y
     * @returns {number}
     */
    static getTileAt(mapDef, wx, wy) {
      const col = Math.floor(wx / TILE);
      const row = Math.floor(wy / TILE);
      if (col < 0 || col >= 40 || row < 0 || row >= 30) return 1;
      return mapDef.tiles[row * 40 + col];
    }

    /**
     * Returns the first hazard whose AABB contains (wx, wy), or null.
     *
     * @param {Object} mapDef
     * @param {number} wx
     * @param {number} wy
     * @returns {Object|null}
     */
    static getHazardAt(mapDef, wx, wy) {
      for (const h of mapDef.hazards) {
        if (wx >= h.x && wx < h.x + h.w && wy >= h.y && wy < h.y + h.h) {
          return h;
        }
      }
      return null;
    }

    /**
     * Returns the capture zone whose radius contains (wx, wy), or null.
     *
     * @param {Object} mapDef
     * @param {number} wx
     * @param {number} wy
     * @returns {Object|null}
     */
    static getZoneAt(mapDef, wx, wy) {
      for (const z of mapDef.zones) {
        const dx = wx - z.x;
        const dy = wy - z.y;
        if (dx * dx + dy * dy <= z.r * z.r) return z;
      }
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pre-build obstacles for all maps now that the class is available.
  // ──────────────────────────────────────────────────────────────────────────
  ALL_MAPS.forEach(m => { m.obstacles = MapLoader.buildObstacles(m); });

  // ──────────────────────────────────────────────────────────────────────────
  // Expose
  // ──────────────────────────────────────────────────────────────────────────
  IT.MapLoader = MapLoader;

})(window.IT = window.IT || {});
